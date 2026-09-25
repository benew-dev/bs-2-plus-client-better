import mongoose from "mongoose";

const homePageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Le titre est requis"],
      minLength: [3, "Le titre doit contenir au moins 3 caractères"],
      trim: true,
    },
    subtitle: {
      type: String,
      required: [true, "Le sous-titre est requis"],
      minLength: [3, "Le sous-titre doit contenir au moins 3 caractères"],
      trim: true,
    },
    text: {
      type: String,
      required: [true, "Le texte est requis"],
      minLength: [10, "Le texte doit contenir au moins 10 caractères"],
      trim: true,
    },
    image: {
      public_id: {
        type: String,
        required: [true, "L'image est requise"],
      },
      url: {
        type: String,
        required: [true, "L'URL de l'image est requise"],
      },
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.models.HomePage ||
  mongoose.model("HomePage", homePageSchema);
