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
  problemsAttempted: number
  problemsCorrect: number
  /** RAW mean response time (ms). Distortion is preserved and shown alongside the clean substats. */
  averageTimeMs: number | null
  /** RAW sum of response times (ms). Preserved verbatim; see `cleanTotalTimeMs` for the de-poisoned total. */
  totalTimeMs: number | null
  skillsUsed: string[]
  visualizationMode: boolean
  startedAt: Date
  completedAt: Date | null

  // ---- Timing-integrity display substats (#157; context-free per-session) ----

  /** Count of Tier-1 (auto-quarantined) attempts in this session. */
  quarantinedTimingCount?: number
  /**
   * Count of flagged attempts in this session that still NEED adult review —
   * resolution-aware (flagged AND not omitted/adjusted/confirmed). Drives the
   * session-list "review timings" badge so it disappears once every flag is
   * acted on; `quarantinedTimingCount` stays as the raw informational substat.
   */
  unresolvedTimingCount?: number
  /** Σ effective response time (ms) over non-Tier-1 samples — the de-poisoned total. */
  cleanTotalTimeMs?: number | null
  /** Count of samples summed into `cleanTotalTimeMs` (its denominator companion). */
  timedProblemCount?: number
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
