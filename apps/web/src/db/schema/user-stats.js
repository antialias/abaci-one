"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userStats = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const users_1 = require("./users");
/**
 * User stats table - game statistics per user
 *
 * One-to-one with users table. Tracks aggregate game performance.
 * Deleted when user is deleted (cascade).
 */
exports.userStats = (0, sqlite_core_1.sqliteTable)('user_stats', {
    /** Primary key and foreign key to users table */
    userId: (0, sqlite_core_1.text)('user_id')
        .primaryKey()
        .references(() => users_1.users.id, { onDelete: 'cascade' }),
    /** Total number of games played */
    gamesPlayed: (0, sqlite_core_1.integer)('games_played').notNull().default(0),
    /** Total number of games won */
    totalWins: (0, sqlite_core_1.integer)('total_wins').notNull().default(0),
    /** User's most-played game type */
    favoriteGameType: (0, sqlite_core_1.text)('favorite_game_type', {
        enum: ['abacus-numeral', 'complement-pairs'],
    }),
    /** Best completion time in milliseconds */
    bestTime: (0, sqlite_core_1.integer)('best_time'),
    /** Highest accuracy percentage (0.0 - 1.0) */
    highestAccuracy: (0, sqlite_core_1.real)('highest_accuracy').notNull().default(0),
});
