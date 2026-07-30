/**
 * Multi-material 3MF assembly tests (#9, #12): the export STL splits into one
 * body per filament slot via the shared shell→slot mapping, the ArUco marker
 * part renders merge into their plan-assigned slots (creating bodies for slots
 * with no frame/bead geometry), bodies come out in ascending slot order with the
 * right colors/labels, empty slots are absent, and the result is a real zip.
 *
 * The fixture builds a synthetic triangle soup shaped the way `analyzeShells`
 * classifies: one wide shell (span > 2 column pitches → frame) and small
 * isolated shells at bead cell positions computed from the same `derived`
 * layout constants the classifier reads. Marker "renders" are plain synthetic
 * soups — the merge never classifies them, so their shape is irrelevant.
 */
import { writeBinaryStl } from '@eink/frames-engine/stl'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { buildAbacusThreeMf } from '../abacus-3mf'
import { defaultParams, derived, type FilamentMap, type Params } from '../abacus-model'

// Marker-bearing params (show_markers defaults true) and the markers-off variant
// used by the split-only tests. Feet are pinned OFF here (defaultParams is
// printed-feet since Gitea #23) and text pinned to emboss (defaultParams writes
// inset friends-of-10 on the rails since Gitea #26) so the marker/split suites
// stay about markers; both of those paths have their own describes below.
const params: Params = {
  ...defaultParams,
  color_scheme: 'heaven-earth',
  feet_mode: 'adhesive',
  text_mode: 'emboss',
}
const noMarkers: Params = { ...params, show_markers: false }

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

const toBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

/** Triangle soup for frame + one heaven bead + one earth bead, welded nowhere. */
function fixtureStl(p: Params): ArrayBuffer {
  const d = derived(p)
  const sEm = p.border_w * p.scale_factor + d.sEm // bead-field x origin
  const sHy = p.border_w * p.scale_factor + d.sHy // heaven row y
  const frameSpan = 3 * d.sCp + 100 // safely wider than the 2-pitch frame test

  const positions = new Float32Array([
    // frame: two triangles sharing an edge → one wide shell. The y band sits clear
    // of the beads (which top out around y=84) but no further: this soup's bbox is
    // the footprint the bed layout packs, and a strip parked at y=200 made the
    // fixture 139 × 201 — deeper than wide, backwards from a real 192.5 × 100.5
    // abacus, and too big to leave any corner for a prime tower under supports.
    ...[0, 95, 0, frameSpan, 95, 0, frameSpan, 105, 0],
    ...[0, 95, 0, frameSpan, 105, 0, 0, 105, 0],
    // heaven bead: centroid on the heaven row → isHeaven
    ...beadTri(sEm, sHy),
    // earth bead: centroid several earth pitches below the heaven row
    ...beadTri(sEm + d.sCp, sHy - 3 * d.sEp),
  ])
  return toBuffer(writeBinaryStl(positions))
}

/** A synthetic marker part render: `n` disjoint triangles near (x, y). */
function markerStl(n: number, x: number, y: number): ArrayBuffer {
  const positions = new Float32Array(n * 9)
  for (let t = 0; t < n; t++) positions.set(beadTri(x + t * 3, y), t * 9)
  return toBuffer(writeBinaryStl(positions))
}

const emptyStl = (): ArrayBuffer => toBuffer(writeBinaryStl(new Float32Array(0)))

describe('buildAbacusThreeMf (markers off — the pure STL split)', () => {
  it('emits one body per used slot, ascending, with the mapped colors', () => {
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(noMarkers),
      params: noMarkers,
      filamentMap: fm,
    })

    expect(bodies).toEqual([
      { slot: 0, label: 'Filament 1', colorHex: '#c9a26e', triangleCount: 2 }, // frame
      { slot: 1, label: 'Filament 2', colorHex: '#f5f5f5', triangleCount: 1 }, // earth bead
      { slot: 3, label: 'Filament 4', colorHex: '#2e86ab', triangleCount: 1 }, // heaven bead
    ])
    // slot 2 (marker black) has no geometry with markers off → no body
    expect(bodies.map((b) => b.slot)).not.toContain(2)
  })

  it('applies caller-provided slot labels (e.g. AMS spool names)', () => {
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(noMarkers),
      params: noMarkers,
      filamentMap: fm,
      slotLabels: ['Latte PLA', 'Snow PLA', 'Ink PLA', 'Ocean PLA'],
    })
    expect(bodies.map((b) => b.label)).toEqual(['Latte PLA', 'Snow PLA', 'Ocean PLA'])
  })

  it('produces a zip (3MF container magic)', () => {
    const { bytes } = buildAbacusThreeMf({
      stl: fixtureStl(noMarkers),
      params: noMarkers,
      filamentMap: fm,
    })
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]) // PK\x03\x04
  })

  it('collapses to a single body when every role rides one slot', () => {
    const mono: FilamentMap = { ...fm, frame: 0, beadRoles: [0, 0] }
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(noMarkers),
      params: noMarkers,
      filamentMap: mono,
    })
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ slot: 0, triangleCount: 4 })
  })

  it('throws on an empty export STL', () => {
    expect(() =>
      buildAbacusThreeMf({ stl: emptyStl(), params: noMarkers, filamentMap: fm })
    ).toThrow(/no triangles/)
  })

  it('ignores marker buffers when markers are off — output identical without them', () => {
    const bare = buildAbacusThreeMf({
      stl: fixtureStl(noMarkers),
      params: noMarkers,
      filamentMap: fm,
    })
    const withBuffers = buildAbacusThreeMf({
      stl: fixtureStl(noMarkers),
      markerBlack: markerStl(4, 10, 10),
      markerWhite: markerStl(4, 40, 10),
      params: noMarkers,
      filamentMap: fm,
    })
    expect(withBuffers.bodies).toEqual(bare.bodies)
    // byte-for-byte equality would be flaky (zip entries embed mtimes); same
    // length pins that no marker geometry leaked into the container
    expect(withBuffers.bytes.length).toBe(bare.bytes.length)
  })
})

describe('buildAbacusThreeMf (markers on — Gitea #12)', () => {
  it('merges the marker part renders into their plan-assigned slots', () => {
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(params),
      markerBlack: markerStl(6, 10, 10),
      markerWhite: markerStl(4, 40, 10),
      params,
      filamentMap: fm,
    })

    expect(bodies).toEqual([
      { slot: 0, label: 'Filament 1', colorHex: '#c9a26e', triangleCount: 2 }, // frame
      // earth bead + the white marker plugs merge into slot 1's one body
      { slot: 1, label: 'Filament 2', colorHex: '#f5f5f5', triangleCount: 1 + 4 },
      // slot 2 had NO frame/bead geometry — its body exists purely from markers
      { slot: 2, label: 'Filament 3', colorHex: '#111111', triangleCount: 6 },
      { slot: 3, label: 'Filament 4', colorHex: '#2e86ab', triangleCount: 1 }, // heaven bead
    ])
  })

  it('merges a marker into the frame body when their slots collide', () => {
    const collided: FilamentMap = { ...fm, markerBlack: 0 }
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(params),
      markerBlack: markerStl(6, 10, 10),
      markerWhite: markerStl(4, 40, 10),
      params,
      filamentMap: collided,
    })
    expect(bodies.map((b) => b.slot)).toEqual([0, 1, 3])
    expect(bodies[0].triangleCount).toBe(2 + 6) // frame + black marker plugs
  })

  it('collapses to one body when every role AND both markers ride one slot', () => {
    const mono: FilamentMap = { ...fm, frame: 0, markerWhite: 0, markerBlack: 0, beadRoles: [0, 0] }
    const { bodies, bytes } = buildAbacusThreeMf({
      stl: fixtureStl(params),
      markerBlack: markerStl(6, 10, 10),
      markerWhite: markerStl(4, 40, 10),
      params,
      filamentMap: mono,
    })
    expect(bodies).toHaveLength(1)
    expect(bodies[0]).toMatchObject({ slot: 0, triangleCount: 4 + 6 + 4 })
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]) // single-body path is still a zip
  })

  it('refuses to build a markerless 3MF when the marker renders are missing', () => {
    expect(() => buildAbacusThreeMf({ stl: fixtureStl(params), params, filamentMap: fm })).toThrow(
      /markerless/
    )
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(params),
        markerBlack: markerStl(6, 10, 10),
        markerWhite: null,
        params,
        filamentMap: fm,
      })
    ).toThrow(/markerless/)
  })

  it('refuses an empty marker render', () => {
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(params),
        markerBlack: emptyStl(),
        markerWhite: markerStl(4, 40, 10),
        params,
        filamentMap: fm,
      })
    ).toThrow(/markerless/)
  })

  it('skips markers on a beads-only debug render (show_frame off, matching the exporter gate)', () => {
    const frameless: Params = { ...params, show_frame: false }
    // the fixture still contains a wide "frame" shell — irrelevant; only the
    // gate is under test: no marker buffers + show_frame=false must not throw
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(frameless),
      params: frameless,
      filamentMap: fm,
    })
    expect(bodies.map((b) => b.slot)).not.toContain(2)
  })
})

describe('buildAbacusThreeMf (printed feet — Gitea #23)', () => {
  // markers off keeps the merges independent; feet slot 2 has no other geometry.
  const feetParams: Params = { ...noMarkers, feet_mode: 'printed' }
  const feetFm: FilamentMap = { ...fm, feet: 2 }

  it('merges the feet part render into the plan-assigned feet slot', () => {
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(feetParams),
      feet: markerStl(6, 10, 10),
      params: feetParams,
      filamentMap: feetFm,
    })
    expect(bodies).toEqual([
      { slot: 0, label: 'Filament 1', colorHex: '#c9a26e', triangleCount: 2 }, // frame
      { slot: 1, label: 'Filament 2', colorHex: '#f5f5f5', triangleCount: 1 }, // earth bead
      // slot 2 had NO frame/bead geometry — its body exists purely from the feet
      { slot: 2, label: 'Filament 3', colorHex: '#111111', triangleCount: 6 },
      { slot: 3, label: 'Filament 4', colorHex: '#2e86ab', triangleCount: 1 }, // heaven bead
    ])
  })

  it('merges feet into the frame body when their slots collide (no-TPU fallback)', () => {
    const collided: FilamentMap = { ...fm, feet: 0 }
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(feetParams),
      feet: markerStl(6, 10, 10),
      params: feetParams,
      filamentMap: collided,
    })
    expect(bodies.map((b) => b.slot)).toEqual([0, 1, 3])
    expect(bodies[0].triangleCount).toBe(2 + 6) // frame + feet
  })

  it('forces the assembly path even single-bodied — the support keys must ship', () => {
    // monochrome map + feet on the same slot: pre-#23 this rode meshesToThreeMf,
    // which emits no project_settings.config — a direct download would print the
    // raised bottom face unsupported.
    const mono: FilamentMap = { ...fm, frame: 0, beadRoles: [0, 0], feet: 0 }
    const { bodies, bytes } = buildAbacusThreeMf({
      stl: fixtureStl(feetParams),
      feet: markerStl(6, 10, 10),
      params: feetParams,
      filamentMap: mono,
    })
    expect(bodies).toHaveLength(1)
    const zip = unzipSync(bytes)
    const project = JSON.parse(strFromU8(zip['Metadata/project_settings.config']))
    expect(project.enable_support).toBe('1')
    expect(project.support_on_build_plate_only).toBe('1')
  })

  it('carries the support keys on the multicolor path too', () => {
    const { bytes } = buildAbacusThreeMf({
      stl: fixtureStl(feetParams),
      feet: markerStl(6, 10, 10),
      params: feetParams,
      filamentMap: feetFm,
    })
    const project = JSON.parse(strFromU8(unzipSync(bytes)['Metadata/project_settings.config']))
    expect(project.enable_support).toBe('1')
  })

  it('refuses to build a footless 3MF when the feet render is missing or empty', () => {
    expect(() =>
      buildAbacusThreeMf({ stl: fixtureStl(feetParams), params: feetParams, filamentMap: feetFm })
    ).toThrow(/footless/)
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(feetParams),
        feet: emptyStl(),
        params: feetParams,
        filamentMap: feetFm,
      })
    ).toThrow(/footless/)
  })

  it('throws when the plan minted no feet slot for a printed-feet design (programming error)', () => {
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(feetParams),
        feet: markerStl(6, 10, 10),
        params: feetParams,
        filamentMap: fm, // no feet key
      })
    ).toThrow(/no feet slot/)
  })

  it('ignores a feet buffer when feet are not printed — output identical without it', () => {
    const bare = buildAbacusThreeMf({
      stl: fixtureStl(noMarkers),
      params: noMarkers,
      filamentMap: fm,
    })
    const withBuffer = buildAbacusThreeMf({
      stl: fixtureStl(noMarkers),
      feet: markerStl(6, 10, 10),
      params: noMarkers,
      filamentMap: fm,
    })
    expect(withBuffer.bodies).toEqual(bare.bodies)
    expect(withBuffer.bytes.length).toBe(bare.bytes.length)
  })

  it('skips feet on a beads-only debug render (show_frame off, matching the exporter gate)', () => {
    const frameless: Params = { ...feetParams, show_frame: false }
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(frameless),
      params: frameless,
      filamentMap: feetFm,
    })
    expect(bodies.map((b) => b.slot)).not.toContain(2)
  })
})

// Supports push the model's first layer outward, so the prime tower needs a wider gap
// whenever they're on — and the operator's ticket style can turn them on for a design
// with no printed feet at all. Keying the wider gap off feet alone is what pinned a
// tower 6 mm from a supported model on prod (exit 155, 2026-07-29).
describe('buildAbacusThreeMf (supports from the ticket style)', () => {
  const projectOf = (bytes: Uint8Array) =>
    JSON.parse(strFromU8(unzipSync(bytes)['Metadata/project_settings.config']))
  const build = (supportsAtSlice?: boolean) =>
    projectOf(
      buildAbacusThreeMf({
        stl: fixtureStl(noMarkers),
        params: noMarkers, // adhesive feet: nothing in the DESIGN asks for supports
        filamentMap: fm,
        supportsAtSlice,
      }).bytes
    )

  it('moves the prime tower once the style enables supports', () => {
    const off = build()
    const on = build(true)
    expect(`${on.wipe_tower_x},${on.wipe_tower_y}`).not.toBe(
      `${off.wipe_tower_x},${off.wipe_tower_y}`
    )
  })

  it('moves the tower and nothing else — the support keys stay off a styleless file', () => {
    // Placement only: the keys belong to the printed-feet recipe, and THH overrides
    // project_settings anyway. Writing them here would turn supports on in a
    // download whose owner never asked for them.
    const on = build(true)
    expect('enable_support' in on).toBe(false)
    expect('support_on_build_plate_only' in on).toBe(false)
  })
})

describe('buildAbacusThreeMf (inset text — Gitea #26)', () => {
  // Two written tokens on the top rail and nothing anywhere else, so rainbow
  // fill means exactly two color groups — the smallest design that can prove the
  // per-group split actually splits.
  const inkParams: Params = {
    ...noMarkers,
    text_mode: 'inset',
    aid_10: 'off',
    aid_5: 'off',
    top_text: 'a b',
  }
  // groups 0 → slot 2 (nothing else prints there), 1 → slot 3 (shared with heaven)
  const inkFm: FilamentMap = { ...fm, textRoles: [2, 3] }
  /** Two plug renders whose geometry actually differs, as real groups' would. */
  const plugs = (a = 3, b = 5) => [
    { group: 0, stl: markerStl(a, 10, 10) },
    { group: 1, stl: markerStl(b, 60, 10) },
  ]

  it('merges each color group into its own slot — the fix for empty pockets', () => {
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(inkParams),
      textPlugs: plugs(),
      params: inkParams,
      filamentMap: inkFm,
    })
    expect(bodies).toEqual([
      { slot: 0, label: 'Filament 1', colorHex: '#c9a26e', triangleCount: 2 }, // frame
      { slot: 1, label: 'Filament 2', colorHex: '#f5f5f5', triangleCount: 1 }, // earth bead
      // slot 2 exists purely from text group 0 — no frame/bead geometry rides it
      { slot: 2, label: 'Filament 3', colorHex: '#111111', triangleCount: 3 },
      // slot 3: heaven bead + text group 1
      { slot: 3, label: 'Filament 4', colorHex: '#2e86ab', triangleCount: 1 + 5 },
    ])
  })

  it('merges groups that share a slot into one body (the collapsed-rainbow case)', () => {
    const collided: FilamentMap = { ...fm, textRoles: [2, 2] }
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(inkParams),
      textPlugs: plugs(),
      params: inkParams,
      filamentMap: collided,
    })
    expect(bodies.map((b) => b.slot)).toEqual([0, 1, 2, 3])
    expect(bodies[2].triangleCount).toBe(3 + 5)
  })

  it('tolerates one empty group — an unrenderable glyph must not kill the export', () => {
    const { bodies } = buildAbacusThreeMf({
      stl: fixtureStl(inkParams),
      textPlugs: [
        { group: 0, stl: emptyStl() },
        { group: 1, stl: markerStl(5, 60, 10) },
      ],
      params: inkParams,
      filamentMap: inkFm,
    })
    expect(bodies.map((b) => b.slot)).toEqual([0, 1, 3]) // slot 2 empty → no body
    expect(bodies[2].triangleCount).toBe(1 + 5)
  })

  it('refuses to ship empty pockets when no group rendered anything', () => {
    // the whole bug in one assertion: inset text in the design, no inlay in the
    // 3MF, meaning bare relief in frame filament on the plate.
    expect(() =>
      buildAbacusThreeMf({ stl: fixtureStl(inkParams), params: inkParams, filamentMap: inkFm })
    ).toThrow(/empty pockets/)
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(inkParams),
        textPlugs: [
          { group: 0, stl: emptyStl() },
          { group: 1, stl: emptyStl() },
        ],
        params: inkParams,
        filamentMap: inkFm,
      })
    ).toThrow(/empty pockets/)
  })

  it('throws when two groups render identical geometry (a plug_group define that never landed)', () => {
    // the silent failure this guard exists for: the scad's -1 default renders
    // EVERY token, so both "groups" would carry all the text.
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(inkParams),
        textPlugs: [
          { group: 0, stl: markerStl(4, 10, 10) },
          { group: 1, stl: markerStl(4, 10, 10) },
        ],
        params: inkParams,
        filamentMap: inkFm,
      })
    ).toThrow(/plug_group filter did not apply/)
  })

  it('throws when the plan minted no text slots for an inked design (programming error)', () => {
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(inkParams),
        textPlugs: plugs(),
        params: inkParams,
        filamentMap: fm, // no textRoles key
      })
    ).toThrow(/no text slots/)
  })

  it('throws when a render names a group the plan never minted', () => {
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(inkParams),
        textPlugs: [...plugs(), { group: 4, stl: markerStl(2, 90, 10) }],
        params: inkParams,
        filamentMap: inkFm,
      })
    ).toThrow(/color group 4 has no slot/)
  })

  it('throws when a group went unrendered — a half-inked plate stays loud', () => {
    expect(() =>
      buildAbacusThreeMf({
        stl: fixtureStl(inkParams),
        textPlugs: [{ group: 0, stl: markerStl(3, 10, 10) }],
        params: inkParams,
        filamentMap: inkFm,
      })
    ).toThrow(/2 inset-text color groups but 1 were rendered/)
  })

  it('ignores text renders when the design has no inlay to ink', () => {
    // emboss (raised letters, no pocket), nothing written, and a beads-only debug
    // render — the three conditions the exporter itself gates on.
    for (const p of [
      { ...inkParams, text_mode: 'emboss' as const },
      { ...inkParams, top_text: '' },
      { ...inkParams, show_frame: false },
    ]) {
      const bare = buildAbacusThreeMf({ stl: fixtureStl(p), params: p, filamentMap: inkFm })
      const withPlugs = buildAbacusThreeMf({
        stl: fixtureStl(p),
        textPlugs: plugs(),
        params: p,
        filamentMap: inkFm,
      })
      expect(withPlugs.bodies).toEqual(bare.bodies)
      expect(withPlugs.bytes.length).toBe(bare.bytes.length)
    }
  })
})
