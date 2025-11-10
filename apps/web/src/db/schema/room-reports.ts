import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { arcadeRooms } from './arcade-rooms'

/**
 * Reports submitted by room members about other members
 */
export const roomReports = sqliteTable('room_reports', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  roomId: text('room_id')
    .notNull()
    .references(() => arcadeRooms.id, { onDelete: 'cascade' }),

  // Who reported
  reporterId: text('reporter_id').notNull(),
  reporterName: text('reporter_name', { length: 50 }).notNull(),

  // Who was reported
  reportedUserId: text('reported_user_id').notNull(),
  reportedUserName: text('reported_user_name', { length: 50 }).notNull(),

  // Report details
  reason: text('reason', {
    enum: ['harassment', 'cheating', 'inappropriate-name', 'spam', 'afk', 'other'],
  }).notNull(),
  details: text('details', { length: 500 }), // Optional additional context

  // Status tracking
  status: text('status', {
    enum: ['pending', 'reviewed', 'dismissed'],
  })
    .notNull()
    .default('pending'),

  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  reviewedBy: text('reviewed_by'), // Host user ID who reviewed
})

export type RoomReport = typeof roomReports.$inferSelect
export type NewRoomReport = typeof roomReports.$inferInsert
