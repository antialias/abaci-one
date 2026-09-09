// theme-guard — the studio has ONE source of colour and type (theme.ts, Gitea
// #43). This test reads the studio's source files and fails on any colour
// literal or off-scale font size outside it, with file:line, so the next
// "just this one rgba" is caught by CI rather than by the next design pass.
//
// Allow-list, per line — the tag must be the line's TRAILING comment:
//   - `// three.js` marks a hex that feeds a three.js material (scene colours
//     are not CSS and have no business in theme.ts)
//   - `// theme-guard: allow — <reason>` for anything else; the reason is
//     mandatory (≥ 8 characters) so the exemption explains itself
// Comment lines and block comments are skipped so issue numbers like
// "Gitea #43" never trip the hex rule.
//
// Stylesheets ARE scanned (a second `.module.css` must not become a back
// door); the one in ALLOWED_CSS is exempt because a stylesheet cannot import
// theme.ts and carries the theme's values by copy.
//
// Known gap, by design: colour VALUES that arrive at runtime — filament hexes,
// palette entries, the ink pairs `pickerInk()` derives in abacus-model.ts —
// are data, not chrome, and are not what this guard is for.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const components = join(here, '..', '..')
const src = join(components, '..')
const studioDir = join(components, 'studio')
const abacusDir = join(components, 'create', 'abacus')

const SWEPT_ABACUS_FILES = [
  'AbacusMarkerSheet.tsx',
  'AbacusStudioViewer.tsx',
  'ConstructionControl.tsx',
  'DesignInspectorRail.tsx',
  'DesignLinkChip.tsx',
  'DesignShareToggle.tsx',
  'FabricationErrorBoundary.tsx',
  'FabricationRail.tsx',
  'FabricationSwitch.tsx',
  'FilamentPlanPanel.tsx',
  'InfillControls.tsx',
  'JobNotices.tsx',
  'KitPlatePreview.tsx',
  'ModularSeamPanel.tsx',
  'MyDesignsList.tsx',
  'ParkedJobCard.tsx',
  'PrintCommitmentCard.tsx',
  'PrintConnectionsManager.tsx',
  'PrintDecision.tsx',
  'PrintPanel.tsx',
  'PrintSubmitErrorNotice.tsx',
  'StageAPrepCard.tsx',
  'TwoStageHandoffCard.tsx',
]

/** files outside the two component directories that still paint studio chrome */
const EXTRA_FILES = [join(src, 'app', 'create', 'abacus', 'page.tsx')]

/** stylesheets that carry theme values by copy (see header) */
const ALLOWED_CSS = ['FilamentPlanPanel.module.css']

function studioSources(): string[] {
  return readdirSync(studioDir)
    .filter((f) => /\.tsx?$/.test(f) && f !== 'theme.ts')
    .map((f) => join(studioDir, f))
}

function stylesheets(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.css') && !ALLOWED_CSS.includes(f))
    .map((f) => join(dir, f))
}

const files = [
  ...studioSources(),
  ...SWEPT_ABACUS_FILES.map((f) => join(abacusDir, f)),
  ...EXTRA_FILES,
  ...stylesheets(studioDir),
  ...stylesheets(abacusDir),
]

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/
const FUNC = /\b(?:rgba?|hsla?)\(/
// 13 / 12 / 11 / 10 only (+ the heading's 14, which arrives via STUDIO.type.heading).
// Matches `fontSize: 9,` / `fontSize: '14px'` / `fontSize={8.5}`. Panda size
// tokens (`fontSize: 'sm'`) are the paper canvas's light scale and are not
// studio chrome — see AbacusMarkerSheet.
const OFF_SCALE_SIZE =
  /fontSize(?::\s*(?:'|")?|=\{)(?:8|8\.5|9|9\.5|10\.5|14|15|16)(?:px)?(?:'|")?\s*[,}]/
const ALLOW_TAG = /\/\/\s*(?:three\.js|theme-guard: allow\s*[—-]\s*\S.{7,})\s*$/

function offending(file: string, rule: RegExp): string[] {
  const hits: string[] = []
  const lines = readFileSync(file, 'utf8').split('\n')
  let inBlock = false // inside a /* … */ (or {/* … */}) that spans lines
  lines.forEach((raw, i) => {
    const t = raw.trim()
    if (inBlock) {
      if (t.includes('*/')) inBlock = false
      return
    }
    if (t.startsWith('//') || t.startsWith('*')) return
    if (t.startsWith('/*') || t.startsWith('{/*')) {
      if (!t.includes('*/')) inBlock = true
      return
    }
    if (ALLOW_TAG.test(raw)) return
    const code = raw
      .replace(/\/\/.*$/, '')
      .replace(/\{\/\*.*?\*\/\}/g, '')
      .replace(/\/\*.*?\*\//g, '')
    if (rule.test(code)) hits.push(`${relative(src, file)}:${i + 1}: ${t.slice(0, 100)}`)
  })
  return hits
}

describe('studio theme guard', () => {
  it('scans every swept file (none has gone missing)', () => {
    for (const f of files) expect(() => readFileSync(f)).not.toThrow()
  })

  it('has no colour literal outside theme.ts', () => {
    const hits = files.flatMap((f) => [...offending(f, HEX), ...offending(f, FUNC)])
    expect(hits, `colour literals — move them to studio/theme.ts:\n${hits.join('\n')}`).toEqual([])
  })

  it('uses only the 13/12/11/10 type scale', () => {
    const hits = files.flatMap((f) => offending(f, OFF_SCALE_SIZE))
    expect(hits, `off-scale font sizes:\n${hits.join('\n')}`).toEqual([])
  })

  it('borrows no debug-panel control', () => {
    const hits = files.flatMap((f) =>
      offending(f, /from '@\/components\/toys\/ToyDebugPanel'|\bDebug(?:Slider|Checkbox|Color)\b/)
    )
    expect(hits, `debug-panel controls in the studio:\n${hits.join('\n')}`).toEqual([])
  })

  it('requires a reason on every allow tag', () => {
    // a bare `// theme-guard: allow` must NOT exempt the line
    expect(ALLOW_TAG.test("  color: '#fff', // theme-guard: allow")).toBe(false)
    expect(ALLOW_TAG.test("  color: '#fff', // theme-guard: allow — canvas-2D fillStyle")).toBe(true)
    expect(ALLOW_TAG.test("  const c = '#fff' // three.js")).toBe(true)
    // the tag has to be trailing — text after it means it is not the tag
    expect(ALLOW_TAG.test("  const c = '#fff' // three.js is unrelated: '#000'")).toBe(false)
  })
})
