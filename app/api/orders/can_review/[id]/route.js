import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import Order from "@/backend/models/order";
import Product from "@/backend/models/product";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import {
  isAuthenticatedUser,
  extractUserInfoFromRequest,
} from "@/lib/auth-utils";

/**
 * GET /api/orders/can_review/[id]
 * Vérifie si un utilisateur peut laisser un avis sur un produit
 * Condition: L'utilisateur doit avoir commandé le produit
 * Rate limit: Configuration intelligente - authenticatedRead (200 req/min)
 */
export const GET = withIntelligentRateLimit(
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

      // Vérifier que le produit existe
      const product = await Product.findById(id).select("_id name isActive");
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

      // Vérifier si le produit est actif
      if (!product.isActive) {
        return NextResponse.json(
          {
            success: false,
            message: "Product is not active",
            code: "PRODUCT_INACTIVE",
            data: {
              canReview: false,
            },
          },
          { status: 200 },
        );
      }

      // Chercher les commandes de l'utilisateur contenant ce produit
      // ✅ authUser.id est castée automatiquement en ObjectId par Mongoose
      const orders = await Order.find({
        "user.userId": authUser.id,
        "orderItems.product": id,
      }).lean();

      // Vérifier si l'utilisateur a commandé le produit
      const canReview = orders && orders.length > 0;

      // Log pour audit (optionnel, en dev seulement)
      if (process.env.NODE_ENV === "development") {
        console.log("Can review check:", {
          userId: authUser.id,
          productId: id,
          canReview,
          ordersCount: orders.length,
        });
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            canReview: canReview,
            meta: {
              timestamp: new Date().toISOString(),
            },
          },
        },
        { status: 200 },
      );
    } catch (error) {
      console.error("Can review check error:", error.message);

      const isAuthError =
        error.message?.includes("authentication") ||
        error.message === "Authentication required";

      // Capturer les erreurs non-validation
      if (error.name !== "CastError" && !isAuthError) {
        captureException(error, {
          tags: {
            component: "api",
            route: "orders/can_review/[id]/GET",
          },
          extra: {
            errorName: error.name,
            errorMessage: error.message,
          },
        });
      }

      let status = 500;
      let message = "Failed to check review eligibility";
      let code = "INTERNAL_ERROR";

      if (error.name === "CastError") {
        status = 400;
        message = "Invalid ID format";
        code = "INVALID_ID_FORMAT";
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
          }),
        },
        { status },
      );
    }
  },
  {
    category: "api",
    action: "authenticatedRead",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
