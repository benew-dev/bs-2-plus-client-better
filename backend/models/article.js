import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const articleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Le titre est obligatoire"],
      trim: true,
      maxlength: [200, "Le titre ne peut pas dépasser 200 caractères"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    excerpt: {
      type: String,
      trim: true,
      maxlength: [500, "L'extrait ne peut pas dépasser 500 caractères"],
    },
    content: {
      type: String,
      required: [true, "Le contenu est obligatoire"],
    },
    coverImage: {
      public_id: {
        type: String,
      },
      url: {
        type: String,
      },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      set: (tags) => tags.map((tag) => tag.toLowerCase().trim()),
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Index composés pour les requêtes fréquentes
articleSchema.index({ isPublished: 1, publishedAt: -1 });
articleSchema.index({ tags: 1, isPublished: 1 });

// Middleware pre-save pour générer le slug et gérer publishedAt
articleSchema.pre("save", function () {
  // Générer le slug à partir du titre
  if (this.isModified("title")) {
    this.slug = this.title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 100);

    // Ajouter un timestamp pour l'unicité
    this.slug = `${this.slug}-${Date.now().toString(36)}`;
  }

  // Mettre à jour publishedAt si on publie pour la première fois
  if (this.isModified("isPublished") && this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Mettre à jour updatedAt
  this.updatedAt = new Date();
});

// Méthode pour incrémenter les vues
articleSchema.methods.incrementViews = async function () {
  this.views += 1;
  await this.save({ validateBeforeSave: false });
  return this.views;
};

/**
 * ✅ Helper interne : récupère un ou plusieurs auteurs depuis la collection
 * native Better Auth "user" (pas le modèle Mongoose "User" / collection "users").
 * L'auteur d'un article est toujours un compte admin connecté via Better Auth.
 */
const fetchAuthorsMap = async (authorIds) => {
  const uniqueIds = [
    ...new Set(authorIds.filter(Boolean).map((id) => id.toString())),
  ];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const db = mongoose.connection.getClient().db();

  const objectIds = uniqueIds
    .map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const authorDocs = await db
    .collection("user")
    .find({ _id: { $in: objectIds } }, { projection: { name: 1, image: 1 } })
    .toArray();

  const authorsMap = new Map();
  authorDocs.forEach((doc) => {
    authorsMap.set(doc._id.toString(), {
      name: doc.name,
      image: doc.image || null,
    });
  });

  return authorsMap;
};

// Méthode statique pour trouver les articles publiés
articleSchema.statics.findPublished = async function (options = {}) {
  const { page = 1, limit = 10, tag = null } = options;
  const skip = (page - 1) * limit;

  const query = { isPublished: true };
  if (tag) {
    query.tags = tag.toLowerCase();
  }

  const articles = await this.find(query)
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // ✅ Récupération groupée des auteurs (une seule requête pour tous les articles)
  const authorsMap = await fetchAuthorsMap(
    articles.map((article) => article.author),
  );

  return articles.map((article) => ({
    ...article,
    author: article.author
      ? authorsMap.get(article.author.toString()) || null
      : null,
  }));
};

// Méthode statique pour trouver un article par slug
articleSchema.statics.findBySlug = async function (slug) {
  const article = await this.findOne({ slug, isPublished: true }).lean();

  if (!article) {
    return null;
  }

  // ✅ Récupération de l'auteur depuis la collection native "user"
  let author = null;
  if (article.author) {
    const authorsMap = await fetchAuthorsMap([article.author]);
    author = authorsMap.get(article.author.toString()) || null;
  }

  return {
    ...article,
    author,
  };
};

export default mongoose.models.Article ||
  mongoose.model("Article", articleSchema);
