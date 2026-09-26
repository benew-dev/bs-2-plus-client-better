import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import dbConnect from "@/backend/config/dbConnect";
import Product from "@/backend/models/product";
import Type from "@/backend/models/type";
import Category from "@/backend/models/category";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import { extractUserInfoFromRequest } from "@/lib/auth-utils";

/**
 * GET /api/products/[id]
 * Récupère un produit par son ID avec produits similaires
 * Rate limit: Configuration intelligente - publicRead (100 req/min) ou authenticatedRead (200 req/min)
 */
export const GET = withIntelligentRateLimit(
  async function (req, { params }) {
    try {
      const { id } = await params;
      if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid product ID format",
          },
          { status: 400 },
        );
      }

      const mongooseInstance = await dbConnect();

      // ✅ Plus de .populate("reviews.user", ...) : les auteurs d'avis sont
      // des comptes Better Auth, récupérés séparément depuis la collection native "user"
      const product = await Product.findById(id)
        .select(
          "name description price images type category stock sold isActive reviews ratings slug",
        )
        .populate("type", "nom")
        .populate("category", "categoryName")
        .lean();

      if (!product) {
        return NextResponse.json(
          {
            success: false,
            message: "Product not found",
          },
          { status: 404 },
        );
      }

      if (product.reviews && product.reviews.length > 0) {
        const authorIds = [
          ...new Set(
            product.reviews
              .map((review) => review.user)
              .filter(Boolean)
              .map((userId) => userId.toString()),
          ),
        ];

        const objectIds = authorIds
          .map((userId) => {
            try {
              return new ObjectId(userId);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        let authorsMap = new Map();
        if (objectIds.length > 0) {
          try {
            const db = mongooseInstance.connection.getClient().db();
            const authorDocs = await db
              .collection("user")
              .find(
                { _id: { $in: objectIds } },
                { projection: { name: 1, image: 1 } },
              )
              .toArray();

            authorDocs.forEach((doc) => {
              authorsMap.set(doc._id.toString(), {
                name: doc.name,
                image: doc.image || null,
              });
            });
          } catch (authorError) {
            console.warn(
              "Failed to fetch review authors:",
              authorError.message,
            );
          }
        }

        // ✅ Conserver _id (attendu par getUserReview et par convention Mongoose)
        // en plus de name/image résolus depuis la collection Better Auth "user"
        product.reviews = product.reviews.map((review) => ({
          ...review,
          user: review.user
            ? {
                _id: review.user.toString(),
                ...(authorsMap.get(review.user.toString()) || {
                  name: null,
                  image: null,
                }),
              }
            : null,
        }));
      }

      // Récupérer les produits similaires avec ratings
      let sameCategoryProducts = [];
      if (product.category) {
        try {
          sameCategoryProducts = await Product.find({
            category: product.category._id,
            _id: { $ne: id },
            isActive: true,
          })
            .select("name price images ratings slug")
            .limit(4)
            .lean();
        } catch (error) {
          console.warn("Failed to fetch similar products:", error.message);
        }
      }

      const cacheHeaders = {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "CDN-Cache-Control": "max-age=600",
        ETag: `"${product._id}-${product.updatedAt || Date.now()}"`,
        Vary: "Accept-Language",
      };

      return NextResponse.json(
        {
          success: true,
          data: {
            product,
            sameCategoryProducts,
          },
        },
        {
          status: 200,
          headers: cacheHeaders,
        },
      );
    } catch (error) {
      console.error("Product fetch error:", error.message);

      if (error.name !== "CastError") {
        captureException(error, {
          tags: {
            component: "api",
            route: "products/[id]/GET",
          },
        });
      }

      return NextResponse.json(
        {
          success: false,
          message:
            error.name === "CastError"
              ? "Invalid product ID format"
              : "Failed to fetch product",
        },
        { status: error.name === "CastError" ? 400 : 500 },
      );
    }
  },
  {
    category: "api",
    action: "publicRead",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
