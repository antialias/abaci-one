/**
 * Who may join a session's live room `session:<id>` (session architecture
 * Phase 4c, §10 P4a-9 / P4c-*).
 *
 * That room carries the kid's `practice-state` (answers, timings, the whole
 * `slotResults` list), `vision-frame` (camera frames) and the observers'
 * controls, so every join is checked exactly as the gated report room is
 * (`authorizeSessionReportJoin` in `lib/curriculum/session-report-access.ts`):
 * - a share holder: a share of this session (`validateSessionShare` with
 *   `allowEnded`, an expired-by-completion share only once the session ended);
 * - a signed-in viewer: `canPerformAction(viewerId, playerId, 'observe')`, the
 *   session being that player's. A join that names no player (the history
 *   list's stats subscriber knows only the session) is checked against the
 *   session's own player, which is the same check.
 *
 * Joins of `session:<id>` (level `observe`): `join-session` (the kid's own
 * screen) and `observe-session` (observers; its handler in `socket-server.ts`
 * calls `authorizeSessionRoomJoin`). The history list's live estimate
 * (`subscribe-session-stats`) joins a separate feed, `session-stats:<id>`, at
 * level `view` (what the dashboard needs): it hears `session-stats` (the
 * kid's parts and tries) and `session-ended`, never `practice-state`. The
 * viewer is the socket's verified one (`socket.data.viewer`, from the
 * handshake's cookies); an id in the payload (`viewerId`, `observerId`) is
 * ignored, so naming someone else's id grants nothing.
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import type {
  SessionStatsEvent,
  SubscribeSessionReportRequest,
} from '@/lib/classroom/socket-events'
import {
  authorizeSessionReportJoin,
  joinCheckOf,
  type SessionJoinCheck,
  type SessionReportJoinDecision,
  type SessionReportSocket,
} from '@/lib/curriculum/session-report-access'
import { type SocketViewerData, socketViewerId } from '@/lib/socket-viewer'

/** The live room of a session (the kid's broadcasts, observers' controls). */
export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`
}

/** The stats feed of a session (`view` level): `session-stats` and `session-ended`. */
export function sessionStatsRoom(sessionId: string): string {
  return `session-stats:${sessionId}`
}

/** The access level each room needs of a signed-in viewer. */
export type SessionRoomLevel = 'observe' | 'view'

/** What a join of `session:<id>` sends; `playerId` may be omitted. */
export type SessionRoomJoinRequest = SubscribeSessionReportRequest

/**
 * A live-room join's decision: an admitted viewer's join also names the
 * session's own player (a share holder's does not).
 */
export type SessionRoomJoinDecision =
  | { ok: true; playerId?: string }
  | Exclude<SessionReportJoinDecision, { ok: true }>

/** `request.viewerId` is the socket's verified viewer (`joinCheckOf`), never the payload's. */
export async function authorizeSessionRoomJoin(
  request: SessionJoinCheck,
  level: SessionRoomLevel = 'observe'
): Promise<SessionRoomJoinDecision> {
  const { sessionId, viewerId, playerId, shareToken } = request ?? ({} as never)
  if (typeof sessionId !== 'string' || !sessionId) return { ok: false, error: 'Session required' }
  if (typeof shareToken === 'string' && shareToken) {
    return authorizeSessionReportJoin({ sessionId, shareToken }, level)
  }
  if (typeof viewerId !== 'string' || !viewerId) {
    return { ok: false, error: 'Viewer and player required' }
  }
  let player = typeof playerId === 'string' && playerId ? playerId : undefined
  if (!player) {
    const [plan] = await db
      .select({ playerId: schema.sessionPlans.playerId })
      .from(schema.sessionPlans)
      .where(eq(schema.sessionPlans.id, sessionId))
      .limit(1)
    if (!plan) return { ok: false, error: 'Session not found' }
    player = plan.playerId
  }
  // Admitted only when `player` is the session's own (authorizeSessionReportJoin)
  const decision = await authorizeSessionReportJoin(
    { sessionId, viewerId, playerId: player },
    level
  )
  return decision.ok ? { ok: true, playerId: player } : decision
}

// ---------------------------------------------------------------------------
// Admissions: joins in flight, and the player of each admitted session
// ---------------------------------------------------------------------------

/**
 * `socket.data`'s record of its live-room admissions: the joins of
 * `session:<id>` still being checked, the session's own player for each
 * viewer admission (`join-session`, or an observer's `observe-session`), and
 * the sessions it was admitted to as the kid's screen (`join-session`).
 */
export interface SessionAdmissionsData {
  pendingSessionJoins?: Map<string, Promise<void>>
  sessionPlayers?: Map<string, string>
  kidScreenSessions?: Set<string>
}

/**
 * Run a live-room join, recorded as in flight until it settles: what the
 * socket sends meanwhile is checked once the join is decided
 * (`isKidScreenOnceAdmitted`, `isMemberOnceAdmitted`), not dropped because the check was still running.
 */
function trackJoin(
  socket: { data: SessionAdmissionsData },
  sessionId: string,
  run: () => Promise<void>
): Promise<void> {
  if (!socket.data.pendingSessionJoins) socket.data.pendingSessionJoins = new Map()
  const pending = socket.data.pendingSessionJoins
  const join: Promise<void> = run().finally(() => {
    if (pending.get(sessionId) === join) pending.delete(sessionId)
  })
  pending.set(sessionId, join)
  return join
}

/** Record the session's own player for an admitted viewer. */
function recordSessionPlayer(
  socket: { data: SessionAdmissionsData },
  sessionId: string,
  playerId: string | undefined
): void {
  if (!playerId) return
  if (!socket.data.sessionPlayers) socket.data.sessionPlayers = new Map()
  socket.data.sessionPlayers.set(sessionId, playerId)
}

/**
 * The session's own player, as the socket's admission found it (null for a
 * share holder or a socket never admitted). The vision recorder files under
 * this player, never under one a payload names.
 */
export function sessionPlayerOf(
  socket: { data: SessionAdmissionsData },
  sessionId: string
): string | null {
  return socket.data.sessionPlayers?.get(sessionId) ?? null
}

/** Wait for a join of `session:<id>` this socket has in flight, if any. */
async function admissionSettled(
  socket: { data: SessionAdmissionsData },
  sessionId: string
): Promise<void> {
  await socket.data.pendingSessionJoins?.get(sessionId)
}

/**
 * Register the checked joins that need nothing beyond the check:
 * `join-session` (`session:<id>`, `observe`) and `subscribe-session-stats`
 * (`session-stats:<id>`, `view`), and the stats leave. A refused join answers
 * `session-room-error { sessionId, error }` and joins nothing, so the socket
 * hears none of the room's traffic.
 */
export function registerSessionRoomJoins(
  socket: SessionReportSocket & { data: SessionAdmissionsData }
): void {
  const join = async (
    request: SessionRoomJoinRequest,
    label: string,
    room: (sessionId: string) => string,
    level: SessionRoomLevel,
    ack?: string
  ) => {
    const sessionId = String(request?.sessionId ?? '')
    try {
      // The kid's screen joins with its viewer credential only: a share
      // holder enters the live room through `observe-session`, which records
      // it as view-only for that session
      const decision =
        label === 'join-session' && request?.shareToken
          ? ({ ok: false, error: 'Share links observe through observe-session' } as const)
          : await authorizeSessionRoomJoin(joinCheckOf(request, socket), level)
      if (!decision.ok) {
        console.log(`⚠️ ${label} refused for session ${sessionId}: ${decision.error}`)
        socket.emit('session-room-error', { sessionId, error: decision.error })
        return
      }
      await socket.join(room(sessionId))
      if (label === 'join-session') {
        recordSessionPlayer(socket, sessionId, decision.playerId)
        if (!socket.data.kidScreenSessions) socket.data.kidScreenSessions = new Set()
        socket.data.kidScreenSessions.add(sessionId)
      }
      if (ack) socket.emit(ack, { sessionId })
    } catch (error) {
      console.error(`[session-room] ${label} failed`, error)
      socket.emit('session-room-error', { sessionId, error: 'Failed to join session' })
    }
  }
  const leave = async ({ sessionId }: { sessionId: string }) => {
    await socket.leave(sessionStatsRoom(String(sessionId ?? '')))
  }

  // The kid's own session screen (receives observer-joined, controls,
  // pauses); acked with `session-room-joined` so it can rebroadcast its state
  // once its broadcasts are relayed
  socket.on('join-session', (request: SessionRoomJoinRequest) =>
    trackJoin(socket, String(request?.sessionId ?? ''), () =>
      join(request, 'join-session', sessionRoom, 'observe', 'session-room-joined')
    )
  )
  // The history list's live time estimate (receives session-stats)
  socket.on('subscribe-session-stats', (request: SessionRoomJoinRequest) =>
    join(request, 'subscribe-session-stats', sessionStatsRoom, 'view')
  )
  socket.on('unsubscribe-session-stats', leave)
}

/** The stats feed's slice of a `practice-state` broadcast (no live answer). */
export function sessionStatsOf(data: {
  sessionId: string
  sessionParts?: unknown[]
  slotResults?: unknown[]
}): SessionStatsEvent {
  return {
    sessionId: data.sessionId,
    sessionParts: data.sessionParts,
    slotResults: data.slotResults,
  }
}

/**
 * The socket surface a control relay needs: the rooms it joined (a socket.io
 * `Socket`'s `rooms`).
 */
export interface SessionRoomMember {
  rooms: { has(room: string): boolean }
}

/**
 * Whether a socket may send a control (pause, abacus, tutorial) to a
 * session: it must have been admitted to the live room (`session:<id>`) by
 * the gate above. A refused socket's controls are dropped.
 */
export function isSessionRoomMember(socket: SessionRoomMember, sessionId: string): boolean {
  return typeof sessionId === 'string' && !!sessionId && socket.rooms.has(sessionRoom(sessionId))
}

/** The socket surface the control relays need. */
export interface SessionControlSocket extends SessionRoomMember {
  on(event: string, handler: (data: any) => void): unknown
  data: SharedSessionsData & SocketViewerData & SessionAdmissionsData
}

/** The server surface the control relays emit through (a socket.io `Server`). */
export interface SessionControlServer {
  to(room: string): { emit(event: string, data: unknown): unknown }
}

/**
 * Relay observers' controls to the kid's client: `tutorial-control`,
 * `abacus-control`, `session-pause` (→ `session-paused`) and
 * `session-resume` (→ `session-resumed`). A control is dropped unless
 * `mayActInSession`.
 */
export function registerSessionControls(
  socket: SessionControlSocket,
  io: SessionControlServer
): void {
  const relay = (event: string, emitted: string) => {
    socket.on(event, (data: { sessionId: string }) => {
      const sessionId = String(data?.sessionId ?? '')
      if (!mayActInSession(socket, sessionId)) {
        console.log(
          `[Socket] ${event} rejected for session ${sessionId}: not admitted, or view-only`
        )
        return
      }
      io.to(sessionRoom(sessionId)).emit(emitted, data)
    })
  }
  relay('tutorial-control', 'tutorial-control')
  relay('abacus-control', 'abacus-control')
  relay('session-pause', 'session-paused')
  relay('session-resume', 'session-resumed')
}

// ---------------------------------------------------------------------------
// Share holders: view-only, per session
// ---------------------------------------------------------------------------

/** `socket.data`'s record of the sessions this socket was admitted to by a share link. */
export interface SharedSessionsData {
  sharedSessions?: Set<string>
}

/** Record that the socket was admitted to `session:<id>` by a share link (view-only there). */
export function markSharedSession(socket: { data: SharedSessionsData }, sessionId: string): void {
  if (!socket.data.sharedSessions) socket.data.sharedSessions = new Set()
  socket.data.sharedSessions.add(sessionId)
}

/** Whether the socket holds `session:<id>` by a share link (view-only there). */
export function isSharedSession(socket: { data: SharedSessionsData }, sessionId: string): boolean {
  return socket.data.sharedSessions?.has(sessionId) ?? false
}

/**
 * Whether a socket may act in a session's live room (send controls, relay
 * the kid's state): admitted to `session:<id>` and not by a share link for
 * that session.
 */
export function mayActInSession(socket: SessionControlSocket, sessionId: string): boolean {
  return isSessionRoomMember(socket, sessionId) && !isSharedSession(socket, sessionId)
}

/**
 * Whether a socket is the kid's own screen for a session: admitted to
 * `session:<id>` by `join-session` (not by `observe-session`, not by a share
 * link). Only it may send the kid's broadcasts (`practice-state`,
 * `SESSION_BROADCASTS`, the vision events): an observer, a parent or teacher
 * on a second device included, may send controls but never the kid's state.
 */
export function isKidScreen(socket: SessionControlSocket, sessionId: string): boolean {
  return (
    mayActInSession(socket, sessionId) && (socket.data.kidScreenSessions?.has(sessionId) ?? false)
  )
}

/**
 * `isKidScreen`, decided after a join of that session the socket has in
 * flight: the kid's screen sends its first broadcasts right after
 * `join-session`, while the join is still being checked.
 */
export async function isKidScreenOnceAdmitted(
  socket: SessionControlSocket,
  sessionId: string
): Promise<boolean> {
  await admissionSettled(socket, sessionId)
  return isKidScreen(socket, sessionId)
}

/**
 * `isSessionRoomMember` (a share holder too), decided after a join in
 * flight: an observer's co-play readiness and DVR requests.
 */
export async function isMemberOnceAdmitted(
  socket: SessionControlSocket,
  sessionId: string
): Promise<boolean> {
  await admissionSettled(socket, sessionId)
  return isSessionRoomMember(socket, sessionId)
}

/**
 * An observer join (`observe-session`): the session and its player, or a
 * share token. `observerId` is what older clients send; it is ignored.
 */
export interface ObserveSessionRequest {
  sessionId: string
  /** Ignored: the observer is the socket's verified viewer */
  observerId?: string
  playerId?: string
  shareToken?: string
}

/** The socket surface `observe-session` needs. */
export interface ObserveSessionSocket extends SessionReportSocket {
  data: SharedSessionsData & SocketViewerData & SessionAdmissionsData
}

/** An admitted observer join: `observerId` is the verified viewer (null for a share holder). */
export interface AdmittedObserver {
  sessionId: string
  observerId: string | null
  shareToken?: string
  shared: boolean
}

/**
 * Register `observe-session`: the same check as every live-room join; a
 * share holder is recorded view-only for that session (`markSharedSession`)
 * before it joins. A refusal answers `observe-error`. `onAdmitted` runs after
 * the join (the socket server sends DVR info and tells the room).
 */
export function registerObserveSession(
  socket: ObserveSessionSocket,
  onAdmitted: (observer: AdmittedObserver) => Promise<void> | void
): void {
  socket.on('observe-session', (request: ObserveSessionRequest) =>
    trackJoin(socket, String(request?.sessionId ?? ''), () => observe(request))
  )
  const observe = async (request: ObserveSessionRequest) => {
    const { sessionId, playerId, shareToken } = request ?? ({} as never)
    const observerId = socketViewerId(socket)
    try {
      const decision = await authorizeSessionRoomJoin({
        sessionId,
        viewerId: observerId,
        playerId,
        shareToken,
      })
      if (!decision.ok) {
        console.log(`⚠️ Observation denied for session ${sessionId}: ${decision.error}`)
        socket.emit('observe-error', { error: decision.error })
        return
      }
      const shared = typeof shareToken === 'string' && !!shareToken
      if (shared) markSharedSession(socket, sessionId)
      await socket.join(sessionRoom(sessionId))
      if (!shared) recordSessionPlayer(socket, sessionId, decision.playerId)
      await onAdmitted({ sessionId, observerId, shareToken, shared })
    } catch (error) {
      console.error('Error starting session observation:', error)
      socket.emit('observe-error', { error: 'Failed to start observation' })
    }
  }
}

/** A `practice-state` broadcast as the relay needs it. */
export interface PracticeStateRelayData {
  sessionId: string
  sessionParts?: unknown[]
  slotResults?: unknown[]
  [key: string]: unknown
}

/** The socket surface the `practice-state` relay needs (`to` excludes the sender). */
export interface PracticeStateRelaySocket extends SessionControlSocket {
  to(room: string): { emit(event: string, data: unknown): unknown }
}

/**
 * Relay the kid's `practice-state`: to `session:<id>` as is, and its parts
 * and tries to the stats feed `session-stats:<id>` as `session-stats` (no
 * live answer). Only from a socket that may act in the session (the kid's
 * screen, admitted by `join-session`); anyone else's state is dropped.
 * `onState` sees each relayed state (the socket server's DVR metadata).
 */
export function registerPracticeStateRelay(
  socket: PracticeStateRelaySocket,
  onState?: (data: PracticeStateRelayData) => void
): void {
  socket.on('practice-state', (data: PracticeStateRelayData) => {
    const sessionId = String(data?.sessionId ?? '')
    if (!isKidScreen(socket, sessionId)) {
      console.log(
        `[Socket] practice-state dropped for session ${sessionId}: not the kid's admitted screen`
      )
      return
    }
    onState?.(data)
    socket.to(sessionRoom(sessionId)).emit('practice-state', data)
    socket.to(sessionStatsRoom(sessionId)).emit('session-stats', sessionStatsOf(data))
  })
}

/** The kid's session broadcasts besides `practice-state`, relayed as they are. */
export const SESSION_BROADCASTS = [
  'part-transition',
  'part-transition-complete',
  'session-flow-state',
  'tutorial-state',
] as const

/**
 * Relay the kid's other broadcasts (`SESSION_BROADCASTS`) to `session:<id>`,
 * the sender excluded. Only from the kid's screen (`isKidScreenOnceAdmitted`:
 * once `join-session` admitted it); anyone else's is dropped, an admitted
 * observer's included, so no one but the kid's screen drives what observers
 * see.
 */
export function registerSessionBroadcasts(socket: PracticeStateRelaySocket): void {
  for (const event of SESSION_BROADCASTS) {
    socket.on(event, async (data: { sessionId: string }) => {
      const sessionId = String(data?.sessionId ?? '')
      if (!(await isKidScreenOnceAdmitted(socket, sessionId))) {
        console.log(
          `[Socket] ${event} dropped for session ${sessionId}: not the kid's admitted screen`
        )
        return
      }
      socket.to(sessionRoom(sessionId)).emit(event, data)
    })
  }
}
