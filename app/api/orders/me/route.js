import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import Order from "@/backend/models/order";
import APIFilters from "@/backend/utils/APIFilters";
import { captureException } from "@/monitoring/sentry";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import {
  isAuthenticatedUser,
  extractUserInfoFromRequest,
} from "@/lib/auth-utils";
import { ObjectId } from "mongodb";

/**
 * GET /api/orders/me
 * Récupère l'historique des commandes de l'utilisateur connecté
 * Rate limit: Configuration intelligente - authenticatedRead (200 req/min)
 *
 * Support des paiements:
 * - Paiements électroniques (WAAFI, D-MONEY, CAC-PAY, BCI-PAY)
 * - Paiement en espèces (CASH) à la livraison
 *
 * Headers de sécurité gérés par next.config.mjs pour /api/orders/* :
 * - Cache-Control: private, no-cache, no-store, must-revalidate
 * - Pragma: no-cache
 * - X-Content-Type-Options: nosniff
 * - X-Robots-Tag: noindex, nofollow
 *
 * Note: Les commandes sont des données sensibles privées
 */
export const GET = withIntelligentRateLimit(
  async function (req) {
    try {
      // Vérifier l'authentification (Better Auth)
      const authUser = await isAuthenticatedUser();

      console.log("User is connected");

      // Connexion DB — collection native Better Auth ("user", pas le modèle Mongoose)
      const mongooseInstance = await dbConnect();
      const db = mongooseInstance.connection.getClient().db();

      const user = await db.collection("user").findOne(
        { _id: new ObjectId(authUser.id) },
        {
          projection: {
            name: 1,
            email: 1,
            phone: 1,
            isActive: 1,
          },
        },
      );

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

      // Vérifier si le compte est actif
      if (!user.isActive) {
        console.warn(
          "Inactive user attempting to access order history:",
          user.email,
        );
        return NextResponse.json(
          {
            success: false,
            message: "Account suspended. Cannot access order history",
            code: "ACCOUNT_SUSPENDED",
          },
          { status: 403 },
        );
      }

      // Récupérer et valider les paramètres de pagination
      const searchParams = req.nextUrl.searchParams;
      const page = parseInt(searchParams.get("page") || "1", 10);
      const resPerPage = 2; // 2 commandes par page

      // Validation des paramètres de pagination
      if (page < 1 || page > 1000) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid page number. Must be between 1 and 1000",
            code: "INVALID_PAGINATION",
            data: { page },
          },
          { status: 400 },
        );
      }

      // Compter le total de commandes avec les filtres
      // ✅ authUser.id est castée automatiquement en ObjectId par Mongoose
      const ordersCount = await Order.countDocuments({
        "user.userId": authUser.id,
      });

      const ordersPaidCount = await Order.countDocuments({
        "user.userId": authUser.id,
        paymentStatus: "paid",
      });

      const ordersUnpaidCount = await Order.countDocuments({
        "user.userId": authUser.id,
        paymentStatus: "unpaid",
      });

      // Compter les commandes en espèces (CASH)
      const ordersCashCount = await Order.countDocuments({
        "user.userId": authUser.id,
        "paymentInfo.typePayment": "CASH",
      });

      // Total de toutes les commandes d'un utilisateur (tous statuts confondus)
      const totalAmountOrders = await Order.getTotalAmountByUser(authUser.id);

      // Si aucune commande trouvée
      if (ordersCount === 0) {
        return NextResponse.json(
          {
            success: true,
            message: "No orders found",
            data: {
              orders: [],
              totalPages: 0,
              currentPage: page,
              count: 0,
              perPage: resPerPage,
              paidCount: 0,
              unpaidCount: 0,
              cashCount: 0,
              totalAmountOrders: { totalAmount: 0, orderCount: 0 },
              meta: {
                hasOrders: false,
                timestamp: new Date().toISOString(),
              },
            },
          },
          { status: 200 },
        );
      }

      // Utiliser APIFilters pour la pagination
      const apiFilters = new APIFilters(
        Order.find({ "user.userId": authUser.id }),
        searchParams,
      ).pagination(resPerPage);

      // Récupérer les commandes avec pagination
      const orders = await apiFilters.query
        .select(
          "orderNumber user paymentInfo paymentStatus totalAmount createdAt updatedAt paidAt cancelledAt cancelReason orderItems",
        )
        .sort({ createdAt: -1 })
        .lean();

      // Calculer le nombre de pages
      const totalPages = Math.ceil(ordersCount / resPerPage);

      // Log pour audit (sans données sensibles)
      console.log("Order history accessed:", {
        userId: authUser.id,
        userEmail: user.email,
        ordersRetrieved: orders.length,
        cashOrders: ordersCashCount,
        page,
        timestamp: new Date().toISOString(),
        ip:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown",
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            orders,
            totalPages,
            currentPage: page,
            count: ordersCount,
            paidCount: ordersPaidCount,
            unpaidCount: ordersUnpaidCount,
            cashCount: ordersCashCount,
            totalAmountOrders,
            perPage: resPerPage,
            meta: {
              hasCashOrders: ordersCashCount > 0,
            },
          },
        },
        { status: 200 },
      );
    } catch (error) {
      console.error("Orders fetch error:", error.message);

      const isAuthError =
        error.message?.includes("authentication") ||
        error.message === "Authentication required";

      // Capturer seulement les vraies erreurs système
      if (!isAuthError) {
        captureException(error, {
          tags: {
            component: "api",
            route: "orders/me/GET",
          },
          extra: {
            page: req.nextUrl.searchParams.get("page"),
          },
        });
      }

      // Gestion détaillée des erreurs
      let status = 500;
      let message = "Failed to fetch orders history";
      let code = "INTERNAL_ERROR";

      if (isAuthError) {
        status = 401;
        message = "Authentication failed";
        code = "AUTH_FAILED";
      } else if (error.name === "CastError") {
        status = 400;
        message = "Invalid request parameters";
        code = "INVALID_PARAMS";
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
    action: "authenticatedRead",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
