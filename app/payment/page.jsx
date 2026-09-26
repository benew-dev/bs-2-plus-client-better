import { Suspense, lazy } from "react";
import { captureException } from "@/monitoring/sentry";
import PaymentPageSkeleton from "@/components/skeletons/PaymentPageSkeleton";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth-utils";

// Forcer le rendu dynamique pour cette page
export const dynamic = "force-dynamic";

// Lazy loading du composant Payment
const Payment = lazy(() => import("@/components/cart/Payment"));

// Métadonnées enrichies pour le SEO
export const metadata = {
  title: "Paiement de votre commande | Buy It Now",
  description:
    "Finalisez votre commande en choisissant votre méthode de paiement préférée",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Paiement de votre commande | Buy It Now",
    description:
      "Finalisez votre commande en choisissant votre méthode de paiement préférée",
    type: "website",
  },
  alternates: {
    canonical: "/payment",
  },
};

/**
 * Récupère toutes les plateformes de paiement depuis l'API
 * Version optimisée avec cache long (les plateformes changent rarement)
 *
 * @returns {Promise<Object>} Données des plateformes ou erreur
 */
const getPaymentPlatforms = async () => {
  try {
    const apiUrl = `${
      process.env.API_URL || "https://bs-2-plus-client-better.vercel.app"
    }/api/paymentPlatform`;

    console.log("Fetching payment platforms from:", apiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      next: {
        revalidate: 1800, // Cache Next.js de 30 minutes (plateformes stables)
        tags: ["payment-platforms"],
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`API Error: ${res.status} - ${res.statusText}`);

      if (res.status === 404) {
        return {
          success: true,
          message: "Aucune plateforme de paiement disponible",
          platforms: [],
          count: 0,
        };
      }

      return {
        success: false,
        message: "Erreur lors de la récupération des plateformes de paiement",
        platforms: [],
        count: 0,
      };
    }

    const responseBody = await res.json();

    if (!responseBody.success || !responseBody.data) {
      console.error("Invalid API response structure:", responseBody);
      return {
        success: false,
        message: responseBody.message || "Réponse API invalide",
        platforms: [],
        count: 0,
      };
    }

    const platforms = responseBody.data.platforms || [];

    console.log(
      `Fetched ${platforms.length} payment platforms successfully.`,
      platforms,
    );

    return {
      success: true,
      message: "Plateformes de paiement récupérées avec succès",
      platforms: platforms,
      count: responseBody.data.count || platforms.length,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Request timeout after 5 seconds");
      return {
        success: false,
        message: "La requête a pris trop de temps",
        platforms: [],
        count: 0,
      };
    }

    console.error("Network error:", error.message);
    return {
      success: false,
      message: "Problème de connexion réseau",
      platforms: [],
      count: 0,
    };
  }
};

/**
 * Page de paiement - Server Component
 * Vérifie l'authentification (Better Auth) et charge les plateformes de paiement
 */
const PaymentPage = async () => {
  // ✅ Vérification de l'authentification — try/catch isolé de la logique
  // métier pour éviter que redirect() ne soit intercepté par un catch générique
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    console.error("Authentication error in payment page", {
      error: error.message,
      route: "/payment",
    });
    captureException(error, {
      tags: { component: "PaymentPage", errorType: error.name },
    });
    redirect("/cart");
  }

  if (!user) {
    redirect("/login?callbackUrl=/payment");
  }

  // Récupérer les plateformes de paiement (erreurs gérées en interne,
  // ne bloque pas le rendu de la page)
  const platformsData = await getPaymentPlatforms();

  if (!platformsData.success) {
    console.warn("Failed to fetch payment platforms:", platformsData.message);
  }

  console.log("Rendering PaymentPage with platforms:", platformsData.platforms);

  return (
    <div
      className="payment-page"
      itemScope
      itemType="https://schema.org/WebPage"
    >
      <meta itemProp="name" content="Paiement" />
      <Suspense fallback={<PaymentPageSkeleton />}>
        <Payment paymentTypes={platformsData.platforms} />
      </Suspense>
    </div>
  );
};

export default PaymentPage;
