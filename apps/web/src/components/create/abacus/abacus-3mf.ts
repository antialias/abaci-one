/**
 * Multi-material 3MF assembly for the abacus export (Phase 2b, Gitea #9).
 *
 * The scad worker renders ONE binary STL of the whole abacus (frame + free
 * beads) with no color information. This module splits that triangle soup by
 * filament slot — `analyzeShells` union-finds the shells, `shellSlotIndex`
 * maps each shell to the slot its role rides (the same mapping the viewer's
 * recolor pass uses) — keeping every body CO-REGISTERED (never per-body
 * re-origin) so the beads stay threaded on their rods.
 *
 * The per-slot bodies then take one of two paths by count:
 *  - MULTICOLOR (>= 2 slots) → `assembleAbacus3mf`: one bed-centered printable
 *    object (a `<components>` assembly, each colored mesh a `<part>` with its
 *    extruder) plus an OWNED prime tower. Four *separate* objects (what
 *    `meshesToThreeMf` emits) let Orca scatter the in-place beads and jam its auto
 *    tower into an unprintable spot (exit 154); one placed object with a pinned
 *    tower slices clean. See abacus-3mf-assembly.ts for the full root cause.
 *  - SINGLE filament → `meshesToThreeMf` unchanged (one object already prints).
 *
 * Marker pockets and inset text ride the frame body in this pass: with the
 * scad's default `inlay_plugs=false` the plug solids aren't in the export STL
 * at all (a flush plug would weld into the frame shell). Separate marker/text
 * bodies via the scad's `only=` selectors are a follow-up render pass, not a
 * split of this one.
 */
import { type ColorBody, meshesToThreeMf } from '@eink/frames-engine/print-bundle'
import { parseStl, writeBinaryStl } from '@eink/frames-engine/stl'
import { type AssemblyBody, assembleAbacus3mf, BAMBU_256_BED } from './abacus-3mf-assembly'
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
  const assemblyBodies: AssemblyBody[] = []
  for (const slot of slots) {
    const bucket = buckets.get(slot)
    const count = triCount.get(slot)
    if (!bucket || count === undefined) continue
    const label = slotLabels?.[slot] ?? `Filament ${slot + 1}`
    const colorHex = filamentMap.slots[slot]
    bodies.push({ slot, label, colorHex, triangleCount: count })
    // extruder = emission order (ascending slot), 1-based — the same color→filament
    // convention `meshesToThreeMf` uses, so the print ticket stays correct.
    assemblyBodies.push({ positions: bucket.positions, colorHex, label, extruder: assemblyBodies.length + 1 })
  }

  // Multicolor: one bed-centered assembly object with an owned prime tower — the
  // 4-separate-object layout scatters the in-place beads and jams Orca's auto tower
  // (exit 154). Single filament already slices clean as one co-registered object.
  if (assemblyBodies.length >= 2) {
    const { bytes } = assembleAbacus3mf(assemblyBodies, BAMBU_256_BED)
    return { bytes, bodies }
  }

  const only = assemblyBodies[0]
  const stlBytes = writeBinaryStl(only.positions)
  const stlBuffer = new ArrayBuffer(stlBytes.byteLength) // ColorBody wants a plain ArrayBuffer
  new Uint8Array(stlBuffer).set(stlBytes)
  const colorBodies: ColorBody[] = [{ label: only.label, stl: stlBuffer, colorHex: only.colorHex }]
  return { bytes: meshesToThreeMf(colorBodies), bodies }
}
