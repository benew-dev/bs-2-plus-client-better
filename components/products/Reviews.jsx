"use client";

import Image from "next/image";
import ReactStarsRating from "react-awesome-stars-rating";
import { MessageSquare, Calendar } from "lucide-react";

const Reviews = ({ reviews }) => {
  // Vérification si reviews existe et n'est pas vide
  if (!reviews || reviews.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center border border-gray-200">
        <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">
          Aucun avis pour le moment
        </h3>
        <p className="text-gray-500 text-sm">
          Soyez le premier à partager votre expérience avec ce produit !
        </p>
      </div>
    );
  }

  // Formater la date
  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("fr-FR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return "Date inconnue";
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {reviews.map((review, index) => (
        <article
          key={review?._id || `review-${index}`}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-sunset-md hover:border-orange-200 transition-all duration-300"
        >
          {/* Header - User Info */}
          <div className="flex items-start gap-4 mb-4">
            <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-orange-200">
              {/* ✅ MODIFICATION: Utiliser l'avatar de l'utilisateur */}
              <Image
                src={review?.user?.image || "/images/default.png"}
                alt={review?.user?.name || "Utilisateur"}
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {review?.user?.name || "Utilisateur anonyme"}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <Calendar className="w-3 h-3" />
                <time dateTime={review?.createdAt}>
                  {formatDate(review?.createdAt)}
                </time>
              </div>
            </div>
          </div>

          {/* Rating - ✅ Affichage correct des décimales */}
          <div className="flex items-center gap-3 mb-4">
            <ReactStarsRating
              value={review?.rating || 0}
              isEdit={false}
              primaryColor="#f97316"
              secondaryColor="#d1d5db"
              className="flex"
              starGap={4}
              count={5}
              size={18}
            />
            <span className="text-sm font-semibold text-orange-600">
              {review?.rating?.toFixed(1) || 0}/5
            </span>
          </div>

          {/* Comment */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <p className="text-gray-700 text-sm leading-relaxed break-words">
              {review?.comment || "Aucun commentaire"}
            </p>
          </div>

          {/* Updated At (if different from createdAt) */}
          {review?.updatedAt && review?.updatedAt !== review?.createdAt && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 italic">
                Modifié le {formatDate(review?.updatedAt)}
              </p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
};

export default Reviews;
