import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { arcadeRooms } from './arcade-rooms'

export const roomMembers = sqliteTable('room_members', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  roomId: text('room_id')
    .notNull()
    .references(() => arcadeRooms.id, { onDelete: 'cascade' }),

  userId: text('user_id').notNull(), // User/guest ID
  displayName: text('display_name', { length: 50 }).notNull(),

  isCreator: integer('is_creator', { mode: 'boolean' }).notNull().default(false),

  joinedAt: integer('joined_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  lastSeen: integer('last_seen', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  isOnline: integer('is_online', { mode: 'boolean' }).notNull().default(true),
})

export type RoomMember = typeof roomMembers.$inferSelect
export type NewRoomMember = typeof roomMembers.$inferInsert
