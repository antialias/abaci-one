import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { players } from "./players";

/**
 * Player stats table - game statistics per player
 *
 * Tracks aggregate performance and per-game breakdowns for each player.
 * One-to-one with players table. Deleted when player is deleted (cascade).
 */
export const playerStats = sqliteTable("player_stats", {
  /** Primary key and foreign key to players table */
  playerId: text("player_id")
    .primaryKey()
    .references(() => players.id, { onDelete: "cascade" }),

  /** Total number of games played across all game types */
  gamesPlayed: integer("games_played").notNull().default(0),

  /** Total number of games won */
  totalWins: integer("total_wins").notNull().default(0),

  /** Total number of games lost */
  totalLosses: integer("total_losses").notNull().default(0),

  /** Best completion time in milliseconds (across all games) */
  bestTime: integer("best_time"),

  /** Highest accuracy percentage (0.0 - 1.0, across all games) */
  highestAccuracy: real("highest_accuracy").notNull().default(0),

  /** Player's most-played game type */
  favoriteGameType: text("favorite_game_type"),

  /**
   * Per-game statistics breakdown (JSON)
   *
   * Structure:
   * {
   *   "matching": {
   *     gamesPlayed: 10,
   *     wins: 5,
   *     losses: 5,
   *     bestTime: 45000,
   *     highestAccuracy: 0.95,
   *     averageScore: 12.5,
   *     lastPlayed: 1704326400000
   *   },
   *   "complement-race": { ... },
   *   ...
   * }
   */
  gameStats: text("game_stats", { mode: "json" })
    .notNull()
    .default("{}")
    .$type<Record<string, GameStatsBreakdown>>(),

  /** When this player last played any game */
  lastPlayedAt: integer("last_played_at", { mode: "timestamp" }),

  /** When this record was created */
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),

  /** When this record was last updated */
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Per-game stats breakdown stored in JSON
 */
export interface GameStatsBreakdown {
  gamesPlayed: number;
  wins: number;
  losses: number;
  bestTime: number | null;
  highestAccuracy: number;
  averageScore: number;
  lastPlayed: number; // timestamp
}

export type PlayerStats = typeof playerStats.$inferSelect;
export type NewPlayerStats = typeof playerStats.$inferInsert;
