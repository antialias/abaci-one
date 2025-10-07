import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

/**
 * Database connection and client
 *
 * Creates a singleton SQLite connection with Drizzle ORM.
 * Enables foreign key constraints (required for cascading deletes).
 *
 * IMPORTANT: The database connection is lazy-loaded to avoid accessing
 * the database at module import time, which would cause build failures
 * when the database doesn't exist (e.g., in CI/CD environments).
 */

const databaseUrl = process.env.DATABASE_URL || './data/sqlite.db'

let _sqlite: Database.Database | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * Get the database connection (lazy-loaded singleton)
 * Only creates the connection when first accessed at runtime
 */
function getDb() {
  if (!_db) {
    _sqlite = new Database(databaseUrl)

    // Enable foreign keys (SQLite requires explicit enable)
    _sqlite.pragma('foreign_keys = ON')

    // Enable WAL mode for better concurrency
    _sqlite.pragma('journal_mode = WAL')

    _db = drizzle(_sqlite, { schema })
  }
  return _db
}

/**
 * Database client instance
 * Uses a Proxy to lazy-load the connection on first access
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>]
  }
})

export { schema }
