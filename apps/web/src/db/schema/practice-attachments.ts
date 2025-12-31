import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { createId } from '@paralleldrive/cuid2'
import { players } from './players'
import { sessionPlans } from './session-plans'
import { users } from './users'

/**
 * Practice attachments - photos of student work
 *
 * Used primarily for offline practice sessions where parents/teachers
 * upload photos of the student's physical abacus work.
 */
export const practiceAttachments = sqliteTable('practice_attachments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Who this photo belongs to
  playerId: text('player_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),

  // Link to session (required for offline sessions)
  sessionId: text('session_id')
    .notNull()
    .references(() => sessionPlans.id, { onDelete: 'cascade' }),

  // File info
  filename: text('filename').notNull(), // UUID.ext stored on disk
  mimeType: text('mime_type').notNull(), // image/jpeg, image/png, etc.
  fileSize: integer('file_size').notNull(), // bytes

  // Audit
  uploadedBy: text('uploaded_by')
    .notNull()
    .references(() => users.id),
  uploadedAt: text('uploaded_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
})

export type PracticeAttachment = typeof practiceAttachments.$inferSelect
export type NewPracticeAttachment = typeof practiceAttachments.$inferInsert
