import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { classrooms } from './classrooms'
import { players } from './players'
import { users } from './users'

/**
 * Entry prompt status
 */
export type EntryPromptStatus = 'pending' | 'accepted' | 'declined' | 'expired'

/**
 * Entry prompts - teacher requests for parent to have child enter classroom
 *
 * Teachers can prompt parents to have their enrolled child enter the classroom.
 * Prompts have an expiry time and parents can accept or decline.
 *
 * - Accept: Child is entered into classroom (presence record created)
 * - Decline: Teacher is notified, child stays out
 * - Expire: Prompt auto-dismisses (client-side based on expiresAt)
 */
export const entryPrompts = sqliteTable(
  'entry_prompts',
  {
    /** Primary key */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Teacher who sent the prompt */
    teacherId: text('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Student (player) to be prompted to enter */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** Classroom to enter */
    classroomId: text('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),

    /** When the prompt expires (ISO timestamp) */
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),

    /** Current status of the prompt */
    status: text('status').notNull().default('pending').$type<EntryPromptStatus>(),

    /** Parent who responded (if any) */
    respondedBy: text('responded_by').references(() => users.id),

    /** When parent responded */
    respondedAt: integer('responded_at', { mode: 'timestamp' }),

    /** When the prompt was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Index for finding prompts by teacher */
    teacherIdx: index('idx_entry_prompts_teacher').on(table.teacherId),

    /** Index for finding prompts by player */
    playerIdx: index('idx_entry_prompts_player').on(table.playerId),

    /** Index for finding prompts by classroom */
    classroomIdx: index('idx_entry_prompts_classroom').on(table.classroomId),

    /** Index for filtering by status */
    statusIdx: index('idx_entry_prompts_status').on(table.status),

    // Note: Partial unique index (only one pending per player/classroom)
    // is created in migration SQL directly since Drizzle doesn't support WHERE clauses
  })
)

export type EntryPrompt = typeof entryPrompts.$inferSelect
export type NewEntryPrompt = typeof entryPrompts.$inferInsert

/**
 * Check if a prompt has expired
 */
export function isPromptExpired(prompt: EntryPrompt): boolean {
  return prompt.expiresAt < new Date()
}

/**
 * Check if a prompt is still active (pending and not expired)
 */
export function isPromptActive(prompt: EntryPrompt): boolean {
  return prompt.status === 'pending' && !isPromptExpired(prompt)
}
