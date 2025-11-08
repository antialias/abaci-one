import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import type { GameStatsBreakdown } from "@/db/schema/player-stats";
import { playerStats } from "@/db/schema/player-stats";
import type {
  GameResult,
  PlayerGameResult,
  PlayerStatsData,
  RecordGameRequest,
  RecordGameResponse,
  StatsUpdate,
} from "@/lib/arcade/stats/types";
import { getViewerId } from "@/lib/viewer";

/**
 * POST /api/player-stats/record-game
 *
 * Records a game result and updates player stats for all participants.
 * Supports cooperative games (team wins/losses) and competitive games.
 */
export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const viewerId = await getViewerId();
    if (!viewerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse and validate request
    const body: RecordGameRequest = await request.json();
    const { gameResult } = body;

    if (
      !gameResult ||
      !gameResult.playerResults ||
      gameResult.playerResults.length === 0
    ) {
      return NextResponse.json(
        { error: "Invalid game result: playerResults required" },
        { status: 400 },
      );
    }

    if (!gameResult.gameType) {
      return NextResponse.json(
        { error: "Invalid game result: gameType required" },
        { status: 400 },
      );
    }

    // 3. Process each player's result
    const updates: StatsUpdate[] = [];

    for (const playerResult of gameResult.playerResults) {
      const update = await recordPlayerResult(gameResult, playerResult);
      updates.push(update);
    }

    // 4. Return success response
    const response: RecordGameResponse = {
      success: true,
      updates,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("❌ Failed to record game result:", error);
    return NextResponse.json(
      {
        error: "Failed to record game result",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

/**
 * Records stats for a single player's game result
 */
async function recordPlayerResult(
  gameResult: GameResult,
  playerResult: PlayerGameResult,
): Promise<StatsUpdate> {
  const { playerId } = playerResult;

  // 1. Fetch or create player stats
  const existingStats = await db
    .select()
    .from(playerStats)
    .where(eq(playerStats.playerId, playerId))
    .limit(1)
    .then((rows) => rows[0]);

  const previousStats: PlayerStatsData = existingStats
    ? convertToPlayerStatsData(existingStats)
    : createDefaultPlayerStats(playerId);

  // 2. Calculate new stats
  const newStats: PlayerStatsData = { ...previousStats };

  // Always increment games played
  newStats.gamesPlayed++;

  // Handle wins/losses (cooperative vs competitive)
  if (gameResult.metadata?.isTeamVictory !== undefined) {
    // Cooperative game: all players share outcome
    if (playerResult.won) {
      newStats.totalWins++;
    } else {
      newStats.totalLosses++;
    }
  } else {
    // Competitive/Solo: individual outcome
    if (playerResult.won) {
      newStats.totalWins++;
    } else {
      newStats.totalLosses++;
    }
  }

  // Update best time (if provided and improved)
  if (playerResult.completionTime) {
    if (!newStats.bestTime || playerResult.completionTime < newStats.bestTime) {
      newStats.bestTime = playerResult.completionTime;
    }
  }

  // Update highest accuracy (if provided and improved)
  if (
    playerResult.accuracy !== undefined &&
    playerResult.accuracy > newStats.highestAccuracy
  ) {
    newStats.highestAccuracy = playerResult.accuracy;
  }

  // Update per-game stats (JSON)
  const gameType = gameResult.gameType;
  const currentGameStats: GameStatsBreakdown = newStats.gameStats[gameType] || {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    bestTime: null,
    highestAccuracy: 0,
    averageScore: 0,
    lastPlayed: 0,
  };

  currentGameStats.gamesPlayed++;
  if (playerResult.won) {
    currentGameStats.wins++;
  } else {
    currentGameStats.losses++;
  }

  // Update game-specific best time
  if (playerResult.completionTime) {
    if (
      !currentGameStats.bestTime ||
      playerResult.completionTime < currentGameStats.bestTime
    ) {
      currentGameStats.bestTime = playerResult.completionTime;
    }
  }

  // Update game-specific highest accuracy
  if (
    playerResult.accuracy !== undefined &&
    playerResult.accuracy > currentGameStats.highestAccuracy
  ) {
    currentGameStats.highestAccuracy = playerResult.accuracy;
  }

  // Update average score
  if (playerResult.score !== undefined) {
    const previousTotal =
      currentGameStats.averageScore * (currentGameStats.gamesPlayed - 1);
    currentGameStats.averageScore =
      (previousTotal + playerResult.score) / currentGameStats.gamesPlayed;
  }

  currentGameStats.lastPlayed = gameResult.completedAt;

  newStats.gameStats[gameType] = currentGameStats;

  // Update favorite game type (most played)
  newStats.favoriteGameType = getMostPlayedGame(newStats.gameStats);

  // Update timestamps
  newStats.lastPlayedAt = new Date(gameResult.completedAt);
  newStats.updatedAt = new Date();

  // 3. Save to database
  if (existingStats) {
    // Update existing record
    await db
      .update(playerStats)
      .set({
        gamesPlayed: newStats.gamesPlayed,
        totalWins: newStats.totalWins,
        totalLosses: newStats.totalLosses,
        bestTime: newStats.bestTime,
        highestAccuracy: newStats.highestAccuracy,
        favoriteGameType: newStats.favoriteGameType,
        gameStats: newStats.gameStats as any, // Drizzle JSON type
        lastPlayedAt: newStats.lastPlayedAt,
        updatedAt: newStats.updatedAt,
      })
      .where(eq(playerStats.playerId, playerId));
  } else {
    // Insert new record
    await db.insert(playerStats).values({
      playerId: newStats.playerId,
      gamesPlayed: newStats.gamesPlayed,
      totalWins: newStats.totalWins,
      totalLosses: newStats.totalLosses,
      bestTime: newStats.bestTime,
      highestAccuracy: newStats.highestAccuracy,
      favoriteGameType: newStats.favoriteGameType,
      gameStats: newStats.gameStats as any,
      lastPlayedAt: newStats.lastPlayedAt,
      createdAt: newStats.createdAt,
      updatedAt: newStats.updatedAt,
    });
  }

  // 4. Return update summary
  return {
    playerId,
    previousStats,
    newStats,
    changes: {
      gamesPlayed: newStats.gamesPlayed - previousStats.gamesPlayed,
      wins: newStats.totalWins - previousStats.totalWins,
      losses: newStats.totalLosses - previousStats.totalLosses,
    },
  };
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

/**
 * Determine most-played game from game stats
 */
function getMostPlayedGame(
  gameStats: Record<string, GameStatsBreakdown>,
): string | null {
  const games = Object.entries(gameStats);
  if (games.length === 0) return null;

  return games.reduce((mostPlayed, [gameType, stats]) => {
    const mostPlayedStats = gameStats[mostPlayed];
    return stats.gamesPlayed > (mostPlayedStats?.gamesPlayed || 0)
      ? gameType
      : mostPlayed;
  }, games[0][0]);
}
