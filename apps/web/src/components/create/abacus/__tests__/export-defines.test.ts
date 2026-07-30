import { describe, expect, it } from 'vitest'
import { defaultParams, exportDefines, type Params } from '../abacus-model'

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

  it('the text pass carries its color group — the whole point of the split', () => {
    for (let g = 0; g < 5; g++) {
      const defs = exportDefines(defaultParams, { only: 'text_plugs', group: g })
      expect(only(defs)).toEqual(['-Donly="text_plugs"'])
      expect(plugGroup(defs)).toEqual([`-Dplug_group=${g}`])
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
