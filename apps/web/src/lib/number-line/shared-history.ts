/**
 * Shared history between a child (player) and a number on the number line.
 *
 * Loads past moments from previous calls and selects the most memorable
 * moments for system prompt injection. Unculled sessions are skipped
 * (not blocked on) and culled in the background so they're ready next time.
 */

import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { startMomentCull } from '../tasks/moment-cull'

export interface SharedHistoryMoment {
  caption: string
  category: string
  significance: number
  /** Fuzzy temporal label: "last time", "a few calls ago", "a while back" */
  recencyLabel: string
}

export interface SharedHistory {
  totalCalls: number
  firstCallDate: Date | null
  sessionSummaries: string[]
  moments: SharedHistoryMoment[]
  /** True if background culls were triggered — client should re-fetch after a delay */
  pendingCulls: boolean
}

const MAX_MOMENTS = 8
const MAX_SESSION_SUMMARIES = 3

/**
 * Load shared history between a player and a caller number.
 *
 * Only includes moments from culled sessions. Unculled sessions
 * (dirty disconnects) are kicked off for background culling but
 * NOT awaited — the call connects immediately. Those moments will
 * be available by the next call.
 */
export async function getSharedHistory(
  playerId: string,
  callerNumber: number,
  userId?: string
): Promise<SharedHistory | null> {
  // Load all sessions for this pair
  const sessions = await db
    .select()
    .from(schema.numberLineSessions)
    .where(
      and(
        eq(schema.numberLineSessions.playerId, playerId),
        eq(schema.numberLineSessions.callerNumber, callerNumber)
      )
    )
    .orderBy(desc(schema.numberLineSessions.createdAt))

  if (sessions.length === 0) return null

  // Dead man's switch: kick off cull for any unculled sessions (fire-and-forget).
  // Skip sessions that already have a cull task running to avoid duplicate work.
  const unculled = sessions.filter((s) => !s.isCulled && s.momentCount > 0 && !s.cullTaskId)
  for (const session of unculled) {
    startMomentCull(
      {
        sessionId: session.id,
        playerId: session.playerId,
        callerNumber: session.callerNumber,
      },
      userId
    ).catch((err) =>
      console.warn(`[shared-history] Background cull failed for session ${session.id}:`, err)
    )
  }

  const hasPendingCulls = unculled.length > 0

  // Only use culled sessions for history (unculled ones aren't ready yet)
  const culledSessions = sessions.filter((s) => s.isCulled)

  // If no culled sessions, return minimal result so the client knows to re-fetch
  if (culledSessions.length === 0) {
    if (!hasPendingCulls) return null
    return {
      totalCalls: sessions.length,
      firstCallDate: sessions[sessions.length - 1].createdAt,
      sessionSummaries: [],
      moments: [],
      pendingCulls: true,
    }
  }

  // Load kept moments from culled sessions only
  const culledSessionIds = new Set(culledSessions.map((s) => s.id))
  const allMoments = await db
    .select()
    .from(schema.numberLineMoments)
    .where(
      and(
        eq(schema.numberLineMoments.playerId, playerId),
        eq(schema.numberLineMoments.callerNumber, callerNumber),
        eq(schema.numberLineMoments.keep, true)
      )
    )
    .orderBy(desc(schema.numberLineMoments.createdAt))

  // Filter to only moments from culled sessions
  const moments = allMoments.filter((m) => culledSessionIds.has(m.sessionId))

  if (moments.length === 0 && culledSessions.every((s) => !s.sessionSummary)) {
    return null
  }

  // Select moments with category diversity and temporal spread
  const selected = selectMoments(moments, culledSessions)

  // Collect session summaries (most recent culled first)
  const summaries = culledSessions
    .filter((s) => s.sessionSummary)
    .slice(0, MAX_SESSION_SUMMARIES)
    .map((s) => s.sessionSummary!)

  return {
    totalCalls: sessions.length, // include unculled in total count
    firstCallDate: sessions.length > 0 ? sessions[sessions.length - 1].createdAt : null,
    sessionSummaries: summaries,
    moments: selected,
    pendingCulls: hasPendingCulls,
  }
}

/**
 * Select the best moments for prompt injection.
 *
 * Scoring: longTermSignificance × recencyMultiplier
 * Then greedy selection with category penalty to ensure diversity.
 */
function selectMoments(
  moments: (typeof schema.numberLineMoments.$inferSelect)[],
  sessions: (typeof schema.numberLineSessions.$inferSelect)[]
): SharedHistoryMoment[] {
  if (moments.length === 0) return []

  // Build session index map (most recent = 0)
  const sessionOrder = new Map<string, number>()
  sessions.forEach((s, i) => sessionOrder.set(s.id, i))

  // Score each moment
  const scored = moments.map((m) => {
    const sessionIdx = sessionOrder.get(m.sessionId) ?? sessions.length
    const recencyMultiplier = getRecencyMultiplier(sessionIdx)
    const significance = m.longTermSignificance ?? m.rawSignificance
    const score = significance * recencyMultiplier

    return {
      ...m,
      score,
      sessionIdx,
      recencyLabel: getRecencyLabel(sessionIdx),
    }
  })

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Greedy selection with category penalty
  const categoryCounts = new Map<string, number>()
  const sessionCounts = new Map<number, number>()
  const selected: SharedHistoryMoment[] = []

  for (const m of scored) {
    if (selected.length >= MAX_MOMENTS) break

    const catCount = categoryCounts.get(m.category) ?? 0
    const sessCount = sessionCounts.get(m.sessionIdx) ?? 0

    // Penalize over-represented categories (>2 of same type feels monotone)
    // and over-represented sessions (>3 from one call crowds out other visits)
    let adjustedScore = m.score
    if (catCount >= 2) adjustedScore *= 0.5
    if (sessCount >= 3) adjustedScore *= 0.5

    // Always take the first 3 (guarantees some history even with low scores),
    // after that only keep moments with meaningful adjusted scores
    if (adjustedScore > 1.5 || selected.length < 3) {
      selected.push({
        caption: m.caption,
        category: m.category,
        significance: m.longTermSignificance ?? m.rawSignificance,
        recencyLabel: m.recencyLabel,
      })
      categoryCounts.set(m.category, catCount + 1)
      sessionCounts.set(m.sessionIdx, sessCount + 1)
    }
  }

  return selected
}

function getRecencyMultiplier(sessionIdx: number): number {
  if (sessionIdx === 0) return 1.0 // last call
  if (sessionIdx <= 2) return 0.8 // 2-3 calls ago
  if (sessionIdx <= 6) return 0.5 // 4-7 calls ago
  return 0.3 // 8+ calls ago
}

function getRecencyLabel(sessionIdx: number): string {
  if (sessionIdx === 0) return 'last time'
  if (sessionIdx === 1) return 'a couple calls ago'
  if (sessionIdx <= 3) return 'a few calls ago'
  return 'a while back'
}
