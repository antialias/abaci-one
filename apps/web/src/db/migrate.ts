import { readFileSync } from 'node:fs'
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { sql } from 'drizzle-orm'

/**
 * Migration runner
 *
 * Runs all pending migrations in the drizzle/ folder.
 * Safe to run multiple times (migrations are idempotent).
 *
 * Includes guard rails that drizzle-orm lacks:
 * - Pre-flight: validates journal timestamps are strictly increasing
 *   (drizzle silently skips migrations with timestamps <= the last applied one)
 * - Post-flight: verifies all journal entries are recorded in the DB
 *
 * Usage: pnpm db:migrate
 */

const MIGRATIONS_FOLDER = './drizzle'
const databaseUrl = process.env.DATABASE_URL || 'file:./data/sqlite.db'
const authToken = process.env.DATABASE_AUTH_TOKEN

interface JournalEntry {
  idx: number
  version: string
  when: number
  tag: string
  breakpoints: boolean
}

/**
 * Pre-flight: abort if journal timestamps are not strictly increasing.
 *
 * Drizzle's migrator uses `lastAppliedTimestamp < migration.folderMillis`
 * to decide what to run. If any migration has a timestamp <= a previous one,
 * it will be silently skipped. This has caused multiple production outages.
 */
function validateTimestampOrdering(entries: JournalEntry[]): void {
  const violations: string[] = []
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].when <= entries[i - 1].when) {
      violations.push(
        `  ${entries[i].tag} (when=${entries[i].when}) <= ${entries[i - 1].tag} (when=${entries[i - 1].when})`
      )
    }
  }
  if (violations.length > 0) {
    throw new Error(
      [
        'Journal timestamp ordering violation detected!',
        'The following migrations have timestamps <= their predecessor:',
        ...violations,
        '',
        'Drizzle will SILENTLY SKIP these migrations, causing missing columns/tables.',
        'Fix: edit drizzle/meta/_journal.json and set each "when" to be greater than the previous entry.',
        'See: apps/web/.claude/procedures/database-migrations.md (Rule 5)',
      ].join('\n')
    )
  }
}

async function runMigrations() {
  // --- Pre-flight: validate journal ---
  const journalPath = `${MIGRATIONS_FOLDER}/meta/_journal.json`
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
  const entries: JournalEntry[] = journal.entries

  console.log(`📋 Journal has ${entries.length} entries`)
  validateTimestampOrdering(entries)

  // --- Run migrations ---
  const client = createClient({
    url: databaseUrl,
    authToken: authToken,
  })

  const db = drizzle(client)

  console.log('🔄 Running migrations...')
  console.log(
    `📍 Database URL: ${databaseUrl.startsWith('file:') ? databaseUrl : databaseUrl.replace(/\/\/.*@/, '//<redacted>@')}`
  )

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })

  // --- Post-flight: verify all migrations are applied ---
  const result = await db.all<{ cnt: number }>(
    sql`SELECT COUNT(*) as cnt FROM __drizzle_migrations`
  )
  const appliedCount = result[0]?.cnt ?? 0
  const expectedCount = entries.length

  if (appliedCount < expectedCount) {
    throw new Error(
      [
        `Post-migration verification FAILED: ${appliedCount} applied but ${expectedCount} expected.`,
        `${expectedCount - appliedCount} migration(s) were silently skipped.`,
        'This usually means a journal timestamp ordering issue slipped past validation.',
        'Check drizzle/meta/_journal.json timestamps and fix manually.',
      ].join('\n')
    )
  }

  console.log(`✅ Migrations complete (${appliedCount}/${expectedCount} applied)`)
}

runMigrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
