import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { ObjectId } from "mongodb";
import dbConnect from "@/backend/config/dbConnect";
import Product from "@/backend/models/product";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import {
  isAuthenticatedUser,
  extractUserInfoFromRequest,
} from "@/lib/auth-utils";

/**
 * POST /api/auth/me/favorites
 * Ajoute ou retire un produit des favoris de l'utilisateur
 * Rate limit: Configuration intelligente - api.write (30 req/min pour utilisateurs authentifiés)
 */
export const POST = withIntelligentRateLimit(
  async function (req) {
    try {
      // Vérifier l'authentification (Better Auth)
      const authUser = await isAuthenticatedUser();

      // Connexion DB — collection native Better Auth ("user", pas le modèle Mongoose "users")
      const mongooseInstance = await dbConnect();
      const db = mongooseInstance.connection.getClient().db();

      // ✅ Le document brut utilise _id (ObjectId), pas un champ "id" séparé
      const userObjectId = new ObjectId(authUser.id);

      const userDoc = await db
        .collection("user")
        .findOne(
          { _id: userObjectId },
          { projection: { email: 1, favorites: 1, isActive: 1 } },
        );

      if (!userDoc) {
        return NextResponse.json(
          {
            success: false,
            message: "User not found",
            code: "USER_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (userDoc.isActive === false) {
        console.warn(
          "Inactive user attempting to manage favorites:",
          userDoc.email,
        );
        return NextResponse.json(
          {
            success: false,
            message: "Account suspended. Cannot manage favorites",
            code: "ACCOUNT_SUSPENDED",
          },
          { status: 403 },
        );
      }

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

      const { productId, productName, action = "toggle" } = body;

      if (!productId || !/^[0-9a-fA-F]{24}$/.test(productId)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid product ID",
            code: "INVALID_PRODUCT_ID",
          },
          { status: 400 },
        );
      }

      if (
        !productName ||
        typeof productName !== "string" ||
        productName.trim() === ""
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Product name is required",
            code: "INVALID_PRODUCT_NAME",
          },
          { status: 400 },
        );
      }

      if (!["add", "remove", "toggle"].includes(action)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid action. Must be 'add', 'remove', or 'toggle'",
            code: "INVALID_ACTION",
          },
          { status: 400 },
        );
      }

      // Vérifier que le produit existe et est actif
      const product = await Product.findById(productId)
        .select("_id name isActive images")
        .lean();

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
            message: "Product is not available",
            code: "PRODUCT_INACTIVE",
          },
          { status: 400 },
        );
      }

      const productImage = product.images?.[0] || {
        public_id: null,
        url: null,
      };

      const currentFavorites = Array.isArray(userDoc.favorites)
        ? userDoc.favorites
        : [];

      const favoriteIndex = currentFavorites.findIndex(
        (fav) => fav.productId?.toString() === productId,
      );
      const isInFavorites = favoriteIndex !== -1;

      let actionPerformed;
      let message;
      let updatedFavorites;

      if (action === "toggle") {
        if (isInFavorites) {
          updatedFavorites = currentFavorites.filter(
            (_, i) => i !== favoriteIndex,
          );
          actionPerformed = "removed";
          message = "Product removed from favorites";
        } else {
          updatedFavorites = [
            ...currentFavorites,
            {
              productId: new ObjectId(productId),
              productName: productName.trim(),
              productImage,
              addedAt: new Date(),
            },
          ];
          actionPerformed = "added";
          message = "Product added to favorites";
        }
      } else if (action === "add") {
        if (isInFavorites) {
          return NextResponse.json(
            {
              success: false,
              message: "Product already in favorites",
              code: "ALREADY_IN_FAVORITES",
            },
            { status: 400 },
          );
        }
        updatedFavorites = [
          ...currentFavorites,
          {
            productId: new ObjectId(productId),
            productName: productName.trim(),
            productImage,
            addedAt: new Date(),
          },
        ];
        actionPerformed = "added";
        message = "Product added to favorites";
      } else {
        // remove
        if (!isInFavorites) {
          return NextResponse.json(
            {
              success: false,
              message: "Product not in favorites",
              code: "NOT_IN_FAVORITES",
            },
            { status: 400 },
          );
        }
        updatedFavorites = currentFavorites.filter(
          (_, i) => i !== favoriteIndex,
        );
        actionPerformed = "removed";
        message = "Product removed from favorites";
      }

      if (updatedFavorites.length > 100) {
        return NextResponse.json(
          {
            success: false,
            message: "Maximum 100 favorites allowed",
            code: "TOO_MANY_FAVORITES",
          },
          { status: 400 },
        );
      }

      // ✅ Écriture directe dans la collection native "user" (Better Auth), via _id
      const updateResult = await db.collection("user").updateOne(
        { _id: userObjectId },
        {
          $set: {
            favorites: updatedFavorites,
            updatedAt: new Date(),
          },
        },
      );

      // ✅ Vérification explicite que l'écriture a bien matché un document
      if (updateResult.matchedCount === 0) {
        console.error(
          "Favorites update matched 0 document for userId:",
          authUser.id,
        );
        return NextResponse.json(
          {
            success: false,
            message: "Failed to update favorites",
            code: "UPDATE_NOT_MATCHED",
          },
          { status: 500 },
        );
      }

      try {
        revalidatePath("/favorites");
        revalidatePath("/shop");
        revalidatePath(`/shop/${productId}`);
      } catch (revalidateError) {
        console.error("Revalidation error:", revalidateError.message);
      }

      console.log("🔒 Security event - Favorite updated:", {
        userId: authUser.id,
        userEmail: userDoc.email,
        productId,
        productName: productName.substring(0, 50),
        action: actionPerformed,
        favoritesCount: updatedFavorites.length,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
      });

      return NextResponse.json(
        {
          success: true,
          message,
          data: {
            action: actionPerformed,
            favorites: updatedFavorites,
            favoritesCount: updatedFavorites.length,
            product: {
              id: productId,
              name: productName,
            },
          },
        },
        { status: 200 },
      );
    } catch (error) {
      console.error("Favorite toggle error:", error.message);

      if (
        error.name !== "ValidationError" &&
        error.name !== "CastError" &&
        !error.message?.includes("authentication") &&
        error.message !== "Authentication required"
      ) {
        captureException(error, {
          tags: {
            component: "api",
            route: "auth/me/favorites",
          },
          level: "error",
        });
      }

      let status = 500;
      let message = "Failed to update favorites";
      let code = "INTERNAL_ERROR";

      if (
        error.message?.includes("authentication") ||
        error.message === "Authentication required"
      ) {
        status = 401;
        message = "Authentication failed";
        code = "AUTH_FAILED";
      } else if (
        error.name === "BSONError" ||
        error.message?.includes("ObjectId")
      ) {
        // ✅ authUser.id n'était pas un ObjectId valide (ex: id généré par Better Auth sous un autre format)
        status = 400;
        message = "Invalid user ID format";
        code = "INVALID_USER_ID_FORMAT";
      } else if (error.name === "ValidationError") {
        status = 400;
        message = "Invalid data";
        code = "VALIDATION_ERROR";
      } else if (error.name === "CastError") {
        status = 400;
        message = "Invalid ID format";
        code = "INVALID_ID_FORMAT";
      } else if (error.message?.includes("connection")) {
        status = 503;
        message = "Database connection error";
        code = "DB_CONNECTION_ERROR";
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
    action: "write",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
