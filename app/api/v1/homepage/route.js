// app/api/v1/homepage/route.js

import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import HomePage from "@/backend/models/homepage";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import { extractUserInfoFromRequest } from "@/lib/auth-utils";

/**
 * GET /api/v1/homepage
 * Version mobile : récupère les données de la page d'accueil.
 * Route publique. Rate limit: publicRead (100 req/min) ou authenticatedRead (200 req/min)
 *
 * Note: Les données de la homepage sont publiques avec cache long
 * car elles changent rarement
 */
export const GET = withIntelligentRateLimit(
  async function (req) {
    try {
      await dbConnect();

      const homePage = await HomePage.findOne()
        .select("title subtitle text image")
        .sort({ createdAt: -1 })
        .lean();

      if (!homePage) {
        return NextResponse.json(
          {
            success: true,
            message: "No homepage configured",
            data: null,
            meta: {
              timestamp: new Date().toISOString(),
              hasData: false,
            },
          },
          { status: 200 },
        );
      }

      const formattedHomePage = {
        title: homePage.title,
        subtitle: homePage.subtitle,
        text: homePage.text,
        image: {
          publicId: homePage.image?.public_id || "",
          url: homePage.image?.url || "",
        },
      };

      const dataHash = Buffer.from(JSON.stringify(formattedHomePage))
        .toString("base64")
        .substring(0, 20);

      const cacheHeaders = {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
        "CDN-Cache-Control": "max-age=7200",
        ETag: `"${dataHash}"`,
      };

      return NextResponse.json(
        {
          success: true,
          data: formattedHomePage,
          meta: {
            timestamp: new Date().toISOString(),
            cached: true,
            cacheMaxAge: 3600,
            etag: dataHash,
            hasData: true,
          },
        },
        {
          status: 200,
          headers: cacheHeaders,
        },
      );
    } catch (error) {
      console.error("HomePage fetch error:", error.message);

      captureException(error, {
        tags: {
          component: "api",
          route: "v1/homepage/GET",
          error_type: error.name,
        },
        extra: {
          message: error.message,
          stack: error.stack,
        },
      });

      let status = 500;
      let message = "Failed to fetch homepage data";
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
