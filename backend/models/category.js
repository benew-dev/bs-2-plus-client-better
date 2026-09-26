import mongoose from "mongoose";
import slug from "mongoose-slug-updater";

// Initialiser le plugin de slug
mongoose.plugin(slug);

const categorySchema = new mongoose.Schema(
  {
    categoryName: {
      type: String,
      required: [true, "Le nom de la catégorie est obligatoire"],
      trim: true,
      maxlength: [
        50,
        "Le nom de la catégorie ne peut pas dépasser 50 caractères",
      ],
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      slug: "categoryName",
      unique: true,
      index: true,
    },
    type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Type",
      required: [true, "Le type de la catégorie est obligatoire"],
      index: true,
    },
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);
// Index pour la recherche textuelle
categorySchema.index({ categoryName: "text" });
// Index composé pour les requêtes par type et statut actif
categorySchema.index({ type: 1, isActive: 1 });
// Virtual pour récupérer les produits dans cette catégorie
categorySchema.virtual("products", {
  ref: "Product",
  localField: "_id",
  foreignField: "category",
});
// Middleware pre-save pour mettre à jour le champ updatedAt
categorySchema.pre("save", function () {
  this.updatedAt = Date.now();
});
// Middleware pre-save pour vérifier que le type existe et est actif
categorySchema.pre("save", async function () {
  if (this.isModified("type")) {
    const Type = mongoose.model("Type");
    const type = await Type.findById(this.type);
    if (!type) {
      const error = new Error("Le type spécifié n'existe pas");
      error.name = "ValidationError";
      throw error;
    }

    if (!type.isActive) {
      const error = new Error(
        "Impossible d'associer une catégorie à un type inactif",
      );
      error.name = "ValidationError";
      throw error;
    }
  }
});
// Méthode statique pour récupérer les catégories avec leur type
categorySchema.statics.findWithType = function (filter = {}) {
  return this.find(filter).populate("type", "nom slug isActive");
};
// Méthode statique pour récupérer les catégories par type
categorySchema.statics.findByType = function (typeId) {
  return this.find({ type: typeId }).populate("type", "nom slug isActive");
};
// Assurer que les modèles ne sont pas redéfinis en cas de hot-reload
const Category =
  mongoose.models.Category || mongoose.model("Category", categorySchema);

export default Category;
