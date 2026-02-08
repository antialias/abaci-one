/**
 * Session Mode Comfort Level
 *
 * Computes the comfort level for a student alongside their session mode.
 * This is used by the session-mode API to return comfort data without
 * requiring a separate API call.
 */

import { computeBktFromHistory, DEFAULT_BKT_OPTIONS } from '@/lib/curriculum/bkt'
import { BKT_THRESHOLDS } from '@/lib/curriculum/config/bkt-integration'
import { computeComfortLevel } from './comfort-level'
import { getPracticingSkills } from './progress-manager'
import { getRecentSessionResults } from './session-planner'
import type { SessionMode } from './session-mode'

/**
 * Compute the comfort level for a student given their session mode.
 *
 * Loads BKT data and practicing skills, then delegates to computeComfortLevel().
 * This mirrors the same data loading done by getSessionMode() and generateSessionPlan().
 */
export async function getSessionModeComfortLevel(
  playerId: string,
  sessionMode: SessionMode
): Promise<number> {
  const [history, practicing] = await Promise.all([
    getRecentSessionResults(playerId, 100),
    getPracticingSkills(playerId),
  ])

  const bktResults = computeBktFromHistory(history, {
    ...DEFAULT_BKT_OPTIONS,
    confidenceThreshold: BKT_THRESHOLDS.confidence,
  })

  const bktMap = new Map(bktResults.skills.map((s) => [s.skillId, s]))
  const practicingIds = practicing.map((s) => s.skillId)

  const result = computeComfortLevel(bktMap, practicingIds, sessionMode)
  return result.comfortLevel
}
