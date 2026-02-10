import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Verification tokens table - for magic link email verification
 *
 * NextAuth's email provider requires this table to store
 * one-time-use tokens for email sign-in links.
 */
export const verificationTokens = sqliteTable(
  'verification_tokens',
  {
    /** Email address the token was sent to */
    identifier: text('identifier').notNull(),

    /** The unique verification token */
    token: text('token').notNull().unique(),

    /** When this token expires (unix timestamp) */
    expires: integer('expires', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    /** Composite primary key */
    pk: primaryKey({ columns: [table.identifier, table.token] }),
  })
)

export type VerificationToken = typeof verificationTokens.$inferSelect
export type NewVerificationToken = typeof verificationTokens.$inferInsert
