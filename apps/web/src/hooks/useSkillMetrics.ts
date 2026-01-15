/**
 * Hooks for managing skill metrics for the scoreboard
 *
 * Provides access to:
 * - Player's skill metrics (overall mastery, category breakdown, trends)
 * - Classroom skills leaderboard (effort-based, improvement-based, speed champions)
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/queryClient";
import { skillMetricsKeys } from "@/lib/queryKeys";
import type {
  StudentSkillMetrics,
  ClassroomSkillsLeaderboard,
} from "@/lib/curriculum/skill-metrics";

// Re-export query keys for consumers
export { skillMetricsKeys } from "@/lib/queryKeys";

// ============================================================================
// API Functions
// ============================================================================

async function fetchPlayerSkillMetrics(
  playerId: string,
): Promise<StudentSkillMetrics> {
  const response = await api(`curriculum/${playerId}/skills/metrics`);

  if (!response.ok) {
    throw new Error(`Failed to fetch skill metrics: ${response.statusText}`);
  }

  const data = await response.json();
  return data.metrics;
}

async function fetchClassroomSkillsLeaderboard(
  classroomId: string,
): Promise<ClassroomSkillsLeaderboard> {
  const response = await api(`classroom/${classroomId}/skills/leaderboard`);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch skills leaderboard: ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data.leaderboard;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch a player's skill metrics for display on the scoreboard.
 *
 * Returns:
 * - Overall mastery percentage (weighted by confidence)
 * - Category breakdown (basic, fiveComplements, etc.)
 * - Normalized response time (seconds per term) with trend
 * - Accuracy metrics with trend
 * - Progress metrics (improvement rate, streak, problem counts)
 */
export function usePlayerSkillMetrics(playerId: string | null) {
  return useQuery({
    queryKey: skillMetricsKeys.player(playerId ?? ""),
    queryFn: () => fetchPlayerSkillMetrics(playerId!),
    enabled: !!playerId,
    // Skill metrics don't change frequently, cache for 1 minute
    staleTime: 60 * 1000,
  });
}

/**
 * Hook to fetch the classroom skills leaderboard.
 *
 * Provides "fun ways to compare students across different ability levels":
 * - Effort-based: byWeeklyProblems, byTotalProblems, byPracticeStreak
 * - Improvement-based: byImprovementRate
 * - Speed champions: fastest in each category (only mastered students compete)
 */
export function useClassroomSkillsLeaderboard(classroomId: string | null) {
  return useQuery({
    queryKey: skillMetricsKeys.classroomLeaderboard(classroomId ?? ""),
    queryFn: () => fetchClassroomSkillsLeaderboard(classroomId!),
    enabled: !!classroomId,
    // Leaderboard is computed on demand, cache for 2 minutes
    staleTime: 2 * 60 * 1000,
  });
}
