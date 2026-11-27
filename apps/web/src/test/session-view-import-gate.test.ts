/**
 * The import gate of Phase 5 (session architecture §7 Phase 5c): no screen
 * under `src/components/practice`, `src/app/practice` or `src/hooks` reads an
 * arithmetic part's slots or the legacy encoding of the plan's cursor
 * (`slots`, `currentSlotIndex`, `retryState`). Screens read the session
 * report for counts and position, and ask the arithmetic kind's views
 * (`lib/curriculum/parts/arithmetic/{session-view,result-view}.ts`) for what
 * only arithmetic has.
 *
 * It catches property reads, not only imports: `x.slots`, `x?.slots`,
 * `x['slots']`, destructuring (`const { slots } = part`, `function f({ slots })`)
 * and destructuring assignment (`({ slots } = part)`). Writing such a
 * property in an object literal (`{ currentSlotIndex: 0 }`) is not a read. A
 * computed key (`x[key]`) cannot be told statically and is not caught.
 *
 * Exempt: tests and stories, and `SessionProgressIndicator.tsx` (the dots
 * read a part's slots to draw one dot per slot, §10 P5b-10). Outside these
 * directories the arithmetic kind's own files and the normalizer read slots
 * by design.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const GATED_DIRS = ['components/practice', 'app/practice', 'hooks']
const GATED_NAMES = new Set(['slots', 'retryState', 'currentSlotIndex'])
const EXEMPT_FILES = new Set(['components/practice/SessionProgressIndicator.tsx'])

function isExempt(relative: string): boolean {
  return (
    EXEMPT_FILES.has(relative) ||
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
      // `({ slots } = part)` / `({ slots: s } = part)` reads `part.slots`
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

describe('Phase 5 import gate: screens read no slots or legacy cursor', () => {
  it('catches every form of a read (the gate fails on a planted read)', () => {
    const planted = [
      'const n = part.slots.length',
      'const n = plan.parts[0]?.slots?.length',
      "const s = part['slots']",
      'const { retryState } = plan',
      'const { currentSlotIndex: slot } = plan',
      'function f({ slots }: SessionPart) { return slots }',
      'const i = data.currentSlotIndex',
      ';({ slots } = part)',
      ';({ retryState: r } = plan)',
      ';[{ currentSlotIndex: c }] = [plan]',
    ].join('\n')
    expect(gatedReads('planted.tsx', planted)).toEqual([
      '1:slots',
      '2:slots',
      '3:slots',
      '4:retryState',
      '5:currentSlotIndex',
      '6:slots',
      '7:currentSlotIndex',
      '8:slots',
      '9:retryState',
      '10:currentSlotIndex',
    ])
  })

  it('does not count writes, unrelated names or a local variable', () => {
    const fine = [
      'const event = { currentSlotIndex: 0, slots: [] }',
      'const slots = arithmeticSlotsOf(part)',
      'const n = slots.length',
      'const retryState = useArcadeSession()',
      'const x = part.slotsTotal',
      'const write = { slots: [], retryState: null }',
      'const k = "slots"; const dynamic = part[k]',
    ].join('\n')
    expect(gatedReads('fine.ts', fine)).toEqual([])
  })

  it('no gated file reads `slots`, `currentSlotIndex` or `retryState`', () => {
    const offenders: string[] = []
    let scanned = 0
    for (const dir of GATED_DIRS) {
      for (const file of sourceFiles(path.join(SRC, dir))) {
        const relative = path.relative(SRC, file).split(path.sep).join('/')
        if (isExempt(relative)) continue
        scanned++
        const hits = gatedReads(file, fs.readFileSync(file, 'utf8'))
        if (hits.length > 0) offenders.push(`${relative} ${hits.join(' ')}`)
      }
    }
    expect(scanned).toBeGreaterThan(100)
    expect(offenders).toEqual([])
  })
})
