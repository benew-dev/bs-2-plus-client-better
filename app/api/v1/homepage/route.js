// app/api/v1/homepage/route.js
// CORRIGÉ : la route lisait encore les anciens champs plats
// (title/subtitle/text/image) qui n'existent plus sur le document — le
// modèle stocke maintenant un tableau "sections". La route renvoyait donc
// {title: undefined, subtitle: undefined, ...} et jamais de "sections",
// ce qui faisait retomber le Hero (carrousel) sur ses valeurs par défaut
// à chaque appel, quoi qu'il y ait en base.

import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import HomePage from "@/backend/models/homepage";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import { extractUserInfoFromRequest } from "@/lib/auth-utils";

export const GET = withIntelligentRateLimit(
  async function (req) {
    try {
      await dbConnect();

      // CORRIGÉ : select("sections") au lieu de select("title subtitle text image")
      const homePage = await HomePage.findOne()
        .select("sections")
        .sort({ createdAt: -1 })
        .lean();

      if (!homePage || !homePage.sections || homePage.sections.length === 0) {
        return NextResponse.json(
          {
            success: true,
            message: "No homepage configured",
            data: { sections: [] },
            meta: {
              timestamp: new Date().toISOString(),
              hasData: false,
            },
          },
          { status: 200 },
        );
      }

      // CORRIGÉ : on formate chaque section du tableau, pas un objet unique
      const formattedSections = homePage.sections.map((section) => ({
        title: section.title,
        subtitle: section.subtitle,
        text: section.text,
        image: {
          publicId: section.image?.public_id || "",
          url: section.image?.url || "",
        },
      }));

      const dataHash = Buffer.from(JSON.stringify(formattedSections))
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
          // CORRIGÉ : data.sections (tableau), plus un objet plat
          data: { sections: formattedSections },
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

      const isAuthError = error.message === "Authentication required";

      if (!isAuthError) {
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
      }

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
