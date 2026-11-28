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
 * - a viewer (signed in or a guest): `canPerformAction(viewerId, playerId,
 *   'observe')`, and the session must be that player's.
 * The viewer id is the socket's verified one (`socket.data.viewer`, set at the
 * handshake by `resolveSocketViewer`); an id in the payload is ignored, so
 * naming someone else's id grants nothing.
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { isEndedOutcome, sessionOutcome } from '@/db/schema/session-plan-normalize'
import type { SubscribeSessionReportRequest } from '@/lib/classroom/socket-events'
import { type SocketViewerData, socketViewerId } from '@/lib/socket-viewer'

export type SessionReportJoinDecision = { ok: true } | { ok: false; error: string }

/**
 * A join's check: the session, the share token or player it names, and the
 * socket's verified viewer id (never one from the payload).
 */
export interface SessionJoinCheck {
  sessionId: string
  playerId?: string
  shareToken?: string
  /** The socket's verified viewer (`socketViewerId`), or null/absent when anonymous */
  viewerId?: string | null
}

/**
 * The check for a join request: the payload's session, player and share
 * token, and the socket's verified viewer. A payload's `viewerId` (older
 * clients still send one) is dropped.
 */
export function joinCheckOf(
  request: SubscribeSessionReportRequest | undefined,
  socket: { data: SocketViewerData }
): SessionJoinCheck {
  const { sessionId, playerId, shareToken } = request ?? ({} as SubscribeSessionReportRequest)
  return { sessionId, playerId, shareToken, viewerId: socketViewerId(socket) }
}

/**
 * `action` is the access level a viewer needs (default `observe`,
 * the report room's and the live room's; the history list's stats feed asks
 * `view`, Phase 4c). A share holder is checked the same way at every level.
 */
export async function authorizeSessionReportJoin(
  request: SessionJoinCheck,
  action: 'observe' | 'view' = 'observe'
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
  if (!(await canPerformAction(viewerId, playerId, action))) {
    return { ok: false, error: `Not authorized to ${action} this session` }
  }
  return { ok: true }
}

/** The socket surface the join handlers need (a socket.io `Socket`). */
export interface SessionReportSocket {
  on(event: string, handler: (data: any) => void): unknown
  join(room: string): unknown
  leave(room: string): unknown
  emit(event: string, data: unknown): unknown
  /** `viewer`: the handshake's verified viewer */
  data: SocketViewerData
}

/** Register `subscribe-session-report` / `unsubscribe-session-report` on a connected socket. */
export function registerSessionReportJoin(socket: SessionReportSocket): void {
  socket.on('subscribe-session-report', async (request: SubscribeSessionReportRequest) => {
    const sessionId = String(request?.sessionId ?? '')
    try {
      const decision = await authorizeSessionReportJoin(joinCheckOf(request, socket))
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
