import { Suspense, lazy } from "react";
import ListProductsSkeleton from "@/components/skeletons/ListProductsSkeleton";
import { parseProductSearchParams } from "@/utils/inputSanitizer";

const ListProducts = lazy(() => import("@/components/products/ListProducts"));

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export const metadata = {
  title: "Hommes - Buy It Now",
  description: "Découvrez notre collection pour hommes",
};

/**
 * 🆕 Une seule méthode qui récupère tout
 */
const getProductsAndCategories = async (searchParams) => {
  try {
    const urlSearchParams = new URLSearchParams();

    if (searchParams) {
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          urlSearchParams.set(key, String(value));
        }
      });
    }

    // 🆕 Ajouter le type dans les paramètres
    const cleanParams = parseProductSearchParams(urlSearchParams);
    cleanParams.type = "men"; // Type pour la page hommes

    const searchQuery = new URLSearchParams(cleanParams).toString();
    const apiUrl = `${
      process.env.API_URL || "https://bs-2-plus-client.vercel.app"
    }/api/products?${searchQuery}`;

    console.log("Fetching from:", apiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      next: {
        revalidate: 300, // ✅ Réduire à 1 minute
        tags: ["products", "men-products"], // ✅ Tag spécifique
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`API Error: ${res.status} - ${res.statusText}`);
      return {
        success: false,
        message: "Erreur lors de la récupération des données",
        data: {
          products: [],
          totalPages: 0,
          categories: [], // 🆕
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
          products: [],
          totalPages: 0,
          categories: [], // 🆕
        },
      };
    }

    // 🆕 Retourner produits ET catégories
    return {
      success: true,
      message: "Données récupérées avec succès",
      data: {
        products: responseBody.data.products || [],
        totalPages: responseBody.data.totalPages || 0,
        totalProducts: responseBody.data.totalProducts || 0,
        categories: responseBody.data.categories || [], // 🆕
        type: responseBody.data.type, // 🆕
      },
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Request timeout after 5 seconds");
      return {
        success: false,
        message: "La requête a pris trop de temps",
        data: {
          products: [],
          totalPages: 0,
          categories: [], // 🆕
        },
      };
    }

    console.error("Network error:", error.message);
    return {
      success: false,
      message: "Problème de connexion réseau",
      data: {
        products: [],
        totalPages: 0,
        categories: [], // 🆕
      },
    };
  }
};

const MenPage = async ({ searchParams }) => {
  const params = await searchParams;

  // 🆕 Une seule requête pour tout
  const data = await getProductsAndCategories(params);

  return (
    <Suspense fallback={<ListProductsSkeleton />}>
      <main>
        <ListProducts
          key="men_products"
          type="men"
          data={data?.data}
          categories={data?.data?.categories || []} // 🆕 Catégories du type men
        />
      </main>
    </Suspense>
  );
};

export default MenPage;
