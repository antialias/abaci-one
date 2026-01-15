import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import type { GameStatsBreakdown } from "@/db/schema/player-stats";
import { playerStats } from "@/db/schema/player-stats";
import { players } from "@/db/schema/players";
import type {
  GetAllPlayerStatsResponse,
  PlayerStatsData,
} from "@/lib/arcade/stats/types";
import { getViewerId } from "@/lib/viewer";

// Force dynamic rendering - this route uses headers()
export const dynamic = "force-dynamic";

/**
 * GET /api/player-stats
 *
 * Fetches stats for all of the current user's players.
 */
export async function GET() {
  try {
    // 1. Authenticate user
    const viewerId = await getViewerId();
    if (!viewerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch all user's players
    const userPlayers = await db
      .select()
      .from(players)
      .where(eq(players.userId, viewerId));

    const playerIds = userPlayers.map((p) => p.id);

    // 3. Fetch stats for all players
    const allStats: PlayerStatsData[] = [];

    for (const playerId of playerIds) {
      const stats = await db
        .select()
        .from(playerStats)
        .where(eq(playerStats.playerId, playerId))
        .limit(1)
        .then((rows) => rows[0]);

      if (stats) {
        allStats.push(convertToPlayerStatsData(stats));
      } else {
        // Player exists but has no stats yet
        allStats.push(createDefaultPlayerStats(playerId));
      }
    }

    // 4. Return response
    const response: GetAllPlayerStatsResponse = {
      playerStats: allStats,
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
