import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Players table - user-created player profiles for games
 *
 * Each user can have multiple players (for multi-player modes).
 * Players are scoped to a user and deleted when user is deleted.
 */
export const players = sqliteTable(
  'players',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to users table - cascades on delete */
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Player display name */
    name: text('name').notNull(),

    /** Player emoji avatar */
    emoji: text('emoji').notNull(),

    /** Player color (hex) for UI theming */
    color: text('color').notNull(),

    /** Whether this player is currently active in games */
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),

    /** When this player was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Index for fast lookups by userId */
    userIdIdx: index('players_user_id_idx').on(table.userId),
  })
)

export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
