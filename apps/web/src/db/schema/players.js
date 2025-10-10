"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.players = void 0;
const cuid2_1 = require("@paralleldrive/cuid2");
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const users_1 = require("./users");
/**
 * Players table - user-created player profiles for games
 *
 * Each user can have multiple players (for multi-player modes).
 * Players are scoped to a user and deleted when user is deleted.
 */
exports.players = (0, sqlite_core_1.sqliteTable)('players', {
    id: (0, sqlite_core_1.text)('id')
        .primaryKey()
        .$defaultFn(() => (0, cuid2_1.createId)()),
    /** Foreign key to users table - cascades on delete */
    userId: (0, sqlite_core_1.text)('user_id')
        .notNull()
        .references(() => users_1.users.id, { onDelete: 'cascade' }),
    /** Player display name */
    name: (0, sqlite_core_1.text)('name').notNull(),
    /** Player emoji avatar */
    emoji: (0, sqlite_core_1.text)('emoji').notNull(),
    /** Player color (hex) for UI theming */
    color: (0, sqlite_core_1.text)('color').notNull(),
    /** Whether this player is currently active in games */
    isActive: (0, sqlite_core_1.integer)('is_active', { mode: 'boolean' }).notNull().default(false),
    /** When this player was created */
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
}, (table) => ({
    /** Index for fast lookups by userId */
    userIdIdx: (0, sqlite_core_1.index)('players_user_id_idx').on(table.userId),
}));
