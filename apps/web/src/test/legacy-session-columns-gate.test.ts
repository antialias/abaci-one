/**
 * The gate of Phase 6b-0 (session architecture §7 Phase 6, §10 P6b-1): nothing
 * reads the six legacy session columns (`break_started_at`, `break_reason`,
 * `break_selected_game`, `break_results`, `current_slot_index`,
 * `retry_state`) except the legacy decode, for a part with no `part_states`
 * entry, and the writers, which still write them exactly as before. 6b-1 can
 * stop writing them only while this holds; 6b-2 drops them.
 *
 * It catches property reads the way the Phase 5 and 6a gates do
 * (`session-view-import-gate.test.ts`, `legacy-try-fields-gate.test.ts`):
 * `x.retryState`, `x?.breakResults`, `x['currentSlotIndex']`, destructuring
 * and destructuring assignment. Writing such a property in an object literal
 * is not a read; nor is a type's property signature or a `Pick<…, 'name'>`.
 * A computed key (`x[key]`) cannot be told statically.
 *
 * Allowed reads are named by file AND enclosing function (`ALLOWED`), so a new
 * read elsewhere in the same file is caught. Files where the names belong to
 * other records (the `practice-state` wire, the arcade's retry state, a
 * component's own prop) are exempt whole (`OTHER_RECORDS`), each with its
 * reason, and are checked to still use a name, so an exemption cannot outlive
 * its reason. Raw SQL is checked separately: no SQL string in `src` names the
 * columns, outside the schema check in `db/migrate.ts`.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const GATED_NAMES = new Set([
  'breakStartedAt',
  'breakReason',
  'breakSelectedGame',
  'breakResults',
  'currentSlotIndex',
  'retryState',
])
// `break_results` is also a flow state, so the SQL check cannot tell it apart
const SQL_NAMES =
  /\b(break_started_at|break_reason|break_selected_game|current_slot_index|retry_state)\b/

/** file → the functions in it that may read the columns, and why */
const ALLOWED: Record<string, Record<string, string>> = {
  'lib/curriculum/parts/arithmetic/state.ts': {
    arithmeticStateOf: 'the legacy decode of the current part (a part with no entry)',
    legacyArithmeticStateOf: 'the legacy decode of another part (a part with no entry)',
    initRetryState: 'a legacy write helper (no caller; goes with the shims in 6b-1)',
  },
  'db/schema/session-plan-normalize.ts': {
    partStatePatch: "the writers' legacy encoding of a part's state (copies retryState)",
  },
  'lib/curriculum/session-flow.ts': {
    legacyBreakStartedAtWrite: 'the legacy breakStartedAt write, exactly as before',
    clearsLegacyBreakFields:
      "whether a try's clearing of the legacy fields bumps flowVersion (P5a-3 (2))",
  },
  'lib/curriculum/session-report-batch.ts': {
    reportRowColumns: 'selects current_slot_index and retry_state for the legacy decode',
  },
  'app/api/curriculum/[playerId]/sessions/plans/[planId]/route.ts': {
    serializePlan: 'wire pass-through of breakStartedAt for bundles before 6b-0 (D9)',
    PATCH: "the request body's breakResults (the client's break_finished payload), not the row",
  },
  'hooks/useSessionPlan.ts': {
    mutationFn: "the break_finished mutation's own breakResults argument, not the row",
  },
  'app/api/curriculum/[playerId]/sessions/plans/[planId]/flow-events/route.ts': {
    serializePlan: 'wire pass-through of breakStartedAt for bundles before 6b-0 (D9)',
  },
}

/** Files where the gated names are fields of other records, not of a session row */
const OTHER_RECORDS: Record<string, string> = {
  'arcade-games/rithmomachia/Provider.tsx': "the arcade session's own retryState",
  'components/practice/SessionProgressIndicator.tsx':
    'its currentSlotIndex prop (arithmeticDotsPosition, through partStateOf)',
  'components/classroom/SessionObserverModal.tsx': "the practice-state wire's currentSlotIndex",
  'components/debug/ObserverDebugPanel.tsx': "the practice-state wire's currentSlotIndex",
  'components/debug/BroadcastDebugPanel.tsx': "the broadcast's currentSlotIndex",
  'lib/curriculum/parts/arithmetic/result-view.ts': "the part-transition wire's currentSlotIndex",
}

function isTestFile(relative: string): boolean {
  return (
    relative.startsWith('test/') ||
    /(^|\/)__tests__\//.test(relative) ||
    /\.(test|spec|stories)\.tsx?$/.test(relative)
  )
}

/** Whether an object or array literal is the target of a destructuring assignment. */
function isAssignmentTarget(node: ts.Node): boolean {
  const parent = node.parent
  if (!parent) return false
  if (ts.isBinaryExpression(parent)) {
    return parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.left === node
  }
  if (ts.isForOfStatement(parent) || ts.isForInStatement(parent)) return parent.initializer === node
  if (ts.isParenthesizedExpression(parent) || ts.isArrayLiteralExpression(parent)) {
    return isAssignmentTarget(parent)
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === node) {
    return isAssignmentTarget(parent.parent)
  }
  if (ts.isShorthandPropertyAssignment(parent) || ts.isSpreadElement(parent)) {
    return isAssignmentTarget(parent.parent)
  }
  return false
}

/** The nearest named function around a node ('' at module level). */
function enclosingFunction(node: ts.Node): string {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name) {
      return n.name.getText()
    }
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      // through a wrapper call: `export const PATCH = withAuth(async (…) => …)`
      let p = n.parent
      while (
        p &&
        (ts.isCallExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression(p))
      ) {
        p = p.parent
      }
      if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
      if (p && ts.isPropertyAssignment(p)) return p.name.getText()
    }
  }
  return ''
}

interface Hit {
  line: number
  name: string
  fn: string
}

/** The gated reads in one source file. */
function gatedReads(fileName: string, source: string): Hit[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const hits: Hit[] = []
  const visit = (node: ts.Node) => {
    let name: string | undefined
    if (ts.isPropertyAccessExpression(node)) {
      name = node.name.text
    } else if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression)
    ) {
      name = node.argumentExpression.text
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const key = node.propertyName ?? node.name
      name = ts.isIdentifier(key) || ts.isStringLiteralLike(key) ? key.text : undefined
    } else if (
      (ts.isShorthandPropertyAssignment(node) || ts.isPropertyAssignment(node)) &&
      ts.isObjectLiteralExpression(node.parent) &&
      isAssignmentTarget(node.parent)
    ) {
      name =
        ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name) ? node.name.text : undefined
    }
    if (name && GATED_NAMES.has(name)) {
      hits.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        name,
        fn: enclosingFunction(node),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

const show = (h: Hit) => `${h.line}:${h.name}@${h.fn || '<module>'}`

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(full, out)
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) out.push(full)
  }
  return out
}

function scan(): { relative: string; source: string; hits: Hit[] }[] {
  return sourceFiles(SRC)
    .map((file) => path.relative(SRC, file).split(path.sep).join('/'))
    .filter((relative) => !isTestFile(relative))
    .map((relative) => {
      const source = fs.readFileSync(path.join(SRC, relative), 'utf8')
      return { relative, source, hits: gatedReads(relative, source) }
    })
}

describe('Phase 6b-0 gate: no reads of the six legacy session columns', () => {
  it('catches every form of a read, with its enclosing function (fails on a planted read)', () => {
    const planted = [
      'function a(plan) { return plan.breakStartedAt }',
      'const b = (plan) => plan?.retryState?.[0]',
      "function c(plan) { return plan['currentSlotIndex'] }",
      'const { breakReason } = plan',
      'function d({ breakSelectedGame }) { return breakSelectedGame }',
      ';({ breakResults: r } = plan)',
    ].join('\n')
    expect(gatedReads('planted.ts', planted).map(show)).toEqual([
      '1:breakStartedAt@a',
      '2:retryState@b',
      '3:currentSlotIndex@c',
      '4:breakReason@<module>',
      '5:breakSelectedGame@d',
      '6:breakResults@<module>',
    ])
  })

  it('does not count writes, types or unrelated names', () => {
    const fine = [
      'const patch = { breakStartedAt: null, retryState: {}, currentSlotIndex: 0 }',
      "type T = Pick<SessionPlan, 'breakReason' | 'breakResults'>",
      'interface W { currentSlotIndex?: number }',
      'const x = plan.breakStartedAtMs',
      'const k = "retryState"; const dynamic = plan[k]',
    ].join('\n')
    expect(gatedReads('fine.ts', fine)).toEqual([])
  })

  it('reads only in the legacy decode and the writers', () => {
    const files = scan()
    expect(files.length).toBeGreaterThan(1000)
    const offenders: string[] = []
    for (const { relative, hits } of files) {
      if (relative in OTHER_RECORDS) continue
      const allowed = ALLOWED[relative] ?? {}
      const bad = hits.filter((h) => !(h.fn in allowed))
      if (bad.length > 0) offenders.push(`${relative} ${bad.map(show).join(' ')}`)
    }
    expect(offenders).toEqual([])
  })

  it('every allowance and exemption still names a read (none outlives its reason)', () => {
    const byFile = new Map(scan().map((f) => [f.relative, f.hits]))
    const stale: string[] = []
    for (const [file, fns] of Object.entries(ALLOWED)) {
      const hits = byFile.get(file) ?? []
      for (const fn of Object.keys(fns)) {
        if (!hits.some((h) => h.fn === fn)) stale.push(`${file}@${fn}`)
      }
    }
    for (const file of Object.keys(OTHER_RECORDS)) {
      if ((byFile.get(file) ?? []).length === 0) stale.push(file)
    }
    expect(stale).toEqual([])
  })

  it('no SQL string in src names the columns (the schema check in db/migrate.ts aside)', () => {
    const offenders = scan()
      .filter(
        ({ relative }) => relative !== 'db/migrate.ts' && relative !== 'db/schema/session-plans.ts'
      )
      .filter(({ source }) => SQL_NAMES.test(source))
      .map(({ relative }) => relative)
    expect(offenders).toEqual([])
  })
})
