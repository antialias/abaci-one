import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Smoke test results table
 *
 * Stores results from automated smoke tests run via CronJob.
 * Used by Gatus to determine if the application is functioning correctly.
 */
export const smokeTestRuns = sqliteTable('smoke_test_runs', {
  /**
   * Unique identifier for the test run
   */
  id: text('id').primaryKey(),

  /**
   * When the test run started
   */
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),

  /**
   * When the test run completed (null if still running)
   */
  completedAt: integer('completed_at', { mode: 'timestamp' }),

  /**
   * Current status of the test run
   */
  status: text('status', {
    enum: ['running', 'passed', 'failed', 'error'],
  }).notNull(),

  /**
   * Total number of tests executed
   */
  totalTests: integer('total_tests'),

  /**
   * Number of tests that passed
   */
  passedTests: integer('passed_tests'),

  /**
   * Number of tests that failed
   */
  failedTests: integer('failed_tests'),

  /**
   * Total duration of the test run in milliseconds
   */
  durationMs: integer('duration_ms'),

  /**
   * JSON-serialized detailed test results
   */
  resultsJson: text('results_json'),

  /**
   * Error message if the run failed with an error
   */
  errorMessage: text('error_message'),
})

export type SmokeTestRun = typeof smokeTestRuns.$inferSelect
export type NewSmokeTestRun = typeof smokeTestRuns.$inferInsert
