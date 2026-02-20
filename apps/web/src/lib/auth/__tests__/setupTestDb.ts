/**
 * Shared setup for auth integration tests that use the real database.
 *
 * Runs Drizzle migrations to ensure all tables exist before tests run.
 * Import and call in a beforeAll() in any test file that does vi.unmock('@/db').
 */
import { migrate } from 'drizzle-orm/libsql/migrator'
import { db } from '@/db'

let migrated = false

export async function ensureTestSchema() {
  if (migrated) return
  await migrate(db, { migrationsFolder: './drizzle' })
  migrated = true
}
