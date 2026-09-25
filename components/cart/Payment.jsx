"use client";

import {
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { captureException } from "@/monitoring/sentry";

// Imports optimisés
import CartContext from "@/context/CartContext";
import OrderContext from "@/context/OrderContext";
import { isArrayEmpty, formatPrice, safeValue } from "@/helpers/helpers";
import PaymentPageSkeleton from "../skeletons/PaymentPageSkeleton";
import { validateDjiboutiPayment } from "@/helpers/validation";
import {
  CreditCard,
  HandCoins,
  Info,
  LoaderCircle,
  ShoppingCart,
  Smartphone,
} from "lucide-react";
import ItemShipping from "./components/ItemShipping";

// Chargement dynamique des composants
const BreadCrumbs = dynamic(() => import("@/components/layouts/BreadCrumbs"), {
  loading: () => <div className="h-12 animate-pulse bg-gray-200 rounded"></div>,
  ssr: true,
});

// Ajouter cette constante après les imports
const PLATFORM_CONFIG = {
  WAAFI: {
    color: "bg-purple-100 text-purple-700 border-purple-200",
    icon: Smartphone,
    displayName: "Waafi",
    requiresAccount: true,
  },
  "D-MONEY": {
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Smartphone,
    displayName: "D-Money",
    requiresAccount: true,
  },
  "CAC-PAY": {
    color: "bg-green-500 text-green-700 border-green-300",
    icon: Smartphone,
    displayName: "CAC Pay",
    requiresAccount: true,
  },
  "BCI-PAY": {
    color: "bg-orange-100 text-orange-700 border-orange-200",
    icon: Smartphone,
    displayName: "BCI Pay",
    requiresAccount: true,
  },
  CASH: {
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: HandCoins,
    displayName: "Espèces",
    requiresAccount: false,
    description: "Paiement en espèces à la livraison",
  },
};

// Squelette pour chargement des items
const CartItemSkeleton = memo(() => (
  <div className="animate-pulse">
    <div className="flex items-center mb-4">
      <div className="w-20 h-20 rounded bg-gray-200"></div>
      <div className="ml-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-32"></div>
        <div className="h-3 bg-gray-200 rounded w-20"></div>
      </div>
    </div>
  </div>
));
CartItemSkeleton.displayName = "CartItemSkeleton";

/**
 * Composant de paiement
 * Permet à l'utilisateur de sélectionner un moyen de paiement local et finaliser sa commande
 */
const Payment = ({ paymentTypes }) => {
  // États locaux
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [errors, setErrors] = useState({});
  const [dataInitialized, setDataInitialized] = useState(false);

  // Référence pour limiter les soumissions multiples
  const submitAttempts = useRef(0);

  // Contextes
  const { cart, cartTotal, cartCount } = useContext(CartContext);

  const { orderInfo, setOrderInfo, setPaymentTypes, error, clearErrors } =
    useContext(OrderContext);

  const router = useRouter();

  // Calcul du montant total
  const totalAmount = useMemo(() => {
    return Number(safeValue(cartTotal?.toFixed(2), 0));
  }, [cartTotal]);

  // Chemins de fil d'Ariane
  const breadCrumbs = useMemo(() => {
    const steps = [
      { name: "Accueil", url: "/" },
      { name: "Panier", url: "/cart" },
    ];

    steps.push({ name: "Paiement", url: "" });

    return steps;
  }, []);

  // Initialisation des données et validation
  useEffect(() => {
    const initializePaymentPage = async () => {
      try {
        setIsLoading(true);

        // Préparation des éléments de commande
        const orderItems = prepareOrderItems();
        setOrderInfo({ orderItems });

        // Précharger la page de confirmation
        router.prefetch("/confirmation");

        // Vérifier que les infos nécessaires sont présentes
        if (!cartTotal || cartTotal < 0 || cartCount < 0) {
          toast.error("Informations de commande incomplètes", {
            position: "bottom-right",
            autoClose: 5000,
          });
          return router.push("/cart");
        }

        // Vérifier si des moyens de paiement sont disponibles
        if (isArrayEmpty(paymentTypes)) {
          toast.error("Aucun moyen de paiement n'est disponible actuellement", {
            position: "bottom-right",
            autoClose: 5000,
          });
        }

        setDataInitialized(true);
      } catch (error) {
        console.error(
          "Erreur lors de l'initialisation de la page de paiement:",
          error,
        );
        captureException(error, {
          tags: { component: "Payment", action: "initializePaymentPage" },
        });

        toast.error(
          "Une erreur est survenue lors du chargement des options de paiement",
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (!dataInitialized) {
      initializePaymentPage();
    }
  }, [
    paymentTypes,
    dataInitialized,
    cartTotal,
    cartCount,
    router,
    setOrderInfo,
  ]);

  // Handle auth context updates
  useEffect(() => {
    if (error) {
      toast.error(error);
      clearErrors();
    }
  }, [error, clearErrors]);

  // Fonction pour préparer les éléments de commande
  const prepareOrderItems = useCallback(() => {
    if (!Array.isArray(cart)) return [];

    return cart.map((item) => ({
      cartId: item?.id,
      product: item?.productId,
      name: item?.productName || "Produit sans nom",
      category: "Non catégorisé",
      quantity: item?.quantity || 1,
      price: item?.price,
      image: item?.imageUrl || "/images/default_product.png",
      subtotal: Number(item?.subtotal),
    }));
  }, [cart]);

  // Handlers pour les changements de champs
  const handlePaymentChange = useCallback((payment) => {
    setSelectedPayment(payment);
  }, []);

  const handleAccountNameChange = useCallback((e) => {
    setAccountName(e.target.value.trim());
  }, []);

  const handleAccountNumberChange = useCallback((e) => {
    const rawValue = e.target.value.replace(/[^\d]/g, "");
    setAccountNumber(rawValue);
  }, []);

  // Fonction d'adaptation pour mapper tes champs vers le schéma existant
  const mapToPaymentSchema = (platform, accountName, accountNumber) => {
    return {
      paymentPlatform: platform?.toLowerCase().replace(/[\s-]/g, "-"),
      accountHolderName: accountName,
      phoneNumber: accountNumber,
    };
  };

  const validatePaymentData = async () => {
    // Validation universelle d'abord
    if (!selectedPayment || !accountName || !accountNumber) {
      return {
        isValid: false,
        errors: { general: "Tous les champs sont requis" },
      };
    }

    // Validation du nom (toujours requise)
    const nameWords = accountName.trim().split(/\s+/);
    if (nameWords.length < 2 || nameWords.some((w) => w.length < 2)) {
      return {
        isValid: false,
        errors: { accountName: "Prénom et nom complets requis" },
      };
    }

    // Validation selon le type de compte
    const cleanNumber = accountNumber.replace(/\D/g, "");

    let validationPassed = false;

    // Si c'est un numéro djiboutien (77XXXXXX)
    if (cleanNumber.match(/^77[0-9]{6}$/)) {
      const paymentData = mapToPaymentSchema(
        selectedPayment.platform,
        accountName,
        cleanNumber,
      );

      const validationResult = await validateDjiboutiPayment(paymentData);

      if (!validationResult.isValid) {
        const errorMessages = Object.values(validationResult.errors);
        errorMessages.forEach((msg) => {
          toast.error(msg, { position: "bottom-right" });
        });
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }
      validationPassed = true;
    } else {
      // Validation pour TOUS les autres types de paiement
      if (cleanNumber.length < 4 || cleanNumber.length > 30) {
        toast.error(
          "Le numéro de compte doit contenir entre 4 et 30 chiffres",
          {
            position: "bottom-right",
          },
        );
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      if (/^0+$/.test(cleanNumber) || /^(\d)\1+$/.test(cleanNumber)) {
        toast.error("Numéro de compte invalide", {
          position: "bottom-right",
        });
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      const words = accountName.trim().split(/\s+/);
      if (words.length < 2 || words.some((w) => w.length < 2)) {
        toast.error("Veuillez saisir votre prénom et nom complets", {
          position: "bottom-right",
        });
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      validationPassed = true;
    }

    if (!validationPassed) {
      toast.error("Validation échouée", { position: "bottom-right" });
      setIsSubmitting(false);
      submitAttempts.current = 0;
      return;
    }

    return { isValid: true, data: { accountName, accountNumber: cleanNumber } };
  };

  // Modifier la fonction handlePayment
  const handlePayment = useCallback(async () => {
    submitAttempts.current += 1;
    if (submitAttempts.current > 1) {
      setTimeout(() => {
        submitAttempts.current = 0;
      }, 5000);
      return toast.info("Traitement en cours, veuillez patienter...", {
        position: "bottom-right",
      });
    }

    try {
      setIsSubmitting(true);

      // Vérifier qu'une méthode de paiement est sélectionnée
      if (!selectedPayment) {
        toast.error("Veuillez sélectionner une méthode de paiement", {
          position: "bottom-right",
        });
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      // Si c'est un paiement cash, pas besoin de valider les infos de compte
      if (selectedPayment.platform === "CASH") {
        const paymentInfo = {
          typePayment: "CASH",
          paymentAccountNumber: "N/A",
          paymentAccountName: "Paiement en espèces",
          paymentDate: new Date().toISOString(),
          isCashPayment: true,
          cashPaymentNote:
            "Le paiement sera effectué en espèces à la livraison",
        };

        const finalOrderInfo = {
          ...orderInfo,
          paymentInfo,
          totalAmount: totalAmount,
        };

        setOrderInfo(finalOrderInfo);
        router.push("/review-order");

        setSelectedPayment(null);
        setAccountName("");
        setAccountNumber("");

        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      // Pour les autres méthodes de paiement, valider normalement
      const validationResult = await validatePaymentData();
      if (!validationResult.isValid) {
        const errorMessages = Object.values(validationResult.errors || {});
        errorMessages.forEach((msg) =>
          toast.error(msg, { position: "bottom-right" }),
        );
        setIsSubmitting(false);
        submitAttempts.current = 0;
        return;
      }

      // Création des informations de paiement
      const paymentInfo = {
        typePayment: selectedPayment.platform,
        paymentAccountNumber: accountNumber,
        paymentAccountName: accountName,
        paymentDate: new Date().toISOString(),
        isCashPayment: false,
      };

      const finalOrderInfo = {
        ...orderInfo,
        paymentInfo,
        totalAmount: totalAmount,
      };

      setPaymentTypes(paymentTypes);

      setOrderInfo(finalOrderInfo);
      router.push("/review-order");

      setSelectedPayment(null);
      setAccountName("");
      setAccountNumber("");
    } catch (error) {
      console.error("Erreur lors du traitement du paiement:", error);
      captureException(error, {
        tags: { component: "Payment", action: "handlePayment" },
        extra: {
          hasOrderInfo: !!orderInfo,
          hasPaymentType: !!selectedPayment,
        },
      });

      toast.error(
        error.message ||
          "Une erreur est survenue lors du traitement du paiement",
        {
          position: "bottom-right",
          autoClose: 5000,
        },
      );
    } finally {
      setIsSubmitting(false);
      submitAttempts.current = 0;
    }
  }, [
    selectedPayment,
    accountName,
    accountNumber,
    totalAmount,
    orderInfo,
    setOrderInfo,
    setPaymentTypes,
    paymentTypes,
    router,
  ]);

  if (isLoading) {
    return <PaymentPageSkeleton />;
  }

  if (!cart || !Array.isArray(cart) || cartCount === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="flex flex-col items-center justify-center">
          <div className="bg-blue-50 rounded-full p-6 mb-6">
            <ShoppingCart size={72} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-semibold mb-3">Votre panier est vide</h2>
          <p className="text-gray-600 mb-6 max-w-md">
            Vous devez ajouter des produits à votre panier avant de procéder au
            paiement.
          </p>
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Découvrir nos produits
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BreadCrumbs breadCrumbs={breadCrumbs} />

      <section className="py-8 md:py-10">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-6">
            <main className="md:w-2/3">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-6 pb-2 border-b">
                  Choisissez votre moyen de paiement
                </h2>

                {isArrayEmpty(paymentTypes) ? (
                  <NoPaymentMethodsFound />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 mb-6">
                    {paymentTypes?.map((payment) => (
                      <PaymentMethodCard
                        key={payment?._id}
                        payment={payment}
                        isSelected={selectedPayment?._id === payment?._id}
                        onSelect={handlePaymentChange}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-8 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
                  <p className="flex items-start">
                    <Info className="mr-2" />
                    Cette transaction est sécurisée. Vos informations de
                    paiement ne sont pas stockées et sont transmises de manière
                    cryptée.
                  </p>
                </div>
              </div>
            </main>
            <aside className="md:w-1/3">
              <div className="bg-white shadow rounded-lg p-6 sticky top-24">
                <h2 className="font-semibold text-lg mb-6 pb-2 border-b">
                  Finaliser votre paiement
                </h2>

                {/* Afficher les champs seulement si ce n'est pas un paiement cash */}
                {selectedPayment?.platform !== "CASH" && (
                  <div className="space-y-4 mb-6">
                    <div className="form-group">
                      <label className="block text-gray-700 mb-1 font-medium text-sm">
                        Nom sur le compte{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={`w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-200 focus:outline-none transition-colors ${
                          errors.accountName
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300 bg-gray-50 hover:border-gray-400"
                        }`}
                        type="text"
                        placeholder="Nom complet sur le compte"
                        value={accountName}
                        onChange={handleAccountNameChange}
                        aria-invalid={errors.accountName ? "true" : "false"}
                        required
                      />
                      {errors.accountName && (
                        <p className="mt-1 text-red-500 text-xs">
                          {errors.accountName}
                        </p>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="block text-gray-700 mb-1 font-medium text-sm">
                        Numéro de compte <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={`w-full px-3 py-2 border rounded-md focus:ring focus:ring-blue-200 focus:outline-none transition-colors ${
                          errors.accountNumber
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300 bg-gray-50 hover:border-gray-400"
                        }`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Numéro de compte (chiffres uniquement)"
                        value={accountNumber}
                        onChange={handleAccountNumberChange}
                        aria-invalid={errors.accountNumber ? "true" : "false"}
                        autoComplete="off"
                        maxLength="30"
                        required
                      />
                      {errors.accountNumber && (
                        <p className="mt-1 text-red-500 text-xs">
                          {errors.accountNumber}
                        </p>
                      )}
                      <div className="mt-1 text-xs text-gray-500">
                        <p>
                          Saisissez uniquement les chiffres, minimum 4
                          caractères
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Message pour paiement cash */}
                {selectedPayment?.platform === "CASH" && (
                  <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <HandCoins
                        className="text-emerald-600 flex-shrink-0 mt-0.5"
                        size={20}
                      />
                      <div>
                        <p className="font-semibold text-emerald-900 mb-1">
                          Paiement en espèces
                        </p>
                        <p className="text-sm text-emerald-700">
                          Vous paierez en espèces au moment de la livraison de
                          votre commande.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-lg font-bold border-t pt-3 mt-2">
                    <span>Total a payer:</span>
                    <span className="text-blue-600">
                      {formatPrice(totalAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between space-x-3">
                  <Link
                    href="/cart"
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 shadow-sm"
                  >
                    Retour
                  </Link>

                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={isSubmitting}
                    className={`flex-1 px-5 py-2 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isSubmitting
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                    }`}
                    aria-live="polite"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <LoaderCircle className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
                        Traitement...
                      </span>
                    ) : (
                      "Payer"
                    )}
                  </button>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <h3 className="font-medium text-gray-800 mb-3">
                    Produits ({Array.isArray(cart) ? cartCount : 0})
                  </h3>

                  <div className="space-y-3 max-h-80 overflow-auto pr-2 hide-scrollbar">
                    {Array.isArray(cart) && cartCount > 0 ? (
                      cart.map((item) => (
                        <ItemShipping key={item.id || item._id} item={item} />
                      ))
                    ) : (
                      <p className="text-gray-500 text-sm italic py-2">
                        Aucun produit dans votre panier
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
};

const NoPaymentMethodsFound = memo(() => (
  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
    <HandCoins className="mr-2" />
    <p className="font-semibold text-lg mb-2">
      Aucun moyen de paiement disponible
    </p>
    <p className="text-gray-600 mb-4 px-4">
      Nos moyens de paiement sont temporairement indisponibles. Veuillez
      réessayer plus tard.
    </p>
    <Link
      href="/cart"
      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm"
    >
      Retour au panier
    </Link>
  </div>
));
NoPaymentMethodsFound.displayName = "NoPaymentMethodsFound";

// Modifier le composant PaymentMethodCard pour gérer CASH
const PaymentMethodCard = memo(({ payment, isSelected, onSelect }) => {
  const config = PLATFORM_CONFIG[payment?.platform] || {
    color: "bg-gray-100 text-gray-700 border-gray-200",
    icon: CreditCard,
    displayName: payment?.platform || "Inconnu",
    requiresAccount: true,
  };

  const isCash = payment?.platform === "CASH";

  return (
    <label
      className={`flex flex-col p-4 border rounded-lg transition-all duration-200 cursor-pointer ${
        isSelected
          ? "bg-blue-50 border-blue-400 shadow-sm"
          : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
      }`}
    >
      <span className="flex items-center mb-3">
        <input
          name="payment"
          type="radio"
          value={payment?._id}
          checked={isSelected}
          onChange={() => onSelect(payment)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
        />
        <div className="ml-3">
          <span
            className={`inline-block px-3 py-1 rounded-full text-white text-sm font-bold bg-gradient-to-r ${config.color}`}
          >
            {config.displayName}
          </span>
        </div>
      </span>

      {isCash ? (
        <div className="ml-7 space-y-1">
          <div className="text-sm text-gray-700 font-medium">
            {config.description}
          </div>
          <div className="text-xs text-gray-500">
            Paiement sécurisé à la réception de votre commande
          </div>
        </div>
      ) : (
        <div className="ml-7 space-y-1">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Titulaire:</span> {payment?.name}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Numéro:</span> {payment?.number}
          </div>
        </div>
      )}
    </label>
  );
});

PaymentMethodCard.displayName = "PaymentMethodCard";

export default Payment;
