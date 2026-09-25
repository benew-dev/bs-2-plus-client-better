"use client";

import { useRouter } from "next/navigation";
import { createContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useSession, authClient } from "@/lib/auth-client"; // ✅ AJOUT

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // ✅ user vient de la session Better Auth, plus de state local dupliqué
  const { data: session, refetch: refetchSession } = useSession();
  const sessionUser = session?.user ?? null;

  // ✅ Favoris optimistes séparés de la session (évite le souci de cookieCache stale)
  const [optimisticFavorites, setOptimisticFavorites] = useState(null);

  // Resynchroniser avec la session dès qu'elle change côté serveur
  useEffect(() => {
    setOptimisticFavorites(null); // on relâche l'override optimiste
  }, [sessionUser?.favorites]);

  const user = sessionUser
    ? {
        ...sessionUser,
        favorites: optimisticFavorites ?? sessionUser.favorites ?? [],
      }
    : null;

  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState(false);

  const router = useRouter();

  /**
   * Force un refetch de la session en bypassant le cookieCache
   * (nécessaire car cookieCache.maxAge = 5min peut renvoyer une session périmée)
   */
  const forceRefreshSession = async () => {
    try {
      await authClient.getSession({ query: { disableCookieCache: true } });
      await refetchSession();
    } catch (err) {
      console.warn("[AuthContext] Failed to refresh session:", err);
    }
  };

  /**
   * Met à jour le profil utilisateur via l'API qui utilise Better Auth
   */
  const updateProfile = async ({ phone, address }) => {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        phone: phone.trim(),
        address,
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me/update`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
          credentials: "include",
        },
      );

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        let errorMessage = "";
        switch (res.status) {
          case 400:
            if (data.errors) {
              const firstErrorKey = Object.keys(data.errors)[0];
              errorMessage =
                data.errors[firstErrorKey] || "Données de profil invalides";
            } else {
              errorMessage = data.message || "Données de profil invalides";
            }
            break;
          case 401:
            errorMessage = "Session expirée. Veuillez vous reconnecter";
            setTimeout(() => router.push("/login"), 2000);
            break;
          case 429:
            errorMessage = "Trop de tentatives. Réessayez plus tard.";
            break;
          default:
            errorMessage = data.message || "Erreur lors de la mise à jour";
        }

        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = res.status === 401;
        console.error(httpError, "AuthContext", "updateProfile", isCritical);

        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (data.success && data.data?.updatedUser) {
        toast.success("Profil mis à jour avec succès!");
        await forceRefreshSession(); // ✅ remplace setUser(data.data.updatedUser)
        setUpdated(true);

        const sessionUpdated = res.headers.get("X-Session-Updated");

        return { success: true, sessionUpdated };
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setError("La requête a pris trop de temps");
        console.error(error, "AuthContext", "updateProfile", false);
      } else {
        setError("Problème de connexion. Vérifiez votre connexion.");
        console.error(error, "AuthContext", "updateProfile", true);
      }

      console.error("Profile update error:", error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Met à jour le mot de passe utilisateur via Better Auth
   */
  const updatePassword = async ({
    currentPassword,
    newPassword,
    confirmPassword,
  }) => {
    try {
      setLoading(true);
      setError(null);

      if (!currentPassword || !newPassword) {
        const validationError = new Error("Tous les champs sont obligatoires");
        console.error(validationError, "AuthContext", "updatePassword", false);
        setError("Tous les champs sont obligatoires");
        setLoading(false);
        return;
      }

      if (currentPassword === newPassword) {
        const validationError = new Error(
          "Le nouveau mot de passe doit être différent",
        );
        console.error(validationError, "AuthContext", "updatePassword", false);
        setError("Le nouveau mot de passe doit être différent");
        setLoading(false);
        return;
      }

      if (newPassword.length < 8) {
        const validationError = new Error(
          "Minimum 8 caractères pour le nouveau mot de passe",
        );
        console.error(validationError, "AuthContext", "updatePassword", false);
        setError("Minimum 8 caractères pour le nouveau mot de passe");
        setLoading(false);
        return;
      }

      if (newPassword !== confirmPassword) {
        const validationError = new Error(
          "Le nouveau mot de passe et la confirmation ne correspondent pas",
        );
        console.error(validationError, "AuthContext", "updatePassword", false);
        setError(
          "Le nouveau mot de passe et la confirmation ne correspondent pas",
        );
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            revokeOtherSessions: true,
          }),
          signal: controller.signal,
          credentials: "include",
        },
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));

        let errorMessage = "";
        switch (res.status) {
          case 400:
            errorMessage =
              data.error || data.message || "Mot de passe actuel incorrect";
            break;
          case 401:
            errorMessage = "Session expirée. Veuillez vous reconnecter";
            setTimeout(() => router.push("/login"), 2000);
            break;
          case 429:
            errorMessage = "Trop de tentatives. Réessayez plus tard.";
            break;
          default:
            errorMessage =
              data.error || data.message || "Erreur lors de la mise à jour";
        }

        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = res.status === 401;
        console.error(httpError, "AuthContext", "updatePassword", isCritical);

        setError(errorMessage);
        setLoading(false);
        return;
      }

      toast.success("Mot de passe mis à jour avec succès!");

      setTimeout(() => {
        router.push("/me");
        router.refresh();
      }, 1000);
    } catch (error) {
      if (error.name === "AbortError") {
        setError("La requête a pris trop de temps");
        console.error(error, "AuthContext", "updatePassword", false);
      } else {
        setError("Problème de connexion. Vérifiez votre connexion.");
        console.error(error, "AuthContext", "updatePassword", true);
      }
      console.error("Password update error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FAVORIS : optimistic update local + resynchronisation session en arrière-plan
  // ✅ FAVORIS : optimistic update local + resynchronisation session en arrière-plan
  const toggleFavorite = async (
    productId,
    productName,
    productImage,
    action = "toggle",
  ) => {
    try {
      setError(null);

      if (!productId) {
        const validationError = new Error("L'ID du produit est obligatoire");
        console.error(validationError, "AuthContext", "toggleFavorite", false);
        setError("L'ID du produit est obligatoire");
        return { success: false };
      }

      const currentFavorites = user?.favorites || [];
      const backupFavorites = JSON.parse(JSON.stringify(currentFavorites));

      const favoriteIndex = currentFavorites.findIndex(
        (fav) => fav.productId?.toString() === productId,
      );
      const isCurrentlyInFavorites = favoriteIndex !== -1;

      let actionToPerform = action;
      if (action === "toggle") {
        actionToPerform = isCurrentlyInFavorites ? "remove" : "add";
      }

      let updatedFavorites;
      if (actionToPerform === "add") {
        updatedFavorites = [
          ...currentFavorites,
          {
            productId,
            productName: productName.trim(),
            productImage: productImage || { public_id: null, url: null },
            addedAt: new Date(),
          },
        ];
      } else if (actionToPerform === "remove") {
        updatedFavorites = currentFavorites.filter(
          (fav) => fav.productId?.toString() !== productId,
        );
      } else {
        updatedFavorites = currentFavorites;
      }

      setOptimisticFavorites(updatedFavorites);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      let res;
      try {
        res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/auth/me/favorites`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              productId,
              productName,
              productImage,
              action: actionToPerform,
            }),
            signal: controller.signal,
            credentials: "include",
          },
        );
      } finally {
        clearTimeout(timeoutId);
      }

      // ✅ Parser la réponse de façon défensive : ne tenter le JSON
      // que si le serveur en a réellement renvoyé
      const contentType = res.headers.get("content-type") || "";
      let data = null;

      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch (parseError) {
          console.error(
            "[toggleFavorite] Failed to parse JSON response:",
            parseError.message,
          );
        }
      }

      // ✅ GESTION DES ERREURS avec ROLLBACK
      if (!res.ok) {
        let errorMessage = "";

        if (data?.message) {
          errorMessage = data.message;
        } else {
          // Pas de JSON exploitable : message basé sur le statut HTTP
          switch (res.status) {
            case 400:
              errorMessage = "Données invalides";
              break;
            case 401:
              errorMessage = "Session expirée. Veuillez vous reconnecter";
              setTimeout(() => router.push("/login"), 2000);
              break;
            case 404:
              errorMessage = "Service indisponible (route introuvable)";
              break;
            case 429:
              errorMessage = "Trop de tentatives. Réessayez plus tard.";
              break;
            default:
              errorMessage = `Erreur lors de l'opération (${res.status})`;
          }
        }

        // ✅ ROLLBACK local
        setOptimisticFavorites(backupFavorites);

        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = res.status === 401;
        console.error(httpError, "AuthContext", "toggleFavorite", isCritical);

        setError(errorMessage);
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }

      // ✅ Réponse ok mais pas de JSON exploitable : rollback aussi,
      // car on ne peut pas confirmer que l'opération a réussi côté serveur
      if (!data) {
        setOptimisticFavorites(backupFavorites);
        const errorMessage = "Réponse invalide du serveur";
        console.error(
          new Error(errorMessage),
          "AuthContext",
          "toggleFavorite",
          true,
        );
        setError(errorMessage);
        toast.error(errorMessage);
        return { success: false, error: errorMessage };
      }

      if (data.success && data.data?.favorites) {
        setOptimisticFavorites(data.data.favorites);
        forceRefreshSession();

        try {
          router.refresh();
        } catch (error) {
          console.warn("[toggleFavorite] Failed to refresh router:", error);
        }

        const isAdded = data.data.action === "added";
        toast.success(
          isAdded
            ? `${productName} ajouté aux favoris`
            : `${productName} retiré des favoris`,
        );

        return {
          success: true,
          isFavorite: isAdded,
          favorites: data.data.favorites,
        };
      }

      // ✅ success non confirmé par le payload : rollback par précaution
      setOptimisticFavorites(backupFavorites);
      return { success: false, error: "Réponse inattendue du serveur" };
    } catch (error) {
      console.error("[toggleFavorite] Error:", error.message);

      // ✅ ROLLBACK réseau : on revient à ce qu'était la session avant l'appel
      setOptimisticFavorites(null);

      let errorMessage = "Problème de connexion. Vérifiez votre connexion.";
      if (error.name === "AbortError") {
        errorMessage = "La requête a pris trop de temps";
        console.error(error, "AuthContext", "toggleFavorite", false);
      } else {
        console.error(error, "AuthContext", "toggleFavorite", true);
      }

      setError(errorMessage);
      toast.error(errorMessage);
      return { success: false, error: error.message };
    }
  };

  /**
   * Envoie un email via l'API
   */
  const sendEmail = async ({ subject, message }) => {
    try {
      setLoading(true);
      setError(null);

      if (!subject || !subject.trim()) {
        const validationError = new Error("Le sujet est obligatoire");
        console.error(validationError, "AuthContext", "sendEmail", false);
        setError("Le sujet est obligatoire");
        setLoading(false);
        return;
      }

      if (!message || !message.trim()) {
        const validationError = new Error("Le message est obligatoire");
        console.error(validationError, "AuthContext", "sendEmail", false);
        setError("Le message est obligatoire");
        setLoading(false);
        return;
      }

      if (subject.length > 200) {
        const validationError = new Error(
          "Le sujet est trop long (max 200 caractères)",
        );
        console.error(validationError, "AuthContext", "sendEmail", false);
        setError("Le sujet est trop long (max 200 caractères)");
        setLoading(false);
        return;
      }

      if (message.length > 5000) {
        const validationError = new Error(
          "Le message est trop long (max 5000 caractères)",
        );
        console.error(validationError, "AuthContext", "sendEmail", false);
        setError("Le message est trop long (max 5000 caractères)");
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ subject, message }),
        signal: controller.signal,
        credentials: "include",
      });

      clearTimeout(timeoutId);
      const data = await res.json();

      if (!res.ok) {
        let errorMessage = "";
        switch (res.status) {
          case 400:
            errorMessage = data.message || "Données invalides";
            break;
          case 401:
            errorMessage = "Session expirée. Veuillez vous reconnecter";
            setTimeout(() => router.push("/login"), 2000);
            break;
          case 404:
            errorMessage = "Utilisateur non trouvé";
            break;
          case 429:
            errorMessage = "Trop de tentatives. Réessayez plus tard.";
            break;
          case 503:
            errorMessage = "Service d'email temporairement indisponible";
            break;
          default:
            errorMessage = data.message || "Erreur lors de l'envoi";
        }

        const httpError = new Error(`HTTP ${res.status}: ${errorMessage}`);
        const isCritical = [401, 503].includes(res.status);
        console.error(httpError, "AuthContext", "sendEmail", isCritical);

        setError(errorMessage);
        setLoading(false);
        return;
      }

      if (data.success) {
        toast.success("Message envoyé avec succès!");
        router.push("/me");
      }
    } catch (error) {
      if (error.name === "AbortError") {
        setError("La requête a pris trop de temps");
        console.error(error, "AuthContext", "sendEmail", false);
      } else {
        setError("Problème de connexion. Vérifiez votre connexion.");
        console.error(error, "AuthContext", "sendEmail", true);
      }
      console.error("Email send error:", error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Nettoie l'état utilisateur (à la déconnexion, par ex.)
   */
  const clearUser = () => {
    setOptimisticFavorites(null);
    setError(null);
    setUpdated(false);
  };

  /**
   * Nettoie les erreurs
   */
  const clearErrors = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        error,
        loading,
        updated,
        setUpdated,
        setLoading,
        updateProfile,
        updatePassword,
        toggleFavorite,
        sendEmail,
        clearUser,
        clearErrors,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
