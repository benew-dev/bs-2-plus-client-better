import { Suspense, lazy } from "react";
import { redirect } from "next/navigation";
import { captureException } from "@/monitoring/sentry";
import { getAuthenticatedUser } from "@/lib/auth-utils";
import CartSkeleton from "@/components/skeletons/CartSkeleton";

// Forcer le rendu dynamique pour cette page
export const dynamic = "force-dynamic";

// Lazy loading du composant Cart
const Cart = lazy(() => import("@/components/cart/Cart"));

// Métadonnées enrichies pour le panier
export const metadata = {
  title: "Votre Panier | Buy It Now",
  description:
    "Consultez et gérez les articles de votre panier sur Buy It Now.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Votre Panier | Buy It Now",
    description:
      "Consultez et gérez les articles de votre panier sur Buy It Now.",
    type: "website",
  },
  alternates: {
    canonical: "/cart",
  },
};

const CartPage = async () => {
  // ✅ Vérification de l'authentification via Better Auth (session complète,
  // pas un simple check de cookie brut qui dépend du nom exact du cookie)
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (error) {
    console.error("Authentication error in cart page", {
      error: error.message,
      route: "/cart",
    });
    captureException(error, {
      tags: {
        component: "CartPage",
        errorType: error.name,
      },
    });
    redirect("/error?code=auth_error");
  }

  if (!user) {
    const callbackPath = encodeURIComponent("/cart");
    redirect(`/login?callbackUrl=${callbackPath}`);
  }

  return (
    <div itemScope itemType="https://schema.org/ItemList">
      <meta itemProp="name" content="Shopping Cart" />
      <Suspense fallback={<CartSkeleton />}>
        <Cart />
      </Suspense>
    </div>
  );
};

export default CartPage;
