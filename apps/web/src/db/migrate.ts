import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

/**
 * Migration runner
 *
 * Runs all pending migrations in the drizzle/ folder.
 * Safe to run multiple times (migrations are idempotent).
 *
 * Usage: pnpm db:migrate
 */

const databaseUrl = process.env.DATABASE_URL || 'file:./data/sqlite.db'
const authToken = process.env.DATABASE_AUTH_TOKEN

async function runMigrations() {
  const client = createClient({
    url: databaseUrl,
    authToken: authToken,
  })

  const db = drizzle(client)

  console.log('🔄 Running migrations...')
  console.log(`📍 Database URL: ${databaseUrl.startsWith('file:') ? databaseUrl : databaseUrl.replace(/\/\/.*@/, '//<redacted>@')}`)

  await migrate(db, { migrationsFolder: './drizzle' })

  console.log('✅ Migrations complete')
}

runMigrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  })
