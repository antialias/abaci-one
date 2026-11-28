/**
 * The kind-folder gates (practice-kinds plan of record §4 K4, S1, S9).
 *
 * 1. **A kind's folder is its own.** No file outside `parts/<kind>/` imports
 *    from it, but the registries and the exemptions listed below, each with
 *    its reason and the phase that removes it. The gate asserts every
 *    exemption still imports the folder, so the list only shrinks and a new
 *    one is a visible diff.
 * 2. **A kind's server half is safe to load anywhere.** `parts/<kind>/server.ts`
 *    reaches no `.tsx` and nothing under `src/db/` at runtime (type-only
 *    imports are erased): the seed-bundle hazard and the client-bundle hazard.
 * 3. **The planner registry is server-only** (from K6a, when
 *    `parts/planner-registry.ts` exists): it and every `parts/<kind>/planner.ts`
 *    carry `import 'server-only'`, and only `generateSessionPlan`'s module,
 *    the `/offers` route and the dev route import the registry. Until the file
 *    exists the gate is inactive; its checker is tested on planted sources.
 *
 * Tests, stories and test fixtures are out of scope: they reach into a kind
 * by design.
 */

import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '..')
const PARTS = 'lib/curriculum/parts'
/** Folders of `parts/` that are not kinds */
const NOT_KINDS = new Set(['cursor', '__tests__'])
/** The registries: the one place a kind is named (`registry.ts`; K5 adds the browser one, K6a the planner one) */
const REGISTRIES = new Set([
  `${PARTS}/registry.ts`,
  `${PARTS}/browser-registry.ts`,
  `${PARTS}/planner-registry.ts`,
])
const PLANNER_REGISTRY = `${PARTS}/planner-registry.ts`
/** Who may import the planner registry (K6a) */
const PLANNER_IMPORTERS = [
  /^lib\/curriculum\/session-planner\.ts$/,
  /^app\/api\/.*\/offers\/route\.ts$/,
  /^app\/api\/debug\/practice-session\/route\.ts$/,
]

/**
 * Files outside a kind's folder that import it today: each with the folder
 * modules it may import (by `src`-relative path, no extension) and why, and
 * when it stops (§8 A16). An exempt file that imports any other folder module
 * fails the gate, as does an exemption whose import is gone.
 */
const A = `${PARTS}/arithmetic`
const FOLDER_EXEMPT: Record<string, { modules: string[]; why: string }> = {
  [`${PARTS}/legacy-wire.ts`]: {
    modules: [`${A}/legacy-wire`],
    why: "the legacy wire's seam: record/record_redo bodies are arithmetic's (retired by an owner decision, K14)",
  },
  'db/schema/session-plan-normalize.ts': {
    modules: [`${A}/server`, `${A}/state`],
    why: "the normalizer derives old rows' envelopes with arithmetic's state and evidence (pre-K1 rows, K14)",
  },
  'db/schema/session-plan-helpers.ts': {
    modules: [`${A}/state`],
    why: "arithmetic's part state of a stored plan (K5 readers)",
  },
  'constants/practiceTypes.ts': {
    modules: [`${A}/presentations`],
    why: "K3's view over arithmetic's presentations (K6a's composer)",
  },
  'app/api/classrooms/[classroomId]/presence/active-sessions/route.ts': {
    modules: [`${A}/session-view`],
    why: "the presence list's slot index (K5's observer view)",
  },
  'app/api/curriculum/[playerId]/sessions/plans/[planId]/route.ts': {
    modules: [`${A}/session-view`],
    why: "the plan route's slot index in its broadcast and trace (K5's observer view)",
  },
  'app/practice/[studentId]/PracticeClient.tsx': {
    modules: [`${A}/session-view`],
    why: "arithmetic's session view (K5, the shell)",
  },
  'components/practice/ActiveSession.tsx': {
    modules: [`${A}/session-view`, `${A}/state`],
    why: "arithmetic's session view and state (K5, the shell)",
  },
  'components/practice/AllProblemsSection.tsx': {
    modules: [`${A}/result-view`],
    why: "arithmetic's result view (K5's try cards)",
  },
  'components/practice/BrowseModeView.tsx': {
    modules: [`${A}/result-view`],
    why: "arithmetic's result view (K5's try cards)",
  },
  'components/practice/PartTransitionScreen.tsx': {
    modules: [`${A}/session-view`],
    why: "arithmetic's transition view (K5b)",
  },
  'components/practice/PlanReview.tsx': {
    modules: [`${A}/result-view`],
    why: "arithmetic's slots for the plan review (K5)",
  },
  'components/practice/SessionPlanOverview.tsx': {
    modules: [`${A}/result-view`],
    why: "arithmetic's part overview (K5)",
  },
  'components/practice/hooks/useInteractionPhase.ts': {
    modules: [`${A}/browser/useDigitEntry`],
    why: "the try lifecycle composed with arithmetic's digit entry, for ActiveSession (K5a-1; K5a-3's shell deletes it)",
  },
  'components/practice/redoReturnTarget.ts': {
    modules: [`${A}/state`],
    why: "arithmetic's current problem (K5, the shell)",
  },
  'components/practice/sessionSummaryUtils.ts': {
    modules: [`${A}/result-view`],
    why: "arithmetic's slots for the summary (K5)",
  },
  'hooks/useSessionObserver.ts': {
    modules: [`${A}/result-view`],
    why: "arithmetic's observer dots (K5's observer view)",
  },
}

// ============================================================================
// Reading imports
// ============================================================================

interface ImportRef {
  spec: string
  /** Erased at compile time: `import type`, every name `type`, or `export type … from` */
  typeOnly: boolean
  line: number
}

/** Every module a source file names: static imports and re-exports, `import()`, `require()`. */
function importsOf(fileName: string, source: string): ImportRef[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true)
  const out: ImportRef[] = []
  const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause
      const named = clause?.namedBindings
      const allNamedTypes =
        !!named &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((e) => e.isTypeOnly)
      const typeOnly = !!clause && (clause.isTypeOnly || (!clause.name && allNamedTypes))
      out.push({ spec: node.moduleSpecifier.text, typeOnly, line: lineOf(node) })
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const clause = node.exportClause
      const allTypes =
        !!clause &&
        ts.isNamedExports(clause) &&
        clause.elements.length > 0 &&
        clause.elements.every((e) => e.isTypeOnly)
      out.push({
        spec: node.moduleSpecifier.text,
        typeOnly: node.isTypeOnly || allTypes,
        line: lineOf(node),
      })
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
      out.push({ spec: node.arguments[0].text, typeOnly: false, line: lineOf(node) })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/** The `src`-relative path a specifier names (unresolved), or null for a package. */
function targetOf(fromRelative: string, spec: string): string | null {
  if (spec.startsWith('@/')) return spec.slice(2)
  if (spec.startsWith('.')) {
    return path.posix.normalize(path.posix.join(path.posix.dirname(fromRelative), spec))
  }
  return null
}

/** The file a `src`-relative target resolves to, or null. */
function resolveFile(target: string): string | null {
  const candidates = [
    target,
    `${target}.ts`,
    `${target}.tsx`,
    `${target}/index.ts`,
    `${target}/index.tsx`,
  ]
  for (const c of candidates) {
    const full = path.join(SRC, c)
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return c
  }
  return null
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      sourceFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

const rel = (full: string) => path.relative(SRC, full).split(path.sep).join('/')
const isTestFile = (relative: string) =>
  relative.startsWith('test/') ||
  /(^|\/)__tests__\//.test(relative) ||
  /\.(test|spec|stories)\.tsx?$/.test(relative)

const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8')

function kindFolders(): string[] {
  return fs
    .readdirSync(path.join(SRC, PARTS), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !NOT_KINDS.has(d.name))
    .map((d) => `${PARTS}/${d.name}`)
}

// ============================================================================
// The checks, as functions of sources (so a planted source can fail them)
// ============================================================================

/** The imports of `relative` into a kind folder it is not in, as `line:spec`. */
function folderReach(relative: string, source: string, kinds: string[]): string[] {
  return folderImports(relative, source, kinds).map(({ spec, line }) => `${line}:${spec}`)
}

/** The same imports with the module each names (`src`-relative, no extension). */
function folderImports(relative: string, source: string, kinds: string[]) {
  return importsOf(relative, source)
    .map((i) => ({ ...i, target: targetOf(relative, i.spec) }))
    .filter(
      (i): i is typeof i & { target: string } =>
        i.target !== null &&
        kinds.some(
          (dir) =>
            (i.target === dir || i.target!.startsWith(`${dir}/`)) && !relative.startsWith(`${dir}/`)
        )
    )
    .map((i) => ({ ...i, target: i.target.replace(/\.tsx?$/, '').replace(/\/index$/, '') }))
}

/**
 * What a server half reaches at runtime that it must not: a `.tsx`, or a
 * module under `src/db/`. Follows runtime imports (type-only ones are
 * erased) through `src`; `read` supplies sources so a test can plant one.
 */
function serverHazards(
  entry: string,
  readSource: (relative: string) => string,
  resolve: (target: string) => string | null = resolveFile
): string[] {
  const hazards: string[] = []
  const seen = new Set<string>()
  const walk = (file: string, via: string[]) => {
    if (seen.has(file)) return
    seen.add(file)
    for (const { spec, typeOnly } of importsOf(file, readSource(file))) {
      if (typeOnly) continue
      const target = targetOf(file, spec)
      if (target === null) continue
      const trail = [...via, spec].join(' -> ')
      if (target === 'db' || target.startsWith('db/')) {
        hazards.push(`@/db: ${trail}`)
        continue
      }
      const resolved = resolve(target)
      if (resolved === null) continue
      if (resolved.endsWith('.tsx')) {
        hazards.push(`.tsx: ${trail}`)
        continue
      }
      walk(resolved, [...via, spec])
    }
  }
  walk(entry, [entry])
  return hazards
}

/** What the planner-registry gate finds wrong in a set of sources. */
function plannerRegistryProblems(sources: Record<string, string>): string[] {
  const problems: string[] = []
  const serverOnly = (relative: string) =>
    importsOf(relative, sources[relative]).some((i) => i.spec === 'server-only' && !i.typeOnly)
  const planners = Object.keys(sources).filter((r) =>
    new RegExp(`^${PARTS}/[^/]+/planner\\.ts$`).test(r)
  )
  for (const file of [PLANNER_REGISTRY, ...planners]) {
    if (file in sources && !serverOnly(file)) problems.push(`${file}: no import 'server-only'`)
  }
  for (const [relative, source] of Object.entries(sources)) {
    if (relative === PLANNER_REGISTRY || isTestFile(relative)) continue
    const reaches = importsOf(relative, source).some(({ spec, typeOnly }) => {
      if (typeOnly) return false
      const target = targetOf(relative, spec)
      return target !== null && resolvesTo(target, PLANNER_REGISTRY)
    })
    if (reaches && !PLANNER_IMPORTERS.some((re) => re.test(relative))) {
      problems.push(`${relative}: imports the planner registry`)
    }
  }
  return problems
}

const resolvesTo = (target: string, file: string) =>
  target === file || `${target}.ts` === file || `${target}.tsx` === file

// ============================================================================
// The gates
// ============================================================================

describe('kind-folder gate: a kind folder is imported only by the registries and listed exemptions', () => {
  it('fails on a planted import (relative and aliased, static and dynamic)', () => {
    const kinds = [`${PARTS}/arithmetic`]
    const planted = [
      "import { x } from '@/lib/curriculum/parts/arithmetic/state'",
      "import type { Y } from '../lib/curriculum/parts/arithmetic/session-view'",
      "const m = await import('@/lib/curriculum/parts/arithmetic')",
      "export { z } from '@/lib/curriculum/parts/arithmetic/server'",
      "import { k } from '@/lib/curriculum/parts/kind'",
      "import { c } from '@/lib/curriculum/parts/cursor/retry-rounds'",
    ].join('\n')
    expect(folderReach('hooks/planted.ts', planted, kinds)).toEqual([
      '1:@/lib/curriculum/parts/arithmetic/state',
      '2:../lib/curriculum/parts/arithmetic/session-view',
      '3:@/lib/curriculum/parts/arithmetic',
      '4:@/lib/curriculum/parts/arithmetic/server',
    ])
    // Inside the folder, the folder is its own
    expect(folderReach(`${PARTS}/arithmetic/ui.tsx`, "import { a } from './state'", kinds)).toEqual(
      []
    )
  })

  it('no production file reaches into a kind folder but the registries and the exemptions', () => {
    const kinds = kindFolders()
    expect(kinds).toContain(`${PARTS}/arithmetic`)
    const offenders: string[] = []
    const imported = new Map<string, Set<string>>()
    let scanned = 0
    for (const full of sourceFiles(SRC)) {
      const relative = rel(full)
      if (isTestFile(relative)) continue
      scanned++
      const hits = folderImports(relative, read(relative), kinds)
      if (hits.length === 0 || REGISTRIES.has(relative)) continue
      imported.set(relative, new Set(hits.map((h) => h.target)))
      const allowed = FOLDER_EXEMPT[relative]?.modules ?? []
      for (const hit of hits) {
        if (!allowed.includes(hit.target)) offenders.push(`${relative} ${hit.line}:${hit.spec}`)
      }
    }
    expect(scanned).toBeGreaterThan(500)
    expect(offenders).toEqual([])
    // Each exemption still imports each module it names: a fixed import leaves the list
    const stale = Object.entries(FOLDER_EXEMPT).flatMap(([file, { modules }]) =>
      modules.filter((m) => !imported.get(file)?.has(m)).map((m) => `${file} -> ${m}`)
    )
    expect(stale).toEqual([])
    expect(Object.keys(FOLDER_EXEMPT)).toHaveLength(17)
  })
})

describe('server-half gate: parts/<kind>/server.ts reaches no .tsx and nothing in @/db at runtime', () => {
  it('fails on a planted runtime import, and not on a type-only one', () => {
    const sources: Record<string, string> = {
      'lib/curriculum/parts/planted/server.ts': [
        "import type { SessionPlan } from '@/db/schema/session-plans'",
        "import { type A, type B } from '@/db/schema'",
        "import { helper } from './helper'",
      ].join('\n'),
      'lib/curriculum/parts/planted/helper.ts': [
        "import { db } from '@/db'",
        "import { View } from './view'",
      ].join('\n'),
    }
    const hazards = serverHazards(
      'lib/curriculum/parts/planted/server.ts',
      (r) => sources[r] ?? read(r),
      (target) => (`${target}.ts` in sources ? `${target}.ts` : resolveFile(target))
    )
    expect(hazards).toEqual(['@/db: lib/curriculum/parts/planted/server.ts -> ./helper -> @/db'])
    // A .tsx reached at runtime (arithmetic's own ui.tsx stands in)
    expect(
      serverHazards(`${PARTS}/arithmetic/planted-server.ts`, (r) =>
        r === `${PARTS}/arithmetic/planted-server.ts` ? "import { x } from './ui'" : read(r)
      )
    ).toEqual([`.tsx: ${PARTS}/arithmetic/planted-server.ts -> ./ui`])
  })

  it('every kind server half is clean', () => {
    const servers = kindFolders()
      .map((dir) => `${dir}/server.ts`)
      .filter((f) => fs.existsSync(path.join(SRC, f)))
    expect(servers).toContain(`${PARTS}/arithmetic/server.ts`)
    for (const server of servers) {
      expect(serverHazards(server, read), server).toEqual([])
    }
  })
})

describe('planner-registry gate (K6a): server-only, imported by three modules', () => {
  const PLANTED_REGISTRY = "import 'server-only'\nexport const planners = new Map()"

  it('fails on a planted importer and on a planner without server-only', () => {
    expect(
      plannerRegistryProblems({
        [PLANNER_REGISTRY]: PLANTED_REGISTRY,
        [`${PARTS}/arithmetic/planner.ts`]: 'export const plan = () => []',
        'lib/curriculum/session-planner.ts': "import { planners } from './parts/planner-registry'",
        'app/api/curriculum/[playerId]/offers/route.ts':
          "import { planners } from '@/lib/curriculum/parts/planner-registry'",
        'app/api/debug/practice-session/route.ts':
          "import { planners } from '@/lib/curriculum/parts/planner-registry'",
        'components/practice/Planted.tsx':
          "import { planners } from '@/lib/curriculum/parts/planner-registry'",
        'hooks/typesOnly.ts':
          "import type { Planner } from '@/lib/curriculum/parts/planner-registry'",
      })
    ).toEqual([
      `${PARTS}/arithmetic/planner.ts: no import 'server-only'`,
      'components/practice/Planted.tsx: imports the planner registry',
    ])
  })

  it('holds for the tree (inactive until parts/planner-registry.ts exists)', () => {
    if (!fs.existsSync(path.join(SRC, PLANNER_REGISTRY))) {
      // Before K6a there is no planner, so nothing to gate
      expect(
        kindFolders().filter((dir) => fs.existsSync(path.join(SRC, dir, 'planner.ts')))
      ).toEqual([])
      return
    }
    const sources: Record<string, string> = {}
    for (const full of sourceFiles(SRC)) sources[rel(full)] = fs.readFileSync(full, 'utf8')
    expect(plannerRegistryProblems(sources)).toEqual([])
  })
})
