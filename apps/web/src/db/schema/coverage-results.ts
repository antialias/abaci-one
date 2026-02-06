import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Coverage results table
 *
 * Stores unit test coverage percentages reported by CI.
 * Used to drive Prometheus gauges and Grafana dashboards.
 */
export const coverageResults = sqliteTable('coverage_results', {
  /** Auto-increment primary key */
  id: integer('id').primaryKey({ autoIncrement: true }),

  /** When the coverage run was recorded */
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),

  /** Git commit SHA */
  commitSha: text('commit_sha'),

  /** Line coverage percentage (0-100) */
  linesPct: real('lines_pct').notNull(),

  /** Branch coverage percentage (0-100) */
  branchesPct: real('branches_pct').notNull(),

  /** Function coverage percentage (0-100) */
  functionsPct: real('functions_pct').notNull(),

  /** Statement coverage percentage (0-100) */
  statementsPct: real('statements_pct').notNull(),
})

export type CoverageResult = typeof coverageResults.$inferSelect
export type NewCoverageResult = typeof coverageResults.$inferInsert
