// app/api/v1/category/route.js

import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import Category from "@/backend/models/category";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import { extractUserInfoFromRequest } from "@/lib/auth-utils";

/**
 * GET /api/v1/category
 * Version mobile : récupère toutes les catégories actives (tous types
 * confondus — distinct des catégories scopées par type renvoyées avec
 * /api/v1/products).
 * Route publique. Rate limit: publicRead (100 req/min) ou authenticatedRead (200 req/min)
 */
export const GET = withIntelligentRateLimit(
  async function (req) {
    try {
      await dbConnect();

      const categories = await Category.find({ isActive: true })
        .select("categoryName")
        .sort({ categoryName: 1 })
        .lean();

      if (!categories || categories.length === 0) {
        return NextResponse.json(
          {
            success: true,
            message: "No categories available",
            data: {
              categories: [],
              count: 0,
              meta: {
                timestamp: new Date().toISOString(),
                cached: false,
              },
            },
          },
          { status: 200 },
        );
      }

      const formattedCategories = categories.map((cat) => ({
        _id: cat._id,
        name: cat.categoryName,
      }));

      const dataHash = Buffer.from(JSON.stringify(formattedCategories))
        .toString("base64")
        .substring(0, 20);

      return NextResponse.json(
        {
          success: true,
          data: {
            categories: formattedCategories,
            count: formattedCategories.length,
            meta: {
              timestamp: new Date().toISOString(),
              etag: dataHash,
              cached: true,
              cacheMaxAge: 300,
            },
          },
        },
        { status: 200 },
      );
    } catch (error) {
      console.error("Categories fetch error:", error.message);

      captureException(error, {
        tags: {
          component: "api",
          route: "v1/category/GET",
          error_type: error.name,
        },
        extra: {
          message: error.message,
          stack: error.stack,
        },
      });

      let status = 500;
      let message = "Failed to fetch categories";
      let code = "INTERNAL_ERROR";

      if (
        error.name === "MongoNetworkError" ||
        error.message?.includes("connection")
      ) {
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
    action: "publicRead",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
