"use client";

import { memo, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "react-toastify";
import Link from "next/link";
import Image from "next/image";
import { Heart, ShoppingCart } from "lucide-react";

import CartContext from "@/context/CartContext";
import { INCREASE } from "@/helpers/constants";
import AuthContext from "@/context/AuthContext";

const ProductItem = memo(({ product }) => {
  const { addItemToCart, updateCart, cart } = useContext(CartContext);
  // ✅ user vient directement d'AuthContext (session + optimistic update fusionnés)
  const { user, toggleFavorite } = useContext(AuthContext);

  // ✅ État de loading pour le bouton Favoris
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // Vérification de sécurité pour s'assurer que product est un objet valide
  if (!product || typeof product !== "object") {
    return null;
  }

  const inStock = product.stock > 0;
  const productId = product._id || "";
  const productName = product.name || "Produit sans nom";
  const productPrice = product.price || 0;
  const productCategory = product.category?.categoryName || "Non catégorisé";

  // URL de l'image avec fallback
  const imageUrl = product.images?.[0]?.url || "/images/default_product.png";

  // ✅ Calculer si le produit est dans les favoris
  const isFavorite = useMemo(() => {
    if (!user || !user.favorites || !Array.isArray(user.favorites)) {
      return false;
    }

    return user.favorites.some(
      (fav) => fav.productId?.toString() === productId,
    );
  }, [user, productId]);

  // Handler pour ajouter au panier
  const addToCartHandler = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        if (!user) {
          return toast.error(
            "Connectez-vous pour ajouter des articles à votre panier !",
          );
        }

        const isProductInCart = cart.find((i) => i?.productId === productId);

        if (isProductInCart) {
          updateCart(isProductInCart, INCREASE);
        } else {
          addItemToCart({
            product: productId,
          });
        }
      } catch (error) {
        toast.error("Impossible d'ajouter au panier. Veuillez réessayer.");
        console.error("Erreur d'ajout au panier:", error);
      }
    },
    [user, cart, productId, updateCart, addItemToCart],
  );

  // ✅ Handler pour les favoris avec gestion du loading et prévention des clics multiples
  const toggleFavoriteHandler = useCallback(
    async (e) => {
      e.preventDefault();
      e.stopPropagation();

      // ✅ Empêcher les clics multiples
      if (favoriteLoading) {
        return;
      }

      if (!user) {
        return toast.error(
          "Connectez-vous pour ajouter des produits à vos favoris !",
        );
      }

      setFavoriteLoading(true);
      try {
        // Préparer l'image du produit
        const productImage = product.images?.[0] || {
          public_id: null,
          url: null,
        };

        // Appeler la méthode du context
        await toggleFavorite(productId, productName, productImage);
      } catch (error) {
        console.error("Error toggling favorite:", error);
        toast.error("Erreur lors de la mise à jour des favoris");
      } finally {
        setFavoriteLoading(false);
      }
    },
    [
      user,
      productId,
      productName,
      product.images,
      toggleFavorite,
      favoriteLoading,
    ],
  );

  return (
    <article className="group relative bg-white rounded-lg shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-100 w-full">
      <Link
        href={`/shop/${productId}`}
        className="block"
        aria-label={`Voir les détails du produit: ${productName}`}
      >
        {/* Badge de stock */}
        {!inStock && (
          <div className="absolute top-3 left-3 z-10 bg-red-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-lg">
            Rupture de stock
          </div>
        )}

        {/* Bouton Favoris avec état de loading et état visuel amélioré */}
        <button
          onClick={toggleFavoriteHandler}
          disabled={favoriteLoading}
          className={`absolute top-3 right-3 z-10 backdrop-blur-sm p-2 rounded-full shadow-md transition-all duration-200 ${
            isFavorite
              ? "bg-pink-50 hover:bg-pink-100"
              : "bg-white/90 hover:bg-white"
          } ${
            favoriteLoading
              ? "opacity-60 cursor-not-allowed scale-95"
              : "hover:scale-110"
          }`}
          aria-label={
            isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
          }
          aria-busy={favoriteLoading}
        >
          {favoriteLoading ? (
            <div className="w-4 h-4 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Heart
              className={`w-4 h-4 transition-all duration-200 ${
                isFavorite
                  ? "fill-pink-500 stroke-pink-500 scale-110"
                  : "stroke-gray-700 hover:stroke-pink-500 hover:scale-105"
              }`}
            />
          )}
        </button>

        {/* Image du produit */}
        <div className="relative w-full h-48 bg-white overflow-hidden">
          <Image
            src={imageUrl}
            alt={productName}
            title={productName}
            fill
            onError={(e) => {
              e.currentTarget.src = "/images/default_product.png";
              e.currentTarget.onerror = null;
            }}
            className="object-contain group-hover:scale-105 transition-transform duration-500 p-2"
            priority={false}
            loading="lazy"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        </div>

        {/* Contenu du produit */}
        <div className="p-4 space-y-2.5">
          {/* Catégorie */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
              {productCategory}
            </span>
          </div>

          {/* Nom du produit */}
          <h3
            className="font-semibold text-base text-gray-900 line-clamp-2 min-h-[2.5rem] group-hover:text-blue-600 transition-colors"
            title={productName}
          >
            {productName}
          </h3>

          {/* Prix */}
          <div className="pt-1">
            <span className="text-xl font-bold text-gray-900">
              {new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "Fdj",
              }).format(productPrice)}
            </span>
          </div>

          {/* Bouton d'ajout au panier */}
          <div className="pt-3">
            <button
              disabled={!inStock}
              className={`
                w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
                transition-all duration-200 shadow-sm
                ${
                  inStock
                    ? "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }
              `}
              onClick={addToCartHandler}
              aria-label={
                inStock ? "Ajouter au panier" : "Produit indisponible"
              }
              aria-disabled={!inStock}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{inStock ? "Ajouter au panier" : "Indisponible"}</span>
            </button>
          </div>
        </div>
      </Link>
    </article>
  );
});

// Ajouter displayName pour faciliter le débogage
ProductItem.displayName = "ProductItem";

export default ProductItem;
