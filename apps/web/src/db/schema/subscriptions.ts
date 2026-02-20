import { createId } from '@paralleldrive/cuid2'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './users'

/**
 * Subscriptions table — one per user.
 *
 * Maps a user to their Stripe subscription and tracks plan/status.
 * Users without a row here are on the free tier.
 */
export const subscriptions = sqliteTable('subscriptions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),

  /** User FK — unique, one subscription per user */
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),

  /** Stripe customer ID (cus_...) */
  stripeCustomerId: text('stripe_customer_id').notNull(),

  /** Stripe subscription ID (sub_...) */
  stripeSubscriptionId: text('stripe_subscription_id').unique(),

  /** Plan name — matches TierName (excluding 'guest') */
  plan: text('plan', { enum: ['free', 'family'] })
    .notNull()
    .default('free'),

  /** Subscription lifecycle status */
  status: text('status', {
    enum: ['active', 'past_due', 'canceled', 'trialing'],
  })
    .notNull()
    .default('active'),

  /** When the current billing period ends */
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),

  /** Whether the subscription will cancel at period end */
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),

  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
