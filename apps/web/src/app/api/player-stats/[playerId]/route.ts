import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import type { GameStatsBreakdown } from "@/db/schema/player-stats";
import { playerStats } from "@/db/schema/player-stats";
import { players } from "@/db/schema/players";
import type {
  GetPlayerStatsResponse,
  PlayerStatsData,
} from "@/lib/arcade/stats/types";
import { getViewerId } from "@/lib/viewer";

/**
 * GET /api/player-stats/[playerId]
 *
 * Fetches stats for a specific player (must be owned by current user).
 */
export async function GET(
  _request: Request,
  { params }: { params: { playerId: string } },
) {
  try {
    const { playerId } = params;

    // 1. Authenticate user
    const viewerId = await getViewerId();
    if (!viewerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Verify player belongs to user
    const player = await db
      .select()
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    if (player.userId !== viewerId) {
      return NextResponse.json(
        { error: "Forbidden: player belongs to another user" },
        { status: 403 },
      );
    }

    // 3. Fetch player stats
    const stats = await db
      .select()
      .from(playerStats)
      .where(eq(playerStats.playerId, playerId))
      .limit(1)
      .then((rows) => rows[0]);

    const playerStatsData: PlayerStatsData = stats
      ? convertToPlayerStatsData(stats)
      : createDefaultPlayerStats(playerId);

    // 4. Return response
    const response: GetPlayerStatsResponse = {
      stats: playerStatsData,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Failed to fetch player stats:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch player stats",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * Convert DB record to PlayerStatsData
 */
function convertToPlayerStatsData(
  dbStats: typeof playerStats.$inferSelect,
): PlayerStatsData {
  return {
    playerId: dbStats.playerId,
    gamesPlayed: dbStats.gamesPlayed,
    totalWins: dbStats.totalWins,
    totalLosses: dbStats.totalLosses,
    bestTime: dbStats.bestTime,
    highestAccuracy: dbStats.highestAccuracy,
    favoriteGameType: dbStats.favoriteGameType,
    gameStats: (dbStats.gameStats as Record<string, GameStatsBreakdown>) || {},
    lastPlayedAt: dbStats.lastPlayedAt,
    createdAt: dbStats.createdAt,
    updatedAt: dbStats.updatedAt,
  };
}

/**
 * Create default player stats for new player
 */
function createDefaultPlayerStats(playerId: string): PlayerStatsData {
  const now = new Date();
  return {
    playerId,
    gamesPlayed: 0,
    totalWins: 0,
    totalLosses: 0,
    bestTime: null,
    highestAccuracy: 0,
    favoriteGameType: null,
    gameStats: {},
    lastPlayedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}
