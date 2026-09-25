import { lazy, Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { captureException } from "@/monitoring/sentry";

import logger from "@/utils/logger";
import { getAuthenticatedUser } from "@/lib/auth-utils"; // ✅ Corrigé

export const dynamic = "force-dynamic";

const ListOrders = lazy(() => import("@/components/orders/ListOrders"));

/**
 * Récupère l'historique des commandes de l'utilisateur connecté
 * en transmettant les cookies de la requête entrante à l'API interne
 */
const getAllOrders = async (searchParams, cookieHeader) => {
  try {
    const urlParams = {};

    if (searchParams?.page) {
      const parsedPage = parseInt(searchParams.page, 10);
      if (!isNaN(parsedPage) && parsedPage > 0 && parsedPage <= 100) {
        urlParams.page = parsedPage;
      } else {
        console.warn("Invalid page parameter:", searchParams.page);
        urlParams.page = 1;
      }
    }

    const searchQuery = new URLSearchParams(urlParams).toString();
    const apiUrl = `${
      process.env.API_URL || "https://bs-2-plus-client-better.vercel.app"
    }/api/orders/me${searchQuery ? `?${searchQuery}` : ""}`;

    console.log("Fetching orders from:", apiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        // ✅ On transmet l'intégralité du header Cookie de la requête entrante,
        // au lieu de reconstruire un cookie nommé en dur (dépendant de next-auth)
        Cookie: cookieHeader || "",
      },
      next: {
        revalidate: 0,
        tags: ["user-orders"],
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 401) {
        return {
          success: false,
          message: "Authentification requise",
          data: {
            orders: [],
            totalPages: 0,
            currentPage: 1,
            count: 0,
            paidCount: 0,
            unpaidCount: 0,
            totalAmountOrders: { totalAmount: 0, orderCount: 0 },
          },
        };
      }

      if (res.status === 404) {
        return {
          success: true,
          message: "Aucune commande trouvée",
          data: {
            orders: [],
            totalPages: 0,
            currentPage: urlParams.page || 1,
            count: 0,
            paidCount: 0,
            unpaidCount: 0,
            totalAmountOrders: { totalAmount: 0, orderCount: 0 },
          },
        };
      }

      console.error(`API Error: ${res.status} - ${res.statusText}`);
      return {
        success: false,
        message: "Erreur lors de la récupération des commandes",
        data: {
          orders: [],
          totalPages: 0,
          currentPage: 1,
          count: 0,
          paidCount: 0,
          unpaidCount: 0,
          totalAmountOrders: { totalAmount: 0, orderCount: 0 },
        },
      };
    }

    const responseBody = await res.json();

    if (!responseBody.success || !responseBody.data) {
      console.error("Invalid API response structure:", responseBody);
      return {
        success: false,
        message: responseBody.message || "Réponse API invalide",
        data: {
          orders: [],
          totalPages: 0,
          currentPage: 1,
          count: 0,
          paidCount: 0,
          unpaidCount: 0,
          totalAmountOrders: { totalAmount: 0, orderCount: 0 },
        },
      };
    }

    const sanitizedOrders = (responseBody.data.orders || []).map((order) => ({
      ...order,
      paymentInfo: order.paymentInfo
        ? {
            ...order.paymentInfo,
            paymentAccountNumber: order.paymentInfo.paymentAccountNumber,
          }
        : order.paymentInfo,
    }));

    return {
      success: true,
      message:
        responseBody.data.count > 0
          ? "Commandes récupérées avec succès"
          : "Aucune commande trouvée",
      data: {
        orders: sanitizedOrders,
        totalPages: responseBody.data.totalPages || 0,
        currentPage: responseBody.data.currentPage || urlParams.page || 1,
        count: responseBody.data.count || 0,
        perPage: responseBody.data.perPage || 2,
        paidCount: responseBody.data.paidCount || 0,
        unpaidCount: responseBody.data.unpaidCount || 0,
        totalAmountOrders: responseBody.data.totalAmountOrders || {
          totalAmount: 0,
          orderCount: 0,
        },
      },
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Request timeout after 8 seconds");
      return {
        success: false,
        message: "La requête a pris trop de temps",
        data: {
          orders: [],
          totalPages: 0,
          currentPage: 1,
          count: 0,
          paidCount: 0,
          unpaidCount: 0,
          totalAmountOrders: { totalAmount: 0, orderCount: 0 },
        },
      };
    }

    console.error("Network error:", error.message);
    return {
      success: false,
      message: "Problème de connexion réseau",
      data: {
        orders: [],
        totalPages: 0,
        currentPage: 1,
        count: 0,
        paidCount: 0,
        unpaidCount: 0,
        totalAmountOrders: { totalAmount: 0, orderCount: 0 },
      },
    };
  }
};

const OrdersPageSkeleton = () => (
  <div className="animate-pulse p-4">
    <div className="h-7 bg-gray-200 rounded w-48 mb-6"></div>
    {[...Array(3)].map((_, i) => (
      <div key={i} className="mb-6">
        <div className="h-64 bg-gray-200 rounded-md mb-3"></div>
      </div>
    ))}
  </div>
);

export const metadata = {
  title: "Historique de commandes | Buy It Now",
  description: "Consultez l'historique de vos commandes sur Buy It Now",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  alternates: {
    canonical: "/me/orders",
  },
};

const MyOrdersPage = async ({ searchParams }) => {
  const requestId = `orderspage-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;

  // ✅ Vérification de l'authentification (Better Auth), hors de tout
  // try/catch qui pourrait intercepter redirect()
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    logger.error("Authentication error on orders page", {
      requestId,
      error: error.message,
    });
    captureException(error, {
      tags: { component: "MyOrdersPage", action: "auth_check" },
      extra: { requestId },
    });
    redirect("/error?code=auth_error");
  }

  if (!user) {
    logger.warn("Unauthenticated access to orders page", {
      requestId,
      action: "unauthenticated_access",
    });
    redirect("/login?callbackUrl=/me/orders");
  }

  logger.info("Orders page accessed", {
    requestId,
    page: searchParams?.page || 1,
    userId: user.id
      ? `${user.id.substring(0, 2)}...${user.id.slice(-2)}`
      : "unknown",
    action: "orders_page_access",
  });

  try {
    const sanitizedSearchParams = {
      page: searchParams?.page || 1,
    };

    // ✅ Cookies de la requête entrante, transmis tels quels
    const headersList = await headers();
    const cookieHeader = headersList.get("cookie") || "";

    const ordersPromise = await getAllOrders(
      sanitizedSearchParams,
      cookieHeader,
    );

    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold mb-6">Mes commandes</h1>
        <Suspense fallback={<OrdersPageSkeleton />}>
          <OrdersData ordersPromise={ordersPromise} />
        </Suspense>
      </div>
    );
  } catch (error) {
    logger.error("Error loading orders page", {
      requestId,
      error: error.message,
      stack: error.stack,
      action: "orders_page_error",
    });

    captureException(error, {
      tags: { component: "MyOrdersPage", action: "page_load" },
      extra: { requestId, searchParams },
    });

    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-semibold text-red-700 mb-2">
            Impossible de charger vos commandes
          </h2>
          <p className="text-red-600">
            Nous rencontrons actuellement des difficultés pour récupérer votre
            historique de commandes. Veuillez réessayer ultérieurement ou
            contacter notre service client.
          </p>
        </div>
      </div>
    );
  }
};

const OrdersData = async ({ ordersPromise }) => {
  try {
    const orders = await ordersPromise;
    return <ListOrders orders={orders.data} />;
  } catch (error) {
    captureException(error, {
      tags: { component: "OrdersData", action: "data_fetch" },
    });

    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-red-600">
          Une erreur est survenue lors du chargement de vos commandes. Veuillez
          réessayer.
        </p>
      </div>
    );
  }
};

export default MyOrdersPage;
