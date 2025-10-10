"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.arcadeRooms = void 0;
const cuid2_1 = require("@paralleldrive/cuid2");
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.arcadeRooms = (0, sqlite_core_1.sqliteTable)('arcade_rooms', {
    id: (0, sqlite_core_1.text)('id')
        .primaryKey()
        .$defaultFn(() => (0, cuid2_1.createId)()),
    // Room identity
    code: (0, sqlite_core_1.text)('code', { length: 6 }).notNull().unique(), // e.g., "ABC123"
    name: (0, sqlite_core_1.text)('name', { length: 50 }).notNull(),
    // Creator info
    createdBy: (0, sqlite_core_1.text)('created_by').notNull(), // User/guest ID
    creatorName: (0, sqlite_core_1.text)('creator_name', { length: 50 }).notNull(),
    createdAt: (0, sqlite_core_1.integer)('created_at', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
    // Lifecycle
    lastActivity: (0, sqlite_core_1.integer)('last_activity', { mode: 'timestamp' })
        .notNull()
        .$defaultFn(() => new Date()),
    ttlMinutes: (0, sqlite_core_1.integer)('ttl_minutes').notNull().default(60), // Time to live
    isLocked: (0, sqlite_core_1.integer)('is_locked', { mode: 'boolean' }).notNull().default(false),
    // Game configuration
    gameName: (0, sqlite_core_1.text)('game_name', {
        enum: ['matching', 'memory-quiz', 'complement-race'],
    }).notNull(),
    gameConfig: (0, sqlite_core_1.text)('game_config', { mode: 'json' }).notNull(), // Game-specific settings
    // Current state
    status: (0, sqlite_core_1.text)('status', {
        enum: ['lobby', 'playing', 'finished'],
    })
        .notNull()
        .default('lobby'),
    currentSessionId: (0, sqlite_core_1.text)('current_session_id'), // FK to arcade_sessions (nullable)
    // Metadata
    totalGamesPlayed: (0, sqlite_core_1.integer)('total_games_played').notNull().default(0),
});
