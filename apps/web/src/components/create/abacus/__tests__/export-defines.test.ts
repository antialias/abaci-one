import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defaultParams,
  type ExportPass,
  exportDefines,
  INSPECT_PARTS,
  MODULE_PASSES,
  type Params,
} from '../abacus-model'

// The define strings the export path hands the OpenSCAD worker. This file exists
// because `-Dplug_group` is the one define whose ABSENCE fails silently: the
// scad defaults plug_group to −1 = "render every token", so a typo'd or dropped
// name yields N successful renders that each contain the WHOLE inlay. The 3MF
// then ships N overlapping copies of all the text on N extruders — plausible in
// the slicer, wrong on the plate. Nothing else in CI can catch that (no headless
// OpenSCAD exists in this repo), so the strings are pinned here.

const only = (defs: string[]): string[] => defs.filter((d) => d.startsWith('-Donly='))
const plugGroup = (defs: string[]): string[] => defs.filter((d) => d.startsWith('-Dplug_group='))

describe('exportDefines', () => {
  it('whole-abacus export sends no part-pass define at all', () => {
    const defs = exportDefines(defaultParams)
    expect(only(defs)).toEqual([])
    expect(plugGroup(defs)).toEqual([])
  })

  it('marker and feet passes select the part, and never carry a plug group', () => {
    for (const pass of ['marker_black', 'marker_white', 'feet'] as const) {
      const defs = exportDefines(defaultParams, { only: pass })
      expect(only(defs)).toEqual([`-Donly="${pass}"`])
      expect(plugGroup(defs)).toEqual([])
    }
  })

  it('every text pass carries its color group — the whole point of the split', () => {
    for (const name of ['text_plugs', 'module_left_text', 'module_right_text'] as const) {
      for (let g = 0; g < 5; g++) {
        const defs = exportDefines(defaultParams, { only: name, group: g })
        expect(only(defs)).toEqual([`-Donly="${name}"`])
        expect(plugGroup(defs)).toEqual([`-Dplug_group=${g}`])
      }
    }
  })

  it('two text groups differ ONLY in plug_group (same design, same geometry)', () => {
    const a = exportDefines(defaultParams, { only: 'text_plugs', group: 0 })
    const b = exportDefines(defaultParams, { only: 'text_plugs', group: 3 })
    expect(a).toHaveLength(b.length)
    expect(a.filter((d) => !d.startsWith('-Dplug_group='))).toEqual(
      b.filter((d) => !d.startsWith('-Dplug_group='))
    )
  })

  it('every pass still carries the full design — a part pass is a FILTER, not a fresh model', () => {
    // The part passes re-derive the same geometry, so they must see the same
    // knobs; a pass that dropped e.g. scale_factor would render plugs that no
    // longer line up with the frame's pockets.
    const base = exportDefines(defaultParams)
    for (const defs of [
      exportDefines(defaultParams, { only: 'marker_black' }),
      exportDefines(defaultParams, { only: 'feet' }),
      exportDefines(defaultParams, { only: 'text_plugs', group: 2 }),
    ]) {
      for (const d of base) expect(defs).toContain(d)
    }
  })

  it('carries the text knobs the group filter depends on (text_fill drives tok_group)', () => {
    const p: Params = { ...defaultParams, text_fill: 'single', text_color: '#abcdef' }
    const defs = exportDefines(p, { only: 'text_plugs', group: 0 })
    expect(defs).toContain('-Dtext_fill="single"')
    expect(defs).toContain('-Dtext_color="#abcdef"')
    expect(defs).toContain('-Dtext_mode="inset"')
  })
})

// The `only=` vocabulary lives in two places — this module's types and the
// .scad's dispatch chain — and the two can only be kept in step by hand. A name
// that exists on one side and not the other fails SILENTLY in the same family as
// the plug_group bug above: the scad's if/else chain ends in a bare `else` that
// renders the WHOLE abacus, so an unrecognised `-Donly="bead"` doesn't error, it
// quietly ships the entire model where one bead was asked for. That is exactly
// what would happen to a 3MF body if an export pass were renamed on one side.
//
// `Record<ExportPass['only'], true>` is load-bearing: adding a variant to the
// ExportPass union makes this object a COMPILE error until it's listed, so the
// set below can't silently fall behind the type.
const EXPORT_ONLY: Record<ExportPass['only'], true> = {
  marker_black: true,
  marker_white: true,
  text_plugs: true,
  module_left_text: true,
  module_right_text: true,
  feet: true,
}
const SCAD = join(process.cwd(), 'public/scad/abacus.scad')

describe('the only= vocabulary matches abacus.scad', () => {
  // Scrape ONLY the dispatch chain (everything after the assemble marker).
  // `only ==` also appears above it in predicates — e.g. sc_active gates the
  // scale-dependent seam asserts so mono renders at small scale_factor don't
  // trip them — and those are not dispatch branches.
  const src = readFileSync(SCAD, 'utf8')
  const assembleAt = src.indexOf('===== assemble =====')
  if (assembleAt === -1) throw new Error('assemble marker missing from abacus.scad — dispatch scrape is unanchored')
  const dispatched = [...src.slice(assembleAt).matchAll(/\bonly\s*==\s*"([^"]+)"/g)].map(
    (m) => m[1]
  )

  it('every TS pass name is dispatched by the scad, and vice versa', () => {
    const ts = [...Object.keys(EXPORT_ONLY), ...INSPECT_PARTS, ...MODULE_PASSES].sort()
    expect([...new Set(dispatched)].sort()).toEqual(ts)
  })

  it('no name is dispatched twice — a duplicate branch is dead code', () => {
    expect(dispatched).toHaveLength(new Set(dispatched).size)
  })

  it('the three pass vocabularies are pairwise disjoint', () => {
    // All three ride the same `-Donly=` define, so any collision would make two
    // different kinds of render — a filament body, a bench slice, a module kit
    // piece — indistinguishable at the wire.
    expect(INSPECT_PARTS.filter((p) => p in EXPORT_ONLY)).toEqual([])
    expect(MODULE_PASSES.filter((p) => p in EXPORT_ONLY)).toEqual([])
    const inspect = new Set<string>(INSPECT_PARTS)
    expect(MODULE_PASSES.filter((p) => inspect.has(p))).toEqual([])
  })
})
