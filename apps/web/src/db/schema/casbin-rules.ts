import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Casbin rules table for dynamic resource-level authorization policies.
 *
 * Stores both policy rules (ptype='p') and role assignments (ptype='g').
 * Used by the custom Casbin adapter to load/save policies from the database.
 */
export const casbinRules = sqliteTable(
  'casbin_rules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ptype: text('ptype').notNull(),
    v0: text('v0').notNull().default(''),
    v1: text('v1').notNull().default(''),
    v2: text('v2').notNull().default(''),
    v3: text('v3').notNull().default(''),
    v4: text('v4').notNull().default(''),
    v5: text('v5').notNull().default(''),
  },
  (table) => [index('idx_casbin_rules_ptype').on(table.ptype)]
)

export type CasbinRule = typeof casbinRules.$inferSelect
export type NewCasbinRule = typeof casbinRules.$inferInsert
