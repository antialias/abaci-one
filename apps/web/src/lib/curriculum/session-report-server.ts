/**
 * The session report on the server (session architecture §4, Phase 4a):
 * loading its inputs, and pushing it after every committed row write.
 *
 * Push contract (§4 "Push", §3.3):
 * - `withRowCas` calls `pushSessionReportAfterCommit(before, after)` only after
 *   its `UPDATE … WHERE row_version = read` matched, so a write that lost the
 *   race never pushes; `before` is the row the winning attempt read, so the
 *   pair is exactly the transition that committed.
 * - Pushes of one session run one at a time, in the order their writes
 *   committed in this process, and a report whose `rowVersion` is not newer
 *   than the last one pushed for that session is dropped: one server's pushes
 *   carry strictly increasing `rowVersion`s. Across servers the client's rule
 *   (apply only a newer `rowVersion`) gives the same order.
 * - `session-ended` goes out when the committed write moved the session from
 *   live to ended (completed or abandoned: natural completion, end early,
 *   abandon, auto-abandon, worksheet approval), after that write's report,
 *   and even when building the report failed. Rooms: the player's, the
 *   classroom's, the gated report room and (Phase 4c) the live room
 *   `session:<id>`, whose observers then show the ended view (§10 P4a-4).
 * - Reports go only to the gated room `session-report:<id>`
 *   (`session-report-access.ts`).
 * No timers, no polling: one push per committed write.
 */

import { and, asc, desc, eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { adjustmentsOf, isEndedOutcome, sessionOutcome } from '@/db/schema/session-plan-normalize'
import type { SessionPlan } from '@/db/schema/session-plans'
import { readTries } from './read-tries'
import { setRowCommitListener } from './row-cas'
import {
  buildSessionReport,
  type ReportGameResult,
  type SessionReport,
  type SessionReportSongInput,
} from './session-report'

// ============================================================================
// Loading
// ============================================================================

async function loadBreakGameResults(planId: string): Promise<ReportGameResult[]> {
  const rows = await db
    .select({
      id: schema.gameResults.id,
      gameName: schema.gameResults.gameName,
      playedAt: schema.gameResults.playedAt,
      durationMs: schema.gameResults.durationMs,
      fullReport: schema.gameResults.fullReport,
    })
    .from(schema.gameResults)
    .where(
      and(
        eq(schema.gameResults.sessionId, planId),
        eq(schema.gameResults.sessionType, 'practice-break')
      )
    )
    .orderBy(asc(schema.gameResults.playedAt), asc(schema.gameResults.id))
  return rows
}

async function loadSong(planId: string): Promise<SessionReportSongInput | null> {
  const [song] = await db
    .select({ id: schema.sessionSongs.id, status: schema.sessionSongs.status })
    .from(schema.sessionSongs)
    .where(eq(schema.sessionSongs.sessionPlanId, planId))
    .orderBy(desc(schema.sessionSongs.createdAt))
    .limit(1)
  if (!song) return null
  const [share] = await db
    .select({ id: schema.songShares.id })
    .from(schema.songShares)
    .where(and(eq(schema.songShares.songId, song.id), eq(schema.songShares.status, 'active')))
    .orderBy(desc(schema.songShares.createdAt))
    .limit(1)
  return { id: song.id, status: song.status, shareCode: share?.id ?? null }
}

/** The report of a row already loaded (the committed row, or a route's read). */
export async function loadSessionReport(
  plan: SessionPlan,
  now: number = Date.now()
): Promise<SessionReport> {
  const [tries, gameResults, song] = await Promise.all([
    readTries(plan),
    loadBreakGameResults(plan.id),
    loadSong(plan.id),
  ])
  return buildSessionReport({ plan, tries, gameResults, song, now })
}

/** The report of a session by id; null when there is no such row. */
export async function getSessionReport(planId: string): Promise<SessionReport | null> {
  const plan = await db.query.sessionPlans.findFirst({
    where: eq(schema.sessionPlans.id, planId),
  })
  return plan ? loadSessionReport(plan) : null
}

// ============================================================================
// Push
// ============================================================================

/** Highest `rowVersion` pushed per session (bounded; oldest entries evicted). */
const lastPushed = new Map<string, number>()
const LAST_PUSHED_LIMIT = 2000
/** The running push chain per session, so pushes run in commit order. */
const chains = new Map<string, Promise<void>>()

function rememberPushed(sessionId: string, rowVersion: number) {
  lastPushed.delete(sessionId)
  lastPushed.set(sessionId, rowVersion)
  if (lastPushed.size > LAST_PUSHED_LIMIT) {
    const oldest = lastPushed.keys().next().value
    if (oldest !== undefined) lastPushed.delete(oldest)
  }
}

function endReasonOf(plan: SessionPlan): 'completed' | 'ended_early' | 'abandoned' {
  if (sessionOutcome(plan) === 'abandoned') return 'abandoned'
  return adjustmentsOf(plan).some((a) => a.type === 'ended_early') ? 'ended_early' : 'completed'
}

async function pushOne(before: SessionPlan, after: SessionPlan): Promise<void> {
  const rowVersion = after.rowVersion ?? 0
  const pushed = lastPushed.get(after.id)
  if (pushed !== undefined && rowVersion <= pushed) return
  rememberPushed(after.id, rowVersion)

  const { emitSessionEndedEverywhere, emitSessionReport } = await import(
    '@/lib/classroom/socket-emitter'
  )

  // The report, in its own try: a failed build must not swallow the end below
  try {
    await emitSessionReport(await loadSessionReport(after))
  } catch (error) {
    console.error('[session-report] report not pushed', { sessionId: after.id, error })
  }

  const outcome = sessionOutcome(after)
  if (!isEndedOutcome(outcome) || isEndedOutcome(sessionOutcome(before))) return
  let playerName = 'Unknown'
  try {
    const [player] = await db
      .select({ name: schema.players.name })
      .from(schema.players)
      .where(eq(schema.players.id, after.playerId))
      .limit(1)
    playerName = player?.name ?? playerName
  } catch (error) {
    console.error('[session-report] player lookup failed', error)
  }
  let classroomId: string | null = null
  try {
    const { getStudentPresence } = await import('@/lib/classroom/presence-manager')
    classroomId = (await getStudentPresence(after.playerId))?.classroomId ?? null
  } catch (error) {
    console.error('[session-report] presence lookup failed', error)
  }
  await emitSessionEndedEverywhere(
    {
      sessionId: after.id,
      playerId: after.playerId,
      playerName,
      reason: endReasonOf(after),
      outcome: outcome as 'completed' | 'abandoned',
      rowVersion,
    },
    classroomId
  )
}

/**
 * Queue the push for a committed write. Never throws and never delays the
 * write's caller: the push runs behind the session's earlier pushes.
 */
export function pushSessionReportAfterCommit(before: SessionPlan, after: SessionPlan): void {
  const sessionId = after.id
  const previous = chains.get(sessionId) ?? Promise.resolve()
  const next = previous
    .then(() => pushOne(before, after))
    .catch((error) => {
      console.error('[session-report] push failed', { sessionId, error })
    })
  chains.set(sessionId, next)
  void next.then(() => {
    if (chains.get(sessionId) === next) chains.delete(sessionId)
  })
}

/**
 * Tell the row-write commit path to push reports (§4 "Push"). The socket
 * server calls this once at start, so only a process with a socket server
 * pushes; scripts and the seed bundle never load this module through
 * `row-cas` (see its header).
 */
export function registerSessionReportPush(): void {
  setRowCommitListener(pushSessionReportAfterCommit)
}

/** Resolves once every queued push has run (tests, graceful shutdown). */
export async function flushSessionReportPushes(): Promise<void> {
  while (chains.size > 0) {
    await Promise.all([...chains.values()])
  }
}

/** Test seam: forget what was pushed. */
export function resetSessionReportPushState(): void {
  lastPushed.clear()
  chains.clear()
}
