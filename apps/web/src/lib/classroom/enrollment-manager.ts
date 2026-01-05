/**
 * Enrollment Manager Module
 *
 * Manages classroom enrollment with consent workflow:
 * - Create enrollment requests (by parent or teacher)
 * - Approve/deny requests
 * - Automatic enrollment on full approval
 * - Unenroll students
 */

import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  classroomEnrollments,
  classroomPresence,
  classrooms,
  enrollmentRequests,
  isFullyApproved,
  isDenied,
  parentChild,
  type EnrollmentRequest,
  type EnrollmentRequestRole,
  type Classroom,
  type Player,
} from "@/db/schema";

// ============================================================================
// Create Enrollment Request
// ============================================================================

export interface CreateEnrollmentRequestParams {
  classroomId: string;
  playerId: string;
  requestedBy: string;
  requestedByRole: EnrollmentRequestRole;
}

/**
 * Create an enrollment request
 *
 * If a request already exists for this classroom/player pair, it will be
 * reset to pending status with new requester info.
 */
export async function createEnrollmentRequest(
  params: CreateEnrollmentRequestParams,
): Promise<EnrollmentRequest> {
  const { classroomId, playerId, requestedBy, requestedByRole } = params;

  // Check for existing request
  const existing = await db.query.enrollmentRequests.findFirst({
    where: and(
      eq(enrollmentRequests.classroomId, classroomId),
      eq(enrollmentRequests.playerId, playerId),
    ),
  });

  // Auto-approve the requester's side (they implicitly approve by creating the request)
  const teacherApproval = requestedByRole === "teacher" ? "approved" : null;
  const teacherApprovedAt = requestedByRole === "teacher" ? new Date() : null;
  const parentApproval = requestedByRole === "parent" ? "approved" : null;
  const parentApprovedBy = requestedByRole === "parent" ? requestedBy : null;
  const parentApprovedAt = requestedByRole === "parent" ? new Date() : null;

  if (existing) {
    // Upsert: reset with auto-approval for requester's side
    const [updated] = await db
      .update(enrollmentRequests)
      .set({
        status: "pending",
        requestedBy,
        requestedByRole,
        requestedAt: new Date(),
        teacherApproval,
        teacherApprovedAt,
        parentApproval,
        parentApprovedBy,
        parentApprovedAt,
        resolvedAt: null,
      })
      .where(eq(enrollmentRequests.id, existing.id))
      .returning();
    return updated;
  }

  // Create new request with auto-approval for requester's side
  const [request] = await db
    .insert(enrollmentRequests)
    .values({
      id: createId(),
      classroomId,
      playerId,
      requestedBy,
      requestedByRole,
      teacherApproval,
      teacherApprovedAt,
      parentApproval,
      parentApprovedBy,
      parentApprovedAt,
    })
    .returning();

  return request;
}

// ============================================================================
// Approve/Deny Requests
// ============================================================================

export interface ApprovalResult {
  request: EnrollmentRequest;
  fullyApproved: boolean;
}

/**
 * Approve an enrollment request (by teacher or parent)
 *
 * If this approval completes the consent workflow, the actual
 * enrollment is automatically created.
 */
export async function approveEnrollmentRequest(
  requestId: string,
  approverId: string,
  approverRole: "teacher" | "parent",
): Promise<ApprovalResult> {
  const request = await db.query.enrollmentRequests.findFirst({
    where: eq(enrollmentRequests.id, requestId),
  });

  if (!request || request.status !== "pending") {
    throw new Error("Request not found or not pending");
  }

  // Update appropriate approval field
  const updates: Partial<EnrollmentRequest> = {};

  if (approverRole === "teacher") {
    updates.teacherApproval = "approved";
    updates.teacherApprovedAt = new Date();
  } else {
    updates.parentApproval = "approved";
    updates.parentApprovedBy = approverId;
    updates.parentApprovedAt = new Date();
  }

  const [updated] = await db
    .update(enrollmentRequests)
    .set(updates)
    .where(eq(enrollmentRequests.id, requestId))
    .returning();

  // Check if fully approved
  const fullyApproved = isFullyApproved(updated);

  if (fullyApproved) {
    // Create actual enrollment
    await db.insert(classroomEnrollments).values({
      id: createId(),
      classroomId: request.classroomId,
      playerId: request.playerId,
    });

    // Update request status
    await db
      .update(enrollmentRequests)
      .set({ status: "approved", resolvedAt: new Date() })
      .where(eq(enrollmentRequests.id, requestId));
  }

  return { request: updated, fullyApproved };
}

/**
 * Deny an enrollment request
 */
export async function denyEnrollmentRequest(
  requestId: string,
  denierId: string,
  denierRole: "teacher" | "parent",
): Promise<EnrollmentRequest> {
  const request = await db.query.enrollmentRequests.findFirst({
    where: eq(enrollmentRequests.id, requestId),
  });

  if (!request || request.status !== "pending") {
    throw new Error("Request not found or not pending");
  }

  const updates: Partial<EnrollmentRequest> = {
    status: "denied",
    resolvedAt: new Date(),
  };

  if (denierRole === "teacher") {
    updates.teacherApproval = "denied";
    updates.teacherApprovedAt = new Date();
  } else {
    updates.parentApproval = "denied";
    updates.parentApprovedBy = denierId;
    updates.parentApprovedAt = new Date();
  }

  const [updated] = await db
    .update(enrollmentRequests)
    .set(updates)
    .where(eq(enrollmentRequests.id, requestId))
    .returning();

  return updated;
}

/**
 * Cancel an enrollment request
 */
export async function cancelEnrollmentRequest(
  requestId: string,
): Promise<EnrollmentRequest> {
  const [updated] = await db
    .update(enrollmentRequests)
    .set({ status: "cancelled", resolvedAt: new Date() })
    .where(eq(enrollmentRequests.id, requestId))
    .returning();

  return updated;
}

// ============================================================================
// Query Pending Requests
// ============================================================================

export interface EnrollmentRequestWithRelations extends EnrollmentRequest {
  player?: Player;
  classroom?: Classroom;
}

/**
 * Get pending requests for a teacher's classroom that need teacher approval
 *
 * Only returns requests where teacherApproval is null (not yet approved by teacher).
 * Teacher-initiated requests are auto-approved on teacher side, so they won't appear here.
 */
export async function getPendingRequestsForClassroom(
  classroomId: string,
): Promise<EnrollmentRequestWithRelations[]> {
  const requests = await db.query.enrollmentRequests.findMany({
    where: and(
      eq(enrollmentRequests.classroomId, classroomId),
      eq(enrollmentRequests.status, "pending"),
      isNull(enrollmentRequests.teacherApproval), // Only requests needing teacher approval
    ),
    orderBy: [desc(enrollmentRequests.requestedAt)],
  });

  // Fetch related players
  if (requests.length === 0) return [];

  const playerIds = [...new Set(requests.map((r) => r.playerId))];
  const players = await db.query.players.findMany({
    where: (players, { inArray }) => inArray(players.id, playerIds),
  });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  return requests.map((r) => ({
    ...r,
    player: playerMap.get(r.playerId),
  }));
}

/**
 * Get requests awaiting parent approval (teacher has approved, parent hasn't)
 *
 * These are typically teacher-initiated requests where the teacher added a student
 * via family code and is waiting for the parent to approve.
 */
export async function getRequestsAwaitingParentApproval(
  classroomId: string,
): Promise<EnrollmentRequestWithRelations[]> {
  const requests = await db.query.enrollmentRequests.findMany({
    where: and(
      eq(enrollmentRequests.classroomId, classroomId),
      eq(enrollmentRequests.status, "pending"),
      eq(enrollmentRequests.teacherApproval, "approved"), // Teacher has approved
      isNull(enrollmentRequests.parentApproval), // Parent hasn't responded yet
    ),
    orderBy: [desc(enrollmentRequests.requestedAt)],
  });

  // Fetch related players
  if (requests.length === 0) return [];

  const playerIds = [...new Set(requests.map((r) => r.playerId))];
  const players = await db.query.players.findMany({
    where: (players, { inArray }) => inArray(players.id, playerIds),
  });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  return requests.map((r) => ({
    ...r,
    player: playerMap.get(r.playerId),
  }));
}

/**
 * Get pending requests where user needs to approve as parent
 *
 * These are requests initiated by a teacher for one of the user's children,
 * where parent approval hasn't been given yet.
 */
export async function getPendingRequestsForParent(
  parentUserId: string,
): Promise<EnrollmentRequestWithRelations[]> {
  // Get all children of this parent
  const children = await db.query.parentChild.findMany({
    where: eq(parentChild.parentUserId, parentUserId),
  });
  const childIds = children.map((c) => c.childPlayerId);

  if (childIds.length === 0) return [];

  // Find pending requests for these children that need parent approval
  const requests = await db.query.enrollmentRequests.findMany({
    where: and(
      inArray(enrollmentRequests.playerId, childIds),
      eq(enrollmentRequests.status, "pending"),
      eq(enrollmentRequests.requestedByRole, "teacher"), // Teacher initiated, needs parent
      isNull(enrollmentRequests.parentApproval),
    ),
    orderBy: [desc(enrollmentRequests.requestedAt)],
  });

  if (requests.length === 0) return [];

  // Fetch related players and classrooms
  const playerIds = [...new Set(requests.map((r) => r.playerId))];
  const classroomIds = [...new Set(requests.map((r) => r.classroomId))];

  const [players, classroomList] = await Promise.all([
    db.query.players.findMany({
      where: (players, { inArray }) => inArray(players.id, playerIds),
    }),
    db.query.classrooms.findMany({
      where: (classrooms, { inArray }) => inArray(classrooms.id, classroomIds),
    }),
  ]);

  const playerMap = new Map(players.map((p) => [p.id, p]));
  const classroomMap = new Map(classroomList.map((c) => [c.id, c]));

  return requests.map((r) => ({
    ...r,
    player: playerMap.get(r.playerId),
    classroom: classroomMap.get(r.classroomId),
  }));
}

// ============================================================================
// Enrollment Management
// ============================================================================

/**
 * Check if a player is enrolled in a classroom
 */
export async function isEnrolled(
  classroomId: string,
  playerId: string,
): Promise<boolean> {
  const enrollment = await db.query.classroomEnrollments.findFirst({
    where: and(
      eq(classroomEnrollments.classroomId, classroomId),
      eq(classroomEnrollments.playerId, playerId),
    ),
  });
  return !!enrollment;
}

/**
 * Get all enrolled students in a classroom
 */
export async function getEnrolledStudents(
  classroomId: string,
): Promise<Player[]> {
  const enrollments = await db.query.classroomEnrollments.findMany({
    where: eq(classroomEnrollments.classroomId, classroomId),
  });

  if (enrollments.length === 0) return [];

  const playerIds = enrollments.map((e) => e.playerId);
  const students = await db.query.players.findMany({
    where: (players, { inArray }) => inArray(players.id, playerIds),
  });

  return students;
}

/**
 * Unenroll a student from a classroom
 *
 * Also removes presence and cancels pending requests.
 */
export async function unenrollStudent(
  classroomId: string,
  playerId: string,
): Promise<void> {
  // Remove enrollment
  await db
    .delete(classroomEnrollments)
    .where(
      and(
        eq(classroomEnrollments.classroomId, classroomId),
        eq(classroomEnrollments.playerId, playerId),
      ),
    );

  // Also remove presence if present
  await db
    .delete(classroomPresence)
    .where(
      and(
        eq(classroomPresence.classroomId, classroomId),
        eq(classroomPresence.playerId, playerId),
      ),
    );

  // Cancel any pending requests
  await db
    .update(enrollmentRequests)
    .set({ status: "cancelled", resolvedAt: new Date() })
    .where(
      and(
        eq(enrollmentRequests.classroomId, classroomId),
        eq(enrollmentRequests.playerId, playerId),
        eq(enrollmentRequests.status, "pending"),
      ),
    );
}

/**
 * Get all classrooms a player is enrolled in
 */
export async function getEnrolledClassrooms(
  playerId: string,
): Promise<Classroom[]> {
  const enrollments = await db.query.classroomEnrollments.findMany({
    where: eq(classroomEnrollments.playerId, playerId),
  });

  if (enrollments.length === 0) return [];

  const classroomIds = enrollments.map((e) => e.classroomId);
  const classroomList = await db.query.classrooms.findMany({
    where: (classrooms, { inArray }) => inArray(classrooms.id, classroomIds),
  });

  return classroomList;
}

/**
 * Directly enroll a student in a classroom (bypasses request workflow)
 *
 * Use this when:
 * - Teacher is enrolling a student they just created (no parent exists yet)
 * - Direct enrollment is authorized (e.g., teacher owns both classroom and student)
 *
 * @returns true if enrolled, false if already enrolled
 */
export async function directEnrollStudent(
  classroomId: string,
  playerId: string,
): Promise<boolean> {
  // Check if already enrolled
  const existing = await db.query.classroomEnrollments.findFirst({
    where: and(
      eq(classroomEnrollments.classroomId, classroomId),
      eq(classroomEnrollments.playerId, playerId),
    ),
  });

  if (existing) {
    return false; // Already enrolled
  }

  // Create enrollment directly
  await db.insert(classroomEnrollments).values({
    id: createId(),
    classroomId,
    playerId,
  });

  return true;
}

// Re-export helper functions from schema
export { getRequiredApprovals, isFullyApproved, isDenied } from "@/db/schema";
