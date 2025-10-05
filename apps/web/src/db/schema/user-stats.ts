import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * User stats table - game statistics per user
 *
 * One-to-one with users table. Tracks aggregate game performance.
 * Deleted when user is deleted (cascade).
 */
export const userStats = sqliteTable('user_stats', {
  /** Primary key and foreign key to users table */
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Total number of games played */
  gamesPlayed: integer('games_played').notNull().default(0),

  /** Total number of games won */
  totalWins: integer('total_wins').notNull().default(0),

  /** User's most-played game type */
  favoriteGameType: text('favorite_game_type', {
    enum: ['abacus-numeral', 'complement-pairs'],
  }),

  /** Best completion time in milliseconds */
  bestTime: integer('best_time'),

  /** Highest accuracy percentage (0.0 - 1.0) */
  highestAccuracy: real('highest_accuracy').notNull().default(0),
})

export type UserStats = typeof userStats.$inferSelect
export type NewUserStats = typeof userStats.$inferInsert
