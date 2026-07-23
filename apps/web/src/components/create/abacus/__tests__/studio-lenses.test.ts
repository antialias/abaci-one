import { describe, expect, it } from 'vitest'
import { emphasisCaption, markersFollowFrameGhost, xrayGroups } from '../abacus-model'

// The studio's two hover lenses (Gitea #17) — reveal the designed colors, or emphasize
// one role by x-raying the rest — drive three imperative bits of the three.js viewer
// that can't be unit-tested directly: the hero caption text, the geometry-group split
// that makes the x-ray a true see-through (not a dim), and whether the ArUco marker
// decals fade with the frame. Those decisions are factored into the pures below so the
// closures stay thin; these are the contracts they rest on.

describe('emphasisCaption', () => {
  it('announces the print-preview default when no lens is engaged', () => {
    expect(emphasisCaption(false, null, false)).toEqual({
      text: 'Print preview · hover a swatch for your design',
      active: false,
    })
  })

  it('names the emphasized role when a hovered row actually lit a shell', () => {
    expect(emphasisCaption(false, 'Tens bead', true)).toEqual({
      text: 'Emphasizing Tens bead',
      active: true,
    })
  })

  it('falls back to the resting announce when the hovered row lit no shell', () => {
    // marker / inset-text rows resolve to no addressable geometry (matched === false),
    // so the caption must not claim to emphasize a part that never lit up.
    expect(emphasisCaption(false, 'Corner markers', false)).toEqual({
      text: 'Print preview · hover a swatch for your design',
      active: false,
    })
  })

  it('lets the reveal lens win over emphasis', () => {
    // hovering a row's true-color tile both flips the model to designed colors AND
    // singles out the part; reveal is the louder story, so it takes the caption.
    expect(emphasisCaption(true, 'Frame', true)).toEqual({
      text: 'Your designed colors',
      active: true,
    })
    // reveal speaks even with no role in hand.
    expect(emphasisCaption(true, null, false).text).toBe('Your designed colors')
  })
})

describe('xrayGroups', () => {
  const total = (gs: { count: number }[]) => gs.reduce((n, g) => n + g.count, 0)

  it('returns no groups for an empty mask (single-draw fast path upstream)', () => {
    expect(xrayGroups([])).toEqual([])
  })

  it('emits one opaque group (material 0) when every triangle matches', () => {
    expect(xrayGroups([true, true, true])).toEqual([{ start: 0, count: 9, materialIndex: 0 }])
  })

  it('emits one ghost group (material 1) when nothing matches', () => {
    expect(xrayGroups([false, false])).toEqual([{ start: 0, count: 6, materialIndex: 1 }])
  })

  it('coalesces consecutive same-status runs and counts in vertices (3 per triangle)', () => {
    // mask: match match ghost ghost match → three runs
    expect(xrayGroups([true, true, false, false, true])).toEqual([
      { start: 0, count: 6, materialIndex: 0 },
      { start: 6, count: 6, materialIndex: 1 },
      { start: 12, count: 3, materialIndex: 0 },
    ])
  })

  it('splits every triangle into its own group when the mask alternates', () => {
    const gs = xrayGroups([true, false, true, false])
    expect(gs).toHaveLength(4)
    expect(gs.map((g) => g.materialIndex)).toEqual([0, 1, 0, 1])
  })

  it('tiles the whole geometry: contiguous starts, counts summing to 3·triangles', () => {
    const mask = [false, true, true, false, false, true]
    const gs = xrayGroups(mask)
    expect(total(gs)).toBe(mask.length * 3)
    // groups butt up against each other with no gap or overlap
    let cursor = 0
    for (const g of gs) {
      expect(g.start).toBe(cursor)
      cursor += g.count
      // each group's material follows the status of the triangle it starts on
      expect(g.materialIndex).toBe(mask[g.start / 3] ? 0 : 1)
    }
  })
})

describe('markersFollowFrameGhost', () => {
  it('keeps markers opaque when no x-ray is active', () => {
    expect(markersFollowFrameGhost(false, null)).toBe(false)
    expect(markersFollowFrameGhost(false, 'bead-0')).toBe(false)
  })

  it('keeps markers opaque when the frame itself is the emphasized part', () => {
    // the frame stays opaque under x-ray, and the markers are its decals — they ride
    // with it rather than fading out from under the part in focus.
    expect(markersFollowFrameGhost(true, 'frame')).toBe(false)
  })

  it('fades markers with the frame when a bead is emphasized', () => {
    // frame ghosts → its decals must ghost too, or they hang solid over the board.
    expect(markersFollowFrameGhost(true, 'bead-2')).toBe(true)
  })
})
