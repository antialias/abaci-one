/**
 * The gate of Phase 6(a) (session architecture §7 Phase 6): nothing outside
 * the normalizer and the writers reads a stored try's legacy fields
 * (`isRetry`, `epochNumber`, `isManualRedo`, `originalSlotIndex`). Readers ask
 * the normalizer (`db/schema/legacy-try-fields.ts`, `normalizeTries`) for a
 * row's kind, round, retry round or item position, which read the same with
 * or without those fields on a stamped row. Phase 6(b) can stop writing them
 * only while this holds.
 *
 * It catches property reads the way the Phase 5 gate does
 * (`session-view-import-gate.test.ts`): `x.epochNumber`, `x?.isRetry`,
 * `x['isManualRedo']`, destructuring (`const { originalSlotIndex } = r`,
 * `function f({ epochNumber })`) and destructuring assignment. Writing such a
 * property in an object literal is not a read; nor is a type's property
 * signature. A computed key (`x[key]`) cannot be told statically.
 *
 * The scan is by name, so files where the same names belong to other records
 * are exempt, each with its reason (`OTHER_RECORDS`): the item on screen and
 * the retry queue (`CurrentPlanItem`, its retry items), the attempt on screen
 * and the submission built from it, the broadcast's retry context, the vision
 * recordings (`vision_problem_videos` has its own columns of these names) and
 * the observer's `ObservedResult.isRetry`. An exempt file is checked to still
 * use one of the names, so an exemption cannot outlive its reason.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const GATED_NAMES = new Set(['isRetry', 'epochNumber', 'isManualRedo', 'originalSlotIndex'])

/** The normalizer and the writers: they read the legacy fields by design */
const NORMALIZER_AND_WRITERS = new Set([
  // the normalizer's only reader of the fields
  'db/schema/legacy-try-fields.ts',
  'db/schema/session-plan-normalize.ts',
  // the legacy-body adapter of the one recorder (practice-kinds K2;
  // recordSlotResult / recordRedoResult before): its resubmit check
  'lib/curriculum/parts/arithmetic/legacy-wire.ts',
])

/** Files where the gated names are fields of other records, not of a stored try */
const OTHER_RECORDS: Record<string, string> = {
  'lib/curriculum/parts/arithmetic/state.ts': 'the current item and the retry queue items',
  'lib/curriculum/parts/arithmetic/server.ts': "the current item's retry round (itemPositionOf)",
  'lib/curriculum/parts/cursor/retry-rounds.ts':
    "the retry queue's entries, stored under the first kind's names (practice-kinds K3)",
  'components/practice/ActiveSession.tsx':
    'the current item, the attempt on screen, the submission built from it',
  'lib/curriculum/parts/arithmetic/browser/useDigitEntry.ts':
    'the attempt on screen (practice-kinds K5a-1: moved from useInteractionPhase.ts)',
  'components/practice/redoReturnTarget.ts': 'the current item',
  'lib/curriculum/parts/arithmetic/browser/RetryTransitionScreen.tsx':
    'its epochNumber prop (the retry round shown; practice-kinds K5a-2: moved from components/practice/)',
  'app/practice/[studentId]/PracticeClient.tsx':
    "the submission's round and the do-over's redoContext",
  'hooks/useSessionBroadcast.ts': "the broadcast's retry context",
  'lib/curriculum/try-wire.ts':
    "the screen's submission: the round it was shown in, sent as the envelope's round (practice-kinds A16)",
  'socket-server.ts': "the vision recorder's problem markers",
  'lib/vision/recording/VisionRecorder.ts': 'vision recording metadata',
  'components/vision/ProblemVideoPlayer.tsx': 'vision_problem_videos rows',
  'components/classroom/SessionObserverModal.tsx': 'vision_problem_videos rows',
  'lib/utils/attempt-tracking.ts': 'vision_problem_videos rows',
  'app/api/curriculum/[playerId]/sessions/[sessionId]/videos/route.ts':
    'vision_problem_videos rows',
  'app/api/curriculum/[playerId]/sessions/[sessionId]/problems/[problemNumber]/video/route.ts':
    'the vision_problem_videos column',
  'app/api/curriculum/[playerId]/sessions/[sessionId]/problems/[problemNumber]/metadata/route.ts':
    'the vision_problem_videos column',
  'db/schema/vision-problem-videos.ts': 'the vision_problem_videos table and its index',
  'components/practice/LiveResultsPanel.tsx':
    "ObservedResult.isRetry (observer-report's view field, from the normalized tries)",
  'components/practice/LiveSessionReportModal.tsx':
    "ObservedResult.isRetry (observer-report's view field, from the normalized tries)",
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

/** The gated reads in one source file, as `line:name`. */
function gatedReads(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )
  const hits: string[] = []
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
      hits.push(`${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}:${name}`)
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

function relativeOf(file: string): string {
  return path.relative(SRC, file).split(path.sep).join('/')
}

describe('Phase 6(a) gate: only the normalizer and the writers read the legacy try fields', () => {
  it('catches every form of a read (the gate fails on a planted read)', () => {
    const planted = [
      'const r = result.isRetry',
      'const e = plan.results[0]?.epochNumber ?? 0',
      "const m = row['isManualRedo']",
      'const { originalSlotIndex } = result',
      'const { epochNumber: epoch } = result',
      'function f({ isRetry }: SlotResult) { return isRetry }',
      ';({ isManualRedo } = result)',
      ';[{ originalSlotIndex: o }] = [result]',
    ].join('\n')
    expect(gatedReads('planted.tsx', planted)).toEqual([
      '1:isRetry',
      '2:epochNumber',
      '3:isManualRedo',
      '4:originalSlotIndex',
      '5:epochNumber',
      '6:isRetry',
      '7:isManualRedo',
      '8:originalSlotIndex',
    ])
  })

  it('does not count writes, type members, unrelated names or a local variable', () => {
    const fine = [
      'const row = { isRetry: false, epochNumber: 0, isManualRedo: true, originalSlotIndex: 2 }',
      'interface T { epochNumber?: number; isRetry: boolean }',
      'type P = Pick<SlotResult, "epochNumber" | "isRetry">',
      'const isRetry = move.timestamp === last',
      'const epochNumber = retryRoundOfRow(result)',
      'const x = state.isRetrying',
      'const k = "epochNumber"; const dynamic = result[k]',
    ].join('\n')
    expect(gatedReads('fine.ts', fine)).toEqual([])
  })

  it('no file outside the normalizer, the writers and tests reads them', () => {
    const offenders: string[] = []
    let scanned = 0
    for (const file of sourceFiles(SRC)) {
      const relative = relativeOf(file)
      if (isTestFile(relative) || NORMALIZER_AND_WRITERS.has(relative)) continue
      if (relative in OTHER_RECORDS) continue
      scanned++
      const hits = gatedReads(file, fs.readFileSync(file, 'utf8'))
      if (hits.length > 0) offenders.push(`${relative} ${hits.join(' ')}`)
    }
    expect(scanned).toBeGreaterThan(1000)
    expect(offenders).toEqual([])
  })

  it('every exemption still has its reason (a file that no longer uses the names leaves the list)', () => {
    const stale = Object.keys(OTHER_RECORDS).filter((relative) => {
      const file = path.join(SRC, relative)
      return !fs.existsSync(file) || gatedReads(file, fs.readFileSync(file, 'utf8')).length === 0
    })
    expect(stale).toEqual([])
  })
})
