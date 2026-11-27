/**
 * The gate on the six legacy session columns (`break_started_at`,
 * `break_reason`, `break_selected_game`, `break_results`,
 * `current_slot_index`, `retry_state`; session architecture §7 Phase 6, §10
 * P6b-8, P6b1-7). 6b-0 stopped reading them, 6b-1 stopped writing them, 6b-2
 * drops them.
 *
 * Since 6b-1 they are out of the drizzle schema, so `tsc` rejects any typed
 * read or write of `breakStartedAt`, `retryState`, … on a session row. Until
 * 6b-1 this gate also scanned the source for property reads, with allowances
 * by enclosing function (§10 P6b-12 (4)); `tsc` now does that job without the
 * allowances. What `tsc` cannot see stays here: SQL. No string or template
 * literal in `src` names the columns, outside the post-migration schema check
 * in `db/migrate.ts`, which keeps them until 6b-2 (§10 P6b-10).
 */

import fs from 'node:fs'
import path from 'node:path'
import { getTableColumns } from 'drizzle-orm'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { sessionPlans } from '@/db/schema/session-plans'

const SRC = path.resolve(__dirname, '..')
const COLUMNS = [
  'break_started_at',
  'break_reason',
  'break_selected_game',
  'break_results',
  'current_slot_index',
  'retry_state',
]
const PROPERTIES = [
  'breakStartedAt',
  'breakReason',
  'breakSelectedGame',
  'breakResults',
  'currentSlotIndex',
  'retryState',
]
// `break_results` is also a flow state, so the SQL check cannot tell it apart
const SQL_NAMES =
  /\b(break_started_at|break_reason|break_selected_game|current_slot_index|retry_state)\b/
/** file → why its SQL may name the columns */
const SQL_ALLOWED: Record<string, string> = {
  'db/migrate.ts': "the post-migration schema check lists session_plans' columns until 6b-2",
}

function isTestFile(relative: string): boolean {
  return (
    relative.startsWith('test/') ||
    /(^|\/)__tests__\//.test(relative) ||
    /\.(test|spec|stories)\.tsx?$/.test(relative)
  )
}

/** The string and template literals in a source file that name a column (comments are not literals). */
function sqlHits(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const hits: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const match = SQL_NAMES.exec(node.text)
      if (match)
        hits.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}:${match[1]}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

function scan(): { relative: string; hits: string[] }[] {
  return sourceFiles(SRC)
    .map((file) => path.relative(SRC, file).split(path.sep).join('/'))
    .filter((relative) => !isTestFile(relative))
    .map((relative) => ({
      relative,
      hits: sqlHits(relative, fs.readFileSync(path.join(SRC, relative), 'utf8')),
    }))
}

describe('Phase 6b-1 gate: the six legacy session columns', () => {
  it('are out of the drizzle schema, so tsc rejects any read or write of them', () => {
    const columns = getTableColumns(sessionPlans)
    expect(Object.keys(columns)).toEqual(expect.not.arrayContaining(PROPERTIES))
    const names = Object.values(columns).map((c) => c.name)
    expect(names).toEqual(expect.not.arrayContaining(COLUMNS))
    // the schema still describes the row otherwise (a sanity check of the read)
    expect(names).toEqual(expect.arrayContaining(['current_part_index', 'part_states', 'breaks']))
  })

  it('catches a column in a string or template literal, not in a comment (fails on a planted one)', () => {
    const planted = [
      '// current_slot_index in a comment',
      "const a = 'SELECT retry_state FROM session_plans'",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: planted source text, not a template
      'const b = `UPDATE session_plans SET ${x} = 1, break_reason = NULL`',
      'const c = sql`SELECT break_started_at FROM t`',
      "const d = 'break_results'", // a flow state: not caught
    ].join('\n')
    expect(sqlHits('planted.ts', planted)).toEqual([
      '2:retry_state',
      '3:break_reason',
      '4:break_started_at',
    ])
  })

  it('no SQL in src names the columns (the schema check in db/migrate.ts aside)', () => {
    const files = scan()
    expect(files.length).toBeGreaterThan(1000)
    const offenders = files
      .filter(({ relative, hits }) => hits.length > 0 && !(relative in SQL_ALLOWED))
      .map(({ relative, hits }) => `${relative} ${hits.join(' ')}`)
    expect(offenders).toEqual([])
    // the allowance still names the columns (it goes with them in 6b-2)
    for (const file of Object.keys(SQL_ALLOWED)) {
      expect(files.find((f) => f.relative === file)?.hits.length, file).toBeGreaterThan(0)
    }
  })
})
