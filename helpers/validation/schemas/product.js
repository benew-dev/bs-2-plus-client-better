/**
 * Schémas de validation pour les produits et recherche
 */

import * as yup from "yup";
import {
  sanitizeString,
  isValidObjectId,
  validate,
  noNoSqlInjection,
} from "../core/utils";

// Schéma de recherche
export const searchSchema = yup.object().shape({
  keyword: yup
    .string()
    .required("Nom de produit requis")
    .transform(sanitizeString)
    .min(2, "Minimum 2 caractères")
    .max(100, "Maximum 100 caractères")
    .matches(
      /^[a-zA-Z0-9\u00C0-\u017F\s.,'\-&()[\]]+$/,
      "Caractères non autorisés",
    )
    .test("no-nosql", "Format invalide", noNoSqlInjection),
});

// Schéma de filtres de prix
export const priceFiltersSchema = yup.object().shape({
  min: yup
    .number()
    .nullable()
    .min(0, "Prix minimum doit être >= 0")
    .max(999999, "Prix maximum dépassé"),

  max: yup
    .number()
    .nullable()
    .min(0, "Prix maximum doit être >= 0")
    .max(999999, "Prix maximum dépassé")
    .test("greater-than-min", "Doit être > prix minimum", function (value) {
      const { min } = this.parent;
      return !value || !min || value >= min;
    }),
});

// ✅ NOUVEAU : Schéma de filtres de ratings
export const ratingsFiltersSchema = yup.object().shape({
  ratings: yup
    .number()
    .nullable()
    .min(0, "Note minimum doit être >= 0")
    .max(5, "Note maximum est 5")
    .test(
      "valid-decimal",
      "Note doit être un multiple de 0.5",
      function (value) {
        if (!value) return true;
        // Vérifier que c'est un multiple de 0.5 (0, 0.5, 1, 1.5, 2, ..., 5)
        return (value * 2) % 1 === 0;
      },
    ),
});

// Schéma de catégorie
export const categorySchema = yup.object().shape({
  category: yup
    .string()
    .nullable()
    .transform(sanitizeString)
    .test(
      "valid-id",
      "ID catégorie invalide",
      (value) => !value || isValidObjectId(value),
    ),
});

// ✅ MODIFIÉ : Schéma complet des filtres avec ratings[gte]
export const productFiltersSchema = yup.object().shape({
  keyword: yup.string().nullable().transform(sanitizeString),
  category: categorySchema.fields.category,
  "price[gt]": priceFiltersSchema.fields.min,
  "price[lt]": priceFiltersSchema.fields.max,
  "ratings[gte]": ratingsFiltersSchema.fields.ratings, // ✅ AJOUTÉ
  page: yup
    .number()
    .nullable()
    .integer("Page doit être un entier")
    .min(1, "Page minimum 1")
    .max(1000, "Page maximum 1000")
    .default(1),
});

// Schéma d'avis produit
export const productReviewSchema = yup.object().shape({
  rating: yup
    .number()
    .required("Note requise")
    .min(1, "Note minimum 1")
    .max(5, "Note maximum 5")
    .test(
      "valid-decimal",
      "Note doit être un multiple de 0.5",
      function (value) {
        if (!value) return true;
        // Vérifier que c'est un multiple de 0.5
        return (value * 2) % 1 === 0;
      },
    ),

  title: yup
    .string()
    .required("Titre requis")
    .transform(sanitizeString)
    .min(5, "Minimum 5 caractères")
    .max(100, "Maximum 100 caractères"),

  comment: yup
    .string()
    .required("Commentaire requis")
    .transform(sanitizeString)
    .min(10, "Minimum 10 caractères")
    .max(500, "Maximum 500 caractères"),

  wouldRecommend: yup.boolean().nullable(),
});

// Fonctions de validation
export const validateProductSearch = (data) => validate(searchSchema, data);
export const validatePriceFilters = (data) =>
  validate(priceFiltersSchema, data);
export const validateRatingsFilters = (data) =>
  validate(ratingsFiltersSchema, data); // ✅ AJOUTÉ
export const validateCategory = (data) => validate(categorySchema, data);
export const validateProductFilters = (data) =>
  validate(productFiltersSchema, data);
export const validateProductReview = (data) =>
  validate(productReviewSchema, data);
