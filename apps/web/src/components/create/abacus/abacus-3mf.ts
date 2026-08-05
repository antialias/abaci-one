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
 * Printed TPU feet (Gitea #23) ride the same part-pass pattern: the scad's
 * `only="feet"` selector renders the pocket-filling foot solids (stand-off
 * below z=0 + crossbar voids), merged here into the plan's `feet` slot. Feet
 * NEVER enter shell classification — a foot shell would centroid-map to a bead
 * column and silently mis-color. A printed-feet export always takes the
 * assembly path (even single-bodied) so `project_settings.config` can carry
 * the support keys the raised bottom face needs; missing/empty feet renders
 * are the same class of hard error as markerless markers.
 *
 * Inset text (Gitea #26) rides the same pattern once more, but split by COLOR
 * GROUP rather than by part: `only="text_plugs"` renders the perimeter writing's
 * inlay plugs, and `-Dplug_group=g` narrows a render to the tokens the scad
 * would tint with palette ink `g`. One render per group, each merged into that
 * group's plan-assigned slot. Before this, the export asked for no plug pass at
 * all and every 3MF shipped the text pockets EMPTY — bare relief in frame
 * filament, the same class of silent bug the marker pass fixed.
 */
import { type BedSize, type ColorBody, meshesToThreeMf } from '@eink/frames-engine/print-bundle'
import { parseStl, type StlMesh, writeBinaryStl } from '@eink/frames-engine/stl'
import type { ThhBedGeometry } from '@/lib/abacus/print/filament-wire'
import {
  type AssemblyBody,
  assembleAbacus3mf,
  BAMBU_256_BED,
  DEFAULT_WIPE_TOWER_PROFILE,
  type WipeTowerProfileGeometry,
} from './abacus-3mf-assembly'
import {
  analyzeShells,
  anyTokens,
  type FilamentMap,
  type Params,
  shellSlotIndex,
} from './abacus-model'

/** One `only="text_plugs"` render, tagged with the `plug_group` it was rendered
 *  under. Tagged rather than positional so a dropped group can't silently shift
 *  every later group's geometry onto the wrong slot. */
export interface TextPlugRender {
  /** The `plug_group` define this render used — indexes `FilamentMap.textRoles`. */
  group: number
  stl: ArrayBuffer
}

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
  /** `only="feet"` part pass — null iff `params.feet_mode !== 'printed'` (or the
   *  frame was off). */
  feet: ArrayBuffer | null
  /** `only="text_plugs"` part passes, one per inlay color group. Empty iff the
   *  design has no inset writing to ink (emboss mode, no tokens, or no frame). */
  textPlugs: TextPlugRender[]
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
  /** Present only when the emitted body count makes Orca generate a tower. */
  wipeTower: {
    profile: string
    pinMm: { x: number; y: number }
    /** The filament count whose envelope row sized this reservation. Echoed to the
     *  service, which cross-checks it against the resolved plan and rejects a
     *  disagreement up front rather than letting a wrong-sized hole reach the slicer. */
    packedForFilaments: number
  } | null
}

/**
 * Project THH's reported machine geometry onto the `BedSize` the emitter and
 * the packer both take. Shared by the one-piece submit and the module-kit
 * plate (Gitea #32) so the two can't drift into disagreeing about the plate
 * they're laying parts on.
 *
 * Exclusion POLYGONS collapse to their axis-aligned bounding rect: everything
 * downstream reserves rectangles, and over-reserving a keep-out only costs
 * area, while under-reserving it puts a part where the printer can't print.
 * A zero-point zone is dropped rather than becoming a degenerate rect at the
 * origin — `Math.min()` of nothing is `Infinity`, which would poison the bed.
 *
 * Returns `undefined` for an absent bed, which every caller reads as "use the
 * bundled fallback plate" — a download-only path has no printer to ask.
 */
export function bedSizeFromThh(bed: ThhBedGeometry | undefined): BedSize | undefined {
  if (!bed) return undefined
  return {
    wMm: bed.sizeMm.x,
    dMm: bed.sizeMm.y,
    exclude: (bed.exclusionsMm ?? []).flatMap((zone) => {
      if (zone.pointsMm.length === 0) return []
      const xs = zone.pointsMm.map((point) => point[0])
      const ys = zone.pointsMm.map((point) => point[1])
      const x0 = Math.min(...xs)
      const y0 = Math.min(...ys)
      return [{ xMm: x0, yMm: y0, wMm: Math.max(...xs) - x0, dMm: Math.max(...ys) - y0 }]
    }),
  }
}

/**
 * Split the export STL by filament slot, merge in the marker part renders, and
 * build the multi-material 3MF.
 *
 * @param stl        The one-shot export render (binary STL, whole abacus).
 * @param markerBlack The `only="marker_black"` part render. Required (and
 *                   non-empty) when `params.show_markers`; ignored otherwise.
 * @param markerWhite The `only="marker_white"` part render, same contract.
 * @param feet       The `only="feet"` part render. Required (and non-empty)
 *                   when `params.feet_mode === 'printed'`; ignored otherwise.
 * @param textPlugs  The `only="text_plugs"` renders, one per inlay color group.
 *                   At least one must carry geometry when the design has inset
 *                   writing; ignored otherwise.
 * @param params     The scad params ALL the renders came from — shell
 *                   classification reads the same layout constants, and
 *                   `show_markers` / `feet_mode` / `text_mode` gate the part merges.
 * @param filamentMap The role→slot mapping the plan materialized — markers ride
 *                   its `markerBlack` / `markerWhite` slots, feet its `feet`
 *                   slot, inlay groups their `textRoles` slots (each present iff
 *                   the plan minted the matching role).
 * @param slotLabels Optional human names per slot (e.g. spool names from the
 *                   AMS roster); defaults to `Filament N`.
 * @param supportsAtSlice Whether the print this file is headed for will slice with
 *                   supports on because the operator's ticket style says so. Only
 *                   the print path knows this (a plain download carries no style,
 *                   and its own settings say supports off), and it only moves the
 *                   prime tower — printed feet turn supports on by themselves.
 */
export function buildAbacusThreeMf(args: {
  stl: ArrayBuffer
  markerBlack?: ArrayBuffer | null
  markerWhite?: ArrayBuffer | null
  feet?: ArrayBuffer | null
  textPlugs?: readonly TextPlugRender[] | null
  params: Params
  filamentMap: FilamentMap
  slotLabels?: readonly string[]
  supportsAtSlice?: boolean
  /** Selected printer geometry from THH; download-only callers use the fallback plate. */
  bed?: BedSize
  /** Selected printer's bounded profile; download-only callers use the bundled twin. */
  wipeTower?: WipeTowerProfileGeometry
  /** Filaments the ticket adds beyond the emitted bodies — the support-interface
   *  spool. A download adds none. */
  extraFilaments?: number
}): AbacusThreeMf {
  const {
    stl,
    markerBlack,
    markerWhite,
    feet,
    textPlugs,
    params,
    filamentMap,
    slotLabels,
    supportsAtSlice,
    bed = BAMBU_256_BED,
    wipeTower = DEFAULT_WIPE_TOWER_PROFILE,
    extraFilaments,
  } = args

  const mesh = parseStl(stl)
  if (mesh.triangleCount === 0) {
    throw new Error('export STL has no triangles — nothing to print')
  }

  const { triShell, shellInfo } = analyzeShells(mesh.positions, params)
  const slotOfShell = shellInfo.map((info) => shellSlotIndex(info, params, filamentMap))

  // Part-pass soups (markers, feet) never enter shell classification (a flush
  // marker would weld into the frame there; a foot shell would centroid-map to
  // a bead column) — they arrive as their own soups and merge straight into
  // their plan-assigned slots' buckets. The gates match the exporter's:
  // the part on AND a frame to sit in (a beads-only debug render has no pockets).
  const partSoups: { slot: number; positions: Float32Array }[] = []
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
    partSoups.push({ slot: filamentMap.markerBlack, positions: black.positions })
    partSoups.push({ slot: filamentMap.markerWhite, positions: white.positions })
  }
  const feetPrinted = params.feet_mode === 'printed' && params.show_frame
  if (feetPrinted) {
    if (filamentMap.feet === undefined) {
      // the plan mints the feet role from the same feet_mode — a map without the
      // slot means plan and params came from different designs (programming error)
      throw new Error('feet_mode is "printed" but the filament map has no feet slot')
    }
    if (!feet) {
      throw new Error(
        'feet_mode is "printed" but the feet part render is missing — refusing to build a footless 3MF'
      )
    }
    const feetSoup = parseStl(feet)
    if (feetSoup.triangleCount === 0) {
      throw new Error('the feet part render came back empty — refusing to build a footless 3MF')
    }
    partSoups.push({ slot: filamentMap.feet, positions: feetSoup.positions })
  }

  // Inset text: one render per inlay color group, each into its own plan slot.
  // Gated on the same three conditions the exporter gates on — inset mode, a
  // frame to carve pockets in, and something written.
  if (params.text_mode === 'inset' && params.show_frame && anyTokens(params)) {
    const textRoles = filamentMap.textRoles
    if (!textRoles || textRoles.length === 0) {
      // the plan mints one text role per color group from these same params, so
      // a map without them means plan and params came from different designs
      throw new Error('the design has inset text but the filament map has no text slots')
    }
    const inked: { group: number; slot: number; positions: Float32Array }[] = []
    let textTriangles = 0
    for (const plug of textPlugs ?? []) {
      const slot = textRoles[plug.group]
      if (slot === undefined) {
        throw new Error(
          `inset-text render for color group ${plug.group} has no slot in the filament map`
        )
      }
      const soup = parseStl(plug.stl)
      textTriangles += soup.triangleCount
      // A single group may legitimately come back empty — these are user glyphs,
      // and one unrenderable codepoint shouldn't kill an export. Unlike the
      // synthetic marker/feet geometry, per-group emptiness is not an error.
      if (soup.triangleCount === 0) continue
      inked.push({ group: plug.group, slot, positions: soup.positions })
    }
    // Zero across ALL groups — including no renders at all, the pre-#26 state of
    // the world — means the text never rendered, and shipping that is the empty
    // -pocket bug itself: bare relief in frame filament. Checked FIRST because it
    // is both the likelier failure and the more specific diagnosis.
    if (textTriangles === 0) {
      throw new Error(
        'the design has inset text but no text plug render carried geometry — refusing to ship empty pockets'
      )
    }
    // Then: every group the plan minted must have been rendered. The renders come
    // from a params snapshot while the map comes from the live store (see @param
    // params) — if the writing changed mid-export, a group's ink would silently
    // never print. Loud beats a quietly half-inked plate.
    const rendered = new Set((textPlugs ?? []).map((p) => p.group))
    if (rendered.size !== textRoles.length) {
      throw new Error(
        `the plan has ${textRoles.length} inset-text color groups but ${rendered.size} were rendered — the design changed mid-export`
      )
    }
    assertGroupsDiffer(inked)
    for (const g of inked) partSoups.push({ slot: g.slot, positions: g.positions })
  }

  return emitThreeMfBodies({
    mesh,
    triShell,
    slotOfShell,
    partSoups,
    filamentMap,
    slotLabels,
    feetPrinted,
    supportsAtSlice,
    bed,
    wipeTower,
    extraFilaments,
  })
}

/**
 * The shared emit tail of the whole-abacus and per-module 3MF builders: bucket
 * the classified main soup plus the part soups per filament slot, then pick the
 * container. Factored, not forked (buildModuleThreeMf in abacus-module-kit.ts
 * is the second caller), so a container-law fix — like the exit-154/155 lessons
 * in the comments below — can never apply to one builder and miss the other.
 * The builders keep their own classification and hard-error contracts; only the
 * mechanical bucket/emit stage is shared.
 */
export function emitThreeMfBodies(args: {
  mesh: StlMesh
  triShell: Int32Array
  slotOfShell: readonly number[]
  partSoups: readonly { slot: number; positions: Float32Array }[]
  filamentMap: FilamentMap
  slotLabels?: readonly string[]
  /** Printed feet force the assembly path even single-bodied AND bake the
   *  support keys into project_settings.config. */
  feetPrinted: boolean
  supportsAtSlice?: boolean
  bed: BedSize
  wipeTower: WipeTowerProfileGeometry
  /** The soups are already laid out on this bed (the packed module-kit plate,
   *  Gitea #32) — see `Assemble3mfOpts.placedOnBed`. Forces the assembly path:
   *  a plate is a placed layout even when it lands on one filament, and the
   *  single-body path would re-origin it into the bed corner. */
  placedOnBed?: { towerPinMm: { x: number; y: number } }
  /** Filaments the resolved ticket will load that no body carries — today the
   *  support-interface spool, so 0 or 1. Added to the emitted body count to pick
   *  the tower's envelope row and to report `packedForFilaments`. */
  extraFilaments?: number
}): AbacusThreeMf {
  const {
    mesh,
    triShell,
    slotOfShell,
    partSoups,
    filamentMap,
    slotLabels,
    feetPrinted,
    supportsAtSlice,
    bed,
    wipeTower,
    placedOnBed,
    extraFilaments = 0,
  } = args

  // Count triangles per slot, then bucket the position soup (9 floats/tri).
  const triCount = new Map<number, number>()
  for (let t = 0; t < mesh.triangleCount; t++) {
    const slot = slotOfShell[triShell[t]]
    triCount.set(slot, (triCount.get(slot) ?? 0) + 1)
  }
  // Part counts join BEFORE bucket allocation — a marker/feet slot with no
  // frame/bead geometry (the typical case) gets its bucket created here.
  for (const soup of partSoups) {
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
  // Part soups append after the main soup (deterministic body content:
  // frame/beads first, then black, then white, then feet when slots collide).
  for (const soup of partSoups) {
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
  // (exit 154). Single filament already slices clean as one co-registered object —
  // EXCEPT with printed feet, which force the assembly path even single-bodied:
  // only project_settings.config can carry the support keys the raised bottom
  // face needs, and meshesToThreeMf emits none.
  //
  // `supportsAtSlice` is separate from `feetPrinted` on purpose: supports push the
  // first layer past the model outline, so the tower needs a wider gap whenever
  // they're on — and the operator's style can turn them on for a design with no
  // printed feet at all. Keying the wider gap off feet alone is what let prod pin a
  // tower just 6 mm from a supported model before exit 155 (2026-07-29); a later A/B
  // slices that same 6 mm clean, so read the extra room as margin, not a proven cure.
  // Single filament needs neither: no second extruder, no tower, nothing to collide with.
  // What the plate will actually load: one filament per emitted body, plus whatever
  // routing adds on top. This is the same arithmetic the ticket does downstream (one
  // entry per distinct body slot, then the support-interface entry), derived from the
  // same slot set, so the reservation and the declared count cannot disagree.
  const plateFilaments = bodies.length + extraFilaments

  if (assemblyBodies.length >= 2 || feetPrinted || placedOnBed) {
    const assembled = assembleAbacus3mf(assemblyBodies, bed, {
      support: feetPrinted,
      supportsAtSlice,
      wipeTower,
      placedOnBed,
      filaments: plateFilaments,
    })
    return {
      bytes: assembled.bytes,
      bodies,
      // Printed feet force this assembly path even when the model itself is monochrome. Keep
      // the pin available because ticket routing may add a distinct support-interface spool,
      // turning that one-body model into a real two-filament/tower slice.
      wipeTower: {
        profile: wipeTower.profile,
        pinMm: { x: assembled.wipeTower.xMm, y: assembled.wipeTower.yMm },
        packedForFilaments: plateFilaments,
      },
    }
  }

  const only = assemblyBodies[0]
  const stlBytes = writeBinaryStl(only.positions)
  const stlBuffer = new ArrayBuffer(stlBytes.byteLength) // ColorBody wants a plain ArrayBuffer
  new Uint8Array(stlBuffer).set(stlBytes)
  const colorBodies: ColorBody[] = [{ label: only.label, stl: stlBuffer, colorHex: only.colorHex }]
  return { bytes: meshesToThreeMf(colorBodies), bodies, wipeTower: null }
}

/**
 * The one check that catches a dropped, misspelled, or ignored `plug_group`
 * define — the highest-consequence silent failure in the inset-text path.
 *
 * The scad's `plug_group` defaults to -1 meaning "every token", so a define that
 * never lands doesn't error: each group's render comes back with ALL the text,
 * and the 3MF ships G overlapping copies of the writing on G extruders. That
 * looks entirely plausible in a slicer preview and prints as a smeared mess.
 *
 * Two groups can never legitimately share geometry — every token occupies its
 * own position along its rail — so identical soups mean the filter didn't apply.
 * Compared by triangle count plus the first triangle's 9 floats: enough to
 * separate real groups (which differ in the very first glyph's x) without
 * walking megabytes of vertices.
 *
 * Exported for the per-module kit build (abacus-module-kit.ts), whose
 * module_left_text/module_right_text passes ride the same plug_group define
 * and therefore the same failure mode — factored, not forked.
 */
export function assertGroupsDiffer(
  inked: readonly { group: number; positions: Float32Array }[]
): void {
  for (let i = 0; i < inked.length; i++) {
    for (let j = i + 1; j < inked.length; j++) {
      const a = inked[i].positions
      const b = inked[j].positions
      if (a.length !== b.length) continue
      let same = true
      for (let k = 0; k < 9; k++) {
        if (a[k] !== b[k]) {
          same = false
          break
        }
      }
      if (same) {
        throw new Error(
          `inset-text color groups ${inked[i].group} and ${inked[j].group} rendered identical geometry — the plug_group filter did not apply`
        )
      }
    }
  }
}
