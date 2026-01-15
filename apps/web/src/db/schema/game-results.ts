import { createId } from '@paralleldrive/cuid2'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { GameResultsReport } from '@/lib/arcade/game-sdk/types'
import { players } from './players'

/**
 * Game results table - stores completed game results for scoreboard and history
 *
 * Each record represents one completed game session for one player.
 * Results can come from practice breaks, arcade rooms, or standalone games.
 */
export const gameResults = sqliteTable(
  'game_results',
  {
    /** Primary key */
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    /** Player who played this game */
    playerId: text('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),

    /** User ID for cross-device identification */
    userId: text('user_id'),

    // === Game identification ===

    /** Internal game name (e.g., 'matching', 'card-sorting') */
    gameName: text('game_name').notNull(),

    /** Human-readable game name */
    gameDisplayName: text('game_display_name').notNull(),

    /** Game icon emoji */
    gameIcon: text('game_icon'),

    // === Session context ===

    /** Where this game was played */
    sessionType: text('session_type').notNull(), // 'practice-break' | 'arcade-room' | 'standalone'

    /** Links to practice session or arcade room ID */
    sessionId: text('session_id'),

    // === Core metrics for leaderboard comparison ===

    /** Normalized score (0-100 scale) for cross-game comparison */
    normalizedScore: real('normalized_score').notNull(),

    /** Raw score from the game */
    rawScore: integer('raw_score'),

    /** Accuracy percentage (0-100) */
    accuracy: real('accuracy'),

    /** Game category for leaderboard grouping */
    category: text('category'), // 'puzzle' | 'memory' | 'speed' | 'strategy' | 'geography'

    /** Difficulty level played */
    difficulty: text('difficulty'), // 'easy' | 'medium' | 'hard' | 'expert'

    // === Timing ===

    /** Game duration in milliseconds */
    durationMs: integer('duration_ms'),

    /** When the game was played */
    playedAt: integer('played_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    // === Full report JSON ===

    /** Complete GameResultsReport for detailed display */
    fullReport: text('full_report', {
      mode: 'json',
    }).$type<GameResultsReport>(),

    // === Metadata ===

    /** When this record was created */
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    /** Index for player history lookups */
    playerGameIdx: index('game_results_player_game_idx').on(table.playerId, table.gameName),
    /** Index for game-wide leaderboards */
    gameScoreIdx: index('game_results_game_score_idx').on(table.gameName, table.normalizedScore),
    /** Index for category leaderboards */
    categoryScoreIdx: index('game_results_category_score_idx').on(
      table.category,
      table.normalizedScore
    ),
    /** Index for player history ordered by time */
    playerTimeIdx: index('game_results_player_time_idx').on(table.playerId, table.playedAt),
  })
)

export type GameResult = typeof gameResults.$inferSelect
export type NewGameResult = typeof gameResults.$inferInsert
