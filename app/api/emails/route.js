// app/api/emails/route.js

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { validateContactMessage } from "@/helpers/validation/schemas/contact";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import {
  getAuthenticatedUser,
  extractUserInfoFromRequest,
} from "@/lib/auth-utils";
import sanitizeHtml from "sanitize-html";

const resend = new Resend(process.env.RESEND_API_KEY);

const sanitizePlain = (value) =>
  sanitizeHtml(value || "", { allowedTags: [], allowedAttributes: {} });

const sanitizeRich = (value) =>
  sanitizeHtml(value || "", {
    allowedTags: ["b", "i", "em", "strong", "p", "br"],
    allowedAttributes: {},
  });

/**
 * POST /api/emails
 * Envoie un email de contact — fonctionne pour les utilisateurs connectés
 * (nom/email dérivés de la session, non falsifiables) et non connectés
 * (nom/email fournis dans le corps de la requête, validés via Yup).
 * Rate limit: 2 emails par 30 minutes par IP (protection anti-spam)
 */
export const POST = withIntelligentRateLimit(
  async function (req) {
    try {
      // ✅ Vérification "douce" : retourne null si non connecté, ne lève pas
      const authUser = await getAuthenticatedUser();
      const isAuthenticated = !!authUser;

      // Parser le body
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

      const { subject, message } = body;

      let sanitizedName;
      let sanitizedEmail;
      let sanitizedSubject;
      let sanitizedMessage;

      if (isAuthenticated) {
        // ✅ Nom/email dérivés de la session Better Auth — non falsifiables
        if (!subject || typeof subject !== "string" || !subject.trim()) {
          return NextResponse.json(
            {
              success: false,
              message: "Le sujet est requis",
              code: "VALIDATION_FAILED",
              errors: { subject: "Le sujet est requis" },
            },
            { status: 400 },
          );
        }

        if (subject.length > 200) {
          return NextResponse.json(
            {
              success: false,
              message: "Le sujet est trop long (max 200 caractères)",
              code: "VALIDATION_FAILED",
              errors: {
                subject: "Le sujet est trop long (max 200 caractères)",
              },
            },
            { status: 400 },
          );
        }

        if (!message || typeof message !== "string" || !message.trim()) {
          return NextResponse.json(
            {
              success: false,
              message: "Le message est requis",
              code: "VALIDATION_FAILED",
              errors: { message: "Le message est requis" },
            },
            { status: 400 },
          );
        }

        if (message.length > 5000) {
          return NextResponse.json(
            {
              success: false,
              message: "Le message est trop long (max 5000 caractères)",
              code: "VALIDATION_FAILED",
              errors: {
                message: "Le message est trop long (max 5000 caractères)",
              },
            },
            { status: 400 },
          );
        }

        sanitizedName = sanitizePlain(authUser.name || "Utilisateur inscrit");
        sanitizedEmail = sanitizePlain(authUser.email);
        sanitizedSubject = sanitizePlain(subject);
        sanitizedMessage = sanitizeRich(message);
      } else {
        // Utilisateur non connecté : name/email requis, validés via Yup
        const { name, email } = body;

        const validation = await validateContactMessage({
          name,
          email,
          subject,
          message,
        });

        if (!validation.isValid) {
          return NextResponse.json(
            {
              success: false,
              message: "Validation failed",
              code: "VALIDATION_FAILED",
              errors: validation.errors,
            },
            { status: 400 },
          );
        }

        sanitizedName = sanitizePlain(validation.data.name);
        sanitizedEmail = sanitizePlain(validation.data.email);
        sanitizedSubject = sanitizePlain(validation.data.subject);
        sanitizedMessage = sanitizeRich(validation.data.message);
      }

      // Vérifier la configuration Resend
      if (!process.env.RESEND_API_KEY) {
        console.error("RESEND_API_KEY not configured");
        captureException(new Error("Email service not configured"), {
          tags: { component: "api", route: "emails/POST" },
          level: "error",
        });

        return NextResponse.json(
          {
            success: false,
            message: "Email service temporarily unavailable",
            code: "SERVICE_UNAVAILABLE",
          },
          { status: 503 },
        );
      }

      const statusLabel = isAuthenticated ? "Inscrit" : "Non inscrit";
      const bannerColor = isAuthenticated ? "#d1fae5" : "#fff3cd";
      const bannerBorder = isAuthenticated ? "#10b981" : "#ffc107";
      const bannerText = isAuthenticated ? "#065f46" : "#856404";
      const bannerMessage = isAuthenticated
        ? "✅ Message d'un utilisateur inscrit"
        : "⚠️ Message d'un utilisateur non inscrit";

      const emailOptions = {
        from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
        reply_to: sanitizedEmail,
        to: process.env.CONTACT_EMAIL || ["fathismael@gmail.com"],
        subject: `[Contact BuyItNow] ${sanitizedSubject}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 20px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Nouveau Message de Contact</h1>
              </div>

              <div style="padding: 30px;">
                <div style="background-color: ${bannerColor}; border-left: 4px solid ${bannerBorder}; padding: 15px; margin-bottom: 20px;">
                  <p style="margin: 0; color: ${bannerText}; font-weight: bold;">${bannerMessage}</p>
                </div>

                <div style="background-color: #f8f9fa; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px;">
                  <p style="margin: 0 0 10px 0; color: #666;"><strong>De:</strong> ${sanitizedName}</p>
                  <p style="margin: 0 0 10px 0; color: #666;"><strong>Email:</strong> ${sanitizedEmail}</p>
                  <p style="margin: 0; color: #666;"><strong>Sujet:</strong> ${sanitizedSubject}</p>
                </div>

                <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 4px;">
                  <h3 style="color: #1f2937; margin-top: 0;">Message:</h3>
                  <div style="color: #4b5563; line-height: 1.6; white-space: pre-wrap;">${sanitizedMessage}</div>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

                <div style="text-align: center; color: #9ca3af; font-size: 12px;">
                  <p>Message envoyé depuis BuyItNow - ${new Date().toLocaleString("fr-FR")}</p>
                  <p>Utilisateur: ${statusLabel}</p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `
De: ${sanitizedName}
Email: ${sanitizedEmail}
Sujet: ${sanitizedSubject}

Message:
${sanitizedMessage}

---
Message envoyé depuis BuyItNow
Date: ${new Date().toLocaleString("fr-FR")}
Utilisateur: ${statusLabel}
`,
      };

      let emailResult;
      try {
        emailResult = await resend.emails.send(emailOptions);

        if (!emailResult || emailResult.error) {
          throw new Error(emailResult?.error?.message || "Email send failed");
        }
      } catch (emailError) {
        console.error("Resend API error:", emailError);

        captureException(emailError, {
          tags: {
            component: "api",
            route: "emails/POST",
            service: "resend",
          },
          extra: {
            subject: sanitizedSubject,
            messageLength: sanitizedMessage.length,
            isAuthenticated,
          },
        });

        return NextResponse.json(
          {
            success: false,
            message: "Failed to send email. Please try again later",
            code: "EMAIL_SEND_FAILED",
          },
          { status: 500 },
        );
      }

      console.log("🔒 Security event - Contact email sent:", {
        email: sanitizedEmail,
        isAuthenticated,
        subject: sanitizedSubject.substring(0, 50),
        messageLength: sanitizedMessage.length,
        emailId: emailResult.id,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
      });

      return NextResponse.json(
        {
          success: true,
          message: "Email sent successfully",
          data: {
            emailId: emailResult.id,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      console.error("Email send error:", error.message);

      captureException(error, {
        tags: {
          component: "api",
          route: "emails/POST",
        },
        level: "error",
      });

      return NextResponse.json(
        {
          success: false,
          message: "Failed to send email",
          code: "INTERNAL_ERROR",
        },
        { status: 500 },
      );
    }
  },
  {
    category: "api",
    action: "write",
    customStrategy: {
      points: 2, // 2 emails maximum
      duration: 1800000, // par 30 minutes
      blockDuration: 3600000, // blocage 1h
      keyStrategy: "ip", // par IP, valable connecté ou non
      requireAuth: false,
    },
    extractUserInfo: extractUserInfoFromRequest,
  },
);
