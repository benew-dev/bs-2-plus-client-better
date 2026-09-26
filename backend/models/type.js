import mongoose from "mongoose";
import slug from "mongoose-slug-updater";
// Initialiser le plugin de slug
mongoose.plugin(slug);
const typeSchema = new mongoose.Schema(
  {
    nom: {
      type: String,
      required: [true, "Le nom du type est obligatoire"],
      trim: true,
      maxlength: [50, "Le nom du type ne peut pas dépasser 50 caractères"],
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      slug: "nom",
      unique: true,
      index: true,
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
// Index pour la recherche textuelle
typeSchema.index({ nom: "text" });
// Middleware pre-save pour mettre à jour le champ updatedAt
typeSchema.pre("save", function () {
  this.updatedAt = Date.now();
});
// Middleware pre-save pour vérifier la limite de 3 documents
typeSchema.pre("save", async function () {
  if (this.isNew) {
    const count = await mongoose.model("Type").countDocuments();
    if (count >= 3) {
      const error = new Error(
        "Limite atteinte : Vous ne pouvez pas créer plus de 3 types. Veuillez en supprimer un avant d'ajouter un nouveau type.",
      );
      error.name = "ValidationError";
      throw error;
    }
  }
});
// Méthode statique pour vérifier si on peut ajouter un nouveau type
typeSchema.statics.canAddNewType = async function () {
  const count = await this.countDocuments();
  return count < 3;
};
// Méthode statique pour obtenir le nombre de types restants
typeSchema.statics.getRemainingSlots = async function () {
  const count = await this.countDocuments();
  return Math.max(0, 3 - count);
};
// Assurer que les modèles ne sont pas redéfinis en cas de hot-reload
const Type = mongoose.models.Type || mongoose.model("Type", typeSchema);

export default Type;
