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
    const m = model.match(/<item objectid="\d+" transform="1 0 0 0 1 0 0 0 1 ([-\d.]+) ([-\d.]+) ([-\d.]+)"/)
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
    const t = { x0: wipeTower.xMm, y0: wipeTower.yMm, x1: wipeTower.xMm + 45, y1: wipeTower.yMm + 40 }
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
})
