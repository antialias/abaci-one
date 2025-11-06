import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Worksheet generator settings table - persists user preferences per worksheet type
 *
 * Uses JSON blob approach for flexibility across different worksheet types
 * (addition, subtraction, multiplication, etc.)
 *
 * The config column stores versioned JSON that is validated at runtime
 * See src/app/create/worksheets/config-schemas.ts for schema definitions
 */
export const worksheetSettings = sqliteTable('worksheet_settings', {
  /** Unique identifier (UUID) */
  id: text('id').primaryKey(),

  /** Foreign key to users table */
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Type of worksheet: 'addition', 'subtraction', 'multiplication', etc. */
  worksheetType: text('worksheet_type').notNull(),

  /** JSON blob containing versioned settings (see config-schemas.ts for types) */
  config: text('config').notNull(),

  /** Timestamp of creation */
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),

  /** Timestamp of last update */
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type WorksheetSettings = typeof worksheetSettings.$inferSelect
export type NewWorksheetSettings = typeof worksheetSettings.$inferInsert
