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

/**
 * Classroom enrollments - persistent student roster
 *
 * Links students (players) to classrooms. An enrolled student can:
 * - Be viewed by the teacher (skills, history, progress)
 * - Enter the classroom for live practice sessions
 * - Be unenrolled by teacher or parent at any time
 */
export const classroomEnrollments = sqliteTable(
  "classroom_enrollments",
  {
    /** Primary key */
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Classroom this enrollment is for */
    classroomId: text("classroom_id")
      .notNull()
      .references(() => classrooms.id, { onDelete: "cascade" }),

    /** Student (player) being enrolled */
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),

    /** When this enrollment was created */
    enrolledAt: integer("enrolled_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Each student can only be enrolled once per classroom */
    classroomPlayerIdx: uniqueIndex("idx_enrollments_classroom_player").on(
      table.classroomId,
      table.playerId,
    ),

    /** Index for finding all students in a classroom */
    classroomIdx: index("idx_enrollments_classroom").on(table.classroomId),

    /** Index for finding all classrooms a student is enrolled in */
    playerIdx: index("idx_enrollments_player").on(table.playerId),
  }),
);

export type ClassroomEnrollment = typeof classroomEnrollments.$inferSelect;
export type NewClassroomEnrollment = typeof classroomEnrollments.$inferInsert;
