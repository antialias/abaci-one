import { sql } from 'drizzle-orm'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'

/**
 * Post-migration checks run by `db/migrate.ts`.
 *
 * On prod that script is the Argo PreSync Job
 * (`infra/k8s/abaci-app/migration-job.yaml`, `node dist/db/migrate.js`), run
 * from the image being deployed, rollbacks included: a check that fails stops
 * the deploy. So a check may name only columns that every table this image can
 * meet has, and a column leaves this list one release before the migration
 * that drops it (`.claude/procedures/database-migrations.md`, Rule 6).
 */

/**
 * The session_plans columns the check requires. The four legacy `break_*`
 * columns left the list in Phase 6b-2a, the release before migration 0149
 * drops them, so the Job passes on the table before the drop and after it
 * (session architecture §10 P6b2a-1).
 */
export const REQUIRED_SESSION_PLAN_COLUMNS = ['flow_state', 'flow_updated_at', 'flow_version']

export async function validateCriticalSessionPlanColumns(
  db: Pick<LibSQLDatabase, 'all'>
): Promise<void> {
  const columns = await db.all<{ name: string }>(sql`PRAGMA table_info(session_plans)`)
  const existing = new Set(columns.map((c) => c.name))

  const missing = REQUIRED_SESSION_PLAN_COLUMNS.filter((name) => !existing.has(name))
  if (missing.length > 0) {
    throw new Error(
      [
        'Post-migration schema verification failed: session_plans is missing required columns.',
        ...missing.map((name) => `  - ${name}`),
        '',
        'A migration may have been partially applied or skipped.',
      ].join('\n')
    )
  }
}
