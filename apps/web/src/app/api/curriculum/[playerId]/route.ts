/**
 * API route for player curriculum management
 *
 * GET /api/curriculum/[playerId] - Get full curriculum state
 * PATCH /api/curriculum/[playerId] - Update curriculum settings
 */

import { NextResponse } from "next/server";
import { canPerformAction } from "@/lib/classroom";
import {
  getPlayerCurriculum,
  getAllSkillMastery,
  getRecentSessions,
  upsertPlayerCurriculum,
} from "@/lib/curriculum/progress-manager";
import { getRecentSessionResults } from "@/lib/curriculum/session-planner";
import { getDbUserId } from "@/lib/viewer";

interface RouteParams {
  params: Promise<{ playerId: string }>;
}

/**
 * GET - Fetch player's full curriculum state
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

    const [curriculum, rawSkills, recentSessions, sessionResults] =
      await Promise.all([
        getPlayerCurriculum(playerId),
        getAllSkillMastery(playerId),
        getRecentSessions(playerId, 200),
        getRecentSessionResults(playerId, 2000),
      ]);

    // Compute skill stats from session results (single source of truth)
    const skillStats = new Map<
      string,
      { attempts: number; correct: number; responseTimes: number[] }
    >();
    for (const result of sessionResults) {
      for (const skillId of result.skillsExercised) {
        if (!skillStats.has(skillId)) {
          skillStats.set(skillId, {
            attempts: 0,
            correct: 0,
            responseTimes: [],
          });
        }
        const stats = skillStats.get(skillId)!;
        stats.attempts++;
        if (result.isCorrect) {
          stats.correct++;
        }
        if (result.responseTimeMs > 0) {
          stats.responseTimes.push(result.responseTimeMs);
        }
      }
    }

    // Enrich skills with computed stats
    const skills = rawSkills.map((skill) => {
      const stats = skillStats.get(skill.skillId);
      return {
        ...skill,
        attempts: stats?.attempts ?? 0,
        correct: stats?.correct ?? 0,
        totalResponseTimeMs:
          stats?.responseTimes.reduce((a, b) => a + b, 0) ?? 0,
        responseTimeCount: stats?.responseTimes.length ?? 0,
      };
    });

    return NextResponse.json({
      curriculum,
      skills,
      recentSessions,
    });
  } catch (error) {
    console.error("Error fetching curriculum:", error);
    return NextResponse.json(
      { error: "Failed to fetch curriculum" },
      { status: 500 },
    );
  }
}

/**
 * PATCH - Update curriculum settings
 *
 * Only parents and present teachers can modify curriculum settings.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { playerId } = await params;

    if (!playerId) {
      return NextResponse.json(
        { error: "Player ID required" },
        { status: 400 },
      );
    }

    // Authorization check - stricter than 'view', only parents/present teachers can modify
    const userId = await getDbUserId();
    const canModify = await canPerformAction(userId, playerId, "start-session");
    if (!canModify) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { worksheetPreset, visualizationMode, currentLevel, currentPhaseId } =
      body;

    const updated = await upsertPlayerCurriculum(playerId, {
      ...(worksheetPreset !== undefined && { worksheetPreset }),
      ...(visualizationMode !== undefined && { visualizationMode }),
      ...(currentLevel !== undefined && { currentLevel }),
      ...(currentPhaseId !== undefined && { currentPhaseId }),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating curriculum:", error);
    return NextResponse.json(
      { error: "Failed to update curriculum" },
      { status: 500 },
    );
  }
}
