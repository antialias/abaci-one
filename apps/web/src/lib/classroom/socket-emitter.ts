/**
 * Socket Emission Helper for Enrollment Events
 *
 * Provides a type-safe, centralized way to emit enrollment-related socket events.
 * This ensures consistent event payloads and makes it easy to audit who gets notified.
 *
 * Channel Patterns:
 * - classroom:${classroomId} - Teacher's view
 * - user:${userId}           - Parent/user notifications
 * - player:${playerId}       - Student-specific notifications
 */

import { getSocketIO } from "@/lib/socket-io";
import type {
  EnrollmentApprovedEvent,
  EnrollmentRequestApprovedEvent,
  EnrollmentRequestCreatedEvent,
  EnrollmentRequestDeniedEvent,
  EntryPromptAcceptedEvent,
  EntryPromptCreatedEvent,
  EntryPromptDeclinedEvent,
  SessionEndedEvent,
  SessionStartedEvent,
  StudentUnenrolledEvent,
} from "./socket-events";

/**
 * Enrollment event payload - common fields for all enrollment events
 */
export interface EnrollmentEventPayload {
  requestId: string;
  classroomId: string;
  classroomName: string;
  playerId: string;
  playerName: string;
}

/**
 * Recipients for socket events
 */
export interface SocketRecipients {
  /** Emit to the classroom channel (teacher's view) */
  classroomId?: string;
  /** Emit to specific user channels (parents) */
  userIds?: string[];
  /** Emit to specific player channels */
  playerIds?: string[];
}

/**
 * Emit an enrollment request created event
 *
 * Use when: A new enrollment request is created (by teacher or parent)
 */
export async function emitEnrollmentRequestCreated(
  payload: EnrollmentEventPayload & { requestedByRole: "teacher" | "parent" },
  recipients: SocketRecipients,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: EnrollmentRequestCreatedEvent = {
    request: {
      id: payload.requestId,
      classroomId: payload.classroomId,
      classroomName: payload.classroomName,
      playerId: payload.playerId,
      playerName: payload.playerName,
      requestedByRole: payload.requestedByRole,
    },
  };

  emitToRecipients(
    io,
    "enrollment-request-created",
    eventData,
    recipients,
    "request-created",
  );
}

/**
 * Emit an enrollment request approved event
 *
 * Use when: One side (teacher or parent) approves, but enrollment is not yet complete.
 * This notifies the other party that their approval is still pending.
 */
export async function emitEnrollmentRequestApproved(
  payload: EnrollmentEventPayload & { approvedBy: "teacher" | "parent" },
  recipients: SocketRecipients,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: EnrollmentRequestApprovedEvent = {
    requestId: payload.requestId,
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
    approvedBy: payload.approvedBy,
  };

  emitToRecipients(
    io,
    "enrollment-request-approved",
    eventData,
    recipients,
    "request-approved",
  );
}

/**
 * Emit an enrollment request denied event
 *
 * Use when: Either side denies the enrollment request.
 */
export async function emitEnrollmentRequestDenied(
  payload: EnrollmentEventPayload & { deniedBy: "teacher" | "parent" },
  recipients: SocketRecipients,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: EnrollmentRequestDeniedEvent = {
    requestId: payload.requestId,
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
    deniedBy: payload.deniedBy,
  };

  emitToRecipients(
    io,
    "enrollment-request-denied",
    eventData,
    recipients,
    "request-denied",
  );
}

/**
 * Emit an enrollment completed event
 *
 * Use when: Both sides have approved and the student is now enrolled.
 */
export async function emitEnrollmentCompleted(
  payload: Omit<EnrollmentEventPayload, "requestId">,
  recipients: SocketRecipients,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: EnrollmentApprovedEvent = {
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
  };

  emitToRecipients(
    io,
    "enrollment-approved",
    eventData,
    recipients,
    "enrollment-completed",
  );
}

/**
 * Emit a student unenrolled event
 *
 * Use when: A student is removed from a classroom (by teacher or parent).
 * This also implies their presence was removed if they were in the classroom.
 */
export async function emitStudentUnenrolled(
  payload: Omit<EnrollmentEventPayload, "requestId"> & {
    unenrolledBy: "teacher" | "parent";
  },
  recipients: SocketRecipients,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: StudentUnenrolledEvent = {
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
    unenrolledBy: payload.unenrolledBy,
  };

  emitToRecipients(
    io,
    "student-unenrolled",
    eventData,
    recipients,
    "student-unenrolled",
  );
}

/**
 * Internal helper to emit to all specified recipients
 */
function emitToRecipients<T>(
  io: ReturnType<typeof getSocketIO> extends Promise<infer U>
    ? NonNullable<U>
    : never,
  eventName: string,
  eventData: T,
  recipients: SocketRecipients,
  logLabel: string,
): void {
  const { classroomId, userIds, playerIds } = recipients;

  try {
    // Emit to classroom channel
    if (classroomId) {
      io.to(`classroom:${classroomId}`).emit(eventName, eventData);
      console.log(`[SocketEmitter] ${logLabel} -> classroom:${classroomId}`);
    }

    // Emit to user channels
    if (userIds?.length) {
      for (const userId of userIds) {
        io.to(`user:${userId}`).emit(eventName, eventData);
        console.log(`[SocketEmitter] ${logLabel} -> user:${userId}`);
      }
    }

    // Emit to player channels
    if (playerIds?.length) {
      for (const playerId of playerIds) {
        io.to(`player:${playerId}`).emit(eventName, eventData);
        console.log(`[SocketEmitter] ${logLabel} -> player:${playerId}`);
      }
    }
  } catch (error) {
    console.error(`[SocketEmitter] Failed to emit ${logLabel}:`, error);
  }
}

// ============================================================================
// Session Events
// ============================================================================

/**
 * Session event payload
 */
export interface SessionEventPayload {
  sessionId: string;
  playerId: string;
  playerName: string;
}

/**
 * Emit a session started event
 *
 * Use when: A student starts a practice session while present in a classroom.
 * This notifies the teacher so they can see the session in their active sessions view.
 */
export async function emitSessionStarted(
  payload: SessionEventPayload,
  classroomId: string,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: SessionStartedEvent = {
    sessionId: payload.sessionId,
    playerId: payload.playerId,
    playerName: payload.playerName,
  };

  try {
    io.to(`classroom:${classroomId}`).emit("session-started", eventData);
    console.log(`[SocketEmitter] session-started -> classroom:${classroomId}`);
  } catch (error) {
    console.error("[SocketEmitter] Failed to emit session-started:", error);
  }
}

/**
 * Emit a session ended event
 *
 * Use when: A student's practice session ends (completed, ended early, or abandoned)
 * while they are present in a classroom.
 */
export async function emitSessionEnded(
  payload: SessionEventPayload & {
    reason: "completed" | "ended_early" | "abandoned";
  },
  classroomId: string,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: SessionEndedEvent = {
    sessionId: payload.sessionId,
    playerId: payload.playerId,
    playerName: payload.playerName,
    reason: payload.reason,
  };

  try {
    io.to(`classroom:${classroomId}`).emit("session-ended", eventData);
    console.log(
      `[SocketEmitter] session-ended (${payload.reason}) -> classroom:${classroomId}`,
    );
  } catch (error) {
    console.error("[SocketEmitter] Failed to emit session-ended:", error);
  }
}

/**
 * Emit a session started event to the player channel
 *
 * Use when: A student starts a practice session.
 * This notifies parents who are subscribed to their child's player channel.
 */
export async function emitSessionStartedToPlayer(
  payload: SessionEventPayload,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: SessionStartedEvent = {
    sessionId: payload.sessionId,
    playerId: payload.playerId,
    playerName: payload.playerName,
  };

  try {
    io.to(`player:${payload.playerId}`).emit("session-started", eventData);
    console.log(
      `[SocketEmitter] session-started -> player:${payload.playerId}`,
    );
  } catch (error) {
    console.error(
      "[SocketEmitter] Failed to emit session-started to player:",
      error,
    );
  }
}

/**
 * Emit a session ended event to the player channel
 *
 * Use when: A student's practice session ends.
 * This notifies parents who are subscribed to their child's player channel.
 */
export async function emitSessionEndedToPlayer(
  payload: SessionEventPayload & {
    reason: "completed" | "ended_early" | "abandoned";
  },
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: SessionEndedEvent = {
    sessionId: payload.sessionId,
    playerId: payload.playerId,
    playerName: payload.playerName,
    reason: payload.reason,
  };

  try {
    io.to(`player:${payload.playerId}`).emit("session-ended", eventData);
    console.log(
      `[SocketEmitter] session-ended (${payload.reason}) -> player:${payload.playerId}`,
    );
  } catch (error) {
    console.error(
      "[SocketEmitter] Failed to emit session-ended to player:",
      error,
    );
  }
}

// ============================================================================
// Entry Prompt Events
// ============================================================================

/**
 * Entry prompt event payload
 */
export interface EntryPromptPayload {
  promptId: string;
  classroomId: string;
  classroomName: string;
  playerId: string;
  playerName: string;
  playerEmoji: string;
}

/**
 * Emit an entry prompt created event
 *
 * Use when: A teacher creates an entry prompt for a student.
 * This notifies all parents of the student to prompt them to enter the child.
 */
export async function emitEntryPromptCreated(
  payload: EntryPromptPayload & { teacherName: string; expiresAt: Date },
  parentIds: string[],
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: EntryPromptCreatedEvent = {
    promptId: payload.promptId,
    classroomId: payload.classroomId,
    classroomName: payload.classroomName,
    playerId: payload.playerId,
    playerName: payload.playerName,
    playerEmoji: payload.playerEmoji,
    teacherName: payload.teacherName,
    expiresAt: payload.expiresAt.toISOString(),
  };

  try {
    // Emit to each parent's user channel
    for (const parentId of parentIds) {
      io.to(`user:${parentId}`).emit("entry-prompt-created", eventData);
      console.log(`[SocketEmitter] entry-prompt-created -> user:${parentId}`);
    }
  } catch (error) {
    console.error(
      "[SocketEmitter] Failed to emit entry-prompt-created:",
      error,
    );
  }
}

/**
 * Emit an entry prompt accepted event
 *
 * Use when: A parent accepts an entry prompt, entering their child into the classroom.
 * This notifies the teacher and updates the classroom presence view.
 */
export async function emitEntryPromptAccepted(
  payload: Omit<EntryPromptPayload, "playerEmoji"> & { acceptedBy: string },
  teacherId: string,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: EntryPromptAcceptedEvent = {
    promptId: payload.promptId,
    classroomId: payload.classroomId,
    playerId: payload.playerId,
    playerName: payload.playerName,
    acceptedBy: payload.acceptedBy,
  };

  try {
    // Emit to teacher's user channel
    io.to(`user:${teacherId}`).emit("entry-prompt-accepted", eventData);
    console.log(`[SocketEmitter] entry-prompt-accepted -> user:${teacherId}`);

    // Also emit to classroom channel for real-time presence updates
    io.to(`classroom:${payload.classroomId}`).emit(
      "entry-prompt-accepted",
      eventData,
    );
    console.log(
      `[SocketEmitter] entry-prompt-accepted -> classroom:${payload.classroomId}`,
    );
  } catch (error) {
    console.error(
      "[SocketEmitter] Failed to emit entry-prompt-accepted:",
      error,
    );
  }
}

/**
 * Emit an entry prompt declined event
 *
 * Use when: A parent declines an entry prompt.
 * This only notifies the teacher (no need to update classroom).
 */
export async function emitEntryPromptDeclined(
  payload: Omit<EntryPromptPayload, "playerEmoji" | "classroomName"> & {
    declinedBy: string;
  },
  teacherId: string,
): Promise<void> {
  const io = await getSocketIO();
  if (!io) return;

  const eventData: EntryPromptDeclinedEvent = {
    promptId: payload.promptId,
    classroomId: payload.classroomId,
    playerId: payload.playerId,
    playerName: payload.playerName,
    declinedBy: payload.declinedBy,
  };

  try {
    // Emit only to teacher's user channel
    io.to(`user:${teacherId}`).emit("entry-prompt-declined", eventData);
    console.log(`[SocketEmitter] entry-prompt-declined -> user:${teacherId}`);
  } catch (error) {
    console.error(
      "[SocketEmitter] Failed to emit entry-prompt-declined:",
      error,
    );
  }
}
