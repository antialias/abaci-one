/**
 * API route for player attachments
 *
 * GET /api/curriculum/[playerId]/attachments
 *
 * Returns attachment counts grouped by session ID for display in session history.
 */

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { practiceAttachments } from "@/db/schema";
import { canPerformAction } from "@/lib/classroom";
import { getDbUserId } from "@/lib/viewer";

interface RouteParams {
  params: Promise<{ playerId: string }>;
}

/**
 * GET - Get attachment counts per session
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params;

    if (!playerId) {
      return NextResponse.json(
        { error: "Player ID required" },
        { status: 400 },
      );
    }

    // Authorization check
    const userId = await getDbUserId();
    const canView = await canPerformAction(userId, playerId, "view");
    if (!canView) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get attachment counts grouped by session
    const counts = await db
      .select({
        sessionId: practiceAttachments.sessionId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(practiceAttachments)
      .where(eq(practiceAttachments.playerId, playerId))
      .groupBy(practiceAttachments.sessionId)
      .all();

    // Transform to a map for easy lookup
    const sessionCounts: Record<string, number> = {};
    for (const row of counts) {
      sessionCounts[row.sessionId] = row.count;
    }

    return NextResponse.json({ sessionCounts });
  } catch (error) {
    console.error("Error fetching attachment counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch attachment counts" },
      { status: 500 },
    );
  }
}
