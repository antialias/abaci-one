import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Feature flags table
 *
 * Global on/off toggles with optional JSON config.
 * Designed for admin-controlled feature gating.
 */
export const featureFlags = sqliteTable('feature_flags', {
  /** Dot-namespaced identifier (e.g. 'billing.enabled') */
  key: text('key').primaryKey(),

  /** Whether the flag is active */
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),

  /** Optional JSON config attached to the flag */
  config: text('config'),

  /** Human-readable explanation shown in admin UI */
  description: text('description'),

  /** JSON array of roles allowed to see this flag, e.g. '["admin"]'. null = all roles. */
  allowedRoles: text('allowed_roles'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),

  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
})

export type FeatureFlag = typeof featureFlags.$inferSelect
export type NewFeatureFlag = typeof featureFlags.$inferInsert
