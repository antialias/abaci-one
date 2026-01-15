/**
 * Hooks for managing game results and scoreboard data
 *
 * Provides access to:
 * - Player's game history and personal bests
 * - Classroom leaderboards
 * - Save game results mutation
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { gameResultsKeys } from "@/lib/queryKeys";
import type { GameResultsReport } from "@/lib/arcade/game-sdk/types";
import type { GameResult } from "@/db/schema";

// Re-export query keys for consumers
export { gameResultsKeys } from "@/lib/queryKeys";

// ============================================================================
// Types
// ============================================================================

export interface PersonalBest {
  bestScore: number;
  gamesPlayed: number;
  displayName: string;
  icon: string | null;
}

export interface PlayerGameHistoryData {
  history: GameResult[];
  personalBests: Record<string, PersonalBest>;
  totalGames: number;
}

export interface LeaderboardRanking {
  playerId: string;
  playerName: string;
  playerEmoji: string;
  bestScore: number;
  gamesPlayed: number;
  avgScore: number;
  totalDuration: number;
  rank: number;
}

export interface GameAvailable {
  gameName: string;
  gameDisplayName: string;
  gameIcon: string | null;
}

export interface ClassroomLeaderboardData {
  rankings: LeaderboardRanking[];
  playerCount: number;
  gamesAvailable: GameAvailable[];
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchPlayerGameHistory(
  playerId: string,
  options?: { gameName?: string; limit?: number },
): Promise<PlayerGameHistoryData> {
  const params = new URLSearchParams();
  if (options?.gameName) params.set("gameName", options.gameName);
  if (options?.limit) params.set("limit", String(options.limit));

  const url = `game-results/player/${playerId}${params.toString() ? `?${params}` : ""}`;
  const response = await api(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch game history: ${response.statusText}`);
  }

  return response.json();
}

async function fetchClassroomLeaderboard(
  classroomId: string,
  gameName?: string,
): Promise<ClassroomLeaderboardData> {
  const params = new URLSearchParams();
  if (gameName) params.set("gameName", gameName);

  const url = `game-results/leaderboard/classroom/${classroomId}${params.toString() ? `?${params}` : ""}`;
  const response = await api(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }

  return response.json();
}

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook for fetching a player's game history and personal bests
 *
 * @param playerId - The player ID to fetch history for
 * @param options - Optional filters (gameName, limit)
 */
export function usePlayerGameHistory(
  playerId: string | null,
  options?: { gameName?: string; limit?: number },
) {
  return useQuery({
    queryKey: gameResultsKeys.playerHistory(playerId ?? ""),
    queryFn: () => fetchPlayerGameHistory(playerId!, options),
    enabled: !!playerId,
  });
}

/**
 * Hook for fetching classroom leaderboard rankings
 *
 * @param classroomId - The classroom ID to fetch leaderboard for
 * @param gameName - Optional game filter
 */
export function useClassroomLeaderboard(
  classroomId: string | null,
  gameName?: string,
) {
  return useQuery({
    queryKey: gameResultsKeys.classroomLeaderboard(classroomId ?? "", gameName),
    queryFn: () => fetchClassroomLeaderboard(classroomId!, gameName),
    enabled: !!classroomId,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

export interface SaveGameResultParams {
  playerId: string;
  userId?: string;
  sessionType: "practice-break" | "arcade-room" | "standalone";
  sessionId?: string;
  report: GameResultsReport;
}

/**
 * Hook for saving a game result to the database
 *
 * Used when a game completes to persist results for scoreboard/history.
 * Automatically invalidates the player's history and leaderboards.
 */
export function useSaveGameResult() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SaveGameResultParams) => {
      const response = await api("game-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save game result");
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate player's history
      queryClient.invalidateQueries({
        queryKey: gameResultsKeys.playerHistory(variables.playerId),
      });
      // Invalidate any leaderboards they might be on
      queryClient.invalidateQueries({
        queryKey: [...gameResultsKeys.all, "leaderboard"],
      });
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to find the player's rank in a classroom leaderboard
 *
 * @param classroomId - The classroom ID
 * @param playerId - The current player ID
 * @param gameName - Optional game filter
 * @returns The player's ranking info or null if not found
 */
export function usePlayerClassroomRank(
  classroomId: string | null,
  playerId: string | null,
  gameName?: string,
) {
  const { data: leaderboard, ...rest } = useClassroomLeaderboard(
    classroomId,
    gameName,
  );

  const playerRanking =
    leaderboard?.rankings.find((r) => r.playerId === playerId) ?? null;

  return {
    ...rest,
    playerRanking,
    totalPlayers: leaderboard?.playerCount ?? 0,
    rankings: leaderboard?.rankings ?? [],
  };
}
