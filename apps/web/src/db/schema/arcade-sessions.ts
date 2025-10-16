import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { arcadeRooms } from './arcade-rooms'
import { users } from './users'

export const arcadeSessions = sqliteTable('arcade_sessions', {
  // Room ID is now the primary key - one session per room
  // For room-based multiplayer games, this ensures all members share the same session
  roomId: text('room_id')
    .primaryKey()
    .references(() => arcadeRooms.id, { onDelete: 'cascade' }),

  // User who "owns" this session (typically the room creator)
  // For room-based sessions, this is just for reference/ownership tracking
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Session metadata
  currentGame: text('current_game', {
    enum: ['matching', 'memory-quiz', 'complement-race', 'number-guesser'],
  }).notNull(),

  gameUrl: text('game_url').notNull(), // e.g., '/arcade/matching'

  // Game state (JSON blob)
  gameState: text('game_state', { mode: 'json' }).notNull(),

  // Active players snapshot (for quick access)
  activePlayers: text('active_players', { mode: 'json' }).notNull(),

  // Timing & TTL
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(), // TTL-based

  // Status
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),

  // Version for optimistic locking
  version: integer('version').notNull().default(1),
})

export type ArcadeSession = typeof arcadeSessions.$inferSelect
export type NewArcadeSession = typeof arcadeSessions.$inferInsert
