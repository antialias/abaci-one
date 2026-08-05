/**
 * Modular-column print kit (Gitea #30, Phase 1).
 *
 * In modular mode the deliverable is not one 3MF but a KIT: per-module print
 * jobs the user downloads as a zip and prints module by module. Three module
 * geometries exist (left end, mid, right end — the same module_* passes the
 * assembled preview instantiates, so kit and preview cannot drift), but bead
 * COLORS vary by the column a mid module will occupy: under place-value
 * coloring a 13-column abacus needs only 5 distinct mid PRINTS covering its 11
 * mid columns. `moduleKitPlan` does that dedupe — one render per geometry, one
 * 3MF VARIANT per distinct bead-slot signature, filenames carrying the print
 * count (`module-mid-10s-x3.3mf`).
 *
 * `buildModuleThreeMf` is deliberately PARALLEL to `buildAbacusThreeMf`, not a
 * generalization of it: the whole-abacus builder's marker/text hard-errors are
 * whole-abacus law (modules carry no marker plugs or inlay text in phase 1 —
 * end modules ship engraved ArUco pockets only, and the perimeter writing is
 * laid out on the mono frame width). What IS shared is the mechanical
 * bucket/emit tail (`emitThreeMfBodies`) and the classifier-to-slot mapping
 * (`shellSlotIndex`), so container law and role→filament law each live in one
 * place. Classification goes through `analyzeModuleShells`, the hard-error
 * gate that refuses to ship a module whose topology isn't exactly one frame
 * body plus one column of beads.
 *
 * Printed TPU feet ride exactly like the mono export: the module_*_feet part
 * passes merge into the plan's `feet` slot without classification, and their
 * absence when `feet_mode === 'printed'` is a hard error — a footless module
 * is the same silent-bug family as a markerless mono plate.
 */
import type { BedSize } from '@eink/frames-engine/print-bundle'
import { parseStl } from '@eink/frames-engine/stl'
import { strToU8, zipSync } from 'fflate'
import { type AbacusThreeMf, emitThreeMfBodies, type SpoolBodySummary } from './abacus-3mf'
import {
  BAMBU_256_BED,
  DEFAULT_WIPE_TOWER_PROFILE,
  type WipeTowerProfileGeometry,
} from './abacus-3mf-assembly'
import {
  analyzeModuleShells,
  beadRoleIndex,
  beadRoleNames,
  derived,
  type FilamentMap,
  isModular,
  type Params,
  shellSlotIndex,
} from './abacus-model'

export type ModuleKind = 'left' | 'mid' | 'right'

/** The one-shot module renders the kit consumes, snapshotted from a single
 *  `Params` value inside the viewer (same contract as `AbacusExportParts`) so
 *  the six passes can never mix designs mid-export. Feet renders are null iff
 *  the snapshot's feet were not printed-mode. */
export interface ModuleExportParts {
  left: ArrayBuffer
  mid: ArrayBuffer
  right: ArrayBuffer
  leftFeet: ArrayBuffer | null
  midFeet: ArrayBuffer | null
  rightFeet: ArrayBuffer | null
  /** The exact snapshot all renders used — pass THIS to the kit build. */
  params: Params
}

/** One printable file of the kit: which geometry, which global column's bead
 *  roles ink it, and how many copies the assembled abacus needs. */
export interface ModuleKitEntry {
  kind: ModuleKind
  /** Representative global column — every column in this entry's group maps its
   *  bead roles to the same filament slots, so one file serves them all. */
  column: number
  count: number
  /** Zip member name, print count encoded (`module-mid-10s-x3.3mf`). */
  file: string
}

/**
 * The kit's file plan: ends print once each; mid columns (1…cols−2) group by
 * their bead-slot SIGNATURE — heaven slot + earth slot under the live filament
 * map — because two mid modules whose beads land on the same spools are the
 * same physical print. Grouping by slot rather than by role also merges roles
 * the user pinned onto one spool. Variant labels come from the bead role
 * names of the columns in the group (joined when a pin merged roles); a kit
 * with a single mid variant drops the label entirely.
 */
export function moduleKitPlan(p: Params, fm: FilamentMap): ModuleKitEntry[] {
  const roleOf = (i: number, heaven: boolean): number =>
    beadRoleIndex(i, heaven, p.color_scheme, p.cols, p.color_palette)
  const slotSig = (i: number): string =>
    `${fm.beadRoles[roleOf(i, true)]}:${fm.beadRoles[roleOf(i, false)]}`

  // first-seen order, walking columns left→right
  const groups = new Map<string, number[]>()
  for (let i = 1; i <= p.cols - 2; i++) {
    const g = groups.get(slotSig(i))
    if (g) g.push(i)
    else groups.set(slotSig(i), [i])
  }
  const single = groups.size <= 1
  const names = beadRoleNames(p.color_scheme)
  const mids: ModuleKitEntry[] = [...groups.values()].map((cols) => {
    const labels = [...new Set(cols.map((i) => names[roleOf(i, false)]))]
    const label = labels.join('+').toLowerCase().replace(/\s+/g, '-')
    return {
      kind: 'mid',
      column: cols[0],
      count: cols.length,
      file: single ? `module-mid-x${cols.length}.3mf` : `module-mid-${label}-x${cols.length}.3mf`,
    }
  })
  return [
    { kind: 'left', column: 0, count: 1, file: 'module-left.3mf' },
    ...mids,
    { kind: 'right', column: p.cols - 1, count: 1, file: 'module-right.3mf' },
  ]
}

/**
 * Build one per-module multi-material 3MF. Same downstream law as the
 * whole-abacus build: shells map to slots via `shellSlotIndex` (the bead
 * shells stamped with `column` so they ink with that column's roles), feet
 * merge unclassified into the plan's feet slot, and the container choice +
 * support keys ride `emitThreeMfBodies`.
 */
export function buildModuleThreeMf(args: {
  /** The module_{kind} body render. */
  body: ArrayBuffer
  /** The module_{kind}_feet render — required (and non-empty) when
   *  `params.feet_mode === 'printed'`; ignored otherwise. */
  feet?: ArrayBuffer | null
  kind: ModuleKind
  /** Global column whose bead roles color this module's beads. */
  column: number
  params: Params
  filamentMap: FilamentMap
  slotLabels?: readonly string[]
  supportsAtSlice?: boolean
  bed?: BedSize
  wipeTower?: WipeTowerProfileGeometry
}): AbacusThreeMf {
  const {
    body,
    feet,
    kind,
    column,
    params,
    filamentMap,
    slotLabels,
    supportsAtSlice,
    bed = BAMBU_256_BED,
    wipeTower = DEFAULT_WIPE_TOWER_PROFILE,
  } = args

  const mesh = parseStl(body)
  if (mesh.triangleCount === 0) {
    throw new Error(`the module_${kind} render has no triangles — nothing to print`)
  }

  const { triShell, shellInfo } = analyzeModuleShells(mesh.positions, params, kind, column)
  const slotOfShell = shellInfo.map((info) => shellSlotIndex(info, params, filamentMap))

  // Feet ride the same unclassified part-pass merge as the mono export, under
  // the same gate (see buildAbacusThreeMf) so the map's conditional feet slot
  // and this consumer can never disagree about when feet exist.
  const partSoups: { slot: number; positions: Float32Array }[] = []
  const feetPrinted = params.feet_mode === 'printed' && params.show_frame
  if (feetPrinted) {
    if (filamentMap.feet === undefined) {
      throw new Error('feet_mode is "printed" but the filament map has no feet slot')
    }
    if (!feet) {
      throw new Error(
        `feet_mode is "printed" but the module_${kind}_feet render is missing — refusing to build a footless module 3MF`
      )
    }
    const feetSoup = parseStl(feet)
    if (feetSoup.triangleCount === 0) {
      throw new Error(
        `the module_${kind}_feet render came back empty — refusing to build a footless module 3MF`
      )
    }
    partSoups.push({ slot: filamentMap.feet, positions: feetSoup.positions })
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
  })
}

/** Sweep-encoded kit name: the fit these modules were generated at rides the
 *  filename so a reprint after coupon tuning is attributable. */
export const kitFilename = (p: Params): string =>
  `abacus-modular-kit-${p.cols}col-x${p.scale_factor}-fit${p.joint_fit}.zip`

export interface ModuleKitFile {
  file: string
  count: number
  bodies: SpoolBodySummary[]
}

export interface ModuleKit {
  /** The finished kit zip. */
  bytes: Uint8Array
  filename: string
  /** One entry per zip member 3MF, plan order — feeds the panel + tests. */
  modules: ModuleKitFile[]
}

/**
 * Assemble the downloadable kit: one 3MF per plan entry (mid variants re-split
 * the SAME mid render with different column stamps — one render per geometry,
 * one file per bead-slot variant), plus a README with the print counts and the
 * fit-tuning ritual. The member 3MFs are stored uncompressed (level 0): each
 * is already a zip, deflate would spend CPU shaving ~nothing.
 */
export function buildModuleKit(args: {
  parts: ModuleExportParts
  filamentMap: FilamentMap
  slotLabels?: readonly string[]
  bed?: BedSize
  wipeTower?: WipeTowerProfileGeometry
}): ModuleKit {
  const { parts, filamentMap, slotLabels, bed, wipeTower } = args
  const p = parts.params
  if (!isModular(p)) {
    throw new Error('the module kit is a modular-mode export — this design is seam_mode "mono"')
  }

  const bodyOf: Record<ModuleKind, ArrayBuffer> = {
    left: parts.left,
    mid: parts.mid,
    right: parts.right,
  }
  const feetOf: Record<ModuleKind, ArrayBuffer | null> = {
    left: parts.leftFeet,
    mid: parts.midFeet,
    right: parts.rightFeet,
  }

  const entries = moduleKitPlan(p, filamentMap)
  const zipInput: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {}
  const modules: ModuleKitFile[] = []
  for (const e of entries) {
    const built = buildModuleThreeMf({
      body: bodyOf[e.kind],
      feet: feetOf[e.kind],
      kind: e.kind,
      column: e.column,
      params: p,
      filamentMap,
      slotLabels,
      bed,
      wipeTower,
    })
    zipInput[e.file] = [built.bytes, { level: 0 }]
    modules.push({ file: e.file, count: e.count, bodies: built.bodies })
  }
  zipInput['README.txt'] = strToU8(kitReadme(p, modules))

  return { bytes: zipSync(zipInput), filename: kitFilename(p), modules }
}

/** The kit's printed instructions — counts, assembly, the joint_fit ritual,
 *  the TPU note, and the phase-1 marker/frame-text limitations. Plain text on purpose:
 *  it gets read next to a slicer, not in a browser. */
function kitReadme(p: Params, modules: readonly ModuleKitFile[]): string {
  const d = derived(p)
  const printList = modules.map((m) => `  ${m.file.padEnd(34)} print x ${m.count}`).join('\n')
  const totalPrints = modules.reduce((n, m) => n + m.count, 0)
  return `Modular abacus print kit
========================

Design: ${p.cols} columns at scale x${p.scale_factor}, joint fit ${p.joint_fit} mm
Assembled size: ${d.frameW.toFixed(1)} x ${d.outerD.toFixed(1)} x ${(
    p.frame_h * p.scale_factor
  ).toFixed(1)} mm (2 end modules + ${p.cols - 2} mid columns)

Print list (${totalPrints} prints total)
----------
${printList}

Each .3mf is a complete per-module print job. Mid variants differ only in
bead filament slots — print each one as many times as the x-count in its
filename says.

Assembly
--------
Modules snap together left to right. The two dovetails (front and back
edges) carry the pull-apart load, and the two-prong clip at the crossbar
band locks the height with a click. All joint features are full-height
vertical prisms, so any middle module drops straight in — or lifts straight
out — of an assembled row. The dovetail bottom seat sets the seated height:
press down until the click and the tops sit flush.

Tuning joint fit
----------------
Before printing the whole kit, print the seam coupon pair from the studio
and walk joint_fit in 0.05 mm steps: looser (+) if the click takes more
than firm hand force, tighter (-) until seam wiggle dies. Then regenerate
the kit at the fit the coupon settles on — the kit filename records the fit
these modules were generated at.

TPU feet
--------
${
  p.feet_mode === 'printed'
    ? `Feet bodies ride each module's 3MF on their own filament slot and are
meant for a flexible filament (TPU). If no TPU spool is loaded, the studio's
plan falls back to the frame filament — rigid feet still print and stand,
they just don't grip like TPU.`
    : `This design does not use printed feet (feet_mode "${p.feet_mode}"), so
the kit's modules carry no feet bodies.`
}

Markers (camera features)
-------------------------
End modules carry the engraved ArUco corner pockets, but this phase-1 kit
does NOT include the printed marker inlays — camera reading of a modular
abacus lands in a later phase. A monolithic (non-modular) export is the way
to get camera-readable markers today.

Frame text
----------
Modules print WITHOUT the frame text tokens (the complement facts along the
rails). Per-module text would make every mid column a unique print and
defeat this kit's shared-file dedupe, so it lands in a later phase — a
monolithic export is the way to get frame text today.
`
}
