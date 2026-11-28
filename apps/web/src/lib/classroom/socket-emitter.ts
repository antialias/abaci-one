/**
 * Socket Emission Helper for Enrollment Events
 *
 * Provides a type-safe, centralized way to emit enrollment-related socket events.
 * This ensures consistent event payloads and makes it easy to audit who gets notified.
 *
 * Channel Patterns:
 * - classroom:${classroomId} - Teacher's view: the teacher-only room (only the
 *   classroom's teacher may join it, `classroom-room-access.ts`, §10 P4d-9)
 * - user:${userId}           - Parent/user notifications
 * - player:${playerId}       - Student-specific notifications
 */

import type { SessionReport } from '@/lib/curriculum/session-report'
import { getSocketIO } from '@/lib/socket-io'
import type {
  ClassroomSessionSummaryEvent,
  EnrollmentApprovedEvent,
  EnrollmentRequestApprovedEvent,
  EnrollmentRequestCreatedEvent,
  EnrollmentRequestDeniedEvent,
  EntryPromptAcceptedEvent,
  EntryPromptCreatedEvent,
  EntryPromptDeclinedEvent,
  SessionEndedEvent,
  SessionReportEvent,
  SessionStartedEvent,
  StudentUnenrolledEvent,
} from './socket-events'

/**
 * Enrollment event payload - common fields for all enrollment events
 */
export interface EnrollmentEventPayload {
  requestId: string
  classroomId: string
  classroomName: string
  playerId: string
  playerName: string
}

/**
 * Recipients for socket events
 */
export interface SocketRecipients {
  /** Emit to the classroom channel (teacher's view) */
  classroomId?: string
  /** Emit to specific user channels (parents) */
  userIds?: string[]
  /** Emit to specific player channels */
  playerIds?: string[]
}

/**
 * Emit an enrollment request created event
 *
 * Use when: A new enrollment request is created (by teacher or parent)
 */
export async function emitEnrollmentRequestCreated(
  payload: EnrollmentEventPayload & { requestedByRole: 'teacher' | 'parent' },
  recipients: SocketRecipients
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: EnrollmentRequestCreatedEvent = {
    request: {
      id: payload.requestId,
      classroomId: payload.classroomId,
      classroomName: payload.classroomName,
      playerId: payload.playerId,
      playerName: payload.playerName,
      requestedByRole: payload.requestedByRole,
    },
  }

  emitToRecipients(io, 'enrollment-request-created', eventData, recipients, 'request-created')
}

/**
 * Emit an enrollment request approved event
 *
 * Use when: One side (teacher or parent) approves, but enrollment is not yet complete.
 * This notifies the other party that their approval is still pending.
 */
export async function emitEnrollmentRequestApproved(
  payload: EnrollmentEventPayload & { approvedBy: 'teacher' | 'parent' },
  recipients: SocketRecipients
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: EnrollmentRequestApprovedEvent = {
    requestId: payload.requestId,
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
    approvedBy: payload.approvedBy,
  }

  emitToRecipients(io, 'enrollment-request-approved', eventData, recipients, 'request-approved')
}

/**
 * Emit an enrollment request denied event
 *
 * Use when: Either side denies the enrollment request.
 */
export async function emitEnrollmentRequestDenied(
  payload: EnrollmentEventPayload & { deniedBy: 'teacher' | 'parent' },
  recipients: SocketRecipients
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: EnrollmentRequestDeniedEvent = {
    requestId: payload.requestId,
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
    deniedBy: payload.deniedBy,
  }

  emitToRecipients(io, 'enrollment-request-denied', eventData, recipients, 'request-denied')
}

/**
 * Emit an enrollment completed event
 *
 * Use when: Both sides have approved and the student is now enrolled.
 */
export async function emitEnrollmentCompleted(
  payload: Omit<EnrollmentEventPayload, 'requestId'>,
  recipients: SocketRecipients
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: EnrollmentApprovedEvent = {
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
  }

  emitToRecipients(io, 'enrollment-approved', eventData, recipients, 'enrollment-completed')
}

/**
 * Emit a student unenrolled event
 *
 * Use when: A student is removed from a classroom (by teacher or parent).
 * This also implies their presence was removed if they were in the classroom.
 */
export async function emitStudentUnenrolled(
  payload: Omit<EnrollmentEventPayload, 'requestId'> & {
    unenrolledBy: 'teacher' | 'parent'
  },
  recipients: SocketRecipients
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: StudentUnenrolledEvent = {
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
    unenrolledBy: payload.unenrolledBy,
  }

  emitToRecipients(io, 'student-unenrolled', eventData, recipients, 'student-unenrolled')
}

/**
 * Internal helper to emit to all specified recipients
 */
function emitToRecipients<T>(
  io: ReturnType<typeof getSocketIO> extends Promise<infer U> ? NonNullable<U> : never,
  eventName: string,
  eventData: T,
  recipients: SocketRecipients,
  logLabel: string
): void {
  const { classroomId, userIds, playerIds } = recipients

  try {
    // Emit to classroom channel
    if (classroomId) {
      io.to(`classroom:${classroomId}`).emit(eventName, eventData)
      console.log(`[SocketEmitter] ${logLabel} -> classroom:${classroomId}`)
    }

    // Emit to user channels
    if (userIds?.length) {
      for (const userId of userIds) {
        io.to(`user:${userId}`).emit(eventName, eventData)
        console.log(`[SocketEmitter] ${logLabel} -> user:${userId}`)
      }
    }

    // Emit to player channels
    if (playerIds?.length) {
      for (const playerId of playerIds) {
        io.to(`player:${playerId}`).emit(eventName, eventData)
        console.log(`[SocketEmitter] ${logLabel} -> player:${playerId}`)
      }
    }
  } catch (error) {
    console.error(`[SocketEmitter] Failed to emit ${logLabel}:`, error)
  }
}

// ============================================================================
// Session Events
// ============================================================================

/**
 * Session event payload
 */
export interface SessionEventPayload {
  sessionId: string
  playerId: string
  playerName: string
}

/**
 * Tell the teacher rooms a session started (Phase 4d, §10 P4d-8): from the
 * commit path, on the write that started it, for every classroom the student
 * is enrolled in, present or not (every start: the plan route's, the MCP
 * tools', the debug route's).
 */
export async function emitSessionStartedToClassrooms(
  payload: SessionEventPayload,
  classroomRooms: string[]
): Promise<void> {
  if (classroomRooms.length === 0) return
  const io = await getSocketIO()
  if (!io) return
  const eventData: SessionStartedEvent = {
    sessionId: payload.sessionId,
    playerId: payload.playerId,
    playerName: payload.playerName,
  }
  try {
    io.to(classroomRooms).emit('session-started', eventData)
    console.log(`[SocketEmitter] session-started -> ${classroomRooms.join(', ')}`)
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit session-started:', error)
  }
}

/**
 * Emit a session started event to the player channel
 *
 * Use when: A student starts a practice session.
 * This notifies parents who are subscribed to their child's player channel.
 */
export async function emitSessionStartedToPlayer(payload: SessionEventPayload): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: SessionStartedEvent = {
    sessionId: payload.sessionId,
    playerId: payload.playerId,
    playerName: payload.playerName,
  }

  try {
    io.to(`player:${payload.playerId}`).emit('session-started', eventData)
    console.log(`[SocketEmitter] session-started -> player:${payload.playerId}`)
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit session-started to player:', error)
  }
}

/**
 * The gated room that receives a session's reports (Phase 4a). Joined only
 * through `subscribe-session-report`, which checks the viewer's `observe`
 * access or a share token (`session-report-access.ts`); `session:<id>` is
 * gated with the same check since Phase 4c (`session-room-access.ts`).
 */
export function sessionReportRoom(sessionId: string): string {
  return `session-report:${sessionId}`
}

/**
 * Push a session's report to its gated room (session architecture §4, Phase 4a).
 *
 * Called only from the row-write commit path (`session-report-server.ts`),
 * after the write committed, in commit order per session.
 */
export async function emitSessionReport(report: SessionReport): Promise<void> {
  const io = await getSocketIO()
  if (!io) return
  const eventData: SessionReportEvent = { report }
  try {
    io.to(sessionReportRoom(report.sessionId)).emit('session-report', eventData)
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit session-report:', error)
  }
}

/** `session-song-status`: the session's song became pending, ready or failed (Phase 4e). */
export interface SessionSongStatusEvent {
  sessionId: string
  songId: string
  /** As the report states it (`SessionReportSong['status']`) */
  status: 'pending' | 'ready' | 'failed'
}

/**
 * Tell a session's report subscribers its song's status changed (Phase 4e,
 * §10 P4a-7). A song row is not a session row write, so no report is pushed
 * for it; subscribers refetch the report on this event. Called by the song
 * task wherever it writes `session_songs.status`.
 */
export async function emitSessionSongStatus(event: SessionSongStatusEvent): Promise<void> {
  const io = await getSocketIO()
  if (!io) return
  try {
    io.to(sessionReportRoom(event.sessionId)).emit('session-song-status', event)
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit session-song-status:', error)
  }
}

/**
 * Tell parents, the teachers, observers and report subscribers a session
 * ended (Phase 4a; the session room since 4c): the player's room, the teacher
 * rooms of every classroom the student is enrolled in (Phase 4d), the gated
 * report room and the live room `session:<id>`, in one emit (a socket in
 * several of them hears it once). Observers in the live room keep the final
 * report on screen and show the ended view (§10 P4a-4, P4c-1). Every end goes
 * through here from the commit path, natural completion included.
 */
export async function emitSessionEndedEverywhere(
  event: SessionEndedEvent,
  classroomRooms: string[]
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return
  const rooms = [
    `player:${event.playerId}`,
    sessionReportRoom(event.sessionId),
    `session:${event.sessionId}`,
    `session-stats:${event.sessionId}`,
  ]
  rooms.push(...classroomRooms)
  try {
    io.to(rooms).emit('session-ended', event)
    console.log(`[SocketEmitter] session-ended (${event.reason}) -> ${rooms.join(', ')}`)
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit session-ended:', error)
  }
}

// ============================================================================
// Entry Prompt Events
// ============================================================================

/** The numbers a teacher card needs, cut from the report (Phase 4d, §10 P4d-8). */
export function classroomSessionSummaryOf(report: SessionReport): ClassroomSessionSummaryEvent {
  // No position once the session is not in progress: done = the items attempted
  const progress = report.position?.progress ?? {
    done: report.totals.problems,
    total: report.totals.plannedProblems,
  }
  return {
    sessionId: report.sessionId,
    playerId: report.playerId,
    outcome: report.outcome,
    completedProblems: progress.done,
    totalProblems: progress.total,
    totals: report.totals,
    rowVersion: report.rowVersion,
  }
}

/**
 * Push a teacher card's numbers to the teacher rooms of every classroom the
 * student is enrolled in (Phase 4d, §10 P4d-8). From the commit path only.
 */
export async function emitClassroomSessionSummary(
  summary: ClassroomSessionSummaryEvent,
  classroomRooms: string[]
): Promise<void> {
  if (classroomRooms.length === 0) return
  const io = await getSocketIO()
  if (!io) return
  try {
    io.to(classroomRooms).emit('classroom-session-summary', summary)
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit classroom-session-summary:', error)
  }
}

/**
 * Entry prompt event payload
 */
export interface EntryPromptPayload {
  promptId: string
  classroomId: string
  classroomName: string
  playerId: string
  playerName: string
  playerEmoji: string
}

/**
 * Emit an entry prompt created event
 *
 * Use when: A teacher creates an entry prompt for a student.
 * This notifies all parents of the student to prompt them to enter the child.
 */
export async function emitEntryPromptCreated(
  payload: EntryPromptPayload & { teacherName: string; expiresAt: Date },
  parentIds: string[]
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: EntryPromptCreatedEvent = {
    promptId: payload.promptId,
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
    playerEmoji: payload.playerEmoji,
    teacherName: payload.teacherName,
    expiresAt: payload.expiresAt.toISOString(),
  }

  try {
    // Emit to each parent's user channel
    for (const parentId of parentIds) {
      io.to(`user:${parentId}`).emit('entry-prompt-created', eventData)
      console.log(`[SocketEmitter] entry-prompt-created -> user:${parentId}`)
    }
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit entry-prompt-created:', error)
  }
}

/**
 * Emit an entry prompt accepted event
 *
 * Use when: A parent accepts an entry prompt, entering their child into the classroom.
 * This notifies the teacher and updates the classroom presence view.
 */
export async function emitEntryPromptAccepted(
  payload: Omit<EntryPromptPayload, 'playerEmoji'> & { acceptedBy: string },
  teacherId: string
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: EntryPromptAcceptedEvent = {
    promptId: payload.promptId,
    classroomId: payload.classroomId,
    playerId: payload.playerId,
    playerName: payload.playerName,
    acceptedBy: payload.acceptedBy,
  }

  try {
    // Emit to teacher's user channel
    io.to(`user:${teacherId}`).emit('entry-prompt-accepted', eventData)
    console.log(`[SocketEmitter] entry-prompt-accepted -> user:${teacherId}`)

    // Also emit to classroom channel for real-time presence updates
    io.to(`classroom:${payload.classroomId}`).emit('entry-prompt-accepted', eventData)
    console.log(`[SocketEmitter] entry-prompt-accepted -> classroom:${payload.classroomId}`)
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit entry-prompt-accepted:', error)
  }
}

/**
 * Emit an entry prompt declined event
 *
 * Use when: A parent declines an entry prompt.
 * This only notifies the teacher (no need to update classroom).
 */
export async function emitEntryPromptDeclined(
  payload: Omit<EntryPromptPayload, 'playerEmoji' | 'classroomName'> & {
    declinedBy: string
  },
  teacherId: string
): Promise<void> {
  const io = await getSocketIO()
  if (!io) return

  const eventData: EntryPromptDeclinedEvent = {
    promptId: payload.promptId,
    classroomId: payload.classroomId,
    playerId: payload.playerId,
    playerName: payload.playerName,
    declinedBy: payload.declinedBy,
  }

  try {
    // Emit only to teacher's user channel
    io.to(`user:${teacherId}`).emit('entry-prompt-declined', eventData)
    console.log(`[SocketEmitter] entry-prompt-declined -> user:${teacherId}`)
  } catch (error) {
    console.error('[SocketEmitter] Failed to emit entry-prompt-declined:', error)
  }
}
