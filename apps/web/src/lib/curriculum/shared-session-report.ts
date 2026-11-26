/**
 * A share link's session and its report, on the server (session architecture
 * §4, Phase 4c): the share page, its OG image and `GET /api/observe/[token]`
 * decide live / ended / not started from the session's outcome and show the
 * report's numbers, as `GET /api/observe/[token]/report` serves them.
 *
 * The token rule is the report route's (§10 P4a-5): completion marks a
 * session's shares `expired`, and such a share still opens the ended session
 * (its report and ended page) while it is before its own `expiresAt`; it is
 * refused while the session is live. A revoked share, or one past its expiry,
 * is refused always.
 */

import 'server-only'

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { type SessionOutcome, sessionOutcome } from '@/db/schema/session-plan-normalize'
import type { SessionPlan } from '@/db/schema/session-plans'
import { getSessionPlan } from '@/lib/curriculum/session-planner'
import type { SessionReport } from '@/lib/curriculum/session-report'
import { loadSessionReport } from '@/lib/curriculum/session-report-server'
import { validateSessionShare } from '@/lib/session-share'

export interface SharedSessionPlayer {
  id: string
  name: string
  emoji: string
  color: string
}

export type SharedSessionShare = { sessionId: string; playerId: string; expiresAt: Date }

/** A share link's session without its report: what live / ended / not started needs. */
export type SharedPlanLookup =
  | { kind: 'invalid'; error: string }
  | {
      kind: 'ok'
      token: string
      share: SharedSessionShare
      plan: SessionPlan
      outcome: Extract<SessionOutcome, 'not_started' | 'in_progress' | 'completed' | 'abandoned'>
      player: SharedSessionPlayer | null
    }

export type SharedSessionLookup =
  | { kind: 'invalid'; error: string }
  | (Extract<SharedPlanLookup, { kind: 'ok' }> & {
      /** The report; null before the session started */
      report: SessionReport | null
    })

/**
 * The share, its session row, outcome and player, by the token rule above;
 * no report is built (so a report failure cannot fail this lookup).
 */
export async function loadSharedPlan(token: string): Promise<SharedPlanLookup> {
  const validation = await validateSessionShare(token, { allowEnded: true })
  if (!validation.valid || !validation.share) {
    return { kind: 'invalid', error: validation.error || 'Invalid share link' }
  }
  const share = validation.share
  const plan = await getSessionPlan(share.sessionId)
  const outcome = plan ? sessionOutcome(plan) : null
  if (!plan || !outcome || outcome === 'deleted' || outcome === 'sentinel') {
    return { kind: 'invalid', error: 'Session not found' }
  }
  if (validation.requiresEndedSession && outcome !== 'completed' && outcome !== 'abandoned') {
    return { kind: 'invalid', error: 'Share link is no longer active' }
  }
  const [player] = await db
    .select({
      id: schema.players.id,
      name: schema.players.name,
      emoji: schema.players.emoji,
      color: schema.players.color,
    })
    .from(schema.players)
    .where(eq(schema.players.id, share.playerId))
    .limit(1)

  return {
    kind: 'ok',
    token,
    share: {
      sessionId: share.sessionId,
      playerId: share.playerId,
      expiresAt: share.expiresAt instanceof Date ? share.expiresAt : new Date(share.expiresAt),
    },
    plan,
    outcome,
    player: player ?? null,
  }
}

/** `loadSharedPlan` and the session's report (null before it started). */
export async function loadSharedSession(token: string): Promise<SharedSessionLookup> {
  const shared = await loadSharedPlan(token)
  if (shared.kind !== 'ok') return shared
  const report = shared.outcome === 'not_started' ? null : await loadSessionReport(shared.plan)
  return { ...shared, report }
}
