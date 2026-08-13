#!/usr/bin/env node
/**
 * Extracts the handful of Bravura glyph outlines the music-flashcard renderers
 * need into `src/components/music/smuflGlyphs.ts`.
 *
 * Why extract instead of shipping the font: the two renderers need three glyphs.
 * Bravura is 513 KB as OTF / 247 KB as WOFF2, and the PDF route would have to
 * embed a subset into every generated file. Three outlines cost ~4 KB of source
 * and nothing at runtime — no font loading, no FOUT, no jsPDF font embedding,
 * and the PDF and the on-screen SVG draw from the same numbers so they cannot
 * drift apart.
 *
 * Run this only when the glyph set changes:
 *
 *   cd apps/web
 *   npm i --prefix node_modules/.cache/smufl-extract opentype.js @vexflow-fonts/bravura
 *   node scripts/extract-smufl-glyphs.mjs
 *
 * The install goes to a scratch prefix rather than the workspace on purpose:
 * these are needed for one command that runs about once a year, and pnpm's
 * workspace protocol makes `npm i` inside apps/web fail outright. Nothing in
 * package.json or the lockfile changes, and `node_modules/.cache` is already
 * ignored.
 *
 * Bravura is (c) Steinberg Media Technologies GmbH, SIL Open Font License 1.1,
 * which permits extracting and redistributing outlines with attribution. The
 * generated file carries that attribution.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = path.join(HERE, '..')
const OUT = path.join(WEB_ROOT, 'src', 'components', 'music', 'smuflGlyphs.ts')
const SCRATCH = path.join(WEB_ROOT, 'node_modules', '.cache', 'smufl-extract')

// Resolve from the scratch prefix first, then from the workspace, so the script
// works whichever way the two packages happen to be available.
const require = createRequire(path.join(SCRATCH, 'noop.js'))
const requireWorkspace = createRequire(path.join(WEB_ROOT, 'noop.js'))

function load(id) {
  for (const req of [require, requireWorkspace]) {
    try {
      return { value: req(id), resolve: (sub) => req.resolve(sub) }
    } catch {}
  }
  console.error(
    `\nMissing build-only dependency: ${id}\n\n` +
      `This script is not part of the build, so its dependencies are not kept in\n` +
      `package.json. Install them into the scratch prefix:\n\n` +
      `  npm i --prefix ${path.relative(process.cwd(), SCRATCH)} opentype.js @vexflow-fonts/bravura\n`
  )
  process.exit(1)
}

const opentype = load('opentype.js').value
const bravura = load('@vexflow-fonts/bravura/metadata.json')
const metadata = bravura.value
const otfPath = bravura.resolve('@vexflow-fonts/bravura/bravura.otf')
if (!existsSync(otfPath)) throw new Error(`bravura.otf not found at ${otfPath}`)

const buf = readFileSync(otfPath)
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

/**
 * SMuFL fonts are drawn on a 4-staff-space em, so asking opentype for the path
 * at fontSize 4 yields coordinates where 1 unit == 1 staff space. opentype
 * returns y-down (screen/PDF convention); SMuFL metadata is y-up, so the two
 * are reconciled below.
 */
const STAFF_SPACES_PER_EM = 4
const round = (n) => Number(n.toFixed(4))

/**
 * `originPosition` is the staff position (0 = bottom line, 8 = top line) that
 * the glyph's origin sits on. It is a property of the glyph's design, not of
 * any particular staff: a G clef is *defined* as the glyph whose origin marks
 * the G line, which is why it can be placed with no magic offsets.
 */
const GLYPHS = [
  { smuflName: 'gClef', codepoint: 0xe050, originPosition: 2, note: 'origin on the G line' },
  { smuflName: 'fClef', codepoint: 0xe062, originPosition: 6, note: 'origin on the F line' },
  {
    smuflName: 'noteheadBlack',
    codepoint: 0xe0a4,
    originPosition: null,
    note: 'origin at the left edge, centred on the note’s own position',
    anchors: ['stemUpSE', 'stemDownNW'],
  },
]

const extracted = GLYPHS.map((spec) => {
  const glyph = font.charToGlyph(String.fromCodePoint(spec.codepoint))
  if (!glyph || glyph.index === 0) {
    throw new Error(`${spec.smuflName}: U+${spec.codepoint.toString(16)} is not in the font`)
  }

  const commands = glyph.getPath(0, 0, STAFF_SPACES_PER_EM).commands.map((c) => {
    if (c.type === 'M' || c.type === 'L') return { t: c.type, x: round(c.x), y: round(c.y) }
    if (c.type === 'C') {
      return {
        t: 'C',
        x1: round(c.x1),
        y1: round(c.y1),
        x2: round(c.x2),
        y2: round(c.y2),
        x: round(c.x),
        y: round(c.y),
      }
    }
    if (c.type === 'Q') {
      throw new Error(
        `${spec.smuflName}: quadratic curve found. The renderers only walk M/L/C/Z; ` +
          `add a Q case to traceGlyph before regenerating.`
      )
    }
    if (c.type === 'Z') return { t: 'Z' }
    throw new Error(`${spec.smuflName}: unhandled command ${c.type}`)
  })

  // Bounds straight off the emitted commands, so the numbers callers position
  // by are the numbers that actually get drawn.
  let left = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY
  for (const c of commands) {
    for (const [x, y] of [
      [c.x, c.y],
      [c.x1, c.y1],
      [c.x2, c.y2],
    ]) {
      if (x === undefined || y === undefined) continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }

  // Cross-check against the font's own metadata. This is the guard that catches
  // a wrong em scale or a y-flip: control points make the computed box slightly
  // larger than the true one, never smaller, so a loose upper bound is correct.
  const meta = metadata.glyphBBoxes[spec.smuflName]
  if (meta) {
    const expected = {
      left: meta.bBoxSW[0],
      right: meta.bBoxNE[0],
      top: -meta.bBoxNE[1], // y-up metadata -> y-down path
      bottom: -meta.bBoxSW[1],
    }
    for (const [key, want] of Object.entries(expected)) {
      const got = { left, right, top, bottom }[key]
      if (Math.abs(got - want) > 0.25) {
        throw new Error(
          `${spec.smuflName}: ${key} bound is ${got.toFixed(3)}, metadata says ` +
            `${want.toFixed(3)}. The em scale or the y direction is wrong.`
        )
      }
    }
  }

  const anchors = {}
  for (const name of spec.anchors ?? []) {
    const a = metadata.glyphsWithAnchors[spec.smuflName]?.[name]
    if (!a) throw new Error(`${spec.smuflName}: missing anchor ${name}`)
    anchors[name] = [round(a[0]), round(-a[1])] // y-up metadata -> y-down path
  }

  return { ...spec, commands, bbox: { left, right, top, bottom }, anchors }
})

const fmt = (c) => {
  if (c.t === 'Z') return `{ t: 'Z' }`
  if (c.t === 'C') {
    return `{ t: 'C', x1: ${c.x1}, y1: ${c.y1}, x2: ${c.x2}, y2: ${c.y2}, x: ${c.x}, y: ${c.y} }`
  }
  return `{ t: '${c.t}', x: ${c.x}, y: ${c.y} }`
}

const entries = extracted
  .map((g) => {
    const anchorKeys = Object.keys(g.anchors)
    const anchorSrc = anchorKeys.length
      ? `\n    anchors: {\n${anchorKeys
          .map((k) => `      ${k}: [${g.anchors[k][0]}, ${g.anchors[k][1]}],`)
          .join('\n')}\n    },`
      : ''
    return `  // ${g.smuflName} (U+${g.codepoint
      .toString(16)
      .toUpperCase()}) — ${g.note}\n  ${g.smuflName}: {
    smuflName: '${g.smuflName}',
    codepoint: 0x${g.codepoint.toString(16)},
    originPosition: ${g.originPosition},
    bbox: { left: ${round(g.bbox.left)}, right: ${round(g.bbox.right)}, top: ${round(
      g.bbox.top
    )}, bottom: ${round(g.bbox.bottom)} },${anchorSrc}
    commands: [
${g.commands.map((c) => `      ${fmt(c)},`).join('\n')}
    ],
  },`
  })
  .join('\n')

const source = `/**
 * Bravura glyph outlines in staff-space units — GENERATED FILE, DO NOT EDIT.
 *
 * Regenerate with \`node scripts/extract-smufl-glyphs.mjs\` (see that script for
 * the temporary install it needs). Hand edits are lost on the next run.
 *
 * Coordinates are in staff spaces with y increasing DOWNWARD, matching both SVG
 * and jsPDF. That means a caller only has to supply an origin and a scale — no
 * per-glyph fudge factors — and the PDF and the on-screen staff render the same
 * shapes from the same numbers. Note that SMuFL's own metadata is y-UP; the
 * extraction script flips it, so everything in this file is already y-down.
 *
 * Bravura © Steinberg Media Technologies GmbH, licensed under the SIL Open Font
 * License 1.1 (https://scripts.sil.org/OFL), which permits redistributing
 * extracted outlines with attribution. Font version ${metadata.fontVersion}.
 */

export type GlyphCommand =
  | { t: 'M'; x: number; y: number }
  | { t: 'L'; x: number; y: number }
  | { t: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { t: 'Z' }

export interface SmuflGlyph {
  smuflName: string
  codepoint: number
  /**
   * Staff position (0 = bottom line, 8 = top line) that the glyph origin sits
   * on, or null for glyphs positioned by the note they belong to.
   */
  originPosition: number | null
  /** Extent in staff spaces relative to the origin; \`top\` < \`bottom\` (y-down). */
  bbox: { left: number; right: number; top: number; bottom: number }
  /** SMuFL attachment points in staff spaces, y-down, relative to the origin. */
  anchors?: Record<string, readonly [number, number]>
  commands: readonly GlyphCommand[]
}

/**
 * Engraving constants from Bravura's own metadata, in staff spaces. Using these
 * keeps stems and ledger lines proportioned the way the font expects rather
 * than by eye.
 */
export const ENGRAVING = {
  stemThickness: ${metadata.engravingDefaults.stemThickness},
  /** How far a ledger line sticks out past the notehead on each side. */
  legerLineExtension: ${metadata.engravingDefaults.legerLineExtension},
  /** Conventional stem length for a note inside the staff. */
  stemLength: 3.5,
} as const

export const SMUFL_GLYPHS = {
${entries}
} satisfies Record<string, SmuflGlyph>

export type SmuflGlyphName = keyof typeof SMUFL_GLYPHS
`

writeFileSync(OUT, source)

const bytes = Buffer.byteLength(source)
console.log(`wrote ${path.relative(process.cwd(), OUT)} (${(bytes / 1024).toFixed(1)} KB)`)
for (const g of extracted) {
  console.log(
    `  ${g.smuflName.padEnd(14)} ${String(g.commands.length).padStart(3)} commands  ` +
      `bbox x[${g.bbox.left.toFixed(2)}, ${g.bbox.right.toFixed(2)}] ` +
      `y[${g.bbox.top.toFixed(2)}, ${g.bbox.bottom.toFixed(2)}]`
  )
}
