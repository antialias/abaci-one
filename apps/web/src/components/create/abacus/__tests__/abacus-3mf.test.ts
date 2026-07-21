/**
 * Multi-material 3MF assembly tests (#9): the export STL splits into one body
 * per filament slot via the shared shell→slot mapping, bodies come out in
 * ascending slot order with the right colors/labels, empty slots are absent,
 * and the result is a real zip.
 *
 * The fixture builds a synthetic triangle soup shaped the way `analyzeShells`
 * classifies: one wide shell (span > 2 column pitches → frame) and small
 * isolated shells at bead cell positions computed from the same `derived`
 * layout constants the classifier reads.
 */
import { writeBinaryStl } from '@eink/frames-engine/stl'
import { describe, expect, it } from 'vitest'
import { buildAbacusThreeMf } from '../abacus-3mf'
import { defaultParams, derived, type FilamentMap, type Params } from '../abacus-model'

const params: Params = { ...defaultParams, color_scheme: 'heaven-earth' }

const fm: FilamentMap = {
  slots: ['#c9a26e', '#f5f5f5', '#111111', '#2e86ab'],
  frame: 0,
  markerWhite: 1,
  markerBlack: 2,
  beadRoles: [3, 1], // heaven → slot 3, earth → slot 1
  markerContrast: 21,
}

/** A small isolated triangle whose bounding-box centroid is exactly (x, y). */
const beadTri = (x: number, y: number): number[] => [x - 1, y - 1, 0, x + 1, y - 1, 0, x, y + 1, 0]

/** Triangle soup for frame + one heaven bead + one earth bead, welded nowhere. */
function fixtureStl(p: Params): ArrayBuffer {
  const d = derived(p)
  const sEm = p.border_w * p.scale_factor + d.sEm // bead-field x origin
  const sHy = p.border_w * p.scale_factor + d.sHy // heaven row y
  const frameSpan = 3 * d.sCp + 100 // safely wider than the 2-pitch frame test

  const positions = new Float32Array([
    // frame: two triangles sharing an edge → one wide shell (y range clear of the beads)
    ...[0, 200, 0, frameSpan, 200, 0, frameSpan, 210, 0],
    ...[0, 200, 0, frameSpan, 210, 0, 0, 210, 0],
    // heaven bead: centroid on the heaven row → isHeaven
    ...beadTri(sEm, sHy),
    // earth bead: centroid several earth pitches below the heaven row
    ...beadTri(sEm + d.sCp, sHy - 3 * d.sEp),
  ])
  const bytes = writeBinaryStl(positions)
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

describe('buildAbacusThreeMf', () => {
  it('emits one body per used slot, ascending, with the mapped colors', () => {
    const { bodies } = buildAbacusThreeMf({ stl: fixtureStl(params), params, filamentMap: fm })

    expect(bodies).toEqual([
      { slot: 0, label: 'Filament 1', colorHex: '#c9a26e', triangleCount: 2 }, // frame
      { slot: 1, label: 'Filament 2', colorHex: '#f5f5f5', triangleCount: 1 }, // earth bead
      { slot: 3, label: 'Filament 4', colorHex: '#2e86ab', triangleCount: 1 }, // heaven bead
    ])
    // slot 2 (marker black) has no geometry in the export STL → no body
    expect(bodies.map((b) => b.slot)).not.toContain(2)
  })

  it('applies caller-provided slot labels (e.g. AMS spool names)', () => {
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(params),
      params,
      filamentMap: fm,
      slotLabels: ['Latte PLA', 'Snow PLA', 'Ink PLA', 'Ocean PLA'],
    })
    expect(bodies.map((b) => b.label)).toEqual(['Latte PLA', 'Snow PLA', 'Ocean PLA'])
  })

  it('produces a zip (3MF container magic)', () => {
    const { bytes } = buildAbacusThreeMf({ stl: fixtureStl(params), params, filamentMap: fm })
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]) // PK\x03\x04
  })

  it('collapses to a single body when every role rides one slot', () => {
    const mono: FilamentMap = { ...fm, frame: 0, beadRoles: [0, 0] }
    const { bodies } = buildAbacusThreeMf({ stl: fixtureStl(params), params, filamentMap: mono })
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ slot: 0, triangleCount: 4 })
  })

  it('throws on an empty export STL', () => {
    const empty = writeBinaryStl(new Float32Array(0))
    const buffer = new ArrayBuffer(empty.byteLength)
    new Uint8Array(buffer).set(empty)
    expect(() => buildAbacusThreeMf({ stl: buffer, params, filamentMap: fm })).toThrow(
      /no triangles/
    )
  })
})
