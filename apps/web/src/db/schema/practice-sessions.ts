/**
 * Practice session types
 *
 * NOTE: The practice_sessions table has been dropped.
 * Session data is now stored in session_plans table.
 * These types are kept for backwards compatibility with the dashboard.
 */

/**
 * Practice session data - used for dashboard display
 */
export interface PracticeSession {
  id: string
  playerId: string
  phaseId: string
  /** Items attempted (the session report's `totals.problems`, Phase 4d) */
  problemsAttempted: number
  /** Items right on the first try (the report's `totals.firstTryCorrect`) */
  problemsCorrect: number
  /** Active time per try (ms): the report's `time.activeMs` ÷ `totals.tries` */
  averageTimeMs: number | null
  /** Active time (ms): the report's `time.activeMs` (Σ effective response time) */
  totalTimeMs: number | null
  skillsUsed: string[]
  visualizationMode: boolean
  startedAt: Date
  completedAt: Date | null
  /**
   * Count of flagged attempts in this session that still NEED adult review —
   * resolution-aware (flagged AND not omitted/adjusted/confirmed). Drives the
   * session-list "review timings" badge; not a session number.
   */
  unresolvedTimingCount?: number
}

/**
 * Helper to calculate accuracy from a session
 */
export function getSessionAccuracy(session: PracticeSession): number {
  if (session.problemsAttempted === 0) return 0
  return session.problemsCorrect / session.problemsAttempted
}

/**
 * Session summary for display
 */
export interface PracticeSessionSummary {
  id: string
  phaseId: string
  problemsAttempted: number
  problemsCorrect: number
  accuracy: number
  averageTimeMs: number | null
  totalTimeMs: number | null
  visualizationMode: boolean
  startedAt: Date
  completedAt: Date | null
}

/**
 * Convert a session to a summary
 */
export function toSessionSummary(session: PracticeSession): PracticeSessionSummary {
  return {
    id: session.id,
    phaseId: session.phaseId,
    problemsAttempted: session.problemsAttempted,
    problemsCorrect: session.problemsCorrect,
    accuracy: getSessionAccuracy(session),
    averageTimeMs: session.averageTimeMs,
    totalTimeMs: session.totalTimeMs,
    visualizationMode: session.visualizationMode,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
  }
}
