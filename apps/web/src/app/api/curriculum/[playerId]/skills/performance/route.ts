import { type NextRequest, NextResponse } from "next/server";
import { canPerformAction } from "@/lib/classroom";
import { analyzeSkillPerformance } from "@/lib/curriculum/progress-manager";
import { getDbUserId } from "@/lib/viewer";

interface RouteParams {
  params: Promise<{ playerId: string }>;
}

/**
 * GET /api/curriculum/[playerId]/skills/performance
 * Get skill performance analysis for a player (response times, strengths/weaknesses)
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { playerId } = await params;

  try {
    // Authorization check
    const userId = await getDbUserId();
    const canView = await canPerformAction(userId, playerId, "view");
    if (!canView) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const analysis = await analyzeSkillPerformance(playerId);
    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("Error fetching skill performance:", error);
    return NextResponse.json(
      { error: "Failed to fetch skill performance" },
      { status: 500 },
    );
  }
}
