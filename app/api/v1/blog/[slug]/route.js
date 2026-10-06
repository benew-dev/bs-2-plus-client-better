// app/api/v1/blog/[slug]/route.js

import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import connectDB from "@/backend/config/dbConnect";
import Article from "@/backend/models/article";

/**
 * GET /api/v1/blog/[slug]
 * Version mobile : récupère un article publié par son slug, avec l'auteur
 * résolu depuis la collection Better Auth "user" (c'est un admin connecté,
 * pas le modèle Mongoose "User").
 */
export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    const mongooseInstance = await connectDB();

    const article = await Article.findOne({ slug, isPublished: true }).lean();

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          message: "Article non trouvé",
        },
        { status: 404 },
      );
    }

    let author = null;
    if (article.author) {
      try {
        const db = mongooseInstance.connection.getClient().db();
        const authorDoc = await db
          .collection("user")
          .findOne(
            { _id: new ObjectId(article.author) },
            { projection: { name: 1, image: 1 } },
          );

        if (authorDoc) {
          author = {
            name: authorDoc.name,
            image: authorDoc.image || null,
          };
        }
      } catch (authorError) {
        console.error("Error fetching article author:", authorError.message);
        // Ne bloque pas l'affichage de l'article si l'auteur est introuvable
      }
    }

    // Incrémenter les vues (fire and forget)
    Article.updateOne({ slug }, { $inc: { views: 1 } }).catch((err) =>
      console.error("Error incrementing views:", err),
    );

    return NextResponse.json({
      success: true,
      article: {
        ...article,
        author,
      },
    });
  } catch (error) {
    console.error("Blog GET by slug Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
