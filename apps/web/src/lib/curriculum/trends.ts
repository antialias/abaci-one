/**
 * Session Trend Calculations
 *
 * Calculates historical trends from session data for display in the session summary.
 * Problems and accuracy are the session report's (§4, Phase 4d): attempted
 * problems, and right on the first try over them.
 */

import type { SessionPlan } from '@/db/schema/session-plans'
import { readTriesSync } from './read-tries'
import { buildSessionReport, type Counts } from './session-report'

export interface SessionTrends {
  /** Comparison to last session */
  accuracyDelta: number | null // e.g., 0.05 for +5%
  previousAccuracy: number | null

  /** This week stats */
  weekSessions: number
  weekProblems: number
  weekAccuracy: number

  /** All-time stats */
  totalSessions: number
  totalProblems: number
  avgAccuracy: number

  /** Streak (consecutive days with practice) */
  currentStreak: number
}

/** A session's report totals */
function totalsOf(session: SessionPlan): Counts {
  return buildSessionReport({ plan: session, tries: readTriesSync(session), now: Date.now() })
    .totals
}

/** First-try accuracy of a session (0 with nothing attempted) */
function getSessionAccuracy(session: SessionPlan): number {
  return totalsOf(session).firstTryAccuracy ?? 0
}

/** Attempted problems of a session */
function getSessionProblemCount(session: SessionPlan): number {
  return totalsOf(session).problems
}

/**
 * Check if a session was completed on a specific date
 */
function isSessionOnDate(session: SessionPlan, date: Date): boolean {
  const completedAt = session.completedAt as unknown as number
  if (!completedAt) return false
  const sessionDate = new Date(completedAt)
  return (
    sessionDate.getFullYear() === date.getFullYear() &&
    sessionDate.getMonth() === date.getMonth() &&
    sessionDate.getDate() === date.getDate()
  )
}

/**
 * Check if a session was completed within the last N days
 */
function isSessionWithinDays(session: SessionPlan, days: number): boolean {
  const completedAt = session.completedAt as unknown as number
  if (!completedAt) return false
  const now = Date.now()
  const cutoff = now - days * 24 * 60 * 60 * 1000
  return completedAt >= cutoff
}

/**
 * Calculate current practice streak (consecutive days)
 */
function calculateStreak(allSessions: SessionPlan[]): number {
  if (allSessions.length === 0) return 0

  // Sort by completion date descending
  const sorted = [...allSessions]
    .filter((s) => s.completedAt)
    .sort((a, b) => {
      const aTime = a.completedAt as unknown as number
      const bTime = b.completedAt as unknown as number
      return bTime - aTime
    })

  if (sorted.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check if there's a session today or yesterday (streak must be active)
  const mostRecent = new Date(sorted[0].completedAt as unknown as number)
  mostRecent.setHours(0, 0, 0, 0)

  const daysDiff = Math.floor((today.getTime() - mostRecent.getTime()) / (24 * 60 * 60 * 1000))
  if (daysDiff > 1) return 0 // Streak broken

  // Count consecutive days backwards
  const checkDate = new Date(mostRecent)
  const sessionDates = new Set<string>()

  for (const session of sorted) {
    const date = new Date(session.completedAt as unknown as number)
    date.setHours(0, 0, 0, 0)
    sessionDates.add(date.toISOString().split('T')[0])
  }

  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0]
    if (sessionDates.has(dateStr)) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  return streak
}

/**
 * Calculate session trends from historical data
 *
 * @param current - The current session being viewed
 * @param previous - The session before current (for delta calculation)
 * @param allSessions - All completed sessions (ordered newest first)
 */
export function calculateSessionTrends(
  current: SessionPlan | null,
  previous: SessionPlan | null,
  allSessions: SessionPlan[]
): SessionTrends | null {
  if (!current) return null

  const currentAccuracy = getSessionAccuracy(current)

  // Accuracy delta from previous session
  const previousAccuracy = previous ? getSessionAccuracy(previous) : null
  const accuracyDelta = previousAccuracy !== null ? currentAccuracy - previousAccuracy : null

  // This week stats (last 7 days)
  const weekSessions = allSessions.filter((s) => isSessionWithinDays(s, 7))
  const weekProblems = weekSessions.reduce((sum, s) => sum + getSessionProblemCount(s), 0)
  const weekCorrect = weekSessions.reduce((sum, s) => sum + totalsOf(s).firstTryCorrect, 0)
  const weekAccuracy = weekProblems > 0 ? weekCorrect / weekProblems : 0

  // All-time stats
  const totalProblems = allSessions.reduce((sum, s) => sum + getSessionProblemCount(s), 0)
  const totalCorrect = allSessions.reduce((sum, s) => sum + totalsOf(s).firstTryCorrect, 0)
  const avgAccuracy = totalProblems > 0 ? totalCorrect / totalProblems : 0

  // Streak
  const currentStreak = calculateStreak(allSessions)

  return {
    accuracyDelta,
    previousAccuracy,
    weekSessions: weekSessions.length,
    weekProblems,
    weekAccuracy,
    totalSessions: allSessions.length,
    totalProblems,
    avgAccuracy,
    currentStreak,
  }
}
