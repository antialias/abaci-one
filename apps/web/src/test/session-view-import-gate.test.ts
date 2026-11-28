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
 *
 * Practice kinds K4 (plan of record §4 K4) adds the kind-blind gate: the
 * session shell (`components/practice/session/`, K5), the flow machine, the
 * report, the recorder, the composer (`lib/curriculum/compose/`, K6a) and the
 * curriculum API read none of arithmetic's try fields either (`problem`,
 * `studentAnswer`, `skillsExercised`, `usedOnScreenAbacus`, `terms`), nor the
 * names above. A path that does not exist yet is listed with the phase that
 * makes it, so it is gated the day it appears; an exemption is listed with
 * its reason and must still read a gated name, so the list only shrinks.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const GATED_DIRS = [
  'components/practice',
  'app/practice',
  'hooks',
  // arithmetic's views, moved out of components/practice in K5a-2, keep the gate they had
  'lib/curriculum/parts/arithmetic/browser',
]
const GATED_NAMES = new Set(['slots', 'retryState', 'currentSlotIndex'])
const EXEMPT_FILES = new Set(['components/practice/SessionProgressIndicator.tsx'])

/** Arithmetic's try fields, which kind-blind code reads only through the kind (K4). */
const TRY_FIELD_NAMES = [
  'problem',
  'studentAnswer',
  'skillsExercised',
  'usedOnScreenAbacus',
  'terms',
]
const KIND_BLIND_NAMES = new Set([...GATED_NAMES, ...TRY_FIELD_NAMES])
const KIND_BLIND_PATHS = [
  'components/practice/session',
  'lib/curriculum/session-flow.ts',
  'lib/curriculum/session-report.ts',
  'lib/curriculum/record-try.ts',
  // the glitch record (K5a-3c R1, §8 A23.3); its route is under app/api/curriculum
  'lib/curriculum/glitches.ts',
  'lib/curriculum/compose',
  'app/api/curriculum',
]
/** Gated paths not written yet, by the phase that writes them. */
const NOT_YET: Record<string, string> = {
  'lib/curriculum/compose': 'K6a (the composer)',
}
/**
 * Kind-blind files that read a gated name today, each with why (§8 A16). The
 * gate asserts each still does, so a fixed one leaves the list.
 */
const KIND_BLIND_EXEMPT: Record<string, string> = {
  'app/api/curriculum/[playerId]/attachments/[attachmentId]/approve/route.ts':
    "worksheet approval keeps its own writer (R16); its response names the worksheet's skills",
}

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
function gatedReads(
  fileName: string,
  source: string,
  names: ReadonlySet<string> = GATED_NAMES
): string[] {
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
    if (name && names.has(name)) {
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

/** The files of a gated path (a file or a directory), relative to `src`, tests and stories left out. */
function gatedFilesOf(gated: string): string[] {
  const full = path.join(SRC, gated)
  const files = fs.statSync(full).isDirectory() ? sourceFiles(full) : [full]
  return files
    .map((file) => path.relative(SRC, file).split(path.sep).join('/'))
    .filter((relative) => !isExempt(relative))
}

describe('K4 kind-blind gate: no arithmetic try field outside the kind', () => {
  it("catches arithmetic's try fields (the gate fails on a planted read)", () => {
    const planted = [
      'const a = row.studentAnswer',
      'const { problem } = row',
      "const s = row['skillsExercised']",
      'const t = row.problem?.terms',
      'const u = r.usedOnScreenAbacus',
      'const n = part.slots.length',
    ].join('\n')
    expect(gatedReads('planted.ts', planted, KIND_BLIND_NAMES)).toEqual([
      '1:studentAnswer',
      '2:problem',
      '3:skillsExercised',
      '4:terms',
      '4:problem',
      '5:usedOnScreenAbacus',
      '6:slots',
    ])
  })

  it('every gated path exists unless its phase is still to come', () => {
    for (const gated of KIND_BLIND_PATHS) {
      expect(fs.existsSync(path.join(SRC, gated)), `${gated} (${NOT_YET[gated] ?? 'exists'})`).toBe(
        !(gated in NOT_YET)
      )
    }
  })

  it('no kind-blind file reads a try field or a slot, but the listed exemptions', () => {
    const offenders: string[] = []
    const exemptHits: Record<string, string[]> = {}
    let scanned = 0
    for (const gated of KIND_BLIND_PATHS) {
      if (gated in NOT_YET) continue
      for (const relative of gatedFilesOf(gated)) {
        scanned++
        const hits = gatedReads(
          relative,
          fs.readFileSync(path.join(SRC, relative), 'utf8'),
          KIND_BLIND_NAMES
        )
        if (relative in KIND_BLIND_EXEMPT) exemptHits[relative] = hits
        else if (hits.length > 0) offenders.push(`${relative} ${hits.join(' ')}`)
      }
    }
    expect(scanned).toBeGreaterThan(30)
    expect(offenders).toEqual([])
    // Each exemption is a file the gate reads and that still reads a gated name
    for (const exempt of Object.keys(KIND_BLIND_EXEMPT)) {
      expect(exemptHits[exempt], `${exempt}: drop it from KIND_BLIND_EXEMPT`).toEqual(
        expect.arrayContaining([expect.any(String)])
      )
    }
  })
})
