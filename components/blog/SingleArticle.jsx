"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

const SingleArticle = ({ article }) => {
  const router = useRouter();

  // Fonction pour formater la date
  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Fonction pour partager l'article
  const handleShare = async () => {
    const shareData = {
      title: article.title,
      text: article.excerpt || article.title,
      url: window.location.href,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback : copier le lien
        await navigator.clipboard.writeText(window.location.href);
        // On pourrait ajouter un toast ici
        alert("Lien copié dans le presse-papiers !");
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Erreur de partage:", error);
      }
    }
  };

  // Article introuvable
  if (!article) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center">
            <svg
              className="w-12 h-12 text-orange-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            Article introuvable
          </h2>
          <p className="text-gray-600 mb-6">
            L'article que vous recherchez n'existe pas ou a été supprimé.
          </p>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-sunset text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Retour au blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec navigation */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Bouton retour */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors text-sm sm:text-base font-medium"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              <span className="hidden sm:inline">Retour</span>
            </button>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors text-sm font-medium"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                <span className="hidden sm:inline">Partager</span>
              </button>

              <Link
                href="/blog"
                className="flex items-center gap-1.5 px-3 py-2 bg-gradient-sunset text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
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
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
                <span className="hidden sm:inline">Tous les articles</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <article className="pb-12 sm:pb-16">
        {/* En-tête de l'article */}
        <header className="bg-gradient-to-br from-orange-50 via-white to-pink-50 py-8 sm:py-12 lg:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              {/* Tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4 sm:mb-6">
                  {article.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog?tag=${encodeURIComponent(tag)}`}
                      className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium hover:bg-orange-200 transition-colors"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              )}

              {/* Titre */}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold text-gray-900 leading-tight mb-4 sm:mb-6">
                {article.title}
              </h1>

              {/* Extrait */}
              {article.excerpt && (
                <p className="text-gray-600 text-base sm:text-lg lg:text-xl leading-relaxed mb-6 sm:mb-8">
                  {article.excerpt}
                </p>
              )}

              {/* Métadonnées */}
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm sm:text-base text-gray-500">
                {/* Auteur */}
                <div className="flex items-center gap-2 sm:gap-3">
                  {article.author?.image ? (
                    <Image
                      src={article.author.image}
                      alt={article.author.name}
                      width={40}
                      height={40}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-pink-400 flex items-center justify-center text-white font-semibold">
                      {article.author?.name?.charAt(0) || "A"}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      {article.author?.name || "Admin"}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">Auteur</p>
                  </div>
                </div>

                {/* Séparateur */}
                <div className="hidden sm:block w-px h-8 bg-gray-200"></div>

                {/* Date */}
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{formatDate(article.publishedAt)}</span>
                </div>

                {/* Vues */}
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  <span>{article.views || 0} lectures</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Image de couverture */}
        {article.coverImage?.url && (
          <div className="container mx-auto px-4 -mt-4 sm:-mt-6 mb-8 sm:mb-12">
            <div className="max-w-5xl mx-auto">
              <div className="relative aspect-video sm:aspect-[21/9] rounded-2xl overflow-hidden shadow-sunset-lg">
                <Image
                  src={article.coverImage.url}
                  alt={article.title}
                  fill
                  sizes="(max-width: 1280px) 100vw, 1280px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        )}

        {/* Contenu de l'article */}
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div
              className="prose prose-lg prose-gray max-w-none
                prose-headings:font-bold prose-headings:text-gray-900
                prose-h1:text-2xl prose-h1:sm:text-3xl prose-h1:mt-8 prose-h1:mb-4
                prose-h2:text-xl prose-h2:sm:text-2xl prose-h2:mt-8 prose-h2:mb-4
                prose-h3:text-lg prose-h3:sm:text-xl prose-h3:mt-6 prose-h3:mb-3
                prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-900 prose-strong:font-semibold
                prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6
                prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6
                prose-li:text-gray-700 prose-li:mb-2
                prose-blockquote:border-l-4 prose-blockquote:border-orange-400 prose-blockquote:bg-orange-50 prose-blockquote:pl-4 prose-blockquote:pr-4 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-gray-700 prose-blockquote:rounded-r-lg prose-blockquote:my-6
                prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:text-orange-600 prose-code:before:content-none prose-code:after:content-none
                prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-xl prose-pre:p-4 prose-pre:my-6 prose-pre:overflow-x-auto
                prose-img:rounded-xl prose-img:shadow-lg prose-img:my-6
                prose-hr:border-gray-200 prose-hr:my-8
              "
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          </div>
        </div>

        {/* Footer de l'article */}
        <footer className="container mx-auto px-4 mt-12 sm:mt-16">
          <div className="max-w-3xl mx-auto">
            {/* Tags */}
            {article.tags && article.tags.length > 0 && (
              <div className="pb-8 border-b border-gray-200">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog?tag=${encodeURIComponent(tag)}`}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-orange-100 hover:text-orange-700 transition-colors"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-orange-100 hover:text-orange-700 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                  />
                </svg>
                Partager cet article
              </button>

              <Link
                href="/blog"
                className="flex items-center gap-2 px-6 py-3 bg-gradient-sunset text-white rounded-xl font-semibold hover:opacity-90 transition-opacity"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
                Voir tous les articles
              </Link>
            </div>
          </div>
        </footer>
      </article>

      {/* Bouton retour en haut */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="fixed bottom-6 right-6 w-12 h-12 bg-white shadow-sunset-md border border-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:text-orange-600 hover:border-orange-200 transition-all hover-lift"
        aria-label="Retour en haut"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
      </button>
    </div>
  );
};

export default SingleArticle;
