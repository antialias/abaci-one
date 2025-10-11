import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const arcadeRooms = sqliteTable('arcade_rooms', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  // Room identity
  code: text('code', { length: 6 }).notNull().unique(), // e.g., "ABC123"
  name: text('name', { length: 50 }).notNull(),

  // Creator info
  createdBy: text('created_by').notNull(), // User/guest ID
  creatorName: text('creator_name', { length: 50 }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),

  // Lifecycle
  lastActivity: integer('last_activity', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  ttlMinutes: integer('ttl_minutes').notNull().default(60), // Time to live
  isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),

  // Game configuration
  gameName: text('game_name', {
    enum: ['matching', 'memory-quiz', 'complement-race'],
  }).notNull(),
  gameConfig: text('game_config', { mode: 'json' }).notNull(), // Game-specific settings

  // Current state
  status: text('status', {
    enum: ['lobby', 'playing', 'finished'],
  })
    .notNull()
    .default('lobby'),
  currentSessionId: text('current_session_id'), // FK to arcade_sessions (nullable)

  // Metadata
  totalGamesPlayed: integer('total_games_played').notNull().default(0),
})

export type ArcadeRoom = typeof arcadeRooms.$inferSelect
export type NewArcadeRoom = typeof arcadeRooms.$inferInsert
