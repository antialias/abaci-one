import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Worksheet shares table - stores immutable worksheet configurations for sharing
 *
 * Allows users to create shareable links to specific worksheet configurations.
 * Each share is identified by a short code (e.g., "abc123") for clean URLs.
 *
 * Use cases:
 * - Teacher collaboration (sharing proven worksheets)
 * - Parent resources (sending specific practice worksheets)
 * - Curriculum documentation (maintaining standard configurations)
 * - Bug reports (sharing exact problematic configurations)
 * - Social sharing ("Check out this worksheet!")
 */
export const worksheetShares = sqliteTable('worksheet_shares', {
  /** Short code identifier for URL (e.g., "abc123") - 7 characters, base62 */
  id: text('id').primaryKey(),

  /** Type of worksheet: 'addition', 'subtraction', 'multiplication', etc. */
  worksheetType: text('worksheet_type').notNull(),

  /** JSON blob containing full worksheet configuration (immutable snapshot) */
  config: text('config').notNull(),

  /** Timestamp of creation */
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),

  /** View counter - incremented each time the share is accessed */
  views: integer('views').notNull().default(0),

  /** Optional: Creator IP for spam prevention (hashed) */
  creatorIp: text('creator_ip'),

  /** Optional: Title/description for the worksheet share */
  title: text('title'),
})

export type WorksheetShare = typeof worksheetShares.$inferSelect
export type NewWorksheetShare = typeof worksheetShares.$inferInsert
