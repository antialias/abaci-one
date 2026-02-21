import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { players } from './players'
import { users } from './users'

/**
 * Family events audit log
 *
 * Tracks family-related actions for abuse prevention and visibility:
 * - Parent linked/unlinked
 * - Family code regenerated
 */
export const familyEvents = sqliteTable('family_events', {
  /** Unique event ID */
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  /** The child this event relates to */
  childPlayerId: text('child_player_id')
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),

  /** Type of event */
  eventType: text('event_type', {
    enum: ['parent_linked', 'parent_unlinked', 'code_regenerated'],
  }).notNull(),

  /** Who performed the action */
  actorUserId: text('actor_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** The parent being linked/unlinked (null for code_regenerated) */
  targetUserId: text('target_user_id'),

  /** When this event occurred */
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type FamilyEvent = typeof familyEvents.$inferSelect
export type NewFamilyEvent = typeof familyEvents.$inferInsert
