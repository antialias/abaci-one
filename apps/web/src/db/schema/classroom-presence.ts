import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { classrooms } from './classrooms'
import { players } from './players'
import { users } from './users'

/**
 * Classroom presence - ephemeral "in classroom" state
 *
 * Tracks which students are currently "in" a classroom for live sessions.
 * A student can only be present in one classroom at a time (enforced by primary key on playerId).
 *
 * Presence is different from enrollment:
 * - Enrollment: persistent registration in a classroom
 * - Presence: currently active in the classroom for a live session
 *
 * When present, the teacher can:
 * - Start practice sessions for the student
 * - Observe the student's practice in real-time
 * - Control the student's tutorial/abacus
 */
export const classroomPresence = sqliteTable(
  'classroom_presence',
  {
    /** Player ID - also the primary key (one classroom at a time) */
    playerId: text('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** Classroom the student is currently in */
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),

    /** When the student entered the classroom */
    enteredAt: integer('entered_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** Who put the student in the classroom (parent, teacher, or self) */
    enteredBy: text('entered_by')
      .notNull()
      .references(() => users.id),
  },
  (table) => ({
    /** Index for finding all students present in a classroom */
    classroomIdx: index('idx_presence_classroom').on(table.classroomId),
  })
)

export type ClassroomPresence = typeof classroomPresence.$inferSelect
export type NewClassroomPresence = typeof classroomPresence.$inferInsert
