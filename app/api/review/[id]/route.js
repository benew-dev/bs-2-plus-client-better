import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import Product from "@/backend/models/product";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import {
  isAuthenticatedUser,
  extractUserInfoFromRequest,
} from "@/lib/auth-utils";
import sanitizeHtml from "sanitize-html";

/**
 * PUT /api/review/[id]
 * Ajoute ou met à jour un avis sur un produit
 * Rate limit: Configuration intelligente - write (30 req/min)
 */
export const PUT = withIntelligentRateLimit(
  async function (req, { params }) {
    try {
      // Validation de l'ID du produit
      const { id } = await params;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid product ID format",
            code: "INVALID_ID",
          },
          { status: 400 },
        );
      }

      // Vérifier l'authentification (Better Auth)
      const authUser = await isAuthenticatedUser();

      // Connexion DB
      await dbConnect();

      // Parser les données
      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid request body",
            code: "INVALID_BODY",
          },
          { status: 400 },
        );
      }

      const { reviewData } = body;

      if (!reviewData || typeof reviewData !== "object") {
        return NextResponse.json(
          {
            success: false,
            message: "Review data is required",
            code: "MISSING_REVIEW_DATA",
          },
          { status: 400 },
        );
      }

      const { rating, comment, productId } = reviewData;

      if (productId && productId !== id) {
        return NextResponse.json(
          {
            success: false,
            message: "Product ID mismatch",
            code: "PRODUCT_ID_MISMATCH",
          },
          { status: 400 },
        );
      }

      if (rating === undefined || rating === null) {
        return NextResponse.json(
          {
            success: false,
            message: "Rating is required",
            code: "MISSING_RATING",
          },
          { status: 400 },
        );
      }

      const numericRating = Number(rating);

      if (
        isNaN(numericRating) ||
        !Number.isFinite(numericRating) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Rating must be a number between 1 and 5",
            code: "INVALID_RATING",
            data: {
              min: 1,
              max: 5,
              provided: rating,
              type: typeof rating,
            },
          },
          { status: 400 },
        );
      }

      const roundedRating = Math.round(numericRating * 2) / 2;

      if (!comment) {
        return NextResponse.json(
          {
            success: false,
            message: "Comment is required",
            code: "MISSING_COMMENT",
          },
          { status: 400 },
        );
      }

      if (typeof comment !== "string") {
        return NextResponse.json(
          {
            success: false,
            message: "Comment must be a string",
            code: "INVALID_COMMENT_TYPE",
            data: { type: typeof comment },
          },
          { status: 400 },
        );
      }

      const trimmedComment = comment.trim();

      if (trimmedComment.length < 10) {
        return NextResponse.json(
          {
            success: false,
            message: "Comment must be at least 10 characters long",
            code: "COMMENT_TOO_SHORT",
            data: { minLength: 10, currentLength: trimmedComment.length },
          },
          { status: 400 },
        );
      }

      if (trimmedComment.length > 1000) {
        return NextResponse.json(
          {
            success: false,
            message: "Comment must not exceed 1000 characters",
            code: "COMMENT_TOO_LONG",
            data: { maxLength: 1000, currentLength: trimmedComment.length },
          },
          { status: 400 },
        );
      }

      const sanitizedComment = sanitizeHtml(trimmedComment, {
        allowedTags: [],
        allowedAttributes: {},
      });

      if (sanitizedComment.trim().length < 10) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Comment contains invalid characters or is too short after sanitization",
            code: "INVALID_COMMENT_CONTENT",
          },
          { status: 400 },
        );
      }

      // ✅ Récupérer le produit (plus besoin de chercher l'utilisateur via Mongoose,
      // authUser contient déjà id/name/email depuis la session Better Auth)
      const product = await Product.findById(id).select(
        "name reviews ratings isActive",
      );

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            message: "Product not found",
            code: "PRODUCT_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (!product.isActive) {
        return NextResponse.json(
          {
            success: false,
            message: "Cannot review an inactive product",
            code: "PRODUCT_INACTIVE",
          },
          { status: 400 },
        );
      }

      // Vérifier si l'utilisateur a déjà laissé un avis
      const existingReviewIndex = product.reviews.findIndex(
        (review) => review.user.toString() === authUser.id.toString(),
      );

      let isUpdate = false;
      let oldRating = null;

      if (existingReviewIndex !== -1) {
        isUpdate = true;
        oldRating = product.reviews[existingReviewIndex].rating;

        product.reviews[existingReviewIndex] = {
          user: authUser.id,
          rating: roundedRating,
          comment: sanitizedComment,
          createdAt: product.reviews[existingReviewIndex].createdAt,
          updatedAt: new Date(),
        };
      } else {
        product.reviews.push({
          user: authUser.id,
          rating: roundedRating,
          comment: sanitizedComment,
          createdAt: new Date(),
        });
      }

      // Recalculer la note moyenne avec une décimale
      const totalReviews = product.reviews.length;
      const sumRatings = product.reviews.reduce(
        (sum, review) => sum + review.rating,
        0,
      );
      product.ratings = Math.round((sumRatings / totalReviews) * 10) / 10;

      await product.save();

      // Log de sécurité pour audit
      console.log("🔒 Security event - Product review added/updated:", {
        userId: authUser.id,
        userName: authUser.name,
        productId: id,
        productName: product.name,
        rating: roundedRating,
        isUpdate,
        oldRating,
        newAverageRating: product.ratings,
        totalReviews,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
      });

      return NextResponse.json(
        {
          success: true,
          message: isUpdate
            ? "Review updated successfully"
            : "Review added successfully",
          data: {
            review: {
              rating: roundedRating,
              comment: sanitizedComment,
              user: {
                id: authUser.id,
                name: authUser.name,
              },
              createdAt: isUpdate
                ? product.reviews[existingReviewIndex].createdAt
                : new Date(),
              updatedAt: isUpdate ? new Date() : undefined,
            },
            product: {
              id: product._id,
              name: product.name,
              ratings: product.ratings,
              totalReviews: product.reviews.length,
            },
            meta: {
              isUpdate,
              ...(isUpdate && { previousRating: oldRating }),
              timestamp: new Date().toISOString(),
            },
          },
        },
        { status: isUpdate ? 200 : 201 },
      );
    } catch (error) {
      console.error("Review PUT error:", error.message);

      const isAuthError =
        error.message?.includes("authentication") ||
        error.message === "Authentication required";

      if (
        error.name !== "CastError" &&
        error.name !== "ValidationError" &&
        !isAuthError
      ) {
        captureException(error, {
          tags: {
            component: "api",
            route: "review/[id]/PUT",
          },
          extra: {
            errorName: error.name,
            errorMessage: error.message,
          },
        });
      }

      let status = 500;
      let message = "Failed to add/update review";
      let code = "INTERNAL_ERROR";

      if (error.name === "CastError") {
        status = 400;
        message = "Invalid ID format";
        code = "INVALID_ID_FORMAT";
      } else if (error.name === "ValidationError") {
        status = 400;
        message = "Validation error";
        code = "VALIDATION_ERROR";
      } else if (isAuthError) {
        status = 401;
        message = "Authentication failed";
        code = "AUTH_FAILED";
      } else if (error.message?.includes("connection")) {
        status = 503;
        message = "Database connection error";
        code = "DB_CONNECTION_ERROR";
      } else if (error.message?.includes("timeout")) {
        status = 504;
        message = "Request timeout";
        code = "TIMEOUT";
      }

      return NextResponse.json(
        {
          success: false,
          message,
          code,
          ...(process.env.NODE_ENV === "development" && {
            error: error.message,
            stack: error.stack,
          }),
        },
        { status },
      );
    }
  },
  {
    category: "api",
    action: "write",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
