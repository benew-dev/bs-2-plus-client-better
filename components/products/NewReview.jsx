"use client";

import { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import ReactStarsRating from "react-awesome-stars-rating";
import { MessageSquare, Star } from "lucide-react";

import AuthContext from "@/context/AuthContext";
import OrderContext from "@/context/OrderContext";
import { getUserReview } from "@/helpers/helpers";

const NewReview = ({ product }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { user } = useContext(AuthContext);
  const { error, clearErrors, postReview } = useContext(OrderContext);

  useEffect(() => {
    const userReview = getUserReview(product?.reviews, user?.id);

    if (userReview) {
      setRating(userReview?.rating);
      setComment(userReview?.comment);
    }
    if (error) {
      toast.error(error);
      clearErrors();
      setIsSubmitting(false);
    }
  }, [error, clearErrors]);

  const handleSubmit = async () => {
    // Validation côté client
    if (rating === 0) {
      toast.error("Veuillez sélectionner une note");
      return;
    }

    if (!comment || comment.trim().length < 10) {
      toast.error("Votre commentaire doit contenir au moins 10 caractères");
      return;
    }

    if (comment.trim().length > 1000) {
      toast.error("Votre commentaire ne doit pas dépasser 1000 caractères");
      return;
    }

    setIsSubmitting(true);

    const reviewData = {
      rating, // ✅ Peut maintenant être 1, 1.5, 2, 2.5, etc.
      comment: comment.trim(),
      productId: product?._id,
    };

    try {
      await postReview(reviewData);
      setIsSubmitting(false);
      // Le composant sera rechargé après la redirection
    } catch (err) {
      console.error("Error posting review:", err);
      setIsSubmitting(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-md">
        <p className="text-orange-800">
          Vous devez être connecté pour laisser un avis.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-sunset flex items-center justify-center">
          <MessageSquare className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Votre avis</h2>
          <p className="text-sm text-gray-600">
            Partagez votre expérience avec ce produit
          </p>
        </div>
      </div>

      {/* Rating Section - ✅ Permettre les demi-étoiles */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Votre note <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-4">
          <ReactStarsRating
            value={rating}
            isEdit={true}
            isHalf={true} // ✅ AJOUT: Activer les demi-étoiles
            primaryColor="#f97316"
            secondaryColor="#d1d5db"
            className="flex"
            starGap={8}
            count={5}
            size={32}
            onChange={(newRating) => setRating(newRating)}
          />
          {rating > 0 && (
            <span className="text-sm font-medium text-gray-600">
              {rating.toFixed(1)} / 5
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Vous pouvez donner une note avec des demi-étoiles (ex: 3.5)
        </p>
      </div>

      {/* Comment Section */}
      <div className="mb-6">
        <label
          htmlFor="review-comment"
          className="block text-sm font-semibold text-gray-700 mb-2"
        >
          Votre commentaire <span className="text-red-500">*</span>
        </label>
        <textarea
          id="review-comment"
          rows="5"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all resize-none"
          placeholder="Décrivez votre expérience avec ce produit..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={isSubmitting}
          maxLength={1000}
        />
        <div className="flex justify-between items-center mt-2">
          <p className="text-xs text-gray-500">
            Minimum 10 caractères, maximum 1000 caractères
          </p>
          <p
            className={`text-xs ${
              comment.length > 1000
                ? "text-red-600 font-semibold"
                : "text-gray-500"
            }`}
          >
            {comment.length} / 1000
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting || rating === 0 || comment.trim().length < 10}
        className="w-full sm:w-auto px-8 py-3 bg-gradient-sunset text-white font-semibold rounded-lg hover:shadow-sunset-lg hover-lift transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:transform-none flex items-center justify-center gap-2"
        aria-label="Publier votre avis"
      >
        {isSubmitting ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Publication en cours...</span>
          </>
        ) : (
          <>
            <Star className="w-5 h-5" />
            <span>Publier mon avis</span>
          </>
        )}
      </button>

      {/* Info Message */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">
          <strong>Note :</strong> Votre avis sera visible publiquement après
          validation. Merci de rester respectueux et constructif.
        </p>
      </div>
    </div>
  );
};

export default NewReview;
