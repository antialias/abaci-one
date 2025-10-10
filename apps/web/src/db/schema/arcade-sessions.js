"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arcadeSessions = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
const arcade_rooms_1 = require("./arcade-rooms");
const users_1 = require("./users");
exports.arcadeSessions = (0, sqlite_core_1.sqliteTable)('arcade_sessions', {
    userId: (0, sqlite_core_1.text)('user_id')
        .primaryKey()
        .references(() => users_1.users.id, { onDelete: 'cascade' }),
    // Session metadata
    currentGame: (0, sqlite_core_1.text)('current_game', {
        enum: ['matching', 'memory-quiz', 'complement-race'],
    }).notNull(),
    gameUrl: (0, sqlite_core_1.text)('game_url').notNull(), // e.g., '/arcade/matching'
    // Game state (JSON blob)
    gameState: (0, sqlite_core_1.text)('game_state', { mode: 'json' }).notNull(),
    // Active players snapshot (for quick access)
    activePlayers: (0, sqlite_core_1.text)('active_players', { mode: 'json' }).notNull(),
    // Room association (null for solo play)
    roomId: (0, sqlite_core_1.text)('room_id').references(() => arcade_rooms_1.arcadeRooms.id, { onDelete: 'set null' }),
    // Timing & TTL
    startedAt: (0, sqlite_core_1.integer)('started_at', { mode: 'timestamp' }).notNull(),
    lastActivityAt: (0, sqlite_core_1.integer)('last_activity_at', { mode: 'timestamp' }).notNull(),
    expiresAt: (0, sqlite_core_1.integer)('expires_at', { mode: 'timestamp' }).notNull(), // TTL-based
    // Status
    isActive: (0, sqlite_core_1.integer)('is_active', { mode: 'boolean' }).notNull().default(true),
    // Version for optimistic locking
    version: (0, sqlite_core_1.integer)('version').notNull().default(1),
});
