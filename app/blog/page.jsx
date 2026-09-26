// app/blog/page.jsx

import ListArticles from "@/components/blog/ListArticles";

export const metadata = {
  title: "Blog - Actualités et Conseils",
  description:
    "Découvrez nos derniers articles, conseils et actualités sur nos produits et services.",
  openGraph: {
    title: "Blog - Buy It Now",
    description:
      "Découvrez nos derniers articles, conseils et actualités sur nos produits et services.",
    type: "website",
  },
};

/**
 * Récupère les articles publiés depuis l'API
 */
const getPublishedArticles = async (page = 1, limit = 9, tag = null) => {
  try {
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
    let url = `${apiUrl}/api/blog?page=${page}&limit=${limit}`;

    if (tag) {
      url += `&tag=${encodeURIComponent(tag)}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      next: {
        revalidate: 300, // Cache 5 minutes
        tags: ["blog"],
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error(`Blog API Error: ${res.status}`);
      return {
        articles: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalArticles: 0,
          hasMore: false,
        },
      };
    }

    const data = await res.json();

    return {
      articles: data.articles || [],
      pagination: data.pagination || {
        currentPage: 1,
        totalPages: 0,
        totalArticles: 0,
        hasMore: false,
      },
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Blog fetch timeout");
    } else {
      console.error("Blog fetch error:", error.message);
    }

    return {
      articles: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalArticles: 0,
        hasMore: false,
      },
    };
  }
};

const BlogPage = async ({ searchParams }) => {
  const params = await searchParams;
  const page = parseInt(params?.page) || 1;
  const tag = params?.tag || null;

  const articlesData = await getPublishedArticles(page, 9, tag);

  console.log("Articles ==========> ", articlesData);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-orange-50 via-white to-pink-50 border-b border-gray-100">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
              Notre <span className="text-gradient-sunset">Blog</span>
            </h1>
            <p className="text-gray-600 text-base sm:text-lg">
              Découvrez nos derniers articles, conseils et actualités
            </p>

            {/* Tag actif */}
            {tag && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <span className="text-gray-500 text-sm">Filtre actif :</span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                  <a
                    href="/blog"
                    className="ml-1 text-orange-500 hover:text-orange-700"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </a>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contenu */}
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <ListArticles data={articlesData} />
      </div>
    </div>
  );
};

export default BlogPage;
