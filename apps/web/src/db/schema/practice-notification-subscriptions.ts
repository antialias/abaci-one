import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'
import { players } from './players'

export const practiceNotificationSubscriptions = sqliteTable(
  'practice_notification_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
    email: text('email'),
    pushSubscription: text('push_subscription', { mode: 'json' }).$type<WebPushSubscriptionJson>(),
    channels: text('channels', { mode: 'json' }).$type<SubscriptionChannels>().notNull(),
    status: text('status', { enum: ['active', 'paused', 'expired'] }).notNull().default('active'),
    label: text('label'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    lastNotifiedAt: integer('last_notified_at', { mode: 'timestamp' }),
  },
  (table) => ({
    playerIdx: index('idx_practice_notif_subs_player').on(table.playerId),
    userIdx: index('idx_practice_notif_subs_user').on(table.userId),
    statusIdx: index('idx_practice_notif_subs_status').on(table.status),
  })
)

export interface WebPushSubscriptionJson {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface SubscriptionChannels {
  webPush?: boolean
  inApp?: boolean
  email?: boolean
}

export type PracticeNotificationSubscription = typeof practiceNotificationSubscriptions.$inferSelect
export type NewPracticeNotificationSubscription = typeof practiceNotificationSubscriptions.$inferInsert
