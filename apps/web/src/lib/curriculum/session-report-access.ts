/**
 * Who may receive a session's pushed reports (session architecture §4, Phase
 * 4a, §10 P4a-9).
 *
 * `session-report` goes only to the gated room `session-report:<id>`, joined
 * through the `subscribe-session-report` socket event, which is checked as
 * `observe-session` checks today:
 * - a share holder: `validateSessionShare(token, { allowEnded: true })` for a
 *   share of this session (an expired-by-completion share only once the
 *   session has ended, as the token report route);
 * - a signed-in viewer: `canPerformAction(viewerId, playerId, 'observe')`, and
 *   the session must be that player's.
 * Like `observe-session`, the viewer id is the one the client sends (sockets
 * carry no server-verified identity yet; §10 P4a-9).
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { isEndedOutcome, sessionOutcome } from '@/db/schema/session-plan-normalize'
import type { SubscribeSessionReportRequest } from '@/lib/classroom/socket-events'

export type SessionReportJoinDecision = { ok: true } | { ok: false; error: string }

export async function authorizeSessionReportJoin(
  request: SubscribeSessionReportRequest
): Promise<SessionReportJoinDecision> {
  const { sessionId, viewerId, playerId, shareToken } = request ?? ({} as never)
  if (typeof sessionId !== 'string' || !sessionId) return { ok: false, error: 'Session required' }

  const plan = await db.query.sessionPlans.findFirst({
    where: eq(schema.sessionPlans.id, sessionId),
  })
  const outcome = plan ? sessionOutcome(plan) : null
  if (!plan || outcome === 'deleted' || outcome === 'sentinel') {
    return { ok: false, error: 'Session not found' }
  }

  if (typeof shareToken === 'string' && shareToken) {
    const { validateSessionShare } = await import('@/lib/session-share')
    const validation = await validateSessionShare(shareToken, { allowEnded: true })
    if (!validation.valid || validation.share?.sessionId !== sessionId) {
      return { ok: false, error: validation.error || 'Invalid share link' }
    }
    if (validation.requiresEndedSession && !isEndedOutcome(outcome!)) {
      return { ok: false, error: 'Share link is no longer active' }
    }
    return { ok: true }
  }

  if (typeof viewerId !== 'string' || !viewerId || typeof playerId !== 'string' || !playerId) {
    return { ok: false, error: 'Viewer and player required' }
  }
  if (plan.playerId !== playerId) return { ok: false, error: 'Session not found' }
  const { canPerformAction } = await import('@/lib/classroom')
  if (!(await canPerformAction(viewerId, playerId, 'observe'))) {
    return { ok: false, error: 'Not authorized to observe this session' }
  }
  return { ok: true }
}

/** The socket surface the join handlers need (a socket.io `Socket`). */
export interface SessionReportSocket {
  on(event: string, handler: (data: any) => void): unknown
  join(room: string): unknown
  leave(room: string): unknown
  emit(event: string, data: unknown): unknown
}

/** Register `subscribe-session-report` / `unsubscribe-session-report` on a connected socket. */
export function registerSessionReportJoin(socket: SessionReportSocket): void {
  socket.on('subscribe-session-report', async (request: SubscribeSessionReportRequest) => {
    const sessionId = String(request?.sessionId ?? '')
    try {
      const decision = await authorizeSessionReportJoin(request)
      if (!decision.ok) {
        socket.emit('session-report-error', { sessionId, error: decision.error })
        return
      }
      const { sessionReportRoom } = await import('@/lib/classroom/socket-emitter')
      await socket.join(sessionReportRoom(sessionId))
      socket.emit('session-report-subscribed', { sessionId })
    } catch (error) {
      console.error('[session-report] subscribe failed', error)
      socket.emit('session-report-error', { sessionId, error: 'Failed to subscribe' })
    }
  })
  socket.on('unsubscribe-session-report', async ({ sessionId }: { sessionId: string }) => {
    const { sessionReportRoom } = await import('@/lib/classroom/socket-emitter')
    await socket.leave(sessionReportRoom(String(sessionId ?? '')))
  })
}
