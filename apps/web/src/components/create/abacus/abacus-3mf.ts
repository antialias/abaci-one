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
 * ArUco corner markers (Gitea #12) arrive as SEPARATE render passes, not a
 * split of the main STL: the main render keeps the scad default
 * `inlay_plugs=false` (a flush plug in the same STL would weld into the frame
 * shell and be unsplittable), and the scad's `only="marker_black"` /
 * `only="marker_white"` selectors render just the four corner plugs each.
 * Those soups are merged here into the buckets of the plan's markerBlack /
 * markerWhite slots — co-registered by construction (same scad coordinate
 * frame), flush in the frame's pockets. When `show_markers` is on, missing or
 * empty marker renders are a hard error: silently shipping a markerless print
 * is the exact bug this path exists to prevent.
 *
 * Inset text stays deferred: its plugs ride no FilamentMap slot yet (P1 scope
 * is frame + markers + beads; per-token text color is P4 territory), so inset
 * text still prints as empty pockets in the frame body.
 */
import { type ColorBody, meshesToThreeMf } from '@eink/frames-engine/print-bundle'
import { parseStl, writeBinaryStl } from '@eink/frames-engine/stl'
import { type AssemblyBody, assembleAbacus3mf, BAMBU_256_BED } from './abacus-3mf-assembly'
import { analyzeShells, type FilamentMap, type Params, shellSlotIndex } from './abacus-model'

/**
 * The one-shot export renders the 3MF build consumes, snapshotted from a single
 * `Params` value so frame and markers can never come from different designs.
 * Produced by the viewer's registered exporter (`exportParts`).
 */
export interface AbacusExportParts {
  /** Whole-abacus render: frame (blank marker pockets) + free beads. */
  stl: ArrayBuffer
  /** `only="marker_black"` part pass — null iff markers were off in `params`. */
  markerBlack: ArrayBuffer | null
  /** `only="marker_white"` part pass — null iff markers were off in `params`. */
  markerWhite: ArrayBuffer | null
  /** The exact snapshot all renders used — pass THIS to `buildAbacusThreeMf`,
   *  not the live store value, so shell classification matches the geometry. */
  params: Params
}

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
 * Split the export STL by filament slot, merge in the marker part renders, and
 * build the multi-material 3MF.
 *
 * @param stl        The one-shot export render (binary STL, whole abacus).
 * @param markerBlack The `only="marker_black"` part render. Required (and
 *                   non-empty) when `params.show_markers`; ignored otherwise.
 * @param markerWhite The `only="marker_white"` part render, same contract.
 * @param params     The scad params ALL the renders came from — shell
 *                   classification reads the same layout constants, and
 *                   `show_markers` gates the marker merge.
 * @param filamentMap The role→slot mapping the plan materialized — markers ride
 *                   its `markerBlack` / `markerWhite` slots.
 * @param slotLabels Optional human names per slot (e.g. spool names from the
 *                   AMS roster); defaults to `Filament N`.
 */
export function buildAbacusThreeMf(args: {
  stl: ArrayBuffer
  markerBlack?: ArrayBuffer | null
  markerWhite?: ArrayBuffer | null
  params: Params
  filamentMap: FilamentMap
  slotLabels?: readonly string[]
}): AbacusThreeMf {
  const { stl, markerBlack, markerWhite, params, filamentMap, slotLabels } = args

  const mesh = parseStl(stl)
  if (mesh.triangleCount === 0) {
    throw new Error('export STL has no triangles — nothing to print')
  }

  const { triShell, shellInfo } = analyzeShells(mesh.positions, params)
  const slotOfShell = shellInfo.map((info) => shellSlotIndex(info, params, filamentMap))

  // The marker plugs never enter shell classification (flush solids would weld
  // into the frame there) — they arrive as their own soups and merge straight
  // into their plan-assigned slots' buckets. The gate matches the exporter's:
  // markers on AND a frame to sit in (a beads-only debug render has no pockets).
  const markerSoups: { slot: number; positions: Float32Array }[] = []
  if (params.show_markers && params.show_frame) {
    if (!markerBlack || !markerWhite) {
      throw new Error(
        'show_markers is on but the marker part renders are missing — refusing to build a markerless 3MF'
      )
    }
    const black = parseStl(markerBlack)
    const white = parseStl(markerWhite)
    if (black.triangleCount === 0 || white.triangleCount === 0) {
      throw new Error('a marker part render came back empty — refusing to build a markerless 3MF')
    }
    markerSoups.push({ slot: filamentMap.markerBlack, positions: black.positions })
    markerSoups.push({ slot: filamentMap.markerWhite, positions: white.positions })
  }

  // Count triangles per slot, then bucket the position soup (9 floats/tri).
  const triCount = new Map<number, number>()
  for (let t = 0; t < mesh.triangleCount; t++) {
    const slot = slotOfShell[triShell[t]]
    triCount.set(slot, (triCount.get(slot) ?? 0) + 1)
  }
  // Marker counts join BEFORE bucket allocation — a marker slot with no
  // frame/bead geometry (the typical case) gets its bucket created here.
  for (const soup of markerSoups) {
    triCount.set(soup.slot, (triCount.get(soup.slot) ?? 0) + soup.positions.length / 9)
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
  // Marker soups append after the main soup (deterministic body content:
  // frame/beads first, then black, then white when slots collide).
  for (const soup of markerSoups) {
    const bucket = buckets.get(soup.slot)
    if (!bucket) continue
    bucket.positions.set(soup.positions, bucket.fill)
    bucket.fill += soup.positions.length
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
    assemblyBodies.push({
      positions: bucket.positions,
      colorHex,
      label,
      extruder: assemblyBodies.length + 1,
    })
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
