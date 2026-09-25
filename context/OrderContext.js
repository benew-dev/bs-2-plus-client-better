"use client";

import { useRouter } from "next/navigation";
import { createContext, useState } from "react";
import { captureClientError } from "@/monitoring/sentry";

const OrderContext = createContext();

// ✅ Parsing JSON défensif, même logique que CartContext :
// évite qu'une réponse non-JSON (HTML, 404, corps vide) ne plante
// silencieusement dans le catch générique avec un message trompeur
async function parseJsonSafely(res) {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  try {
    return await res.json();
  } catch (parseError) {
    console.error(
      "[OrderContext] Failed to parse JSON response:",
      parseError.message,
    );
    return null;
  }
}

export const OrderProvider = ({ children }) => {
  const [error, setError] = useState(null);
  const [updated, setUpdated] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [lowStockProducts, setLowStockProducts] = useState(null);

  // États pour les autres parties de l'app (shipping, etc.)
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [orderInfo, setOrderInfo] = useState(null);

  const router = useRouter();

  const addOrder = async (orderInfo) => {
    try {
      setError(null);
      setUpdated(true);
      setLowStockProducts(null);

      // Validation basique
      if (!orderInfo) {
        const validationError = new Error("Données de commande manquantes");
        captureClientError(validationError, "OrderContext", "addOrder", false);
        setError("Données de commande manquantes");
        setUpdated(false);
        return;
      }

      if (!orderInfo.orderItems || orderInfo.orderItems.length === 0) {
        const validationError = new Error(
          "Panier vide lors de la création de commande",
        );
        captureClientError(validationError, "OrderContext", "addOrder", false);
        setError("Votre panier est vide");
        setUpdated(false);
        return;
      }

      // Simple fetch avec timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s pour une commande

      let res;
      try {
        res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/orders/webhook`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(orderInfo),
            signal: controller.signal,
            credentials: "include",
          },
        );
      } finally {
        clearTimeout(timeoutId);
      }

      // ✅ Parsing défensif : ne tente le JSON que si le content-type l'indique
      const data = await parseJsonSafely(res);

      if (!res.ok) {
        let errorMessage = "";

        if (data?.message) {
          errorMessage = data.message;
        }

        switch (res.status) {
          case 400:
            errorMessage = errorMessage || "Données de commande invalides";
            break;
          case 401:
            errorMessage = "Session expirée. Veuillez vous reconnecter.";
            setTimeout(() => router.push("/login"), 2000);
            break;
          case 404:
            errorMessage = errorMessage || "Utilisateur non trouvé";
            setTimeout(() => router.push("/login"), 2000);
            break;
          case 409:
            // Produits indisponibles - Cas spécial critique pour l'e-commerce
            if (data?.unavailableProducts) {
              setLowStockProducts(data.unavailableProducts);
              errorMessage = "Produits indisponibles détectés";
              router.push("/error");
            } else {
              errorMessage =
                errorMessage || "Certains produits ne sont plus disponibles";
            }
            break;
          case 429:
            errorMessage =
              errorMessage || "Trop de tentatives. Réessayez plus tard.";
            break;
          default:
            errorMessage =
              errorMessage ||
              `Erreur lors du traitement de la commande (${res.status})`;
        }

        // Monitoring pour erreurs HTTP - Critique pour session/utilisateur/stock
        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = [401, 404, 409].includes(res.status);
        captureClientError(httpError, "OrderContext", "addOrder", isCritical);

        setError(errorMessage);
        setUpdated(false);
        return;
      }

      // ✅ Réponse ok mais pas de JSON exploitable : ne pas prétendre au succès
      if (!data) {
        const responseError = new Error(
          "Réponse invalide du serveur lors de la création de commande",
        );
        captureClientError(responseError, "OrderContext", "addOrder", true);
        setError("Réponse invalide du serveur. Veuillez réessayer.");
        setUpdated(false);
        return;
      }

      // Succès - Validation de la réponse
      if (data.success && data.id) {
        setOrderId(data.id);
        setError(null);

        console.log("Order created:", data.orderNumber);
        router.push("/confirmation");
      } else {
        // Succès partiel ou réponse malformée - Critique pour l'e-commerce
        const responseError = new Error(
          "Réponse API malformée lors de la création de commande",
        );
        captureClientError(responseError, "OrderContext", "addOrder", true);
        setError("Erreur lors de la création de la commande");
      }
    } catch (error) {
      // Erreurs réseau/système
      if (error.name === "AbortError") {
        setError("La requête a pris trop de temps. Veuillez réessayer.");
        captureClientError(error, "OrderContext", "addOrder", true);
      } else if (
        error.name === "TypeError" &&
        error.message.includes("fetch")
      ) {
        setError("Problème de connexion. Vérifiez votre connexion.");
        captureClientError(error, "OrderContext", "addOrder", true);
      } else if (error instanceof SyntaxError) {
        setError("Réponse serveur invalide.");
        captureClientError(error, "OrderContext", "addOrder", true);
      } else {
        setError("Problème de connexion. Vérifiez votre connexion.");
        captureClientError(error, "OrderContext", "addOrder", true);
      }
      console.error("Order creation error:", error.message);
    } finally {
      setUpdated(false);
    }
  };

  const clearErrors = () => {
    setError(null);
  };

  // Wrapper pour setters avec monitoring des erreurs critiques
  const safeSetPaymentTypes = (types) => {
    try {
      if (!Array.isArray(types)) {
        const validationError = new Error(
          "Types de paiement invalides (non-array)",
        );
        captureClientError(
          validationError,
          "OrderContext",
          "setPaymentTypes",
          false,
        );
        setPaymentTypes([]);
        return;
      }
      setPaymentTypes(types);
    } catch (error) {
      captureClientError(error, "OrderContext", "setPaymentTypes", true);
      setPaymentTypes([]);
    }
  };

  return (
    <OrderContext.Provider
      value={{
        error,
        updated,
        orderId,
        lowStockProducts,
        paymentTypes,
        orderInfo,
        setPaymentTypes,
        setOrderInfo,
        addOrder,
        setUpdated,
        clearErrors,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
};

export default OrderContext;
