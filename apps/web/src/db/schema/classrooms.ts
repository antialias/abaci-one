import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Classrooms table - teacher's persistent space for students
 *
 * Each teacher has exactly one classroom (enforced by unique constraint on teacherId).
 * Students enroll in classrooms and can be "present" for live sessions.
 */
export const classrooms = sqliteTable(
  'classrooms',
  {
    /** Primary key */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Teacher who owns this classroom (one classroom per teacher) */
    teacherId: text('teacher_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Classroom display name */
    name: text('name').notNull(),

    /** Join code for enrollment (e.g., "MATH-4B") */
    code: text('code').notNull().unique(),

    /** When this classroom was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    /** Default expiry time for entry prompts (in minutes). Null = use system default (30 min) */
    entryPromptExpiryMinutes: integer('entry_prompt_expiry_minutes'),
  },
  (table) => ({
    /** Index for looking up classroom by code */
    codeIdx: index('classrooms_code_idx').on(table.code),
  })
)

export type Classroom = typeof classrooms.$inferSelect
export type NewClassroom = typeof classrooms.$inferInsert

/**
 * Generate a unique classroom code
 * Format: 4-6 uppercase alphanumeric characters (no confusing chars like 0/O, 1/I)
 */
export function generateClassroomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}
