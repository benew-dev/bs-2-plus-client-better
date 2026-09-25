import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import HomePage from "@/backend/models/homepage";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import { extractUserInfoFromRequest } from "@/lib/auth-utils";

/**
 * GET /api/homepage
 * Récupère les données de la page d'accueil
 * Rate limit: Configuration intelligente - publicRead (100 req/min) ou authenticatedRead (200 req/min)
 *
 * Headers de sécurité gérés par next.config.mjs pour /api/homepage :
 * - Cache-Control: public, max-age=3600, stale-while-revalidate=7200
 * - CDN-Cache-Control: max-age=7200
 * - X-Content-Type-Options: nosniff
 * - Vary: Accept-Encoding
 *
 * Note: Les données de la homepage sont publiques avec cache long
 * car elles changent rarement
 */
export const GET = withIntelligentRateLimit(
  async function (req) {
    try {
      // Connexion DB
      await dbConnect();

      // Récupérer la page d'accueil (prendre la plus récente)
      const homePage = await HomePage.findOne()
        .select("title subtitle text image")
        .sort({ createdAt: -1 })
        .lean();

      // Si aucune page d'accueil n'existe
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

      // Formater la réponse
      const formattedHomePage = {
        title: homePage.title,
        subtitle: homePage.subtitle,
        text: homePage.text,
        image: {
          publicId: homePage.image?.public_id || "",
          url: homePage.image?.url || "",
        },
      };

      // Calculer un hash simple pour l'ETag (optionnel)
      const dataHash = Buffer.from(JSON.stringify(formattedHomePage))
        .toString("base64")
        .substring(0, 20);

      // Headers de cache pour la homepage (change rarement)
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
          route: "homepage/GET",
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
