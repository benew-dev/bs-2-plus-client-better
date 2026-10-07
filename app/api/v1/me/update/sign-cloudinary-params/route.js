// app/api/v1/me/update/sign-cloudinary-params/route.js

import { NextResponse } from "next/server";
import cloudinary from "cloudinary";
import dbConnect from "@/backend/config/dbConnect";
import { captureException, captureMessage } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import {
  extractUserInfoFromRequest,
  isAuthenticatedUser,
} from "@/lib/auth-utils";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * POST /api/v1/me/update/sign-cloudinary-params
 * Version mobile : signe les paramètres pour l'upload Cloudinary sécurisé
 * (avatar depuis l'app Expo, upload direct via l'API REST Cloudinary avec
 * la signature retournée).
 * Rate limit: api.upload (10 req/5min, strict)
 */
export const POST = withIntelligentRateLimit(
  async function (req) {
    try {
      if (
        !process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ||
        !process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
      ) {
        captureMessage("Cloudinary configuration missing", {
          level: "error",
          tags: { component: "api", route: "v1/sign-cloudinary-params" },
        });

        return NextResponse.json(
          {
            success: false,
            message: "Server configuration error",
          },
          { status: 500 },
        );
      }

      const user = await isAuthenticatedUser();

      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: "User not found",
            code: "USER_NOT_FOUND",
          },
          { status: 404 },
        );
      }

      if (user.isActive === false) {
        return NextResponse.json(
          {
            success: false,
            message: "Account is deactivated",
          },
          { status: 403 },
        );
      }

      await dbConnect();

      let body;
      try {
        body = await req.json();
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid request body",
          },
          { status: 400 },
        );
      }

      if (
        !body ||
        !body.paramsToSign ||
        typeof body.paramsToSign !== "object"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Missing or invalid paramsToSign",
          },
          { status: 400 },
        );
      }

      const { paramsToSign } = body;

      paramsToSign.folder = "buyitnow/avatars";

      let signature;
      try {
        signature = cloudinary.utils.api_sign_request(
          paramsToSign,
          process.env.CLOUDINARY_API_SECRET,
        );
      } catch (error) {
        console.error("Cloudinary signature error:", error);

        captureException(error, {
          tags: {
            component: "api",
            route: "v1/sign-cloudinary-params",
            action: "signature_generation",
          },
          extra: {
            userId: user.id,
          },
        });

        return NextResponse.json(
          {
            success: false,
            message: "Failed to generate signature",
          },
          { status: 500 },
        );
      }

      if (process.env.NODE_ENV === "production") {
        console.info("Cloudinary signature generated", {
          userId: user.id.toString().substring(0, 8) + "...",
          folder: paramsToSign.folder,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log("Cloudinary params signed:", {
          userId: user.id,
          folder: paramsToSign.folder,
          publicId: paramsToSign.public_id,
        });
      }

      return NextResponse.json(
        {
          success: true,
          message: "Signature generated successfully",
          signature,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Content-Type": "application/json",
          },
        },
      );
    } catch (error) {
      console.error("Sign cloudinary params error:", error);

      // NOUVEAU (absent du fichier source) : détection explicite de
      // l'erreur d'authentification, par cohérence avec les autres routes
      // v1 — sans ça, un appel non authentifié retombe en 500 au lieu de 401.
      if (
        error.message?.includes("authentication") ||
        error.message === "Authentication required"
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "Authentication failed",
            code: "AUTH_FAILED",
          },
          { status: 401 },
        );
      }

      captureException(error, {
        tags: {
          component: "api",
          route: "v1/sign-cloudinary-params",
        },
        extra: {
          errorName: error.name,
        },
      });

      const errorMessage =
        process.env.NODE_ENV === "production"
          ? "Something went wrong"
          : error.message || "Internal server error";

      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
        },
        { status: error.status || 500 },
      );
    }
  },
  {
    category: "api",
    action: "upload",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
