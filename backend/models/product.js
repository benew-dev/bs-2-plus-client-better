import mongoose from "mongoose";
import slug from "mongoose-slug-updater";

// Initialiser le plugin de slug
mongoose.plugin(slug);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Le nom du produit est obligatoire"],
      trim: true,
      maxlength: [100, "Le nom du produit ne peut pas dépasser 100 caractères"],
    },
    slug: {
      type: String,
      slug: "name",
      unique: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "La description du produit est obligatoire"],
      trim: true,
      maxlength: [2000, "La description ne peut pas dépasser 2000 caractères"],
    },
    price: {
      type: Number,
      required: [true, "Le prix du produit est obligatoire"],
      min: [0, "Le prix ne peut pas être négatif"],
      set: (val) => Math.round(val * 100) / 100, // Arrondir à 2 décimales
      index: true,
    },
    images: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
      },
    ],
    type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Type",
      required: [true, "Le type du produit est obligatoire"],
      index: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "La catégorie du produit est obligatoire"],
      ref: "Category",
      index: true,
    },
    stock: {
      type: Number,
      required: [true, "Le stock du produit est obligatoire"],
      min: [0, "Le stock ne peut pas être négatif"],
      validate: {
        validator: Number.isInteger,
        message: "Le stock doit être un nombre entier",
      },
    },
    ratings: {
      type: Number,
      default: 0,
    },
    reviews: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          required: true,
        },
        comment: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    sold: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Indexer les champs fréquemment recherchés
productSchema.index({
  name: "text",
});

// Index composé pour les requêtes par type et catégorie
productSchema.index({ type: 1, category: 1 });
productSchema.index({ type: 1, isActive: 1 });
productSchema.index({ category: 1, price: 1 });
productSchema.index({ name: "text", category: 1, price: 1 });

// Index pour optimiser les requêtes de statistiques de ventes
productSchema.index({ sold: -1, createdAt: -1 });
productSchema.index({ category: 1, sold: -1 });

// Middleware pre-save pour mettre à jour le champ updatedAt
productSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Middleware pour vérifier le stock avant de sauvegarder
productSchema.pre("save", function () {
  if (this.isModified("stock") && this.stock < 0) {
    this.stock = 0;
  }
});

// Middleware pre-save pour vérifier que le type et la catégorie existent et sont actifs
productSchema.pre("save", async function () {
  if (this.isNew || this.isModified("type") || this.isModified("category")) {
    const Type = mongoose.model("Type");
    const Category = mongoose.model("Category");

    // Vérifier le type
    const type = await Type.findById(this.type);
    if (!type) {
      const error = new Error("Le type spécifié n'existe pas");
      error.name = "ValidationError";
      throw error;
    }

    if (!type.isActive) {
      const error = new Error(
        "Impossible de créer un produit avec un type inactif",
      );
      error.name = "ValidationError";
      throw error;
    }

    // Vérifier la catégorie
    const category = await Category.findById(this.category);
    if (!category) {
      const error = new Error("La catégorie spécifiée n'existe pas");
      error.name = "ValidationError";
      throw error;
    }

    if (!category.isActive) {
      const error = new Error(
        "Impossible de créer un produit avec une catégorie inactive",
      );
      error.name = "ValidationError";
      throw error;
    }

    // Vérifier que la catégorie appartient au type
    if (category.type.toString() !== this.type.toString()) {
      const error = new Error(
        "La catégorie sélectionnée n'appartient pas au type choisi",
      );
      error.name = "ValidationError";
      throw error;
    }
  }
});

// Méthode pour vérifier si un produit est en stock
productSchema.methods.isInStock = function () {
  return this.stock > 0;
};

// Méthode statique pour trouver des produits similaires
productSchema.statics.findSimilarProductsLite = function (
  categoryId,
  limit = 5,
) {
  return this.find({ category: categoryId })
    .select("name price images")
    .slice("images", 1)
    .limit(limit)
    .lean();
};

// Méthode statique pour récupérer les produits avec type et catégorie
productSchema.statics.findWithTypeAndCategory = function (filter = {}) {
  return this.find(filter)
    .populate("type", "nom slug isActive")
    .populate("category", "categoryName slug isActive");
};

// Méthode statique pour récupérer les produits par type
productSchema.statics.findByType = function (typeId) {
  return this.find({ type: typeId })
    .populate("type", "nom slug isActive")
    .populate("category", "categoryName slug isActive");
};

// Assurer que les modèles ne sont pas redéfinis en cas de hot-reload
const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);

export default Product;
