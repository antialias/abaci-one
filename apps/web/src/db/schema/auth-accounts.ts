import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Auth accounts table - links OAuth providers to users
 *
 * A user can have multiple linked providers (Google + email).
 * Used by the custom NextAuth adapter to look up users by provider.
 */
export const authAccounts = sqliteTable(
  'auth_accounts',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to users table - cascades on delete */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Provider name: 'google', 'email' */
    provider: text('provider').notNull(),

    /** Provider-specific account ID (Google sub ID, or email address for magic links) */
    providerAccountId: text('provider_account_id').notNull(),

    /** Account type: 'oauth', 'email' */
    type: text('type').notNull(),

    /** When this provider link was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Unique constraint: one account per provider */
    providerIdx: uniqueIndex('auth_accounts_provider_idx').on(
      table.provider,
      table.providerAccountId
    ),
  })
)

export type AuthAccount = typeof authAccounts.$inferSelect
export type NewAuthAccount = typeof authAccounts.$inferInsert
