import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Per-user feature flag overrides
 *
 * Allows admins to enable/disable flags for specific users,
 * independent of the global flag state. Used for testing features
 * with individual accounts before rolling out globally.
 */
export const featureFlagOverrides = sqliteTable(
  'feature_flag_overrides',
  {
    /** The flag key (references feature_flags.key) */
    flagKey: text('flag_key').notNull(),

    /** The user ID to override for */
    userId: text('user_id').notNull(),

    /** Override enabled value */
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),

    /** Optional override config JSON (null = inherit global config) */
    config: text('config'),

    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),

    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.flagKey, table.userId] })]
)

export type FeatureFlagOverride = typeof featureFlagOverrides.$inferSelect
export type NewFeatureFlagOverride = typeof featureFlagOverrides.$inferInsert
