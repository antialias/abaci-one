import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { arcadeRooms } from './arcade-rooms'

/**
 * Users banned from specific rooms by hosts
 */
export const roomBans = sqliteTable(
  'room_bans',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    roomId: text('room_id')
      .notNull()
      .references(() => arcadeRooms.id, { onDelete: 'cascade' }),

    // Banned user
    userId: text('user_id').notNull(),
    userName: text('user_name', { length: 50 }).notNull(), // Name at time of ban

    // Who banned them
    bannedBy: text('banned_by').notNull(), // Host user ID
    bannedByName: text('banned_by_name', { length: 50 }).notNull(),

    // Ban details
    reason: text('reason', {
      enum: ['harassment', 'cheating', 'inappropriate-name', 'spam', 'afk', 'other'],
    }).notNull(),
    notes: text('notes', { length: 500 }), // Optional notes from host

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // One ban record per user per room
    userRoomIdx: uniqueIndex('idx_room_bans_user_room').on(table.userId, table.roomId),
  })
)

export type RoomBan = typeof roomBans.$inferSelect
export type NewRoomBan = typeof roomBans.$inferInsert
