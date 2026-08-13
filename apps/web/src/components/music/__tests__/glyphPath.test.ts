/**
 * Guards on the shared staff geometry.
 *
 * These are the invariants that were violated while the two renderers each
 * carried their own constants: a clef anchored to the wrong staff line, a
 * notehead with no stem, and glyphs sized without regard for whether they fit
 * the space they were drawn into. None of that is expressible in the types.
 */
import { describe, expect, it } from 'vitest'
import {
  clefExtent,
  clefGlyph,
  fitStaff,
  glyphPathData,
  halfSpaceForWidth,
  ledgerHalfWidth,
  noteExtent,
  placeClef,
  placeNotehead,
  positionY,
  STAFF_EXTENT,
  type StaffMetrics,
  staffSpace,
  stemRect,
  unionExtents,
} from '../glyphPath'
import { ENGRAVING, SMUFL_GLYPHS } from '../smuflGlyphs'

const metrics: StaffMetrics = { staffTop: 100, halfSpace: 5 }

describe('positionY', () => {
  it('counts positions upward from the bottom line', () => {
    expect(positionY(metrics, 8)).toBe(100) // top line
    expect(positionY(metrics, 0)).toBe(140) // bottom line, four spaces down
    expect(positionY(metrics, 4)).toBe(120) // middle line
  })
})

describe('placeClef', () => {
  /**
   * The whole point of the glyph origins: a clef is named for the line it
   * marks. The SVG renderer used to anchor the bass clef to the middle line,
   * which put every bass note a third off.
   */
  it('sits the G clef on the G line and the F clef on the F line', () => {
    expect(placeClef(metrics, 'treble', 0).y).toBe(positionY(metrics, 2))
    expect(placeClef(metrics, 'bass', 0).y).toBe(positionY(metrics, 6))
  })

  it('puts the glyph’s left edge where the caller asked', () => {
    const at = placeClef(metrics, 'treble', 42)
    const left = at.x + clefGlyph('treble').bbox.left * at.scale
    expect(left).toBeCloseTo(42, 6)
  })

  it('scales the outline so one glyph unit is one staff space', () => {
    expect(placeClef(metrics, 'treble', 0).scale).toBe(staffSpace(metrics))
  })
})

describe('clef proportions', () => {
  it('gives the G clef the reach a real one has, straddling its own line', () => {
    const e = clefExtent('treble')
    // ~7 staff spaces tall, i.e. ~14 half-spaces — nearly twice the staff.
    expect(e.top - e.bottom).toBeGreaterThan(13)
    expect(e.top - e.bottom).toBeLessThan(15)
    expect(e.top).toBeGreaterThan(8) // above the top line
    expect(e.bottom).toBeLessThan(0) // below the bottom line
  })

  it('keeps the F clef inside the staff, where it belongs', () => {
    const e = clefExtent('bass')
    expect(e.top).toBeLessThanOrEqual(8.5)
    expect(e.bottom).toBeGreaterThanOrEqual(0)
  })
})

describe('placeNotehead', () => {
  it('centres the head on its position, horizontally and vertically', () => {
    const at = placeNotehead(metrics, 3, 200)
    const g = SMUFL_GLYPHS.noteheadBlack
    expect(at.y).toBe(positionY(metrics, 3))
    const centre = at.x + ((g.bbox.left + g.bbox.right) / 2) * at.scale
    expect(centre).toBeCloseTo(200, 6)
  })
})

describe('stemRect', () => {
  it('flips direction at the middle line', () => {
    const at = (p: number) => stemRect(metrics, p, placeNotehead(metrics, p, 200))
    expect(at(3).direction).toBe('up')
    expect(at(4).direction).toBe('down')
    expect(at(-5).direction).toBe('up')
    expect(at(12).direction).toBe('down')
  })

  it('attaches an up-stem on the right of the head and a down-stem on the left', () => {
    const head = (p: number) => placeNotehead(metrics, p, 200)
    const up = stemRect(metrics, 0, head(0))
    const down = stemRect(metrics, 8, head(8))
    expect(up.x).toBeGreaterThan(200)
    expect(down.x + down.width).toBeLessThan(200)
  })

  it('runs the conventional length away from the notehead', () => {
    const head = placeNotehead(metrics, 0, 200)
    const up = stemRect(metrics, 0, head)
    expect(up.height).toBeCloseTo(ENGRAVING.stemLength * staffSpace(metrics), 6)
    // An up-stem's rectangle ends at the notehead and rises from there.
    expect(up.y + up.height).toBeGreaterThan(positionY(metrics, 0) - staffSpace(metrics))
    expect(up.y).toBeLessThan(positionY(metrics, 0))
  })
})

describe('noteExtent', () => {
  it('accounts for the stem, not just the head', () => {
    const head = 1 // half-spaces the head reaches past its own position
    expect(noteExtent(0).top).toBeGreaterThan(0 + head)
    expect(noteExtent(8).bottom).toBeLessThan(8 - head)
  })
})

describe('fitStaff', () => {
  const cases = [
    { label: 'treble, notes on the staff', clef: 'treble' as const, positions: [0, 4, 8] },
    { label: 'treble, deep ledger lines', clef: 'treble' as const, positions: [-6, 14] },
    { label: 'bass, notes on the staff', clef: 'bass' as const, positions: [0, 8] },
    { label: 'bass, deep ledger lines', clef: 'bass' as const, positions: [-5, 12] },
  ]

  /**
   * The overflow guard. A correctly-proportioned clef is taller than the staff,
   * so a layout scaled to the staff alone pushes it off the page — which is
   * exactly what happened the first time the real glyph went in.
   */
  it.each(cases)('keeps everything inside the box: $label', ({ clef, positions }) => {
    const top = 12
    const availableHeight = 160
    const extent = unionExtents(STAFF_EXTENT, clefExtent(clef), ...positions.map(noteExtent))
    const m = fitStaff({ top, availableHeight, extent })

    // positionY is y-down, so the highest position has the smallest y.
    expect(positionY(m, extent.top)).toBeGreaterThanOrEqual(top - 1e-9)
    expect(positionY(m, extent.bottom)).toBeLessThanOrEqual(top + availableHeight + 1e-9)
  })

  it('centres the drawn content in the space it is given', () => {
    const extent = unionExtents(STAFF_EXTENT, clefExtent('treble'))
    const m = fitStaff({ top: 0, availableHeight: 200, extent })
    const above = positionY(m, extent.top)
    const below = 200 - positionY(m, extent.bottom)
    expect(above).toBeCloseTo(below, 6)
  })

  it('honours an extra cap and never exceeds it', () => {
    const extent = unionExtents(STAFF_EXTENT, clefExtent('treble'))
    const cap = 2
    const m = fitStaff({ top: 0, availableHeight: 1000, extent, maxHalfSpace: [cap] })
    expect(m.halfSpace).toBe(cap)
  })

  it('leaves the note room beside the clef at the width-derived scale', () => {
    const staffWidth = 200
    const m: StaffMetrics = { staffTop: 0, halfSpace: halfSpaceForWidth(staffWidth) }
    const at = placeClef(m, 'treble', 0)
    const clefWidth = clefGlyph('treble').bbox.right * at.scale
    // The clef should take roughly a third of the staff, never more than half.
    expect(clefWidth).toBeLessThan(staffWidth / 2)
  })
})

describe('ledgerHalfWidth', () => {
  it('extends past the notehead by Bravura’s own margin', () => {
    const g = SMUFL_GLYPHS.noteheadBlack
    const headHalf = ((g.bbox.right - g.bbox.left) / 2) * staffSpace(metrics)
    expect(ledgerHalfWidth(metrics) - headHalf).toBeCloseTo(
      ENGRAVING.legerLineExtension * staffSpace(metrics),
      6
    )
  })
})

describe('generated glyph outlines', () => {
  const glyphs = Object.values(SMUFL_GLYPHS).map((g) => [g.smuflName, g] as const)

  /**
   * Every placement helper positions by `bbox`, so if the recorded box and the
   * actual outline disagree the clef silently sits off its line. This is the
   * guard on a bad regeneration.
   */
  it.each(glyphs)('%s: the recorded bbox bounds the actual outline', (_name, glyph) => {
    const xs: number[] = []
    const ys: number[] = []
    // No Z case: Bravura's contours close implicitly, so the extractor emits
    // none. If one ever appears, the narrowed command type makes this fail to
    // compile rather than silently read undefined coordinates.
    for (const c of glyph.commands) {
      xs.push(c.x)
      ys.push(c.y)
      if (c.t === 'C') {
        xs.push(c.x1, c.x2)
        ys.push(c.y1, c.y2)
      }
    }
    // Control points can sit slightly outside the true outline, so the box is
    // an upper bound on the curve, never smaller than the on-curve points.
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(glyph.bbox.left - 1e-6)
    expect(Math.max(...xs)).toBeLessThanOrEqual(glyph.bbox.right + 1e-6)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(glyph.bbox.top - 1e-6)
    expect(Math.max(...ys)).toBeLessThanOrEqual(glyph.bbox.bottom + 1e-6)
    expect(glyph.bbox.right).toBeGreaterThan(glyph.bbox.left)
    expect(glyph.bbox.bottom).toBeGreaterThan(glyph.bbox.top)
  })

  it.each(glyphs)('%s: starts a subpath before drawing into it', (_name, glyph) => {
    expect(glyph.commands[0]?.t).toBe('M')
    expect(glyph.commands.length).toBeGreaterThan(1)
  })

  it('gives the G clef the separate subpaths its counters are made of', () => {
    // Several subpaths under the default nonzero fill rule is what leaves the
    // eye of the clef open; one subpath would fill as a solid blob.
    const ms = SMUFL_GLYPHS.gClef.commands.filter((c) => c.t === 'M')
    expect(ms.length).toBeGreaterThan(1)
  })
})

describe('glyphPathData', () => {
  it('emits only the commands both renderers understand', () => {
    const d = glyphPathData(clefGlyph('treble'), placeClef(metrics, 'treble', 0))
    expect(d.startsWith('M')).toBe(true)
    expect(d).toMatch(/[\d.]$/) // ends on a complete coordinate
    expect(d).not.toMatch(/[^MLCZ0-9.\s-]/)
  })

  it('has the subpaths that make the G clef’s counters hollow', () => {
    // Several subpaths in one path plus the default nonzero fill rule is what
    // leaves the eye of the clef open; a single subpath would render a blob.
    const d = glyphPathData(clefGlyph('treble'), placeClef(metrics, 'treble', 0))
    expect((d.match(/M/g) ?? []).length).toBeGreaterThan(1)
  })

  it('places the outline where the placement says', () => {
    const at = placeClef(metrics, 'treble', 30)
    const xs = [...glyphPathData(clefGlyph('treble'), at).matchAll(/[MLC]([-\d.]+)/g)].map((m) =>
      Number(m[1])
    )
    expect(Math.min(...xs)).toBeCloseTo(30, 1)
  })
})
