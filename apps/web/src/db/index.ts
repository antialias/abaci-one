import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

/**
 * Database connection and client
 *
 * Creates a singleton SQLite connection with Drizzle ORM.
 * Enables foreign key constraints (required for cascading deletes).
 */

const databaseUrl = process.env.DATABASE_URL || './data/sqlite.db'

const sqlite = new Database(databaseUrl)

// Enable foreign keys (SQLite requires explicit enable)
sqlite.pragma('foreign_keys = ON')

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL')

export const db = drizzle(sqlite, { schema })
export { schema }
