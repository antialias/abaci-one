import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { drizzle } from 'drizzle-orm/better-sqlite3'

describe('Migrations E2E', () => {
  let sqlite: Database.Database

  beforeEach(() => {
    // Fresh in-memory DB for each test
    sqlite = new Database(':memory:')
    sqlite.pragma('foreign_keys = ON')
  })

  it('applies all migrations successfully', () => {
    const db = drizzle(sqlite)

    // Should not throw
    expect(() => {
      migrate(db, { migrationsFolder: './drizzle' })
    }).not.toThrow()
  })

  it('creates all expected tables', () => {
    const db = drizzle(sqlite)
    migrate(db, { migrationsFolder: './drizzle' })

    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>

    const tableNames = tables.map((t) => t.name)

    expect(tableNames).toContain('users')
    expect(tableNames).toContain('players')
    expect(tableNames).toContain('user_stats')
  })

  it('creates unique indexes on users', () => {
    const db = drizzle(sqlite)
    migrate(db, { migrationsFolder: './drizzle' })

    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='users'")
      .all() as Array<{ name: string }>

    const indexNames = indexes.map((i) => i.name)

    expect(indexNames).toContain('users_guest_id_unique')
    expect(indexNames).toContain('users_email_unique')
  })

  it('creates index on players userId', () => {
    const db = drizzle(sqlite)
    migrate(db, { migrationsFolder: './drizzle' })

    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='players'")
      .all() as Array<{ name: string }>

    const indexNames = indexes.map((i) => i.name)

    expect(indexNames).toContain('players_user_id_idx')
  })

  it('enforces foreign key constraints', () => {
    const db = drizzle(sqlite)
    migrate(db, { migrationsFolder: './drizzle' })

    // Try to insert player with non-existent userId
    expect(() => {
      sqlite
        .prepare(
          "INSERT INTO players (id, user_id, name, emoji, color, is_active, created_at) VALUES ('p1', 'nonexistent', 'Test', '😀', '#000', 0, 0)"
        )
        .run()
    }).toThrow()
  })

  it('cascades deletes from users to players', () => {
    const db = drizzle(sqlite)
    migrate(db, { migrationsFolder: './drizzle' })

    // Insert user
    sqlite
      .prepare("INSERT INTO users (id, guest_id, created_at) VALUES ('u1', 'g1', 0)")
      .run()

    // Insert player for that user
    sqlite
      .prepare(
        "INSERT INTO players (id, user_id, name, emoji, color, is_active, created_at) VALUES ('p1', 'u1', 'Test', '😀', '#000', 0, 0)"
      )
      .run()

    // Verify player exists
    const playerBefore = sqlite.prepare("SELECT * FROM players WHERE id = 'p1'").get()
    expect(playerBefore).toBeDefined()

    // Delete user
    sqlite.prepare("DELETE FROM users WHERE id = 'u1'").run()

    // Verify player was cascade deleted
    const playerAfter = sqlite.prepare("SELECT * FROM players WHERE id = 'p1'").get()
    expect(playerAfter).toBeUndefined()
  })

  it('cascades deletes from users to user_stats', () => {
    const db = drizzle(sqlite)
    migrate(db, { migrationsFolder: './drizzle' })

    // Insert user
    sqlite
      .prepare("INSERT INTO users (id, guest_id, created_at) VALUES ('u1', 'g1', 0)")
      .run()

    // Insert stats for that user
    sqlite
      .prepare(
        "INSERT INTO user_stats (user_id, games_played, total_wins, highest_accuracy) VALUES ('u1', 5, 2, 0.8)"
      )
      .run()

    // Verify stats exist
    const statsBefore = sqlite.prepare("SELECT * FROM user_stats WHERE user_id = 'u1'").get()
    expect(statsBefore).toBeDefined()

    // Delete user
    sqlite.prepare("DELETE FROM users WHERE id = 'u1'").run()

    // Verify stats were cascade deleted
    const statsAfter = sqlite.prepare("SELECT * FROM user_stats WHERE user_id = 'u1'").get()
    expect(statsAfter).toBeUndefined()
  })

  it('is idempotent (can run migrations twice)', () => {
    const db = drizzle(sqlite)

    // Run migrations first time
    migrate(db, { migrationsFolder: './drizzle' })

    // Run migrations second time (should not throw)
    expect(() => {
      migrate(db, { migrationsFolder: './drizzle' })
    }).not.toThrow()
  })
})
