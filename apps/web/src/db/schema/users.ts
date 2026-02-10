import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Users table - stores both guest and authenticated users
 *
 * Guest users are created automatically on first visit via middleware.
 * They can upgrade to full accounts later while preserving their data.
 */
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  /** Stable guest ID from HttpOnly cookie - unique per browser session */
  guestId: text('guest_id').notNull().unique(),

  /** When this user record was created */
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),

  /** When guest upgraded to full account (null for guests) */
  upgradedAt: integer('upgraded_at', { mode: 'timestamp' }),

  /** Email (only set after upgrade) */
  email: text('email').unique(),

  /** Display name (only set after upgrade) */
  name: text('name'),

  /** Profile photo URL (from Google OAuth) */
  image: text('image'),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
