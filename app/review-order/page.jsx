import { Suspense, lazy } from "react";
import { redirect } from "next/navigation";
import { captureException } from "@/monitoring/sentry";
import ReviewOrderSkeleton from "@/components/skeletons/ReviewOrderSkeleton";
import { getAuthenticatedUser } from "@/lib/auth-utils";

// Forcer le rendu dynamique pour cette page
export const dynamic = "force-dynamic";

// Lazy loading du composant ReviewOrder
const ReviewOrder = lazy(() => import("@/components/cart/ReviewOrder"));

// Métadonnées enrichies pour le SEO
export const metadata = {
  title: "Révision de votre commande | Buy It Now",
  description:
    "Vérifiez les détails de votre commande avant de procéder au paiement final",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
  openGraph: {
    title: "Révision de votre commande | Buy It Now",
    description:
      "Vérifiez les détails de votre commande avant de procéder au paiement final",
    type: "website",
  },
  alternates: {
    canonical: "/review-order",
  },
};

const ReviewOrderPage = async () => {
  // ✅ Vérification de l'authentification (Better Auth) — try/catch isolé
  // pour ne pas laisser un catch générique intercepter redirect()
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    console.error("Authentication error in review order page", {
      error: error.message,
      route: "/review-order",
    });
    captureException(error, {
      tags: { component: "ReviewOrderPage" },
    });
    redirect("/payment");
  }

  if (!user) {
    redirect("/login?callbackUrl=/review-order");
  }

  return (
    <div
      className="review-order-page"
      itemScope
      itemType="https://schema.org/WebPage"
    >
      <meta itemProp="name" content="Révision de commande" />
      <Suspense fallback={<ReviewOrderSkeleton />}>
        <ReviewOrder />
      </Suspense>
    </div>
  );
};

export default ReviewOrderPage;
