import { newerReport } from '@/hooks/useSessionReport'
import type { SessionReport } from '@/lib/curriculum/session-report'

/**
 * The report the summary shows (Phase 4b): the live copy (push or fetch) once
 * it is this session's and at least as new as the server's, else the
 * server's. On a `rowVersion` tie the live copy wins: it is the fresher build
 * (an in-progress session's wall time runs to its build time), as
 * `useSessionReport` lets a fetch replace a report of the same `rowVersion`.
 */
export function pickSummaryReport(
  sessionId: string | null,
  initialReport: SessionReport | null,
  liveReport: SessionReport | undefined
): SessionReport | null {
  if (!sessionId || liveReport?.sessionId !== sessionId) return initialReport
  return initialReport ? newerReport(liveReport, initialReport) : liveReport
}
