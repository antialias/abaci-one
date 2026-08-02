/**
 * Assembly-3MF invariants (Gitea #5): the multicolor abacus must export as ONE
 * bed-centered printable object with an OWNED prime tower — never four separate
 * objects that Orca scatters + whose auto tower jams the plate (exit 154).
 *
 * These guard the structural contract proven on THH's sidecar: a single `<build>`
 * item, a `<components>` assembly with one `<part>` (extruder) per filament, and a
 * `wipe_tower_x/y` that sits on the bed, clear of the centered footprint and the
 * front-left cutter keep-out.
 */
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { type AssemblyBody, assembleAbacus3mf, BAMBU_256_BED } from '../abacus-3mf-assembly'

/** One triangle spanning [x0,x1]×[y0,y1] at z=0..2 (9 floats). */
const tri = (x0: number, y0: number, x1: number, y1: number): Float32Array =>
  new Float32Array([x0, y0, 0, x1, y0, 0, x1, y1, 2])

/** Two co-registered bodies whose merged footprint is 60×80 mm. */
const bodies: AssemblyBody[] = [
  { positions: tri(0, 0, 60, 80), colorHex: '#c9a26e', label: 'Frame', extruder: 1 },
  { positions: tri(10, 10, 40, 50), colorHex: '#2e86ab', label: 'Beads', extruder: 2 },
]

const read = (bytes: Uint8Array) => {
  const zip = unzipSync(bytes)
  return {
    model: strFromU8(zip['3D/3dmodel.model']),
    modelSettings: strFromU8(zip['Metadata/model_settings.config']),
    project: JSON.parse(strFromU8(zip['Metadata/project_settings.config'])),
  }
}

describe('assembleAbacus3mf', () => {
  it('emits ONE printable object (single build item, one components assembly)', () => {
    const { bytes } = assembleAbacus3mf(bodies, BAMBU_256_BED)
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]) // PK zip
    const { model } = read(bytes)
    expect(model.match(/<item\b/g)).toHaveLength(1) // exactly one thing on the plate
    expect(model.match(/<components>/g)).toHaveLength(1)
    expect(model.match(/<component\b/g)).toHaveLength(2) // one per filament body
  })

  it('assigns each filament its own extruder part', () => {
    const { modelSettings } = read(assembleAbacus3mf(bodies, BAMBU_256_BED).bytes)
    expect(modelSettings.match(/<part\b/g)).toHaveLength(2)
    expect(modelSettings).toContain('<metadata key="extruder" value="1"/>')
    expect(modelSettings).toContain('<metadata key="extruder" value="2"/>')
  })

  it('centers the footprint on the bed (build-item translate)', () => {
    const { model } = read(assembleAbacus3mf(bodies, BAMBU_256_BED).bytes)
    // transform = "1 0 0 0 1 0 0 0 1 tx ty tz"; merged bbox X[0,60] Y[0,80] → center (30,40)
    const m = model.match(
      /<item objectid="\d+" transform="1 0 0 0 1 0 0 0 1 ([-\d.]+) ([-\d.]+) ([-\d.]+)"/
    )
    expect(m).toBeTruthy()
    const [tx, ty] = [Number(m![1]), Number(m![2])]
    expect(tx).toBeCloseTo(128 - 30, 3) // bedCx - footprintCx
    expect(ty).toBeCloseTo(128 - 40, 3)
  })

  it('pins a wipe tower on the bed, clear of the centered footprint and the cutter zone', () => {
    const { bytes, wipeTower } = assembleAbacus3mf(bodies, BAMBU_256_BED)
    const { project } = read(bytes)
    // project_settings carries the pinned tower (as strings) matching the return
    expect(Number(project.wipe_tower_x)).toBeCloseTo(wipeTower.xMm, 3)
    expect(Number(project.wipe_tower_y)).toBeCloseTo(wipeTower.yMm, 3)

    // centered footprint (60×80 at bed center) and a generous tower reserve
    const obj = { x0: 128 - 30, y0: 128 - 40, x1: 128 + 30, y1: 128 + 40 }
    const t = {
      x0: wipeTower.xMm,
      y0: wipeTower.yMm,
      x1: wipeTower.xMm + 45,
      y1: wipeTower.yMm + 40,
    }
    // on bed
    expect(t.x0).toBeGreaterThanOrEqual(0)
    expect(t.y0).toBeGreaterThanOrEqual(0)
    expect(t.x1).toBeLessThanOrEqual(256)
    expect(t.y1).toBeLessThanOrEqual(256)
    // disjoint from the object
    const overlap = t.x0 < obj.x1 && t.x1 > obj.x0 && t.y0 < obj.y1 && t.y1 > obj.y0
    expect(overlap).toBe(false)
    // clear of the front-left 18×28 filament-cutter keep-out
    const hitsCutter = t.x0 < 18 && t.y0 < 28
    expect(hitsCutter).toBe(false)
  })

  it('pins every filament to AMS group 1 (defeats Orca filament grouping)', () => {
    const { project } = read(assembleAbacus3mf(bodies, BAMBU_256_BED).bytes)
    expect(project.filament_map_mode).toBe('Manual')
    expect(project.filament_map).toEqual(['1', '1'])
    expect(project.filament_colour).toEqual(['#C9A26E', '#2E86AB'])
  })

  it('refuses a single body (single filament rides meshesToThreeMf)', () => {
    expect(() => assembleAbacus3mf([bodies[0]], BAMBU_256_BED)).toThrow(/>= 2/)
  })

  it('drops the merged bbox to the bed — a below-z=0 stand-off becomes the bed contact', () => {
    // printed feet dip to −feet_proud; the build-item tz must lift exactly that,
    // so the print stands on its feet with the foot bottoms at z=0 (Gitea #23).
    const feetProud = 1.6
    const dipped: AssemblyBody[] = [
      bodies[0],
      {
        positions: new Float32Array([20, 20, -feetProud, 30, 20, -feetProud, 25, 30, 2]),
        colorHex: '#1f2937',
        label: 'Feet',
        extruder: 2,
      },
    ]
    const { model } = read(assembleAbacus3mf(dipped, BAMBU_256_BED).bytes)
    const m = model.match(
      /<item objectid="\d+" transform="1 0 0 0 1 0 0 0 1 ([-\d.]+) ([-\d.]+) ([-\d.]+)"/
    )
    expect(m).toBeTruthy()
    expect(Number(m![3])).toBeCloseTo(feetProud, 3)
  })
})

describe('assembleAbacus3mf — support opts (printed feet, Gitea #23)', () => {
  it('bakes the support keys into project_settings when asked', () => {
    const { project } = read(assembleAbacus3mf(bodies, BAMBU_256_BED, { support: true }).bytes)
    expect(project.enable_support).toBe('1')
    expect(project.support_type).toBe('normal(auto)')
    expect(project.support_on_build_plate_only).toBe('1') // nothing grows in channels/on beads
    expect(project.support_interface_top_layers).toBe('2')
    expect(project.support_top_z_distance).toBe('0.2')
    // the interface SPOOL is THH's to pick (ticket filament order) — never baked
    expect('support_interface_filament' in project).toBe(false)
  })

  it('emits NO support keys by default (pre-#23 files stay byte-stable)', () => {
    const { project } = read(assembleAbacus3mf(bodies, BAMBU_256_BED).bytes)
    expect('enable_support' in project).toBe(false)
    expect('support_type' in project).toBe(false)
  })

  it('allows a single body with support (no-TPU fallback merges feet into the frame slot)', () => {
    const { bytes } = assembleAbacus3mf([bodies[0]], BAMBU_256_BED, { support: true })
    const { model, project } = read(bytes)
    expect(model.match(/<item\b/g)).toHaveLength(1)
    expect(model.match(/<component\b/g)).toHaveLength(1)
    expect(project.enable_support).toBe('1')
  })

  it('still refuses an empty body list, support or not', () => {
    expect(() => assembleAbacus3mf([], BAMBU_256_BED, { support: true })).toThrow(/at least one/)
  })

  // The printed-feet path reserves a second, quarter-turned keep-out box. Its premise
  // (that supports make Orca re-orient the plate) has since been disproven — see
  // SUPPORT_SKIRT in abacus-3mf-assembly.ts — and so has the reason to keep it: on real
  // geometry both the pin it yields and the pin it displaces slice clean. Pinned here
  // only so retiring it is a deliberate change; retire this test with the keep-out.
  it('keeps the tower clear of the rotated pose too, once supports are on', () => {
    // a real abacus footprint: 192.5 × 100.5, the size that actually collided
    const abacus: AssemblyBody[] = [
      { positions: tri(0, 0, 192.5, 100.5), colorHex: '#c9a26e', label: 'Frame', extruder: 1 },
      { positions: tri(10, 10, 40, 50), colorHex: '#1f2937', label: 'Feet', extruder: 2 },
    ]
    const { wipeTower } = assembleAbacus3mf(abacus, BAMBU_256_BED, { support: true })
    const t = {
      x0: wipeTower.xMm,
      y0: wipeTower.yMm,
      x1: wipeTower.xMm + 45,
      y1: wipeTower.yMm + 40,
    }
    const hits = (b: { x0: number; y0: number; x1: number; y1: number }) =>
      t.x0 < b.x1 && t.x1 > b.x0 && t.y0 < b.y1 && t.y1 > b.y0

    // declared pose, grown by the printed-feet support brim skirt
    expect(hits({ x0: 31.75 - 16, y0: 77.75 - 16, x1: 224.25 + 16, y1: 178.25 + 16 })).toBe(false)
    // the same footprint turned a quarter turn about the bed centre
    expect(hits({ x0: 77.75 - 16, y0: 31.75 - 16, x1: 178.25 + 16, y1: 224.25 + 16 })).toBe(false)
    // still on the bed and off the filament-cutter corner
    expect(t.x0).toBeGreaterThanOrEqual(0)
    expect(t.y0).toBeGreaterThanOrEqual(0)
    expect(t.x1).toBeLessThanOrEqual(256)
    expect(t.y1).toBeLessThanOrEqual(256)
    expect(t.x0 < 18 && t.y0 < 28).toBe(false)
  })

  it('moves the 3-column printed-feet tower to the production-proven front clearance', () => {
    // Exact XY footprint from the 2026-08-02 failed job. At the old 8 mm skirt this pinned
    // y=23.75 and Orca reported a WipeTower/abacus conflict. A controlled replay at y=16
    // returned code 0 and produced a sliced 3MF.
    const cols3: AssemblyBody[] = [
      { positions: tri(0, 0, 62.5, 100.5), colorHex: '#c9a26e', label: 'Frame', extruder: 1 },
      { positions: tri(10, 10, 40, 50), colorHex: '#1f2937', label: 'Feet', extruder: 2 },
    ]
    const { wipeTower } = assembleAbacus3mf(cols3, BAMBU_256_BED, { support: true })
    expect(wipeTower.xMm).toBeCloseTo(105.5, 3)
    expect(wipeTower.yMm).toBeCloseTo(15.75, 3)
  })

  it('leaves the no-support placement beside the model, not cornered', () => {
    // the pre-#23 path must not move: Orca honours our pose without supports.
    const abacus: AssemblyBody[] = [
      { positions: tri(0, 0, 192.5, 100.5), colorHex: '#c9a26e', label: 'Frame', extruder: 1 },
      { positions: tri(10, 10, 40, 50), colorHex: '#2e86ab', label: 'Beads', extruder: 2 },
    ]
    const { wipeTower } = assembleAbacus3mf(abacus, BAMBU_256_BED)
    // front gap, centered on the model in x — TOWER_GAP below the footprint
    expect(wipeTower.xMm).toBeCloseTo(128 - 45 / 2, 3)
    expect(wipeTower.yMm).toBeCloseTo(77.75 - 6 - 40, 3)
  })
})

// Printed feet are not the only way supports get turned on: the operator's saved
// ticket style can set `enable_support` for ANY design, and that is what broke prod on
// 2026-07-29. Supports push the first layer outward while the tower's own brim reaches
// back toward the model; 6 mm is not enough room for both, and Orca's post-slice
// conflict check fails the plate. The fix is the wider gap.
describe('assembleAbacus3mf — supportsAtSlice (supports from the ticket style)', () => {
  type Rect = { x0: number; y0: number; x1: number; y1: number }

  // The design that actually failed: 3 columns → a 62.5 × 100.5 footprint,
  // bed-centered at X[96.75, 159.25] Y[77.75, 178.25].
  const cols3: AssemblyBody[] = [
    { positions: tri(0, 0, 62.5, 100.5), colorHex: '#c9a26e', label: 'Frame', extruder: 1 },
    { positions: tri(10, 10, 40, 50), colorHex: '#2e86ab', label: 'Beads', extruder: 2 },
  ]
  const hits = (a: Rect, b: Rect): boolean =>
    a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
  const tower = (w: { xMm: number; yMm: number }): Rect => ({
    x0: w.xMm,
    y0: w.yMm,
    x1: w.xMm + 45,
    y1: w.yMm + 40,
  })
  const declared: Rect = { x0: 96.75, y0: 77.75, x1: 159.25, y1: 178.25 }
  const skirted: Rect = { x0: 88.75, y0: 69.75, x1: 167.25, y1: 186.25 } // + SUPPORT_SKIRT

  it('clears the support-grown footprint, with the full gap on top of the skirt', () => {
    const t = tower(assembleAbacus3mf(cols3, BAMBU_256_BED, { supportsAtSlice: true }).wipeTower)
    expect(hits(t, skirted)).toBe(false)
    // beside the model on the roomy side, gap measured from the GROWN edge
    expect(t.x0).toBeCloseTo(167.25 + 6, 3)
    expect(t.y0).toBeCloseTo(108, 3)
    expect(t.x1).toBeLessThanOrEqual(256)
    expect(t.y1).toBeLessThanOrEqual(256)
  })

  it('does NOT corner the tower when a side has room', () => {
    // Cornering is what the first cut of this fix did. A roomy side beats a corner:
    // same clearance, without spending most of the bed to get it.
    const { wipeTower } = assembleAbacus3mf(cols3, BAMBU_256_BED, { supportsAtSlice: true })
    expect(wipeTower.xMm).toBeLessThan(195)
    expect(wipeTower.yMm).toBeLessThan(200)
  })

  it('bakes no support keys — a download must not inherit a print-panel setting', () => {
    const { project } = read(
      assembleAbacus3mf(cols3, BAMBU_256_BED, { supportsAtSlice: true }).bytes
    )
    expect('enable_support' in project).toBe(false)
    expect('support_on_build_plate_only' in project).toBe(false)
  })

  it('reproduces the prod pin when the flag is absent', () => {
    // Ground truth from the failing job: the tower pinned at (165.25, 108) — only
    // TOWER_GAP (6 mm) off the model's declared edge, of which the tower's own brim
    // takes 3. Enough for a supports-off slice, not enough once supports grow the
    // model's first layer into the same gap.
    const t = tower(assembleAbacus3mf(cols3, BAMBU_256_BED).wipeTower)
    expect(t.x0).toBeCloseTo(165.25, 3)
    expect(t.y0).toBeCloseTo(108, 3)
    expect(hits(t, skirted)).toBe(true) // inside the support growth → the trigger
  })
})
