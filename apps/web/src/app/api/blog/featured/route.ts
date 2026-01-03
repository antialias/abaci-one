import { NextResponse } from "next/server";
import { getFeaturedPosts } from "@/lib/blog";

export async function GET() {
  try {
    const posts = await getFeaturedPosts();
    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching featured posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch featured posts" },
      { status: 500 },
    );
  }
}
