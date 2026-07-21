/**
 * Multi-material 3MF assembly for the abacus export (Phase 2b, Gitea #9).
 *
 * The scad worker renders ONE binary STL of the whole abacus (frame + free
 * beads) with no color information. This module splits that triangle soup by
 * filament slot — `analyzeShells` union-finds the shells, `shellSlotIndex`
 * maps each shell to the slot its role rides (the same mapping the viewer's
 * recolor pass uses) — and hands the per-slot bodies to frames-engine's
 * `meshesToThreeMf`, which keeps them CO-REGISTERED (one shared translate,
 * never per-body re-origin) so the beads stay threaded on their rods.
 *
 * Marker pockets and inset text ride the frame body in this pass: with the
 * scad's default `inlay_plugs=false` the plug solids aren't in the export STL
 * at all (a flush plug would weld into the frame shell). Separate marker/text
 * bodies via the scad's `only=` selectors are a follow-up render pass, not a
 * split of this one.
 */
import { type ColorBody, meshesToThreeMf } from '@eink/frames-engine/print-bundle'
import { parseStl, writeBinaryStl } from '@eink/frames-engine/stl'
import { analyzeShells, type FilamentMap, type Params, shellSlotIndex } from './abacus-model'

/** Per-body summary of what went into the 3MF — feeds the print panel + tests. */
export interface SpoolBodySummary {
  /** Filament slot index (0-based, into `FilamentMap.slots`). */
  slot: number
  label: string
  colorHex: string
  triangleCount: number
}

export interface AbacusThreeMf {
  /** The finished multi-material `.3mf` (zip bytes). */
  bytes: Uint8Array
  /** One entry per emitted body, ascending slot order. Slots with no geometry are absent. */
  bodies: SpoolBodySummary[]
}

/**
 * Split the export STL by filament slot and build the multi-material 3MF.
 *
 * @param stl        The one-shot export render (binary STL, whole abacus).
 * @param params     The scad params the STL was rendered from — shell
 *                   classification reads the same layout constants.
 * @param filamentMap The role→slot mapping the plan materialized.
 * @param slotLabels Optional human names per slot (e.g. spool names from the
 *                   AMS roster); defaults to `Filament N`.
 */
export function buildAbacusThreeMf(args: {
  stl: ArrayBuffer
  params: Params
  filamentMap: FilamentMap
  slotLabels?: readonly string[]
}): AbacusThreeMf {
  const { stl, params, filamentMap, slotLabels } = args

  const mesh = parseStl(stl)
  if (mesh.triangleCount === 0) {
    throw new Error('export STL has no triangles — nothing to print')
  }

  const { triShell, shellInfo } = analyzeShells(mesh.positions, params)
  const slotOfShell = shellInfo.map((info) => shellSlotIndex(info, params, filamentMap))

  // Count triangles per slot, then bucket the position soup (9 floats/tri).
  const triCount = new Map<number, number>()
  for (let t = 0; t < mesh.triangleCount; t++) {
    const slot = slotOfShell[triShell[t]]
    triCount.set(slot, (triCount.get(slot) ?? 0) + 1)
  }

  const slots = [...triCount.keys()].sort((a, b) => a - b)
  const buckets = new Map<number, { positions: Float32Array; fill: number }>()
  for (const slot of slots) {
    const count = triCount.get(slot)
    if (count === undefined) continue
    buckets.set(slot, { positions: new Float32Array(count * 9), fill: 0 })
  }
  for (let t = 0; t < mesh.triangleCount; t++) {
    const bucket = buckets.get(slotOfShell[triShell[t]])
    if (!bucket) continue
    bucket.positions.set(mesh.positions.subarray(t * 9, t * 9 + 9), bucket.fill)
    bucket.fill += 9
  }

  const bodies: SpoolBodySummary[] = []
  const colorBodies: ColorBody[] = []
  for (const slot of slots) {
    const bucket = buckets.get(slot)
    const count = triCount.get(slot)
    if (!bucket || count === undefined) continue
    const label = slotLabels?.[slot] ?? `Filament ${slot + 1}`
    const colorHex = filamentMap.slots[slot]
    const stlBytes = writeBinaryStl(bucket.positions)
    // ColorBody wants a plain ArrayBuffer; copy into an exact-size one.
    const stlBuffer = new ArrayBuffer(stlBytes.byteLength)
    new Uint8Array(stlBuffer).set(stlBytes)
    bodies.push({ slot, label, colorHex, triangleCount: count })
    colorBodies.push({ label, stl: stlBuffer, colorHex })
  }

  return { bytes: meshesToThreeMf(colorBodies), bodies }
}
