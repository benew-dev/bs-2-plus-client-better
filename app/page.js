import Hero from "@/components/home/Hero";

export const metadata = {
  title: "Buy It Now - Votre boutique en ligne de confiance",
  description:
    "Découvrez des milliers de produits de qualité à des prix imbattables. Livraison rapide et paiement sécurisé.",
};

/**
 * Récupère les données de la page d'accueil depuis l'API
 * Version optimisée avec cache long (les données changent rarement)
 *
 * @returns {Promise<Object>} Données de la homepage ou valeurs par défaut
 */
const getHomePageData = async () => {
  try {
    // 1. Construire l'URL de l'API
    const apiUrl = `${
      process.env.API_URL || "https://bs-plus-client-better.vercel.app"
    }/api/homepage`;

    console.log("Fetching homepage data from:", apiUrl);

    // 2. Faire l'appel API avec timeout (5 secondes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl, {
      signal: controller.signal,
      next: {
        revalidate: 3600, // Cache Next.js de 1 heure (données rarement modifiées)
        tags: ["homepage"],
      },
    });

    clearTimeout(timeoutId);

    // 3. Vérifier le statut HTTP
    if (!res.ok) {
      console.error(`API Error: ${res.status} - ${res.statusText}`);

      // Retourner des valeurs par défaut en cas d'erreur
      return {
        success: false,
        message: "Erreur lors de la récupération des données",
        data: null,
      };
    }

    // 4. Parser la réponse JSON
    const responseBody = await res.json();

    // 5. Vérifier la structure de la réponse
    if (!responseBody.success) {
      console.error("Invalid API response structure:", responseBody);
      return {
        success: false,
        message: responseBody.message || "Réponse API invalide",
        data: null,
      };
    }

    // 6. Retourner les données avec succès
    return {
      success: true,
      message: "Données récupérées avec succès",
      data: responseBody.data,
    };
  } catch (error) {
    // 7. Gestion des erreurs réseau/timeout
    if (error.name === "AbortError") {
      console.error("Request timeout after 5 seconds");
      return {
        success: false,
        message: "La requête a pris trop de temps",
        data: null,
      };
    }

    console.error("Network error:", error.message);
    return {
      success: false,
      message: "Problème de connexion réseau",
      data: null,
    };
  }
};

export default async function Home() {
  // Récupérer les données de la homepage
  const homePageData = await getHomePageData();

  return (
    <>
      <Hero homePageData={homePageData.data} />
    </>
  );
}
