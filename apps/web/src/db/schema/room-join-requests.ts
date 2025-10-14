import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { arcadeRooms } from './arcade-rooms'

/**
 * Join requests for approval-only rooms
 */
export const roomJoinRequests = sqliteTable(
  'room_join_requests',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    roomId: text('room_id')
      .notNull()
      .references(() => arcadeRooms.id, { onDelete: 'cascade' }),

    // Requesting user
    userId: text('user_id').notNull(),
    userName: text('user_name', { length: 50 }).notNull(),

    // Request status
    status: text('status', {
      enum: ['pending', 'approved', 'denied'],
    })
      .notNull()
      .default('pending'),

    // Timestamps
    requestedAt: integer('requested_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
    reviewedBy: text('reviewed_by'), // Host user ID who reviewed
    reviewedByName: text('reviewed_by_name', { length: 50 }),
  },
  (table) => ({
    // One pending request per user per room
    userRoomIdx: uniqueIndex('idx_room_join_requests_user_room').on(table.userId, table.roomId),
  })
)

export type RoomJoinRequest = typeof roomJoinRequests.$inferSelect
export type NewRoomJoinRequest = typeof roomJoinRequests.$inferInsert
