import { NextResponse } from "next/server";
import dbConnect from "@/backend/config/dbConnect";
import Product from "@/backend/models/product";
import Category from "@/backend/models/category";
import Type from "@/backend/models/type";
import APIFilters from "@/backend/utils/APIFilters";
import { captureException } from "@/monitoring/sentry";
import { parseProductSearchParams } from "@/utils/inputSanitizer";
import { validateProductFilters } from "@/helpers/validation/schemas/product";
import { withIntelligentRateLimit } from "@/utils/rateLimit";
import { extractUserInfoFromRequest } from "@/lib/auth-utils";

const DEFAULT_PER_PAGE = process.env.DEFAULT_PRODUCTS_PER_PAGE;
const MAX_PER_PAGE = process.env.MAX_PRODUCTS_PER_PAGE;

export const GET = withIntelligentRateLimit(
  async function (req) {
    try {
      await dbConnect();

      const sanitizedParams = parseProductSearchParams(
        req.nextUrl.searchParams,
      );

      const typeRequest = sanitizedParams.type;
      delete sanitizedParams.type;

      const validation = await validateProductFilters(sanitizedParams);
      if (!validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid parameters",
            errors: validation.errors,
          },
          { status: 400 },
        );
      }

      const validatedParams = validation.data;
      const searchParams = new URLSearchParams();
      Object.entries(validatedParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "") {
          searchParams.set(key, value);
        }
      });

      if (!typeRequest) {
        return NextResponse.json(
          {
            success: false,
            message: "Type parameter is required (men or women)",
          },
          { status: 400 },
        );
      }

      // Trouver le Type en base (par slug)
      const typeDoc = await Type.findOne({
        nom: typeRequest,
        isActive: true,
      });

      if (!typeDoc) {
        return NextResponse.json(
          {
            success: false,
            message: "Type not found or inactive",
          },
          { status: 404 },
        );
      }

      // Récupérer les catégories ACTIVES pour ce type
      const categories = await Category.find({
        type: typeDoc._id,
        isActive: true,
      })
        .select("categoryName _id")
        .sort({ categoryName: 1 })
        .lean();

      // Formater les catégories
      const formattedCategories = categories.map((cat) => ({
        _id: cat._id,
        name: cat.categoryName,
      }));

      // Configuration de la pagination
      const resPerPage = Math.min(MAX_PER_PAGE, Math.max(1, DEFAULT_PER_PAGE));

      // Créer les filtres avec le typeId
      const apiFilters = new APIFilters(
        Product.find({ type: typeDoc._id, isActive: true })
          .select("name description stock price images category ratings")
          .slice("images", 1),
        searchParams,
      )
        .search()
        .filter();

      const filteredProductsCount = await apiFilters.query
        .clone()
        .lean()
        .countDocuments();

      apiFilters.pagination(resPerPage);

      // Récupérer les produits avec populate
      const products = await apiFilters.query
        .populate("category", "categoryName")
        .lean();

      const totalPages = Math.ceil(filteredProductsCount / resPerPage);

      // Réponse avec catégories incluses
      const responseData = {
        success: true,
        data: {
          totalPages,
          totalProducts: filteredProductsCount,
          products: products || [],
          categories: formattedCategories,
          type: {
            _id: typeDoc._id,
            name: typeDoc.nom,
          },
        },
      };

      const cacheHeaders = {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
        "CDN-Cache-Control": "max-age=600",
      };

      return NextResponse.json(responseData, {
        status: 200,
        headers: cacheHeaders,
      });
    } catch (error) {
      console.error("Products fetch error:", error.message);

      if (error.name !== "ValidationError") {
        captureException(error, {
          tags: { component: "api", route: "products/GET" },
          extra: {
            query: req.nextUrl.search,
          },
        });
      }

      let status = 500;
      let message = "Failed to fetch products";

      if (error.name === "ValidationError") {
        status = 400;
        message = "Invalid parameters";
      } else if (error.message?.includes("timeout")) {
        status = 504;
        message = "Request timeout";
      }

      return NextResponse.json(
        {
          success: false,
          message,
        },
        { status },
      );
    }
  },
  {
    category: "api",
    action: "publicRead",
    extractUserInfo: extractUserInfoFromRequest,
  },
);
