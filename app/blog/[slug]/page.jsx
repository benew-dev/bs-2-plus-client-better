// app/blog/[slug]/page.jsx

import { notFound } from "next/navigation";
import SingleArticle from "@/components/blog/SingleArticle";

/**
 * Génération des métadonnées dynamiques pour le SEO
 */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return {
      title: "Article non trouvé",
      description: "L'article que vous recherchez n'existe pas.",
    };
  }

  // Extraire le texte brut pour la description
  const plainText = article.content
    ? article.content.replace(/<[^>]*>/g, "").substring(0, 160)
    : "";

  return {
    title: article.title,
    description: article.excerpt || plainText,
    authors: [{ name: article.author?.name || "Admin" }],
    openGraph: {
      title: article.title,
      description: article.excerpt || plainText,
      type: "article",
      publishedTime: article.publishedAt,
      authors: [article.author?.name || "Admin"],
      tags: article.tags || [],
      images: article.coverImage?.url
        ? [
            {
              url: article.coverImage.url,
              width: 1200,
              height: 630,
              alt: article.title,
            },
          ]
        : [],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt || plainText,
      images: article.coverImage?.url ? [article.coverImage.url] : [],
    },
  };
}

/**
 * Récupère un article par son slug depuis l'API
 */
const getArticleBySlug = async (slug) => {
  try {
    const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL;
    const url = `${apiUrl}/api/blog/${encodeURIComponent(slug)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      next: {
        revalidate: 300, // Cache 5 minutes
        tags: ["blog", `article-${slug}`],
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      if (res.status === 404) {
        return null;
      }
      console.error(`Article API Error: ${res.status}`);
      return null;
    }

    const data = await res.json();

    if (!data.success || !data.article) {
      return null;
    }

    return data.article;
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("Article fetch timeout");
    } else {
      console.error("Article fetch error:", error.message);
    }
    return null;
  }
};

const ArticlePage = async ({ params }) => {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  // Si l'article n'existe pas, afficher la page 404
  if (!article) {
    notFound();
  }

  return <SingleArticle article={article} />;
};

export default ArticlePage;
