"use client";

import {
  useContext,
  useState,
  useEffect,
  useCallback,
  memo,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import { toast } from "react-toastify";
import PropTypes from "prop-types";
import Image from "next/image";
import Link from "next/link";

import AuthContext from "@/context/AuthContext";
import CartContext from "@/context/CartContext";
import { isArrayEmpty } from "@/helpers/helpers";
import { INCREASE } from "@/helpers/constants";

import DOMPurify from "dompurify";
import ReactStarsRating from "react-awesome-stars-rating";
import { Share2, ShoppingCart, Star, Truck, Heart } from "lucide-react"; // ✅ Import Heart
import { useSwipeable } from "react-swipeable";
import OrderContext from "@/context/OrderContext";
import NewReview from "./NewReview";
import Reviews from "./Reviews";

// Chargement dynamique des composants
const BreadCrumbs = dynamic(() => import("@/components/layouts/BreadCrumbs"), {
  ssr: true,
  loading: () => (
    <div className="h-8 bg-gray-100 rounded-lg animate-pulse"></div>
  ),
});

// Formatter le prix avec séparateur de milliers et devise
const formatPrice = (price) => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "Fdj",
  }).format(price || 0);
};

const ProductImageGallery = memo(function ProductImageGallery({
  product,
  selectedImage,
  onImageSelect,
}) {
  const defaultImage = "/images/default_product.png";
  const productImages =
    product?.images?.length > 0 ? product.images : [{ url: defaultImage }];

  return (
    <aside aria-label="Product images">
      <div
        className="border border-gray-200 shadow-sm p-3 text-center rounded-lg mb-5 bg-white relative h-auto max-h-[500px] flex items-center justify-center overflow-hidden"
        role="img"
        aria-label={`Main image of ${product?.name || "product"}`}
      >
        <div className="w-full h-full transition-transform duration-300 hover:scale-110">
          <Image
            className="object-contain max-h-[450px] inline-block transition-opacity"
            src={selectedImage || defaultImage}
            alt={product?.name || "Product image"}
            width={400}
            height={400}
            priority={true}
            quality={85}
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAEtAJJXIDTiQAAAABJRU5ErkJggg=="
          />
        </div>

        <button
          className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Zoom image"
          onClick={() => {}}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
        </button>
      </div>

      <div
        className="space-x-2 overflow-x-auto pb-3 flex flex-nowrap scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 -mx-2 px-2 hide-scrollbar sm:flex-wrap"
        aria-label="Product thumbnail images"
        role="group"
      >
        {productImages.map((img, index) => (
          <button
            key={img?.url || `img-${index}`}
            className={`inline-block border ${
              selectedImage === img?.url
                ? "border-blue-500 ring-2 ring-blue-200"
                : "border-gray-200"
            } cursor-pointer p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all`}
            onClick={() => onImageSelect(img?.url)}
            aria-label={`View product image ${index + 1}`}
            aria-pressed={selectedImage === img?.url}
          >
            <Image
              className="w-14 h-14 object-contain"
              src={img?.url || defaultImage}
              alt={`${product?.name || "Product"} - thumbnail ${index + 1}`}
              width={56}
              height={56}
              onError={(e) => {
                e.target.src = defaultImage;
              }}
            />
          </button>
        ))}
      </div>
    </aside>
  );
});

// ✅ MODIFICATION: Ajouter les props favoris
const ProductInfo = memo(function ProductInfo({
  product,
  inStock,
  onAddToCart,
  isAddingToCart,
  onShare,
  onToggleFavorite, // ✅ NOUVEAU
  isFavorite, // ✅ NOUVEAU
  favoriteLoading, // ✅ NOUVEAU
}) {
  const formattedPrice = useMemo(
    () => formatPrice(product?.price),
    [product?.price],
  );

  return (
    <main>
      {/* ✅ MODIFICATION: Ajouter le bouton favoris en haut à droite */}
      <div className="flex items-start justify-between mb-4">
        <h1 className="font-semibold text-xl sm:text-2xl text-gray-800 flex-1">
          {product?.name || "Product Not Available"}
        </h1>

        {/* Bouton Favoris */}
        <button
          onClick={onToggleFavorite}
          disabled={favoriteLoading}
          className={`ml-4 p-3 rounded-full transition-all duration-300 shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
            isFavorite
              ? "bg-pink-500 text-white hover:bg-pink-600"
              : "bg-white text-gray-600 hover:bg-pink-50 hover:text-pink-500 border border-gray-300"
          }`}
          aria-label={
            isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"
          }
          title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          {favoriteLoading ? (
            <div className="w-6 h-6 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Heart
              className={`w-6 h-6 transition-all ${
                isFavorite ? "fill-current" : ""
              }`}
            />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center space-x-2 mb-2">
        {product?.verified && (
          <span className="text-green-700 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-1"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Vérifié
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline mb-4">
        <p
          className="font-semibold text-xl sm:text-2xl text-blue-600 mr-3"
          aria-label="Prix"
        >
          {formattedPrice}
        </p>

        {product?.oldPrice && (
          <p className="text-sm sm:text-base text-gray-500 line-through">
            {formatPrice(product.oldPrice)}
          </p>
        )}
      </div>

      {product?.description ? (
        <div
          className="mb-6 text-gray-600 leading-relaxed"
          dangerouslySetInnerHTML={{
            __html: DOMPurify.sanitize(product.description),
          }}
        />
      ) : (
        <p className="mb-6 text-gray-600">
          Aucune description disponible pour ce produit.
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <button
          className={`w-full sm:w-auto px-6 py-3 inline-block text-white font-medium text-center rounded-lg transition-colors 
            ${
              inStock
                ? "bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-300 focus:outline-none cursor-pointer"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          onClick={onAddToCart}
          disabled={!inStock || isAddingToCart}
          aria-label={inStock ? "Ajouter au panier" : "Produit indisponible"}
        >
          {isAddingToCart ? (
            <span className="inline-flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Ajout en cours...
            </span>
          ) : (
            <div className="flex flex-row items-center justify-center gap-2">
              <ShoppingCart />
              {inStock ? "Ajouter au panier" : "Indisponible"}
            </div>
          )}
        </button>

        <button
          className="w-full sm:w-auto px-4 py-2 flex flex-row items-center justify-center text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 focus:ring-2 focus:ring-blue-300 focus:outline-none transition-colors"
          aria-label="Partager ce produit"
          onClick={onShare}
        >
          <Share2 className="mr-1" />
          Partager
        </button>
      </div>

      <ul className="mb-5 text-gray-600 space-y-3">
        {product?.ratings > 0 && (
          <li className="flex items-center">
            <span className="font-medium w-36 inline-block">Note moyenne:</span>
            <div className="flex items-center gap-2">
              <ReactStarsRating
                value={product.ratings}
                isEdit={false}
                primaryColor="#f97316"
                secondaryColor="#d1d5db"
                className="flex"
                starGap={4}
                count={5}
                size={20}
              />
              <span className="font-semibold text-orange-600">
                {product.ratings.toFixed(1)} / 5
              </span>
            </div>
          </li>
        )}

        <li className="mb-2 flex">
          <span className="font-medium w-36 inline-block">Disponibilité:</span>
          {inStock ? (
            <span className="text-green-600 font-medium flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              En stock
            </span>
          ) : (
            <span className="text-red-600 font-medium flex items-center">
              <svg
                className="w-4 h-4 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              Rupture de stock
            </span>
          )}
        </li>
        <li className="mb-2 flex">
          <span className="font-medium w-36 inline-block">Quantité:</span>
          <span>{product?.stock || 0} unité(s)</span>
        </li>
        <li className="mb-2 flex">
          <span className="font-medium w-36 inline-block">Catégorie:</span>
          <span>{product?.category?.categoryName || "Non catégorisé"}</span>
        </li>
        <li className="mb-2 flex">
          <span className="font-medium w-36 inline-block">Référence:</span>
          <span className="font-mono text-sm">{product?._id || "N/A"}</span>
        </li>
      </ul>

      {product?.sold > 10 && (
        <div className="mt-4 flex flex-row bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-700 text-sm mr-2">
          <Truck className="mr-1" />
          {product.sold > 100 ? "Très populaire" : "Populaire"}
        </div>
      )}

      {product?.createdAt &&
        new Date(product.createdAt) >
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
          <div className="mt-4 flex flex-row bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-blue-700 text-sm">
            <Star className="mr-1" />
            Nouveau
          </div>
        )}
    </main>
  );
});

// ✅ MODIFICATION: Afficher le rating pour les produits similaires
const RelatedProductsCarousel = memo(function RelatedProductsCarousel({
  products,
  currentProductId,
}) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [slidesPerView, setSlidesPerView] = useState(4);

  const filteredProducts = useMemo(
    () =>
      products?.filter((product) => product?._id !== currentProductId) || [],
    [products, currentProductId],
  );

  if (isArrayEmpty(filteredProducts)) {
    return null;
  }

  useEffect(() => {
    const updateSlidesPerView = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setSlidesPerView(1);
      } else if (width < 768) {
        setSlidesPerView(2);
      } else if (width < 1024) {
        setSlidesPerView(3);
      } else {
        setSlidesPerView(4);
      }
    };

    updateSlidesPerView();
    window.addEventListener("resize", updateSlidesPerView);
    return () => window.removeEventListener("resize", updateSlidesPerView);
  }, []);

  const maxSlideIndex = useMemo(() => {
    return Math.max(0, filteredProducts.length - slidesPerView);
  }, [filteredProducts.length, slidesPerView]);

  useEffect(() => {
    if (!isAutoScrolling || filteredProducts.length <= slidesPerView) {
      return;
    }

    const interval = setInterval(() => {
      setCurrentSlide((prevSlide) => {
        if (prevSlide >= maxSlideIndex) {
          return 0;
        }
        return prevSlide + 1;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoScrolling, maxSlideIndex, filteredProducts.length, slidesPerView]);

  const translateX = useMemo(() => {
    const slideWidth = 100 / slidesPerView;
    return -(currentSlide * slideWidth);
  }, [currentSlide, slidesPerView]);

  useEffect(() => {
    if (!isAutoScrolling) {
      const timeout = setTimeout(() => {
        setIsAutoScrolling(true);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [isAutoScrolling]);

  const totalDots = useMemo(() => {
    if (filteredProducts.length <= slidesPerView) return 0;
    return maxSlideIndex + 1;
  }, [filteredProducts.length, slidesPerView, maxSlideIndex]);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (currentSlide < maxSlideIndex) {
        setCurrentSlide((prev) => prev + 1);
        setIsAutoScrolling(false);
      }
    },
    onSwipedRight: () => {
      if (currentSlide > 0) {
        setCurrentSlide((prev) => prev - 1);
        setIsAutoScrolling(false);
      }
    },
    onSwiping: (eventData) => {
      setIsAutoScrolling(false);
    },
    preventScrollOnSwipe: true,
    trackMouse: true,
    trackTouch: true,
    delta: 50,
    swipeDuration: 500,
    rotationAngle: 15,
  });

  return (
    <section aria-labelledby="related-heading" className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2
          id="related-heading"
          className="font-bold text-xl sm:text-2xl text-gray-800"
        >
          Produits similaires
        </h2>

        <span className="text-sm text-gray-500">
          {filteredProducts.length} produit
          {filteredProducts.length > 1 ? "s" : ""}
        </span>
      </div>

      <div className="relative group">
        <div {...handlers} className="overflow-hidden rounded-lg">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{
              transform: `translateX(${translateX}%)`,
            }}
          >
            {filteredProducts.map((product) => (
              <div
                key={product?._id}
                className="flex-shrink-0 px-2"
                style={{
                  width: `${100 / slidesPerView}%`,
                }}
              >
                <Link
                  href={`/shop/${product?._id}`}
                  className="group/card block bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-gray-200 hover:border-blue-100 transform hover:-translate-y-1 h-full"
                >
                  <div className="aspect-square mb-4 bg-gray-100 rounded-lg overflow-hidden relative">
                    <Image
                      src={
                        product?.images?.[0]?.url ||
                        "/images/default_product.png"
                      }
                      alt={product?.name || "Produit similaire"}
                      fill
                      className="object-contain group-hover/card:scale-105 transition-transform duration-300"
                      loading="lazy"
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      onError={(e) => {
                        e.target.src = "/images/default_product.png";
                      }}
                    />

                    {product?.createdAt &&
                      new Date(product.createdAt) >
                        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) && (
                        <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                          Nouveau
                        </div>
                      )}

                    {product?.stock === 0 && (
                      <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                        Épuisé
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-800 group-hover/card:text-blue-600 transition-colors line-clamp-2 text-sm leading-tight min-h-[2.5rem]">
                      {product?.name || "Produit sans nom"}
                    </h3>

                    {/* ✅ AJOUT: Afficher le rating */}
                    {product?.ratings > 0 && (
                      <div className="flex items-center gap-2">
                        <ReactStarsRating
                          value={product.ratings}
                          isEdit={false}
                          primaryColor="#f97316"
                          secondaryColor="#d1d5db"
                          className="flex"
                          starGap={2}
                          count={5}
                          size={14}
                        />
                        <span className="text-xs font-medium text-orange-600">
                          {product.ratings.toFixed(1)}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <p className="font-bold text-blue-600 text-lg">
                        {formatPrice(product?.price)}
                      </p>

                      {product?.stock > 0 && (
                        <span className="text-xs text-green-600 font-medium">
                          En stock
                        </span>
                      )}
                    </div>

                    {product?.category?.categoryName && (
                      <p className="text-xs text-gray-500">
                        {product.category.categoryName}
                      </p>
                    )}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {totalDots > 1 && (
          <div className="flex justify-center mt-4 space-x-2">
            {Array.from({ length: totalDots }).map((_, dotIndex) => (
              <button
                key={dotIndex}
                onClick={() => {
                  setCurrentSlide(dotIndex);
                  setIsAutoScrolling(false);
                }}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  dotIndex === currentSlide
                    ? "bg-blue-600 w-6"
                    : "bg-gray-300 hover:bg-gray-400"
                }`}
                aria-label={`Aller à la position ${dotIndex + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {filteredProducts.length <= slidesPerView &&
        filteredProducts.length > 0 && (
          <p className="text-center text-sm text-gray-500 mt-4">
            Tous les produits similaires sont affichés
          </p>
        )}
    </section>
  );
});

// Composant principal
function ProductDetails({ product, sameCategoryProducts }) {
  const { user, toggleFavorite } = useContext(AuthContext);
  const { addItemToCart, updateCart, cart, error, clearError } =
    useContext(CartContext);
  const { canUserReview, canReview } = useContext(OrderContext);

  const [selectedImage, setSelectedImage] = useState(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // ✅ AJOUT: États pour les favoris
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  // ✅ AJOUT: Calculer l'état favori
  const isFavorite = useMemo(() => {
    if (!user?.favorites || !Array.isArray(user.favorites)) {
      return false;
    }

    return user.favorites.some(
      (fav) => fav.productId?.toString() === product?._id?.toString(),
    );
  }, [user, product?._id]);

  useEffect(() => {
    canUserReview(product?._id);
  }, []);

  useEffect(() => {
    if (product?.images && product.images.length > 0) {
      setSelectedImage(product.images[0]?.url);
    } else {
      setSelectedImage("/images/default_product.png");
    }
  }, [product]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const inStock = useMemo(() => {
    if (!product || product?.stock === undefined) return false;
    return product.stock >= 1;
  }, [product]);

  const breadCrumbs = useMemo(() => {
    if (!product) return null;

    return [
      { name: "Accueil", url: "/" },
      {
        name: `${product?.type?.nom === "Homme" ? "Men" : "Women" || "men"}`,
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/${product?.type?.nom === "Homme" ? "/men" : "/women" || "/men"}`,
      },
      {
        name: product?.category?.categoryName || "Catégorie",
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/${product?.type?.nom === "Homme" ? "/men" : "/women" || "/men"}?category=${product?.category?._id || ""}`,
      },
      {
        name: product?.name
          ? product?.name?.length > 40
            ? `${product?.name?.substring(0, 40)}...`
            : product?.name
          : "Produit",
        url: `/shop/${product?._id}`,
      },
    ];
  }, [product]);

  const handleAddToCart = useCallback(() => {
    if (!product || !product?._id) {
      toast.error("Produit invalide");
      return;
    }

    if (!user) {
      toast.info(
        "Veuillez vous connecter pour ajouter des articles à votre panier",
      );
      return;
    }

    if (!inStock) {
      toast.warning("Ce produit est en rupture de stock");
      return;
    }

    if (isAddingToCart) return;

    setIsAddingToCart(true);

    try {
      const isProductInCart = cart.find((i) => i?.productId === product?._id);

      if (isProductInCart) {
        updateCart(isProductInCart, INCREASE);
        toast.success("Quantité mise à jour dans votre panier");
      } else {
        addItemToCart({
          product: product?._id,
        });
        toast.success("Produit ajouté à votre panier");
      }
    } catch (error) {
      console.error("Error adding item to cart:", error);
      toast.error("Erreur lors de l'ajout au panier. Veuillez réessayer.");
    } finally {
      setTimeout(() => {
        setIsAddingToCart(false);
      }, 500);
    }
  }, [product, user, cart, inStock, addItemToCart, updateCart, isAddingToCart]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator
        .share({
          title: product?.name || "Découvrez ce produit",
          text: `Découvrez ${product?.name} sur notre boutique.`,
          url: window.location.href,
        })
        .then(() => console.log("Produit partagé avec succès"))
        .catch((error) => console.error("Erreur lors du partage:", error));
    } else {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          toast.success("Lien copié dans le presse-papier !");
        })
        .catch(() => {
          const tempInput = document.createElement("input");
          tempInput.value = window.location.href;
          document.body.appendChild(tempInput);
          tempInput.select();
          document.execCommand("copy");
          document.body.removeChild(tempInput);
          toast.success("Lien copié dans le presse-papier !");
        });
    }
  }, [product?.name]);

  const handleImageSelect = useCallback((imageUrl) => {
    setSelectedImage(imageUrl);
  }, []);

  // ✅ AJOUT: Gérer le toggle des favoris
  const handleToggleFavorite = useCallback(async () => {
    if (!user) {
      toast.info("Connectez-vous pour ajouter aux favoris");
      return;
    }

    if (favoriteLoading) return;

    try {
      setFavoriteLoading(true);

      const result = await toggleFavorite(
        product._id,
        product.name,
        product.images?.[0] || { public_id: null, url: null },
        "toggle",
      );

      if (!result.success) {
        console.error("❌ Échec de la mise à jour des favoris");
      }
    } catch (error) {
      console.error("❌ Error toggling favorite:", error);
    } finally {
      setFavoriteLoading(false);
    }
  }, [user, favoriteLoading, toggleFavorite, product]);

  if (!product) {
    return (
      <div className="container max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white shadow-md rounded-lg p-8">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-gray-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            Produit non disponible
          </h2>
          <p className="text-gray-600 mb-6">
            Le produit demandé n&apos;existe pas ou a été retiré de notre
            catalogue.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 py-6 sm:py-10">
      {breadCrumbs && <BreadCrumbs breadCrumbs={breadCrumbs} />}

      <div className="container max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <ProductImageGallery
              product={product}
              selectedImage={selectedImage}
              onImageSelect={handleImageSelect}
            />

            {/* ✅ MODIFICATION: Passer les props favoris */}
            <ProductInfo
              product={product}
              inStock={inStock}
              onAddToCart={handleAddToCart}
              isAddingToCart={isAddingToCart}
              onShare={handleShare}
              onToggleFavorite={handleToggleFavorite}
              isFavorite={isFavorite}
              favoriteLoading={favoriteLoading}
            />
          </div>

          {product.specifications && (
            <div className="border-t border-gray-200 pt-8 mt-8">
              <h2 className="text-xl font-semibold mb-4">Spécifications</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(product.specifications).map(([key, value]) => (
                  <div key={key} className="flex">
                    <span className="font-medium w-36">{key}:</span>
                    <span>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {canReview && <NewReview product={product} />}
        <hr />
        <div className="font-semibold">
          <h1 className="text-gray-500 review-title mb-6 mt-10 text-2xl">
            Other Customers Reviews
          </h1>
          <Reviews reviews={product?.reviews} />
        </div>
        <RelatedProductsCarousel
          products={sameCategoryProducts}
          currentProductId={product._id}
        />
      </div>
    </div>
  );
}

ProductDetails.propTypes = {
  product: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    price: PropTypes.number,
    oldPrice: PropTypes.number,
    description: PropTypes.string,
    stock: PropTypes.number,
    sold: PropTypes.number,
    createdAt: PropTypes.string,
    images: PropTypes.arrayOf(
      PropTypes.shape({
        url: PropTypes.string,
      }),
    ),
    category: PropTypes.shape({
      _id: PropTypes.string,
      categoryName: PropTypes.string,
    }),
    specifications: PropTypes.object,
    verified: PropTypes.bool,
  }),
  sameCategoryProducts: PropTypes.array,
};

ProductDetails.defaultProps = {
  product: null,
  sameCategoryProducts: [],
};

export default memo(ProductDetails);
