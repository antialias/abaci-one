/**
 * Extract session statistics for song prompt generation.
 *
 * Takes a session plan + player + recent history and produces a structured
 * input object that the LLM uses to write personalized song lyrics.
 */

import type { SessionPlan } from '@/db/schema/session-plans'
import type { Player } from '@/db/schema/players'
import {
  getSessionPlanAccuracy,
  getTotalProblemCount,
  getCompletedProblemCount,
} from '@/db/schema/session-plan-helpers'
import { PRACTICE_TYPES } from '@/constants/practiceTypes'

// ============================================================================
// Types
// ============================================================================

export interface SongPromptInput {
  player: {
    name: string
    emoji: string
  }
  currentSession: {
    accuracy: number
    problemsDone: number
    problemsTotal: number
    skillsPracticed: string[]
    bestCorrectStreak: number
    partTypes: string[]
    durationMinutes: number
    helpUsed: boolean
  }
  history: {
    recentSessionCount: number
    averageAccuracy: number
    trend: 'improving' | 'steady' | 'declining'
  }
}

// ============================================================================
// Helper — compute best correct streak from results
// ============================================================================

function getBestCorrectStreak(results: Array<{ isCorrect: boolean }>): number {
  let best = 0
  let current = 0
  for (const r of results) {
    if (r.isCorrect) {
      current++
      if (current > best) best = current
    } else {
      current = 0
    }
  }
  return best
}

// ============================================================================
// Helper — get human-readable labels for part types
// ============================================================================

function getPartTypeLabel(partType: string): string {
  const found = PRACTICE_TYPES.find((t) => t.id === partType)
  return found?.label ?? partType
}

// ============================================================================
// Main extractor
// ============================================================================

interface RecentSessionSummary {
  accuracy: number
}

/**
 * Extract statistics from a session plan and player for use in song generation.
 *
 * @param plan - The current session plan (may be in-progress or completed)
 * @param player - The player profile
 * @param recentSessions - Summary of recent sessions (past week) for trend calculation
 */
export function extractSessionStats(
  plan: SessionPlan,
  player: Player,
  recentSessions: RecentSessionSummary[]
): SongPromptInput {
  const accuracy = getSessionPlanAccuracy(plan)
  const problemsDone = getCompletedProblemCount(plan)
  const problemsTotal = getTotalProblemCount(plan)
  const bestCorrectStreak = getBestCorrectStreak(plan.results)

  // Get unique part types with human-readable labels
  const partTypeIds = [...new Set(plan.parts.map((p) => p.type))]
  const partTypeLabels = partTypeIds.map(getPartTypeLabel)

  // Collect unique skill names exercised from results
  const skillNames = new Set<string>()
  for (const result of plan.results) {
    if (result.skillsExercised) {
      for (const skill of result.skillsExercised) {
        skillNames.add(skill)
      }
    }
  }

  // Check if help was used in any result
  const helpUsed = plan.results.some((r) => r.hadHelp)

  // Calculate duration in minutes
  const durationMinutes = plan.targetDurationMinutes ?? 10

  // Calculate history trend
  const recentCount = recentSessions.length
  let averageAccuracy = 0
  let trend: 'improving' | 'steady' | 'declining' = 'steady'

  if (recentCount > 0) {
    averageAccuracy = recentSessions.reduce((sum, s) => sum + s.accuracy, 0) / recentCount

    if (recentCount >= 3) {
      // Compare first half vs second half
      const mid = Math.floor(recentCount / 2)
      const olderAvg = recentSessions.slice(0, mid).reduce((sum, s) => sum + s.accuracy, 0) / mid
      const newerAvg =
        recentSessions.slice(mid).reduce((sum, s) => sum + s.accuracy, 0) / (recentCount - mid)

      const diff = newerAvg - olderAvg
      if (diff > 0.05) trend = 'improving'
      else if (diff < -0.05) trend = 'declining'
    }
  }

  return {
    player: {
      name: player.name,
      emoji: player.emoji,
    },
    currentSession: {
      accuracy,
      problemsDone,
      problemsTotal,
      skillsPracticed: [...skillNames],
      bestCorrectStreak,
      partTypes: partTypeLabels,
      durationMinutes,
      helpUsed,
    },
    history: {
      recentSessionCount: recentCount,
      averageAccuracy,
      trend,
    },
  }
}
