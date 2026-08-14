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
 * generalization of it: the whole-abacus builder's marker hard-errors are
 * whole-abacus law (modules carry no marker plugs in phase 1 — end modules
 * ship engraved ArUco pockets only). Inset frame text DOES ride the end
 * modules: the side rails and end walls sit wholly inside them, so each end
 * carries its own side's inlay bodies (`module_left_text`/`module_right_text`
 * passes, partitioned by `sideTextGroups`) under a per-side mirror of the mono
 * builder's empty-pocket error family. What IS shared is the mechanical
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
import { parseStl, type StlMesh } from '@eink/frames-engine/stl'
import { strToU8, zipSync } from 'fflate'
import {
  type AbacusThreeMf,
  assertGroupsDiffer,
  emitThreeMfBodies,
  type SpoolBodySummary,
  type TextPlugRender,
} from './abacus-3mf'
import {
  BAMBU_256_BED,
  DEFAULT_WIPE_TOWER_PROFILE,
  type WipeTowerProfileGeometry,
} from './abacus-3mf-assembly'
import {
  analyzeModuleShells,
  anyTokens,
  beadRoleIndex,
  beadRoleNames,
  bumperLabel,
  derived,
  type FilamentMap,
  isModular,
  matchBumper,
  type Params,
  shellSlotIndex,
  sideTextGroups,
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
  /** `only="module_left_text"` / `module_right_text` part passes, one per inlay
   *  color group PRESENT ON THAT SIDE (sideTextGroups — the two ends partition
   *  the plate's groups, so `group` indexes FilamentMap.textRoles exactly like
   *  the mono passes). Empty iff nothing inset prints on that end module:
   *  emboss mode, no frame, or no tokens on that side's rail + wall. */
  leftText: TextPlugRender[]
  rightText: TextPlugRender[]
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
 * One module's export-gated geometry, in the module's OWN render frame and
 * before any container decision: the classified body soup (per-triangle shell,
 * per-shell filament slot) plus the part-pass soups already assigned to their
 * slots.
 *
 * Two consumers: `buildModuleThreeMf` emits it as that module's own 3MF, and
 * the single-plate kit build (abacus-kit-plate.ts) places a rigidly-transformed
 * copy per instance and emits a whole plate as one. Factored rather than forked
 * so every module on a packed plate passes the exact same hard-error gate its
 * standalone 3MF would — a plate must never be the loophole that ships a
 * footless module or an empty text pocket.
 */
export interface ModuleSoups {
  /** The module_{kind} body render, parsed. */
  mesh: StlMesh
  /** Per-triangle shell index into `slotOfShell` (from `analyzeModuleShells`). */
  triShell: Int32Array
  /** Filament slot per shell. */
  slotOfShell: number[]
  /** Feet + inset-text soups, each already assigned its plan slot. */
  partSoups: { slot: number; positions: Float32Array }[]
  /** Printed feet rode this module — forces the assembly path + support keys. */
  feetPrinted: boolean
}

/**
 * Classify one module and run every hard-error gate the kit ships under: shells
 * map to slots via `shellSlotIndex` (bead shells stamped with `column` so they
 * ink with that column's roles), feet merge unclassified into the plan's feet
 * slot, inset side text merges per color group into its own slot. The result is
 * still in the module's render frame — placement, container choice and support
 * keys are the caller's.
 */
export function moduleSoups(args: {
  /** The module_{kind} body render. */
  body: ArrayBuffer
  /** The module_{kind}_feet render — required (and non-empty) when
   *  `params.feet_mode === 'printed'`; ignored otherwise. */
  feet?: ArrayBuffer | null
  /** The module_{kind}_text renders — end modules only, one per color group
   *  that side carries (must cover `sideTextGroups(params, kind)` exactly when
   *  inset text is on); mid modules may never receive any. */
  text?: TextPlugRender[] | null
  kind: ModuleKind
  /** Global column whose bead roles color this module's beads. */
  column: number
  params: Params
  filamentMap: FilamentMap
}): ModuleSoups {
  const { body, feet, text, kind, column, params, filamentMap } = args

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

  // Inset side text (the CP-A end-module pockets): one render per color group
  // present on THIS side, each into its plan slot. The error family mirrors the
  // mono build's (abacus-3mf.ts), scoped per side — the module body carries the
  // carved pockets, so shipping without the plugs is the empty-pocket bug the
  // mono family exists to refuse. Mid modules never carry text (that's what
  // keeps the mid-variant dedupe intact), so renders on one are a hard error.
  const textEligible = params.text_mode === 'inset' && params.show_frame && kind !== 'mid'
  const textRenders = text ?? []
  if (!textEligible && textRenders.length > 0) {
    throw new Error(
      `module_${kind} was handed ${textRenders.length} inset-text render(s) it cannot carry`
    )
  }
  if (textEligible) {
    const expected = sideTextGroups(params, kind as 'left' | 'right')
    if (expected.length > 0 || textRenders.length > 0) {
      const textRoles = filamentMap.textRoles
      if (!textRoles || textRoles.length === 0) {
        throw new Error(
          `the ${kind} end module has inset text but the filament map has no text slots`
        )
      }
      const inked: { group: number; slot: number; positions: Float32Array }[] = []
      let textTriangles = 0
      for (const plug of textRenders) {
        const slot = textRoles[plug.group]
        if (slot === undefined) {
          throw new Error(
            `inset-text render for color group ${plug.group} has no slot in the filament map`
          )
        }
        const soup = parseStl(plug.stl)
        textTriangles += soup.triangleCount
        // per-group emptiness tolerated, same as mono: these are user glyphs
        if (soup.triangleCount === 0) continue
        inked.push({ group: plug.group, slot, positions: soup.positions })
      }
      if (textTriangles === 0) {
        throw new Error(
          `the ${kind} end module has inset text but no text render carried geometry — refusing to ship empty pockets`
        )
      }
      const rendered = new Set(textRenders.map((t) => t.group))
      if (rendered.size !== expected.length || expected.some((g) => !rendered.has(g))) {
        throw new Error(
          `the ${kind} end module needs inset-text groups [${expected.join(', ')}] but [${[...rendered].sort((a, b) => a - b).join(', ')}] were rendered — the design changed mid-export`
        )
      }
      assertGroupsDiffer(inked)
      for (const g of inked) partSoups.push({ slot: g.slot, positions: g.positions })
    }
  }

  return { mesh, triShell, slotOfShell, partSoups, feetPrinted }
}

/**
 * Build one per-module multi-material 3MF: the gated soups above, emitted
 * through the shared container tail. Same downstream law as the whole-abacus
 * build — the container choice and support keys ride `emitThreeMfBodies`.
 */
export function buildModuleThreeMf(args: {
  body: ArrayBuffer
  feet?: ArrayBuffer | null
  text?: TextPlugRender[] | null
  kind: ModuleKind
  column: number
  params: Params
  filamentMap: FilamentMap
  slotLabels?: readonly string[]
  supportsAtSlice?: boolean
  bed?: BedSize
  wipeTower?: WipeTowerProfileGeometry
}): AbacusThreeMf {
  const {
    filamentMap,
    slotLabels,
    supportsAtSlice,
    bed = BAMBU_256_BED,
    wipeTower = DEFAULT_WIPE_TOWER_PROFILE,
  } = args

  return emitThreeMfBodies({
    ...moduleSoups(args),
    filamentMap,
    slotLabels,
    supportsAtSlice,
    bed,
    wipeTower,
  })
}

/** Stable human-readable topology identity used by outer deliverable names. */
export const jointFilenameSlug = (p: Params): string =>
  p.joint_type === 'sliding_dovetail' ? 'sliding-dovetail' : 'vertical-snap'

/** Sweep-encoded kit name: topology and fit ride the filename so a reprint
 *  after coupon tuning is attributable. */
export const kitFilename = (p: Params): string =>
  `abacus-modular-kit-${jointFilenameSlug(p)}-${p.cols}col-x${p.scale_factor}-fit${p.joint_fit}.zip`

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
  const textOf: Record<ModuleKind, TextPlugRender[]> = {
    left: parts.leftText,
    mid: [], // mid modules never carry text — the mid-variant dedupe depends on it
    right: parts.rightText,
  }

  const entries = moduleKitPlan(p, filamentMap)
  const zipInput: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {}
  const modules: ModuleKitFile[] = []
  for (const e of entries) {
    const built = buildModuleThreeMf({
      body: bodyOf[e.kind],
      feet: feetOf[e.kind],
      text: textOf[e.kind],
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
 *  the TPU note, the phase-1 marker limitation, and where frame text does and
 *  doesn't print. Plain text on purpose: it gets read next to a slicer, not in
 *  a browser. */
function kitReadme(p: Params, modules: readonly ModuleKitFile[]): string {
  const d = derived(p)
  const printList = modules.map((m) => `  ${m.file.padEnd(34)} print x ${m.count}`).join('\n')
  const totalPrints = modules.reduce((n, m) => n + m.count, 0)
  return `Modular abacus print kit
========================

Design: ${p.cols} columns at scale x${p.scale_factor}, joint fit ${p.joint_fit} mm
Joint mechanism: ${p.joint_type === 'sliding_dovetail' ? 'rear-entry graduated sliding dovetail' : 'vertical dovetails + snap clip'}
Assembled size: ${d.frameW.toFixed(1)} x ${d.outerD.toFixed(1)} x ${(
    p.frame_h * p.scale_factor
  ).toFixed(1)} mm (2 end modules + ${p.cols - 2} mid columns)

Print list (${totalPrints} prints total)
----------
${printList}

Each .3mf is a complete per-module print job. Mid variants differ only in
bead filament slots — print each one as many times as the x-count in its
filename says.

Assembly and removal
--------------------
${assemblyNote(p)}

Coupon and joint fit
--------------------
${couponNote(p)}

Feet
----
${feetNote(p)}

Markers (camera features)
-------------------------
End modules carry the engraved ArUco corner pockets, but this phase-1 kit
does NOT include the printed marker inlays — camera reading of a modular
abacus lands in a later phase. A monolithic (non-modular) export is the way
to get camera-readable markers today.

Frame text
----------
${frameTextNote(p)}
`
}

function assemblyNote(p: Params): string {
  if (p.joint_type === 'sliding_dovetail') {
    return `Build the row from left to right. Each seam carries ONE continuous
graduated dovetail rail that enters through the REAR face: align the new
module behind its neighbor, drop the rail into the rear entry mouth, and
slide it forward on the table. The rail runs loose for almost the whole
travel and only engages over roughly the last centimeter, so there is no
full-length scraping. Its rear end is a deep anchor block that bites
9 mm into the neighbor — more than half way across its underside — and
hooks the pull-apart direction on BOTH lips: the anchor is symmetric top
to bottom, and it rides on a solid 1.7 mm berth floor rather than on the
table, so no seam surface opens through the bottom face. Keep both
modules flat on the table while sliding. Push firmly until the module
stops against the blind front seat and the seam shoulders close — the
tapered seat is self-holding, like a lightly set Morse taper. Over the
last few millimeters the rail climbs a ridge on the berth floor and the
push gets noticeably firmer; the ridge drops into a notch with a click as
the seat is reached. That click is the seated signal: if it has not
happened, the module is not home. There is no separate clip — a slot
behind the middle of the rail makes that stretch of rail its own spring,
so it is the module you are pushing that flexes, not the one already in
the row.

Each sliding seam adds 2 mm of assembled width — that is what pays for a
2 mm-deep rail — so a sliding row is wider than the same abacus in
vertical-snap modules. The bead channels are untouched.

To remove a module, grip it and give it a firm rearward tug — enough to
lift the detent out of its notch and break the taper — then slide it out
the back. A middle module cannot lift straight out; unzip the row from
either end until the module is exposed. Do not pry the dovetail apart.`
  }
  return `Modules join left to right. The two vertical dovetails (front and back
edges) carry the pull-apart load, and the two-prong clip at the crossbar
band locks the height with a click. Any middle module drops straight in —
or lifts straight out — of an assembled row. Press down until the clip
clicks, the bottom seat is reached, and the tops sit flush.`
}

function couponNote(p: Params): string {
  if (p.joint_type === 'sliding_dovetail') {
    return `Before printing the whole kit, print the bounded sliding-dovetail coupon
plate from the studio. It contains mechanically representative 0.10, 0.11,
and 0.12 mm compensation samples. Slide pairs together from the rear mouth:
reject a sample if it binds before the detent ridge, never clicks into the
notch at the front stop, or cannot be released with a firm rearward tug.
The last stretch is MEANT to be firm — that is the ridge, not a bad fit.
Among the remainder, choose the loosest-running sample with no perceptible
seated X/Z/rocking play, set joint fit to that value, and regenerate the
kit. The outer filename records both the sliding-dovetail topology and
selected fit.`
  }
  return `Before printing the whole kit, print the vertical-snap seam coupon pair
from the studio and walk joint_fit in 0.05 mm steps: looser (+) if the click
takes more than firm hand force, tighter (-) until seam wiggle dies. Then
regenerate the kit at the fit the coupon settles on — the outer filename
records both the vertical-snap topology and selected fit.`
}

/** The README's feet paragraph — one story per feet_mode. Printed studs ride
 *  every module as TPU bodies; adhesive pockets are carved on every module
 *  (corners on the two ends, beside the seam socket on every column module)
 *  and the bumpers are bought hardware, so the note names what to buy and
 *  where it can go. */
function feetNote(p: Params): string {
  if (p.feet_mode === 'printed') {
    return `Feet bodies ride each module's 3MF on their own filament slot and are
meant for a flexible filament (TPU). If no TPU spool is loaded, the studio's
plan falls back to the frame filament — rigid feet still print and stand,
they just don't grip like TPU.`
  }
  if (p.feet_mode === 'adhesive') {
    const b = matchBumper(p)
    const hw = b ? `${bumperLabel(b)} bumpers` : `${p.feet_w.toFixed(1)} mm stick-on bumpers`
    const span = Math.round(p.feet_span * p.scale_factor ** (4 / 3))
    return `Every module carries empty pockets for ${hw} — the end modules at
their corners, every column module beside its seam socket — so feet can go
under any columns you choose. Populate the four corner pockets at least,
and on a long row add a pair roughly every ${span} mm so the middle
cannot flex.`
  }
  return `This design has no feet (feet_mode "none") — the modules stand flat
on their bottom faces.`
}

/** The README's frame-text paragraph — truthful per design: side rails and end
 *  walls print on the end modules (inset = inlay bodies, emboss = raised
 *  lettering in the frame filament); the other four slots cross every column
 *  seam and print only on a one-piece abacus. */
function frameTextNote(p: Params): string {
  const crossing = `Writing on the top/bottom rails or the front/back walls crosses every
column seam, so it prints only on a one-piece abacus — the studio
relocates the complement-fact aids to the side rails automatically.`
  if (!anyTokens(p)) {
    return `This design has no writing on the side rails or end walls, so the
modules carry no frame text. Those are the only spots that CAN carry
text on a modular kit (they sit wholly on the two end modules).
${crossing}`
  }
  const how =
    p.text_mode === 'inset'
      ? `as color inlays riding their own filament slots in module-left.3mf
and module-right.3mf`
      : `as raised lettering in the frame filament`
  return `The side rails and end walls print on the two end modules, ${how}.
Mid modules carry no text, which is what keeps the mid-variant dedupe
(one shared file per bead-color signature) intact.
${crossing}`
}
