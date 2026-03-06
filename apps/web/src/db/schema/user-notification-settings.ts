import { createId } from '@paralleldrive/cuid2'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'
import type { WebPushSubscriptionJson } from './practice-notification-subscriptions'

/**
 * User-level notification preferences.
 *
 * Controls how the user wants to be notified by default across all
 * notification types. Individual notification types can override these
 * defaults via the type_overrides JSON.
 */
export const userNotificationSettings = sqliteTable('user_notification_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Default: show in-app toasts via Socket.IO */
  inAppEnabled: integer('in_app_enabled', { mode: 'boolean' }).notNull().default(true),
  /** Default: send browser push notifications */
  pushEnabled: integer('push_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Default: send email notifications */
  emailEnabled: integer('email_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Override email for notifications (falls back to users.email) */
  notificationEmail: text('notification_email'),
  /**
   * Per-type overrides. Sparse JSON object keyed by NotificationType.
   * Each value is a partial ChannelOverrides: { inApp?: bool, push?: bool, email?: bool }.
   * Null/missing keys mean "use the default above".
   *
   * Example: { "postcard-ready": { "email": false }, "session-started": { "push": true } }
   */
  typeOverrides: text('type_overrides', { mode: 'json' }).$type<TypeOverridesMap>(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
})

/**
 * User push subscriptions — one per browser/device.
 *
 * Decoupled from practice notification subscriptions so push endpoints
 * can be reused for any notification type (postcards, system alerts, etc).
 */
export const userPushSubscriptions = sqliteTable(
  'user_push_subscriptions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    keys: text('keys', { mode: 'json' }).$type<WebPushSubscriptionJson['keys']>().notNull(),
    /** Human-readable label like "Chrome on MacBook" */
    deviceLabel: text('device_label'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  },
  (table) => ({
    userIdx: index('idx_user_push_subs_user').on(table.userId),
    endpointIdx: index('idx_user_push_subs_endpoint').on(table.endpoint),
  })
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Notification types the system supports */
export type NotificationType = 'session-started' | 'postcard-ready'

/** Per-channel override (null = inherit from user default) */
export interface ChannelOverrides {
  inApp?: boolean
  push?: boolean
  email?: boolean
}

/** Sparse map of per-type channel overrides */
export type TypeOverridesMap = Partial<Record<NotificationType, ChannelOverrides>>

export type UserNotificationSettings = typeof userNotificationSettings.$inferSelect
export type UserPushSubscription = typeof userPushSubscriptions.$inferSelect
