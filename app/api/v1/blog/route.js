// app/api/v1/blog/route.js

import { NextResponse } from "next/server";
import connectDB from "@/backend/config/dbConnect";
import Article from "@/backend/models/article";

/**
 * GET /api/v1/blog
 * Version mobile : récupère les articles publiés (public), avec pagination
 * et filtre optionnel par tag.
 */
export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 9;
    const tag = searchParams.get("tag");
    const skip = (page - 1) * limit;

    const query = { isPublished: true };
    if (tag) {
      query.tags = tag.toLowerCase();
    }

    // Exclure author et content (pas besoin dans la liste)
    const articles = await Article.find(query)
      .select("-author -content")
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

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
