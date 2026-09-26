"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { isArrayEmpty } from "@/helpers/helpers";
import { captureException } from "@/monitoring/sentry";
import {
  FiltersSkeleton,
  ProductItemSkeleton,
} from "../skeletons/ListProductsSkeleton";
import { SearchX, Grid2x2 } from "lucide-react";

// Import dynamique des composants
const CustomPagination = dynamic(
  () => import("@/components/layouts/CustomPagination"),
  { ssr: true },
);

const Filters = dynamic(() => import("../layouts/Filters"), {
  loading: () => <FiltersSkeleton />,
  ssr: true,
});

const ProductItem = dynamic(() => import("./ProductItem"), {
  loading: () => <ProductItemSkeleton />,
  ssr: true,
});

const Search = dynamic(() => import("../layouts/Search"), {
  ssr: true,
});

const ListProducts = ({ type, data, categories }) => {
  // États locaux
  const [localLoading, setLocalLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Récupérer les paramètres de recherche pour les afficher
  const keyword = searchParams?.get("keyword");
  const category = searchParams?.get("category");
  const minPrice = searchParams?.get("min");
  const maxPrice = searchParams?.get("max");
  const page = searchParams?.get("page");

  useEffect(() => {
    setLocalLoading(false);
    setShowMobileFilters(false);
  }, [type]);

  // Construire un message récapitulatif des filtres appliqués
  const getFilterSummary = useCallback(() => {
    try {
      let summary = [];

      if (keyword) summary.push(`Recherche: "${keyword}"`);
      if (category) {
        const categoryName = categories?.find((c) => c._id === category)?.name;
        if (categoryName) summary.push(`Catégorie: ${categoryName}`);
      }
      if (minPrice && maxPrice)
        summary.push(`Prix: ${minPrice}€ - ${maxPrice}€`);
      else if (minPrice) summary.push(`Prix min: ${minPrice}€`);
      else if (maxPrice) summary.push(`Prix max: ${maxPrice}€`);

      if (page) summary.push(`Page: ${page || 1}`);

      return summary.length > 0 ? summary.join(" | ") : null;
    } catch (err) {
      captureException(err, {
        tags: { component: "ListProducts", function: "getFilterSummary" },
      });
      return null;
    }
  }, [keyword, category, minPrice, maxPrice, page, categories]);

  const filterSummary = useMemo(() => getFilterSummary(), [getFilterSummary]);

  const hasValidData = data && typeof data === "object";
  const hasValidCategories = categories && Array.isArray(categories);

  const handleResetFilters = useCallback(() => {
    try {
      setLocalLoading(true);
      router.push(`${pathname}`);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }, [router, pathname]);

  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }

    if (localLoading) {
      setLocalLoading(false);
    }
  }, [data, isInitialLoad, localLoading]);

  if (!hasValidData) {
    return (
      <div
        className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-md my-4"
        role="alert"
      >
        <p className="font-medium text-orange-800">
          Les données des produits ne sont pas disponibles pour le moment.
        </p>
      </div>
    );
  }

  return (
    <section className="py-8 bg-gray-50">
      <div className="container max-w-[1440px] mx-auto px-4">
        <div className="flex flex-col md:flex-row -mx-4">
          {/* Sidebar Filters - Desktop uniquement */}
          <div className="hidden md:block md:w-1/3 lg:w-1/4 px-4">
            {hasValidCategories ? (
              <Filters
                categories={categories}
                setLocalLoading={setLocalLoading}
              />
            ) : (
              <div className="p-4 bg-white rounded-md shadow-sm border border-gray-200">
                <p className="text-gray-600">Chargement des filtres...</p>
              </div>
            )}
          </div>

          {/* Main Content */}
          <main
            className="w-full md:w-2/3 lg:w-3/4 px-3"
            aria-label="Liste des produits"
          >
            {/* Barre Search + Toggle Filters Mobile */}
            <div className="mb-4">
              {/* Mobile: Grid2x2 + Search côte à côte */}
              <div className="flex items-center justify-between gap-3 md:hidden mb-4">
                <button
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className="p-2.5 border border-gray-300 bg-white rounded-md shadow-sm hover:bg-gray-50 hover:border-orange-400 flex-shrink-0 transition-all"
                  aria-label="Afficher/Masquer les filtres"
                  aria-expanded={showMobileFilters}
                >
                  <Grid2x2 className="w-5 h-5 text-orange-600" />
                </button>
                <div className="flex-1">
                  <Search setLoading={setLocalLoading} />
                </div>
              </div>

              {/* Desktop: Search aligné à droite */}
              <div className="hidden md:flex md:justify-end">
                <div className="md:w-2/3 lg:w-1/2">
                  <Search setLoading={setLocalLoading} />
                </div>
              </div>
            </div>

            {/* Filters Mobile - Collapsible */}
            {showMobileFilters && (
              <div className="md:hidden mb-4">
                {hasValidCategories ? (
                  <Filters
                    categories={categories}
                    setLocalLoading={setLocalLoading}
                  />
                ) : (
                  <div className="p-4 bg-white rounded-md border border-gray-200">
                    <p>Chargement des filtres...</p>
                  </div>
                )}
              </div>
            )}

            {/* Affichage du récapitulatif des filtres */}
            {filterSummary && (
              <div
                className="mb-4 p-3 bg-orange-50 rounded-lg text-sm border-l-4 border-orange-500"
                aria-live="polite"
                aria-label="Filtres appliqués"
              >
                <p className="font-medium text-orange-800">{filterSummary}</p>
              </div>
            )}

            <div className="mb-4 flex justify-between items-center">
              <h1
                className="text-xl font-bold text-gray-900"
                aria-live="polite"
              >
                {data?.products?.length > 0
                  ? `${data.products.length} produit${data.products.length > 1 ? "s" : ""} trouvé${data.products.length > 1 ? "s" : ""}`
                  : "Produits"}
              </h1>
            </div>

            {localLoading ? (
              <div
                className="space-y-4"
                aria-busy="true"
                aria-label="Chargement des produits"
              >
                {[...Array(3)].map((_, index) => (
                  <ProductItemSkeleton key={index} />
                ))}
              </div>
            ) : isArrayEmpty(data?.products) ? (
              <div
                className="flex flex-col items-center justify-center py-10 text-center bg-white rounded-lg shadow-md p-8"
                aria-live="assertive"
                role="status"
              >
                <div className="mb-4 text-5xl text-orange-600">
                  <SearchX />
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Aucun produit trouvé
                </h2>
                <p className="text-gray-600 max-w-md mb-4">
                  {keyword
                    ? `Aucun résultat pour "${keyword}". Essayez d'autres termes de recherche.`
                    : "Aucun produit ne correspond aux filtres sélectionnés. Essayez de modifier vos critères."}
                </p>
                <button
                  onClick={handleResetFilters}
                  className="mt-6 px-6 py-3 bg-gradient-sunset text-white rounded-lg hover:shadow-sunset-lg hover-lift transition-all font-semibold"
                  aria-label="Voir tous les produits disponibles"
                >
                  Voir tous les produits
                </button>
              </div>
            ) : (
              <>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                  aria-busy={false}
                  aria-label="Grille des produits"
                >
                  {data?.products?.map((product) => (
                    <Suspense
                      key={product?._id || `product-${Math.random()}`}
                      fallback={<ProductItemSkeleton />}
                    >
                      <ProductItem product={product} />
                    </Suspense>
                  ))}
                </div>

                {data?.totalPages > 1 && (
                  <div className="mt-8">
                    <CustomPagination totalPages={data?.totalPages} />
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </section>
  );
};

export default ListProducts;
