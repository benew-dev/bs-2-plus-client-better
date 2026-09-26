import { NextResponse } from "next/server";
import connectDB from "@/backend/config/dbConnect";
import Article from "@/backend/models/article";

// GET - Récupérer les articles publiés (public)
export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 9;
    const tag = searchParams.get("tag");
    const skip = (page - 1) * limit;

    // Construire la requête
    const query = { isPublished: true };
    if (tag) {
      query.tags = tag.toLowerCase();
    }

    // Récupérer les articles (sans populate author)
    const articles = await Article.find(query)
      .select("-author -content") // Exclure author et content (pas besoin dans la liste)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Compter le total
    const totalArticles = await Article.countDocuments(query);
    const totalPages = Math.ceil(totalArticles / limit);

    return NextResponse.json({
      success: true,
      articles,
      pagination: {
        currentPage: page,
        totalPages,
        totalArticles,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Blog GET Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 },
    );
  }
}
