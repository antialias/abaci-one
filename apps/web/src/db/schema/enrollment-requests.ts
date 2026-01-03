import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { classrooms } from "./classrooms";
import { players } from "./players";
import { users } from "./users";

/**
 * Enrollment request status
 */
export type EnrollmentRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "cancelled";

/**
 * Who initiated the enrollment request
 */
export type EnrollmentRequestRole = "parent" | "teacher";

/**
 * Approval status for a single party
 */
export type ApprovalStatus = "approved" | "denied";

/**
 * Enrollment requests - consent workflow for classroom enrollment
 *
 * Enrollment requires mutual consent:
 * - If parent initiates: teacher must approve
 * - If teacher initiates: any linked parent must approve
 *
 * Once all required approvals are in, the actual enrollment is created
 * and the request status is set to 'approved'.
 */
export const enrollmentRequests = sqliteTable(
  "enrollment_requests",
  {
    /** Primary key */
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Classroom this request is for */
    classroomId: text("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),

    /** Student (player) to be enrolled */
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),

    // ---- Who initiated ----

    /** User who created this request */
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Role of the requester */
    requestedByRole: text("requested_by_role")
      .notNull()
      .$type<EnrollmentRequestRole>(),

    /** When the request was created */
    requestedAt: integer("requested_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),

    // ---- Overall status ----

    /** Current status of the request */
    status: text("status")
      .notNull()
      .default("pending")
      .$type<EnrollmentRequestStatus>(),

    // ---- Teacher approval ----

    /** Teacher's approval decision (null if not yet acted or not required) */
    teacherApproval: text("teacher_approval").$type<ApprovalStatus>(),

    /** When teacher approved/denied */
    teacherApprovedAt: integer("teacher_approved_at", { mode: "timestamp" }),

    // ---- Parent approval ----

    /** Parent's approval decision (null if not yet acted or not required) */
    parentApproval: text("parent_approval").$type<ApprovalStatus>(),

    /** Which parent approved (since multiple parents may exist) */
    parentApprovedBy: text("parent_approved_by").references(() => users.id),

    /** When parent approved/denied */
    parentApprovedAt: integer("parent_approved_at", { mode: "timestamp" }),

    // ---- Resolution ----

    /** When the request was resolved (approved, denied, or cancelled) */
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  },
  (table) => ({
    /** One active request per player per classroom */
    classroomPlayerIdx: uniqueIndex(
      "idx_enrollment_requests_classroom_player",
    ).on(table.classroomId, table.playerId),

    /** Index for finding all requests for a classroom */
    classroomIdx: index("idx_enrollment_requests_classroom").on(
      table.classroomId,
    ),

    /** Index for finding all requests for a player */
    playerIdx: index("idx_enrollment_requests_player").on(table.playerId),

    /** Index for filtering by status */
    statusIdx: index("idx_enrollment_requests_status").on(table.status),
  }),
);

export type EnrollmentRequest = typeof enrollmentRequests.$inferSelect;
export type NewEnrollmentRequest = typeof enrollmentRequests.$inferInsert;

/**
 * Determine what approvals are required based on who initiated
 */
export function getRequiredApprovals(
  requestedByRole: EnrollmentRequestRole,
): ("teacher" | "parent")[] {
  switch (requestedByRole) {
    case "parent":
      // Parent initiated → need teacher approval
      return ["teacher"];
    case "teacher":
      // Teacher initiated → need parent approval
      return ["parent"];
    default:
      return [];
  }
}

/**
 * Check if a request has all required approvals
 */
export function isFullyApproved(request: EnrollmentRequest): boolean {
  const required = getRequiredApprovals(
    request.requestedByRole as EnrollmentRequestRole,
  );

  for (const role of required) {
    if (role === "teacher" && request.teacherApproval !== "approved") {
      return false;
    }
    if (role === "parent" && request.parentApproval !== "approved") {
      return false;
    }
  }

  return true;
}

/**
 * Check if a request has been denied by anyone
 */
export function isDenied(request: EnrollmentRequest): boolean {
  return (
    request.teacherApproval === "denied" || request.parentApproval === "denied"
  );
}
