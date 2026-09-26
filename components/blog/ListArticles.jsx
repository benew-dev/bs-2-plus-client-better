"use client";

import Link from "next/link";
import Image from "next/image";

const ListArticles = ({ data }) => {
  const { articles, pagination } = data;

  // Fonction pour formater la date
  const formatDate = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Fonction pour tronquer le texte
  const truncateText = (text, maxLength) => {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // État vide
  if (!articles || articles.length === 0) {
    return (
      <div className="text-center py-16 sm:py-24">
        <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center">
          <svg
            className="w-10 h-10 sm:w-12 sm:h-12 text-orange-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
            />
          </svg>
        </div>
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-2">
          Aucun article disponible
        </h3>
        <p className="text-gray-500 text-sm sm:text-base">
          Revenez bientôt pour découvrir nos nouveaux articles !
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-12">
      {/* Grille d'articles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {articles.map((article) => (
          <Link
            key={article._id}
            href={`/blog/${article.slug}`}
            className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-sunset-md border border-gray-100 hover:border-orange-200 transition-all duration-300 hover-lift"
          >
            {/* Image de couverture */}
            <div className="aspect-video relative overflow-hidden bg-gradient-to-br from-orange-50 to-pink-50">
              {article.coverImage?.url ? (
                <Image
                  src={article.coverImage.url}
                  alt={article.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-orange-200"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}

              {/* Tags overlay */}
              {article.tags && article.tags.length > 0 && (
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                  {article.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-1 bg-white/90 backdrop-blur-sm text-orange-600 text-xs font-medium rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                  {article.tags.length > 2 && (
                    <span className="px-2 py-1 bg-white/90 backdrop-blur-sm text-gray-500 text-xs rounded-full">
                      +{article.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Contenu */}
            <div className="p-5 sm:p-6">
              {/* Titre */}
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-orange-600 transition-colors">
                {article.title}
              </h3>

              {/* Extrait */}
              <p className="text-gray-600 text-sm sm:text-base mb-4 line-clamp-2">
                {article.excerpt || truncateText(article.title, 120)}
              </p>

              {/* Footer - Date et vues uniquement */}
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500">
                <span>{formatDate(article.publishedAt)}</span>
                <span className="flex items-center gap-1">
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  {article.views || 0}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {/* Bouton précédent */}
          {pagination.currentPage > 1 && (
            <Link
              href={`/blog?page=${pagination.currentPage - 1}`}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-colors text-sm font-medium"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Précédent
            </Link>
          )}

          {/* Numéros de page */}
          <div className="hidden sm:flex items-center gap-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }).map(
              (_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.currentPage <= 3) {
                  pageNum = i + 1;
                } else if (
                  pagination.currentPage >=
                  pagination.totalPages - 2
                ) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.currentPage - 2 + i;
                }

                return (
                  <Link
                    key={pageNum}
                    href={`/blog?page=${pageNum}`}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      pageNum === pagination.currentPage
                        ? "bg-gradient-sunset text-white"
                        : "bg-white border border-gray-200 text-gray-700 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600"
                    }`}
                  >
                    {pageNum}
                  </Link>
                );
              },
            )}
          </div>

          {/* Info page mobile */}
          <span className="sm:hidden text-sm text-gray-600 px-3">
            Page {pagination.currentPage} / {pagination.totalPages}
          </span>

          {/* Bouton suivant */}
          {pagination.currentPage < pagination.totalPages && (
            <Link
              href={`/blog?page=${pagination.currentPage + 1}`}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 transition-colors text-sm font-medium"
            >
              Suivant
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

export default ListArticles;
