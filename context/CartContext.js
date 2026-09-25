"use client";

import { createContext, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";
import { DECREASE, INCREASE } from "@/helpers/constants";

const CartContext = createContext();

// ✅ Timeout augmenté : un cold start Vercel (auth + connexion Mongo) peut
// dépasser largement 5s, ce qui déclenchait des AbortError trompeurs
const REQUEST_TIMEOUT = 15000;

// ✅ Parsing JSON défensif partagé : évite qu'une réponse HTML (mauvais
// domaine, 404 générique, corps vide) ne fasse planter res.json() et
// remonte comme une fausse "erreur de connexion" dans le catch générique
async function parseJsonSafely(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return await res.json();
  } catch (parseError) {
    console.error(
      "[CartContext] Failed to parse JSON response:",
      parseError.message,
    );
    return null;
  }
}

export const CartProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState([]);
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);
  const [error, setError] = useState(null);

  // Récupérer le panier
  const setCartToState = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      let res;
      try {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          signal: controller.signal,
          credentials: "include",
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await parseJsonSafely(res);

      if (!res.ok) {
        let errorMessage = "";
        if (data?.message) {
          errorMessage = data.message;
        } else {
          switch (res.status) {
            case 401:
              errorMessage = "Session expirée. Veuillez vous reconnecter";
              break;
            case 404:
              errorMessage = "Service indisponible (route introuvable)";
              break;
            case 429:
              errorMessage = "Trop de tentatives. Réessayez plus tard.";
              break;
            default:
              errorMessage = `Erreur lors de la récupération du panier (${res.status})`;
          }
        }

        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = res.status === 401;
        console.log(httpError, "CartContext", "setCartToState", isCritical);

        setError(errorMessage);
        return;
      }

      if (!data) {
        const errorMessage = "Réponse invalide du serveur";
        console.error(
          new Error(errorMessage),
          "CartContext",
          "setCartToState",
          true,
        );
        setError(errorMessage);
        return;
      }

      if (data.success) {
        remoteDataInState(data);
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setError("La requête a pris trop de temps");
        console.error(error, "CartContext", "setCartToState", false);
      } else {
        setError("Problème de connexion. Vérifiez votre connexion.");
        console.error(error, "CartContext", "setCartToState", true);
      }
      console.error("Cart retrieval error:", error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Ajouter au panier
  const addItemToCart = async ({ product, quantity = 1 }) => {
    try {
      if (!product) {
        const validationError = new Error("Produit invalide");
        console.log(validationError, "CartContext", "addItemToCart", false);
        toast.error("Produit invalide");
        return;
      }

      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      let res;
      try {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            productId: product,
            quantity: parseInt(quantity, 10),
          }),
          signal: controller.signal,
          credentials: "include",
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await parseJsonSafely(res);

      if (!res.ok) {
        let toastMessage = "";

        if (data?.message) {
          toastMessage = data.message;
        } else {
          switch (res.status) {
            case 400:
              toastMessage = "Stock insuffisant";
              break;
            case 401:
              toastMessage = "Veuillez vous connecter";
              break;
            case 404:
              toastMessage = "Service indisponible (route introuvable)";
              break;
            case 409:
              toastMessage = "Produit déjà dans le panier";
              break;
            default:
              toastMessage = `Erreur lors de l'ajout (${res.status})`;
          }
        }

        const httpError = new Error(`HTTP ${res.status}: ${toastMessage}`);
        const isCritical = res.status === 401;
        console.log(httpError, "CartContext", "addItemToCart", isCritical);

        if (res.status === 409) {
          toast.info(toastMessage);
        } else {
          toast.error(toastMessage);
        }
        return;
      }

      if (!data) {
        toast.error("Réponse invalide du serveur");
        console.error(
          new Error("Réponse invalide du serveur"),
          "CartContext",
          "addItemToCart",
          true,
        );
        return;
      }

      if (data.success) {
        await setCartToState();
        toast.success("Produit ajouté au panier");
      }
    } catch (error) {
      if (error.name === "AbortError") {
        toast.error("La connexion est trop lente");
        console.error(error, "CartContext", "addItemToCart", false);
      } else {
        toast.error("Problème de connexion");
        console.error(error, "CartContext", "addItemToCart", true);
      }
      console.error("Add to cart error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Mettre à jour quantité
  const updateCart = async (product, action) => {
    try {
      if (!product?.id || ![INCREASE, DECREASE].includes(action)) {
        const validationError = new Error(
          "Données invalides pour mise à jour panier",
        );
        console.log(validationError, "CartContext", "updateCart", false);
        toast.error("Données invalides");
        return;
      }

      if (action === DECREASE && product.quantity === 1) {
        toast.info("Utilisez le bouton Supprimer pour retirer cet article");
        return;
      }

      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      let res;
      try {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            product,
            value: action,
          }),
          signal: controller.signal,
          credentials: "include",
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await parseJsonSafely(res);

      if (!res.ok) {
        const errorMessage =
          data?.message ||
          (res.status === 404
            ? "Service indisponible (route introuvable)"
            : `Erreur de mise à jour (${res.status})`);

        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = res.status === 401;
        console.log(httpError, "CartContext", "updateCart", isCritical);

        toast.error(errorMessage);
        return;
      }

      if (!data) {
        toast.error("Réponse invalide du serveur");
        console.error(
          new Error("Réponse invalide du serveur"),
          "CartContext",
          "updateCart",
          true,
        );
        return;
      }

      if (data.success) {
        await setCartToState();
        toast.success(
          action === INCREASE ? "Quantité augmentée" : "Quantité diminuée",
        );
      }
    } catch (error) {
      if (error.name === "AbortError") {
        toast.error("La connexion est trop lente");
        console.error(error, "CartContext", "updateCart", false);
      } else {
        toast.error("Problème de connexion");
        console.error(error, "CartContext", "updateCart", true);
      }
      console.error("Update cart error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer du panier
  const deleteItemFromCart = async (id) => {
    try {
      if (!id) {
        const validationError = new Error(
          "ID invalide pour suppression panier",
        );
        console.log(
          validationError,
          "CartContext",
          "deleteItemFromCart",
          false,
        );
        toast.error("ID invalide");
        return;
      }

      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      let res;
      try {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cart/${id}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          signal: controller.signal,
          credentials: "include",
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await parseJsonSafely(res);

      if (!res.ok) {
        const errorMessage =
          data?.message ||
          (res.status === 404
            ? "Article ou service introuvable"
            : `Erreur de suppression (${res.status})`);

        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = [401, 404].includes(res.status);
        console.log(httpError, "CartContext", "deleteItemFromCart", isCritical);

        toast.error(errorMessage);
        return;
      }

      if (!data) {
        toast.error("Réponse invalide du serveur");
        console.error(
          new Error("Réponse invalide du serveur"),
          "CartContext",
          "deleteItemFromCart",
          true,
        );
        return;
      }

      if (data.success) {
        await setCartToState();
        toast.success("Article supprimé");
      }
    } catch (error) {
      if (error.name === "AbortError") {
        toast.error("La connexion est trop lente");
        console.error(error, "CartContext", "deleteItemFromCart", false);
      } else {
        toast.error("Problème de connexion");
        console.error(error, "CartContext", "deleteItemFromCart", true);
      }
      console.error("Delete cart item error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const clearCartOnLogout = () => {
    setCart([]);
    setLoading(false);
    setCartCount(0);
    setCartTotal(0);
  };

  const remoteDataInState = (response) => {
    try {
      const normalizedCart =
        response.data.cart?.map((item) => ({
          ...item,
          quantity: parseInt(item.quantity, 10) || 1,
        })) || [];

      setCart(normalizedCart);
      setCartCount(response.data.cartCount || 0);
      setCartTotal(response.data.cartTotal || 0);
    } catch (error) {
      console.error(error, "CartContext", "remoteDataInState", true);
      console.error("Error normalizing cart data:", error.message);

      setCart([]);
      setCartCount(0);
      setCartTotal(0);
    }
  };

  const contextValue = useMemo(
    () => ({
      loading,
      cart,
      cartCount,
      cartTotal,
      error,
      setCartToState,
      addItemToCart,
      updateCart,
      deleteItemFromCart,
      clearError,
      clearCartOnLogout,
    }),
    [loading, cart, cartCount, cartTotal, error],
  );

  return (
    <CartContext.Provider value={contextValue}>{children}</CartContext.Provider>
  );
};

export default CartContext;
