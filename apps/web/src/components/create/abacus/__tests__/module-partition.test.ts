/**
 * abacus-module-partition — the reordering that lets ONE set of geometry
 * attributes serve every module (Gitea #44).
 *
 * The viewer poses each module as its own THREE.Group, which means each
 * module's triangles have to be a contiguous draw range over a shared position
 * buffer. Everything here is about that contract holding exactly: every
 * triangle lands somewhere, the ranges tile the soup with no gap and no
 * overlap, the geometry that comes out the far side is the geometry that went
 * in (per triangle, vertex order intact), and the tags that index the soup are
 * permuted in lockstep with it. A quiet failure in any of those doesn't throw —
 * it draws a torn abacus.
 */
import { describe, expect, it } from 'vitest'
import { partitionTriangles, permuteInt32, permuteTriangles } from '../abacus-module-partition'

/** distinct, recognisable triangle: every one of its 9 floats encodes `t` */
const tri = (t: number): number[] => Array.from({ length: 9 }, (_, c) => t * 100 + c)
const soup = (n: number): Float32Array =>
  new Float32Array(Array.from({ length: n }, (_, t) => tri(t)).flat())

describe('partitionTriangles', () => {
  const tags = Int32Array.from([2, 0, 1, 2, 0, 0, 1, 2])

  it('tiles the soup: every triangle exactly once, ranges covering [0, nTri)', () => {
    const { order, ranges } = partitionTriangles(tags, 3)
    expect(order).toHaveLength(tags.length)
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    // contiguous, in module order, no gap and no overlap
    let at = 0
    for (const r of ranges) {
      expect(r.start).toBe(at)
      at += r.count
    }
    expect(at).toBe(tags.length)
    expect(ranges.map((r) => r.count)).toEqual([3, 2, 3]) // module 0, 1, 2
  })

  it('lands every triangle inside its own module’s range', () => {
    const { order, ranges } = partitionTriangles(tags, 3)
    ranges.forEach((r, m) => {
      for (let k = r.start; k < r.start + r.count; k++) expect(tags[order[k]]).toBe(m)
    })
  })

  it('is STABLE — within a module the input order survives', () => {
    // module 0 holds original triangles 1, 4, 5 in that order; a stable sort is
    // what keeps a shell's triangles adjacent, which is what keeps the x-ray's
    // coalesced geometry groups short instead of one group per triangle.
    const { order } = partitionTriangles(tags, 3)
    expect([...order]).toEqual([1, 4, 5, 2, 6, 0, 3, 7])
  })

  it('handles an empty module: its range is a zero-count placeholder, not a hole', () => {
    const { ranges } = partitionTriangles(Int32Array.from([0, 0, 2]), 3)
    expect(ranges).toEqual([
      { start: 0, count: 2 },
      { start: 2, count: 0 },
      { start: 2, count: 1 },
    ])
  })

  it('mono (modules = 1) is the identity, and tolerates the classifier’s −1', () => {
    const { order, ranges } = partitionTriangles(Int32Array.from([-1, -1, -1, -1]), 1)
    expect([...order]).toEqual([0, 1, 2, 3])
    expect(ranges).toEqual([{ start: 0, count: 4 }])
  })

  it('throws on an unattributed triangle once there is more than one module', () => {
    // -1 here means the viewer is about to drop geometry on the floor. Loudly.
    expect(() => partitionTriangles(Int32Array.from([0, -1, 1]), 2)).toThrow(/module -1/)
    expect(() => partitionTriangles(Int32Array.from([0, 5, 1]), 2)).toThrow(/module 5/)
  })

  it('empty soup: one empty range per module', () => {
    const { order, ranges } = partitionTriangles(new Int32Array(0), 3)
    expect(order).toHaveLength(0)
    expect(ranges).toEqual([
      { start: 0, count: 0 },
      { start: 0, count: 0 },
      { start: 0, count: 0 },
    ])
  })
})

describe('permuteTriangles / permuteInt32', () => {
  const tags = Int32Array.from([2, 0, 1, 2, 0, 0, 1, 2])

  it('moves whole triangles — same 9 floats, same vertex order', () => {
    const { order } = partitionTriangles(tags, 3)
    const out = permuteTriangles(soup(tags.length), order)
    expect(out).toHaveLength(tags.length * 9)
    for (let k = 0; k < order.length; k++) {
      expect([...out.slice(k * 9, k * 9 + 9)]).toEqual(tri(order[k]))
    }
  })

  it('keeps a per-triangle tag indexing the permuted soup', () => {
    const { order } = partitionTriangles(tags, 3)
    const moved = permuteInt32(tags, order)
    // the permuted tags are exactly the sorted tags — which is the whole point
    expect([...moved]).toEqual([0, 0, 0, 1, 1, 2, 2, 2])
    for (let k = 0; k < order.length; k++) expect(moved[k]).toBe(tags[order[k]])
  })

  it('the identity order is a faithful copy, not a shuffle', () => {
    const { order } = partitionTriangles(new Int32Array(4), 1)
    const src = soup(4)
    expect([...permuteTriangles(src, order)]).toEqual([...src])
    expect([...permuteInt32(Int32Array.from([7, 8, 9, 10]), order)]).toEqual([7, 8, 9, 10])
  })
})
