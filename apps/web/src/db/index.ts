import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

/**
 * Database connection and client
 *
 * Creates a singleton libSQL connection with Drizzle ORM.
 *
 * Connection URL formats:
 * - Dev: file:./data/sqlite.db (local SQLite file, no server needed)
 * - Prod: http://libsql.abaci.svc.cluster.local:8080 (libSQL server in k8s)
 *
 * IMPORTANT: The database connection is lazy-loaded to avoid accessing
 * the database at module import time, which would cause build failures
 * when the database doesn't exist (e.g., in CI/CD environments).
 */

const databaseUrl = process.env.DATABASE_URL || 'file:./data/sqlite.db'
const authToken = process.env.DATABASE_AUTH_TOKEN

let _client: ReturnType<typeof createClient> | null = null
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * Get the database connection (lazy-loaded singleton)
 * Only creates the connection when first accessed at runtime
 */
function getDb() {
  if (!_db) {
    _client = createClient({
      url: databaseUrl,
      authToken: authToken,
    })

    _db = drizzle(_client, { schema })
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
  },
})

export { schema }
