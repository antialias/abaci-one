/**
 * @vitest-environment node
 *
 * Validates that mergeGuestIntoUser handles all tables with foreign keys to users.
 *
 * When a guest user authenticates, mergeGuestIntoUser transfers their data to the
 * auth user. If a new table with a user FK is added but not included in the merge
 * function, guest data will be silently lost (deleted via CASCADE) or orphaned.
 *
 * This test introspects the Drizzle schema at runtime to catch missing tables.
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from '@/db/schema'

/**
 * Tables that are intentionally excluded from the merge function.
 * Each entry must have a reason explaining why it's safe to skip.
 */
const EXCLUDED_FROM_MERGE: Record<string, string> = {
  // auth_accounts is cleaned up by CASCADE when the source user is deleted
  // at the end of mergeGuestIntoUser. We don't want to transfer OAuth links
  // from the guest to the auth user — the auth user already has their own.
  'auth_accounts.user_id':
    'Cleaned up by CASCADE on source user delete; auth user has own OAuth links',
}

/** Extract the SQL table name from a Drizzle table */
function tableName(table: SQLiteTable): string {
  return getTableConfig(table).name
}

/** Collect all Drizzle SQLite table objects from the schema */
function getAllTables(): SQLiteTable[] {
  return Object.values(schema).filter(
    (value) => !!value && typeof value === 'object' && Symbol.for('drizzle:Name') in value
  ) as SQLiteTable[]
}

describe('mergeGuestIntoUser coverage', () => {
  it('handles every table with a direct FK to users.id', () => {
    // 1. Find all tables in the schema
    const tables = getAllTables()

    // 2. For each table, find columns with FK references to `users`
    const userFkColumns: Array<{ table: string; column: string }> = []

    for (const table of tables) {
      const config = getTableConfig(table)
      if (config.name === 'users') continue

      for (const fk of config.foreignKeys) {
        const ref = fk.reference()
        const foreignTable = tableName(ref.foreignTable)

        if (foreignTable === 'users') {
          for (const col of ref.columns) {
            userFkColumns.push({ table: config.name, column: col.name })
          }
        }
      }
    }

    expect(userFkColumns.length).toBeGreaterThan(0)

    // 3. Parse mergeGuestIntoUser.ts to extract handled (table, column) pairs
    const mergeSource = readFileSync(resolve(__dirname, '../mergeGuestIntoUser.ts'), 'utf-8')

    // Match reparent('table', 'column') and reparentOrDrop('table', 'column')
    const handledPattern = /(?:reparent|reparentOrDrop)\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g
    const handledPairs = new Set<string>()
    let match
    while ((match = handledPattern.exec(mergeSource)) !== null) {
      handledPairs.add(`${match[1]}.${match[2]}`)
    }

    // 4. Check that every FK column is either handled or explicitly excluded
    const unhandled: string[] = []

    for (const { table, column } of userFkColumns) {
      const key = `${table}.${column}`
      if (!handledPairs.has(key) && !EXCLUDED_FROM_MERGE[key]) {
        unhandled.push(key)
      }
    }

    if (unhandled.length > 0) {
      expect.fail(
        `mergeGuestIntoUser does not handle these user-FK columns:\n` +
          unhandled.map((k) => `  - ${k}`).join('\n') +
          `\n\nEither add them to mergeGuestIntoUser() or to EXCLUDED_FROM_MERGE in this test with a reason.`
      )
    }
  })

  it('does not reference tables/columns that no longer exist in the schema', () => {
    // Parse the merge function for all referenced (table, column) pairs
    const mergeSource = readFileSync(resolve(__dirname, '../mergeGuestIntoUser.ts'), 'utf-8')

    const handledPattern = /(?:reparent|reparentOrDrop)\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g
    const handledPairs: Array<{ table: string; column: string }> = []
    let match
    while ((match = handledPattern.exec(mergeSource)) !== null) {
      handledPairs.push({ table: match[1], column: match[2] })
    }

    // Build a lookup of actual schema tables and their columns
    const tables = getAllTables()

    const schemaColumns = new Map<string, Set<string>>()
    for (const table of tables) {
      const config = getTableConfig(table)
      schemaColumns.set(config.name, new Set(config.columns.map((c) => c.name)))
    }

    const stale: string[] = []
    for (const { table, column } of handledPairs) {
      const tableColumns = schemaColumns.get(table)
      if (!tableColumns) {
        stale.push(`${table}.${column} (table does not exist)`)
      } else if (!tableColumns.has(column)) {
        stale.push(`${table}.${column} (column does not exist)`)
      }
    }

    if (stale.length > 0) {
      expect.fail(
        `mergeGuestIntoUser references stale tables/columns:\n` +
          stale.map((k) => `  - ${k}`).join('\n') +
          `\n\nRemove these from mergeGuestIntoUser().`
      )
    }
  })
})
