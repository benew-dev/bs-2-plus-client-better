"use client";

import { memo, useContext, useState, useEffect } from "react";
import { Heart, Package, Trash2, ShoppingCart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "react-toastify";
import AuthContext from "@/context/AuthContext";
import CartContext from "@/context/CartContext";

const FavoriteProducts = () => {
  // ✅ user vient directement d'AuthContext (session Better Auth + optimistic update fusionnés)
  const { user, toggleFavorite } = useContext(AuthContext);
  const { addItemToCart } = useContext(CartContext);

  const [isClient, setIsClient] = useState(false);
  const [removingIds, setRemovingIds] = useState(new Set());

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleRemoveFavorite = async (productId, productName) => {
    try {
      setRemovingIds((prev) => new Set(prev).add(productId));

      await toggleFavorite(productId, productName, null, "remove");
    } catch (error) {
      console.error("Error removing favorite:", error);
      toast.error("Erreur lors de la suppression du favori");
    } finally {
      setRemovingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const handleAddToCart = (productId, e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (!user) {
        return toast.error("Connectez-vous pour ajouter au panier !");
      }

      addItemToCart({ product: productId });
      toast.success("Produit ajouté au panier !");
    } catch (error) {
      toast.error("Erreur lors de l'ajout au panier");
      console.error("Error adding to cart:", error);
    }
  };

  // Skeleton loading
  if (!isClient || !user) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse bg-white rounded-lg shadow-sm p-4"
          >
            <div className="w-full h-48 bg-gray-200 rounded-lg mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  // ✅ user (AuthContext) est déjà la source de vérité fusionnée
  const favorites = user?.favorites || [];
  const hasFavorites = favorites.length > 0;

  if (!hasFavorites) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
        <div className="text-center max-w-md mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-pink-50 mb-6">
            <Heart className="w-10 h-10 text-pink-400" />
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-3">
            Aucun favori pour le moment
          </h3>

          <p className="text-gray-600 mb-6">
            Découvrez nos produits et ajoutez vos coups de cœur à vos favoris en
            cliquant sur l'icône ❤️
          </p>

          <Link
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Package className="w-5 h-5" />
            Découvrir nos produits
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-pink-50 flex items-center justify-center">
              <Heart className="w-6 h-6 text-pink-500 fill-pink-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Mes Favoris</h2>
              <p className="text-sm text-gray-500 mt-1">
                {favorites.length} produit{favorites.length > 1 ? "s" : ""} dans
                vos favoris
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid de produits favoris */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {favorites.map((favorite) => {
          const isRemoving = removingIds.has(favorite.productId);

          return (
            <article
              key={favorite.productId}
              className={`group bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 ${
                isRemoving ? "opacity-50 scale-95" : ""
              }`}
            >
              <Link href={`/shop/${favorite.productId}`} className="block">
                {/* Image du produit */}
                <div className="relative w-full h-48 bg-gray-50 overflow-hidden">
                  {favorite.productImage?.url ? (
                    <Image
                      src={favorite.productImage.url}
                      alt={favorite.productName}
                      fill
                      className="object-contain group-hover:scale-105 transition-transform duration-500 p-2"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      onError={(e) => {
                        e.currentTarget.src = "/images/default_product.png";
                      }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <Package className="w-16 h-16 text-gray-300" />
                    </div>
                  )}
                </div>

                {/* Contenu */}
                <div className="p-4 space-y-3">
                  {/* Nom du produit */}
                  <h3 className="font-semibold text-base text-gray-900 line-clamp-2 min-h-[3rem] group-hover:text-blue-600 transition-colors">
                    {favorite.productName}
                  </h3>

                  {/* Date d'ajout */}
                  <p className="text-xs text-gray-500">
                    Ajouté le{" "}
                    {new Date(favorite.addedAt).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    {/* Bouton Ajouter au panier */}
                    <button
                      onClick={(e) => handleAddToCart(favorite.productId, e)}
                      disabled={isRemoving}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Ajouter au panier"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      <span>Ajouter</span>
                    </button>

                    {/* Bouton Retirer des favoris */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveFavorite(
                          favorite.productId,
                          favorite.productName,
                        );
                      }}
                      disabled={isRemoving}
                      className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Retirer des favoris"
                    >
                      {isRemoving ? (
                        <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <Trash2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default memo(FavoriteProducts);
