import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { players } from "@/db/schema";
import {
  computeBktFromHistory,
  DEFAULT_BKT_OPTIONS,
  type SkillBktResult,
} from "@/lib/curriculum/bkt";
import { BKT_THRESHOLDS } from "@/lib/curriculum/config/bkt-integration";
import { getRecentSessionResults } from "@/lib/curriculum/session-planner";

/**
 * GET /api/settings/bkt/aggregate
 *
 * Returns aggregate BKT stats across all students.
 *
 * Query params:
 * - threshold: confidence threshold (default from BKT_THRESHOLDS.confidence)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threshold = parseFloat(
      searchParams.get("threshold") ?? String(BKT_THRESHOLDS.confidence),
    );

    // Get all players
    const allPlayers = await db.select({ id: players.id }).from(players);

    if (allPlayers.length === 0) {
      return NextResponse.json({
        totalStudents: 0,
        totalSkills: 0,
        weak: 0,
        developing: 0,
        strong: 0,
        // Legacy aliases for backwards compatibility
        struggling: 0,
        learning: 0,
        mastered: 0,
      });
    }

    // Track aggregate counts
    let totalStudents = 0;
    let totalSkills = 0;
    let weak = 0;
    let developing = 0;
    let strong = 0;

    // Process each player
    for (const player of allPlayers) {
      // Fetch problem history using the session-planner's helper
      const problemHistory = await getRecentSessionResults(player.id, 500);

      if (problemHistory.length === 0) continue;

      // Compute BKT
      const bktResult = computeBktFromHistory(problemHistory, {
        ...DEFAULT_BKT_OPTIONS,
        confidenceThreshold: threshold,
      });

      // Count classifications
      totalStudents++;
      for (const skill of bktResult.skills) {
        totalSkills++;
        const classification = classifySkill(skill, threshold);
        if (classification === "weak") weak++;
        else if (classification === "developing") developing++;
        else if (classification === "strong") strong++;
      }
    }

    return NextResponse.json({
      totalStudents,
      totalSkills,
      weak,
      developing,
      strong,
      // Legacy aliases for backwards compatibility with BktSettingsClient
      struggling: weak,
      learning: developing,
      mastered: strong,
    });
  } catch (error) {
    console.error("Error computing aggregate BKT stats:", error);
    return NextResponse.json(
      { error: "Failed to compute stats" },
      { status: 500 },
    );
  }
}

function classifySkill(
  skill: SkillBktResult,
  threshold: number,
): "weak" | "developing" | "strong" {
  if (skill.confidence < threshold) {
    return "developing"; // Not enough data - safest default
  }
  if (skill.pKnown >= BKT_THRESHOLDS.strong) {
    return "strong";
  }
  if (skill.pKnown < BKT_THRESHOLDS.weak) {
    return "weak";
  }
  return "developing";
}
