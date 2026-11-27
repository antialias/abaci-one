/**
 * @vitest-environment node
 *
 * Phase 6b-2a (session architecture §10 P6b2a-1): the post-migration check in
 * `db/migrate.ts` gates every deploy, rollbacks included (the Argo PreSync Job
 * runs it from the image being deployed). It must pass on the table as it is
 * before migration 0149 (the six legacy columns present) and after it (all
 * six dropped), so that 6b-2a is a release a rollback from 6b-2 can land on.
 * The database is built as the Job builds it: drizzle's libsql migrator over
 * the real `./drizzle` folder.
 */

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type Client, createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  REQUIRED_SESSION_PLAN_COLUMNS,
  validateCriticalSessionPlanColumns,
} from '../migrate-checks'

/** The six columns migration 0149 (Phase 6b-2) drops */
const LEGACY_COLUMNS = [
  'current_slot_index',
  'retry_state',
  'break_started_at',
  'break_reason',
  'break_selected_game',
  'break_results',
]

let dir: string
let client: Client
let db: ReturnType<typeof drizzle>

const columns = async () =>
  (await client.execute('PRAGMA table_info(session_plans)')).rows.map((r) => String(r.name))

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'migrate-checks-'))
  client = createClient({ url: `file:${join(dir, 'db.sqlite')}` })
  db = drizzle(client)
  await migrate(db, { migrationsFolder: './drizzle' })
})

afterEach(() => {
  client.close()
  rmSync(dir, { recursive: true, force: true })
})

describe('the post-migration session_plans check (Phase 6b-2a)', () => {
  it('names no column migration 0149 drops', () => {
    expect(REQUIRED_SESSION_PLAN_COLUMNS).toEqual(['flow_state', 'flow_updated_at', 'flow_version'])
    expect(REQUIRED_SESSION_PLAN_COLUMNS).toEqual(expect.not.arrayContaining(LEGACY_COLUMNS))
  })

  it('passes on the table the migration chain builds today (the six columns present)', async () => {
    expect(await columns()).toEqual(expect.arrayContaining(LEGACY_COLUMNS))
    await expect(validateCriticalSessionPlanColumns(db)).resolves.toBeUndefined()
  })

  it('passes on the table with the six columns dropped (as 0149 leaves it)', async () => {
    for (const column of LEGACY_COLUMNS) {
      await client.execute(`ALTER TABLE session_plans DROP COLUMN ${column}`)
    }
    expect(await columns()).toEqual(expect.not.arrayContaining(LEGACY_COLUMNS))
    await expect(validateCriticalSessionPlanColumns(db)).resolves.toBeUndefined()
  })

  it('still fails when a required column is missing', async () => {
    await client.execute('ALTER TABLE session_plans DROP COLUMN flow_version')
    await expect(validateCriticalSessionPlanColumns(db)).rejects.toThrow(/- flow_version/)
  })
})
