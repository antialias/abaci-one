/**
 * Shared setup for auth integration tests that use the real database.
 *
 * Runs Drizzle migrations to ensure all tables exist before tests run.
 * Import and call in a beforeAll() in any test file that does vi.unmock('@/db').
 */
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { db } from '@/db'

let migrated = false

export async function ensureTestSchema() {
  if (migrated) return
  // Enable WAL mode to prevent SQLITE_BUSY when tests run in parallel
  await db.run(sql`PRAGMA journal_mode = WAL`)
  await db.run(sql`PRAGMA busy_timeout = 5000`)
  await migrate(db, { migrationsFolder: './drizzle' })
  migrated = true
}
