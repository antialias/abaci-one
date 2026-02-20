import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { players } from './players'

/**
 * Euclid Progress
 *
 * Tracks which propositions a player has completed in the Euclid's Elements
 * interactive. One row per (player, proposition) pair.
 */
export const euclidProgress = sqliteTable(
  'euclid_progress',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Foreign key to players table */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** Proposition number (1-48) */
    propositionId: integer('proposition_id').notNull(),

    /** When the proposition was completed */
    completedAt: integer('completed_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Index for fast lookups by playerId */
    playerIdx: index('euclid_progress_player_idx').on(table.playerId),

    /** Unique constraint: one record per player per proposition */
    playerPropUnique: uniqueIndex('euclid_progress_player_prop_unique').on(
      table.playerId,
      table.propositionId
    ),
  })
)

export type EuclidProgress = typeof euclidProgress.$inferSelect
export type NewEuclidProgress = typeof euclidProgress.$inferInsert
