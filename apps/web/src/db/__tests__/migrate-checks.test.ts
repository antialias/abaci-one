/**
 * @vitest-environment node
 *
 * Phase 6b-2a (session architecture §10 P6b2a-1): the post-migration check in
 * `db/migrate.ts` gates every deploy, rollbacks included (the Argo PreSync Job
 * runs it from the image being deployed). It must pass on the table as it is
 * before migration 0149 (the six legacy columns present) and after it (all
 * six dropped), so that 6b-2a is a release a rollback from 6b-2 can land on.
 * The database is built as the Job builds it: drizzle's libsql migrator over
 * the real `./drizzle` folder, first without 0149 (prod before 6b-2), then
 * with it (6b-2's Job, P6b2-1).
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

/** The real migrations folder without 0149: the chain prod ran before 6b-2 */
function folderBefore0149(): string {
  const folder = join(dir, 'drizzle')
  cpSync('./drizzle', folder, { recursive: true })
  const journalPath = join(folder, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8'))
  journal.entries = journal.entries.filter((e: { tag: string }) => !e.tag.startsWith('0149_'))
  writeFileSync(journalPath, JSON.stringify(journal))
  return folder
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'migrate-checks-'))
  client = createClient({ url: `file:${join(dir, 'db.sqlite')}` })
  db = drizzle(client)
  await migrate(db, { migrationsFolder: folderBefore0149() })
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

  it('passes on the table before 0149 (the six columns present)', async () => {
    expect(await columns()).toEqual(expect.arrayContaining(LEGACY_COLUMNS))
    await expect(validateCriticalSessionPlanColumns(db)).resolves.toBeUndefined()
  })

  it('passes on the table 0149 leaves (the six columns dropped)', async () => {
    await migrate(db, { migrationsFolder: './drizzle' })
    expect(await columns()).toEqual(expect.not.arrayContaining(LEGACY_COLUMNS))
    await expect(validateCriticalSessionPlanColumns(db)).resolves.toBeUndefined()
  })

  it('still fails when a required column is missing', async () => {
    await client.execute('ALTER TABLE session_plans DROP COLUMN flow_version')
    await expect(validateCriticalSessionPlanColumns(db)).rejects.toThrow(/- flow_version/)
  })
})
