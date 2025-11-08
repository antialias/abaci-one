import { NextResponse } from "next/server";
import { getViewerId } from "@/lib/viewer";

/**
 * GET /api/viewer
 *
 * Returns the current viewer's ID (guest or authenticated user)
 */
export async function GET() {
  try {
    const viewerId = await getViewerId();
    return NextResponse.json({ viewerId });
  } catch (_error) {
    return NextResponse.json(
      { error: "No valid viewer session found" },
      { status: 401 },
    );
  }
}
