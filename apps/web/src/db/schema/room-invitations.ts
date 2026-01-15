import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { arcadeRooms } from './arcade-rooms'

/**
 * Room invitations sent by hosts to users
 * Used to invite users back after unbanning or to invite new users
 */
export const roomInvitations = sqliteTable(
  'room_invitations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),

    roomId: text('room_id')
      .notNull()
      .references(() => arcadeRooms.id, { onDelete: 'cascade' }),

    // Invited user
    userId: text('user_id').notNull(),
    userName: text('user_name', { length: 50 }).notNull(), // Name at time of invitation

    // Who invited them
    invitedBy: text('invited_by').notNull(), // Host user ID
    invitedByName: text('invited_by_name', { length: 50 }).notNull(),

    // Invitation status
    status: text('status', {
      enum: ['pending', 'accepted', 'declined', 'expired'],
    })
      .notNull()
      .default('pending'),

    // Type of invitation
    invitationType: text('invitation_type', {
      enum: ['manual', 'auto-unban', 'auto-create'],
    })
      .notNull()
      .default('manual'),

    // Optional message
    message: text('message', { length: 500 }),

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),

    respondedAt: integer('responded_at', { mode: 'timestamp' }),

    expiresAt: integer('expires_at', { mode: 'timestamp' }), // Optional expiration
  },
  (table) => ({
    // One pending invitation per user per room
    userRoomIdx: uniqueIndex('idx_room_invitations_user_room').on(table.userId, table.roomId),
  })
)

export type RoomInvitation = typeof roomInvitations.$inferSelect
export type NewRoomInvitation = typeof roomInvitations.$inferInsert
