// app/api/v1/me/update/route.js

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { validateProfileContact } from "@/helpers/validation/schemas/user";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import { getAuth } from "@/lib/auth";
import {
  extractUserInfoFromRequest,
  isAuthenticatedUser,
} from "@/lib/auth-utils";

/**
 * PUT /api/v1/me/update
 * Version mobile : met à jour le profil utilisateur (phone + adresse)
 * via Better Auth.
 * Rate limit: api.write (30 req/min pour utilisateurs authentifiés)
 */
export const PUT = withIntelligentRateLimit(
  async function (req) {
    try {
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
          { success: false, message: "Account is deactivated" },
          { status: 403 },
        );
      }

      let profileData;
      try {
        profileData = await req.json();
      } catch (error) {
        return NextResponse.json(
          { success: false, message: "Invalid request body" },
          { status: 400 },
        );
      }

      const validation = await validateProfileContact(profileData);

      if (!validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            message: "Validation failed",
            errors: validation.errors,
          },
          { status: 400 },
        );
      }

      const allowedFields = ["phone", "address"];
      const updateData = {};

      allowedFields.forEach((field) => {
        if (validation.data[field] !== undefined) {
          updateData[field] = validation.data[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { success: false, message: "No fields to update" },
          { status: 400 },
        );
      }

      const auth = await getAuth();

      const updatedUser = await auth.api.updateUser({
        body: updateData,
        headers: await headers(),
      });

      if (!updatedUser) {
        return NextResponse.json(
          { success: false, message: "Update failed" },
          { status: 500 },
        );
      }

      // Invalider le cache de session en le récupérant sans cache
      await auth.api.getSession({
        query: {
          disableCookieCache: true,
        },
        headers: await headers(),
      });

      const response = NextResponse.json(
        {
          success: true,
          message: "Profile updated successfully",
          data: {
            updatedUser: {
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              phone: updatedUser.phone,
              avatar: updatedUser.avatar,
              address: updatedUser.address,
              role: updatedUser.role,
              isActive: updatedUser.isActive || true,
            },
          },
        },
        { status: 200 },
      );

      response.headers.set("X-Session-Updated", "true");

      return response;
    } catch (error) {
      console.error("Profile update error:", error.message);

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

      if (error.name !== "ValidationError") {
        captureException(error, {
          tags: { component: "api", route: "v1/me/update" },
        });
      }

      return NextResponse.json(
        {
          success: false,
          message:
            error.name === "ValidationError"
              ? "Invalid profile data"
              : "Something went wrong",
        },
        { status: error.name === "ValidationError" ? 400 : 500 },
      );
    }
  },
  {
    category: "api",
    action: "write",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
