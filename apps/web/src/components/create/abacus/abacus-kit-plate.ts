/**
 * The modular column kit on ONE build plate (Gitea #32, Phase A).
 *
 * A print ticket is one plate, one sliced job — there is no quantity field
 * anywhere in the contract and no batch concept. So for the kit to become "hit
 * print", somebody has to lay 13 modules out on a bed. Today that somebody is
 * the user, in their slicer, from the kit zip. This module is that somebody.
 *
 * WHAT IS BORROWED. Frame Studio already solved plate packing and the packer is
 * shared: MaxRects under a 12-way tournament (3 fit heuristics × 4 biggest-first
 * orderings, fewest plates then tightest envelope), gap applied by inflating
 * footprints, free 90° rotation. The purge tower is RESERVED BEFORE packing, as
 * a keep-out the parts pack around — a tower that lands on a part is a slice the
 * printer refuses outright, which is our own exit-154/155 history in someone
 * else's words. Bed truth comes from the printer, not a constant.
 *
 * WHAT IS OURS. Frame Studio packs single-body parts. A module is a multi-body
 * assembly — frame + its bead column + printed TPU feet + inset text inlays —
 * whose bodies must stay registered to each other or the beads come off their
 * rods and the inlays miss their pockets. So the new piece is {@link
 * placeModuleBodies}: one placement (the free 90° turn AND the translate)
 * applied to EVERY body of that module through ONE shared basis. Per-body
 * re-origin is the bug this module exists to not have — it is what "rigid group"
 * means, and it is why the basis ({@link ModuleBasis}) is computed once per
 * module kind and used by BOTH the packer's footprint and the transform. If
 * those two ever came from different boxes, every module would print shifted
 * from where the packer thought it was.
 *
 * WHAT IS SHARED WITH THE ZIP PATH. Everything upstream of placement:
 * `moduleSoups` runs the same hard-error gate (shell topology, footless module,
 * empty text pockets) each module's standalone 3MF runs, and the plate emits
 * through the same `emitThreeMfBodies` tail, so container law and role→filament
 * law each still live in exactly one place. The per-module zip path is
 * unchanged — a plate is a different container, not a different abacus.
 *
 * REFUSALS. This ticket either fits one plate or falls back to the zip. An
 * overfull plate, a module too big for the bed, or a tower with nowhere to go
 * all raise {@link KitPlateFitError} naming what didn't fit and which knob moves
 * it. Never silently drop a module: a kit missing a column is not a kit.
 *
 * IMPORT NOTE. `packPlates`, `meshBounds` and the tower reserve come from
 * `@eink/frames-engine` today. They move to `@eink/plate-packing` (eink PR #569)
 * once it publishes — a pure extraction with identical signatures, so that
 * switch is an import-line edit.
 */
import {
  type BedRect,
  type BedSize,
  meshBounds,
  type PackItem,
  packPlates,
} from '@eink/frames-engine/print-bundle'
import {
  type PlacedTower,
  placeTowerReserve,
  type TowerReserve,
  towerMargin,
} from '@eink/frames-engine/wipe-tower'
import { type AbacusThreeMf, emitThreeMfBodies, type SpoolBodySummary } from './abacus-3mf'
import {
  BAMBU_256_BED,
  DEFAULT_WIPE_TOWER_PROFILE,
  SUPPORT_SKIRT,
  TOWER_GAP,
  type WipeTowerProfileGeometry,
} from './abacus-3mf-assembly'
import { type FilamentMap, isModular, type Params } from './abacus-model'
import {
  type ModuleExportParts,
  type ModuleKind,
  type ModuleSoups,
  moduleKitPlan,
  moduleSoups,
} from './abacus-module-kit'

const EPS = 1e-6

/**
 * How far ONE module's first layer reaches past its declared outline.
 *
 * A brim is the floor: Orca's `brim_width` is 5 mm with auto_brim, and it rings
 * the whole part. With supports on, `SUPPORT_SKIRT` (8 mm — the measured worst
 * case with headroom, see abacus-3mf-assembly) dominates it outright.
 *
 * This is the SAME law the tower ring keeps, applied at the other end of the
 * pipeline. Getting it wrong here is exit 192, "Object conflicts were detected":
 * the plate's declared boxes are disjoint, Orca slices it, and the extrusions
 * collide. The one-piece abacus can't reach this state — it is a single object,
 * so there is nothing on the bed for it to conflict with but the tower.
 */
const MODULE_BRIM = 5

/**
 * Gap between neighbouring modules — BOTH grow, so it's twice one module's
 * reach, never once.
 *
 * The 4 mm this used to be is the shared bundler's default, and it is wrong for
 * a kit in both states: 4 mm doesn't even hold two 5 mm brims, let alone two
 * support skirts. It survived review because the plan's rectangles are disjoint
 * at 4 mm — the packer, the overlap tests and the bed preview all agree the
 * plate is clean. Only the slicer sees the extrusion.
 */
const moduleGapMm = (supports: boolean): number => 2 * (supports ? SUPPORT_SKIRT : MODULE_BRIM)

// ---- refusals ---------------------------------------------------------------

/** Why a kit can't ship as one plate. Each wants a different move from the
 *  person who composed the design, so they stay distinguishable. */
export type KitPlateRefusal =
  /** Everything fits the bed alone, but not together. */
  | 'overflow'
  /** One module exceeds the usable bed even by itself. */
  | 'too-big'
  /** No clear rectangle left for the purge tower. */
  | 'no-tower-room'

/**
 * A kit that cannot be laid out on one plate. `modules` names the labels that
 * didn't fit (empty for a tower refusal — nothing is at fault but the bed), so a
 * caller can point at them instead of re-deriving the diagnosis from prose.
 *
 * Typed rather than a bare Error because the fallback differs: the zip download
 * still prints every one of these module by module, and the UI should say so.
 */
export class KitPlateFitError extends Error {
  readonly reason: KitPlateRefusal
  readonly modules: readonly string[]
  /** What happened, on its own — the UI headline. */
  readonly headline: string
  /** The knob to turn, on its own. Every refusal has one, so this is never null:
   *  a plate we won't ship must always leave the user somewhere to go. */
  readonly remediation: string

  constructor(
    reason: KitPlateRefusal,
    modules: readonly string[],
    headline: string,
    remediation: string
  ) {
    // `message` stays the whole story so a log line or a bare `.message` reader
    // loses nothing; the split above is for a UI that renders the two apart.
    super(`${headline} ${remediation}`)
    this.name = 'KitPlateFitError'
    this.reason = reason
    this.modules = modules
    this.headline = headline
    this.remediation = remediation
  }
}

const bedLabel = (bed: BedSize): string => `${bed.wMm} × ${bed.dMm} mm bed`

// ---- instances --------------------------------------------------------------

/** One physically printed module on the plate: which geometry, which global
 *  column's bead roles ink it, and the two names that follow it downstream. */
export interface KitPlateInstance {
  /** Stable and unique within the plate — what the packer keys on. */
  readonly id: string
  /** Unique human name — what a job binding, a bed preview or an error names. */
  readonly label: string
  readonly kind: ModuleKind
  /** The GLOBAL column whose bead roles color this instance's beads. Bead color
   *  varies per column, so an instance carries its own — a placed module that
   *  borrowed its neighbour's column would print the wrong beads. */
  readonly column: number
  /** The kit-zip member this instance is a copy of. The label deliberately does
   *  NOT encode the mid variant (`mid 3 of 11` reads better than
   *  `mid-10s 1 of 3`), so the machine-readable variant identity lives here. */
  readonly file: string
}

/**
 * Expand the kit plan's counts into individually placeable instances: `mid ×11`
 * becomes eleven modules, each with its own id and label.
 *
 * Mid instances are numbered ACROSS variants, in plan order — the five bead-slot
 * variants of a 13-column kit are eleven mid modules to the person at the
 * printer, and eleven pieces is what they'll count off the plate. A kit with a
 * single mid (a 3-column design) drops the ordinal rather than reading `mid 1
 * of 1`. Ends are never numbered: there is exactly one of each.
 */
export function kitPlateInstances(p: Params, fm: FilamentMap): KitPlateInstance[] {
  const entries = moduleKitPlan(p, fm)
  const mids = entries.reduce((n, e) => n + (e.kind === 'mid' ? e.count : 0), 0)
  const out: KitPlateInstance[] = []
  let nth = 0
  for (const e of entries) {
    for (let k = 0; k < e.count; k++) {
      if (e.kind === 'mid') {
        nth++
        out.push({
          id: `mid-${nth}`,
          label: mids === 1 ? 'mid' : `mid ${nth} of ${mids}`,
          kind: 'mid',
          column: e.column,
          file: e.file,
        })
      } else {
        out.push({
          id: e.kind,
          label: `${e.kind} end`,
          kind: e.kind,
          column: e.column,
          file: e.file,
        })
      }
    }
  }
  return out
}

// ---- footprints -------------------------------------------------------------

/**
 * A module kind's XY footprint and the origin its bodies are measured from —
 * the ONE box that both the packer and {@link placeModuleBodies} read.
 *
 * Measured off the GATED soups rather than the raw renders, so what's measured
 * is exactly what ships: a feet render present on a design whose feet aren't
 * printed never enters the geometry and must never enter the footprint either.
 * In practice the frame body decides the box (feet sit in its pockets, inlays in
 * its carved text), but the union costs one pass and cannot be wrong if some
 * future part pass pokes proud.
 */
export interface ModuleBasis {
  readonly kind: ModuleKind
  /** XY origin of the module's own render frame — subtracted on placement. There
   *  is deliberately no Z here: placement is an XY decision, and the plate's drop
   *  to the bed stays with the container (see {@link placeModuleBodies}). */
  readonly minX: number
  readonly minY: number
  /** Footprint fed to the packer (un-rotated). */
  readonly wMm: number
  readonly hMm: number
}

/** Measure one kind's basis from its gated soups. Every instance of a kind
 *  renders from the same passes — one render per geometry is the kit's whole
 *  dedupe premise — so this is computed once per kind and shared. */
export function moduleBasis(kind: ModuleKind, soups: ModuleSoups): ModuleBasis {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const all = [
    soups.mesh,
    ...soups.partSoups.map((s) => ({
      positions: s.positions,
      triangleCount: s.positions.length / 9,
    })),
  ]
  for (const s of all) {
    if (s.triangleCount === 0) continue
    const b = meshBounds(s)
    if (b.minX < minX) minX = b.minX
    if (b.minY < minY) minY = b.minY
    if (b.maxX > maxX) maxX = b.maxX
    if (b.maxY > maxY) maxY = b.maxY
  }
  if (!Number.isFinite(minX)) {
    throw new Error(`the module_${kind} render has no triangles — nothing to place`)
  }
  return { kind, minX, minY, wMm: maxX - minX, hMm: maxY - minY }
}

// ---- rigid-group placement --------------------------------------------------

/** The classified body soup's slots live per SHELL, not per soup, so its slot
 *  field is unread on the way through the group transform. */
const SLOT_PER_SHELL = -1

/** A triangle soup bound to a filament slot. */
export interface SlotSoup {
  readonly slot: number
  readonly positions: Float32Array
}

/** Where the packer put one module: min corner on the bed, and whether it was
 *  turned 90° about Z (free for printing — the print face stays down). */
export interface ModulePlacement {
  readonly xMm: number
  readonly yMm: number
  readonly rotated: boolean
}

/**
 * Apply ONE placement to EVERY body of one module — the rigid-group transform.
 *
 * The upstream single-body path rotates a part's soup by (x, y) → (−y, x) and
 * then re-origins it by re-measuring its own bounds. Re-measuring per body is
 * exactly what must not happen here: a module's feet and its frame have
 * different bounds, so each would land on its own origin and the module would
 * come apart — feet under the wrong column, inlays beside their pockets.
 *
 * So the basis is shared and applied analytically. Under (x, y) → (−y, x) the
 * group's box maps to x ∈ [−maxY, −minY], y ∈ [minX, maxX], so re-origining the
 * ROTATED group means subtracting −maxY from x and minX from y. Both are
 * constants of the group, never of the body:
 *
 *   un-rotated   x' = x − minX + X        y' = y − minY + Y
 *   rotated      x' = maxY − y + X        y' = x − minX + Y
 *
 * Z is left exactly as rendered. Packing is an XY decision, and dropping the
 * print onto the bed is the container's job — `assembleAbacus3mf` already
 * translates the whole assembly by −minZ, and doing it here instead would move
 * the frame's z=0 plane out from under the support-transition modifier, which is
 * pinned to that plane (printed feet dip BELOW zero and the modifier follows the
 * frame/support boundary, not the feet).
 *
 * The result is the module standing at its packed slot with every internal
 * relationship — bead-to-channel clearance, foot-to-pocket registration —
 * untouched, because a rotation and a translation are the same rigid motion for
 * all of its bodies.
 */
export function placeModuleBodies(
  bodies: readonly SlotSoup[],
  basis: ModuleBasis,
  at: ModulePlacement
): SlotSoup[] {
  const maxY = basis.minY + basis.hMm
  return bodies.map((body) => {
    const src = body.positions
    const out = new Float32Array(src.length)
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i]
      const y = src[i + 1]
      out[i] = (at.rotated ? maxY - y : x - basis.minX) + at.xMm
      out[i + 1] = (at.rotated ? x - basis.minX : y - basis.minY) + at.yMm
      out[i + 2] = src[i + 2]
    }
    return { slot: body.slot, positions: out }
  })
}

// ---- packing ----------------------------------------------------------------

/** One module as laid out, footprint resolved post-rotation — enough to draw the
 *  bed, and enough for a test to prove nothing overlaps. */
export interface KitPlatePlacement extends KitPlateInstance, ModulePlacement {
  readonly wMm: number
  readonly hMm: number
}

export interface KitPlateLayout {
  readonly placements: readonly KitPlatePlacement[]
  /** The reserved purge-tower rect and the pin inside it. */
  readonly tower: PlacedTower
  /** The bed everything above is in the coordinates of. */
  readonly bed: BedSize
}

/**
 * A compact string identity for a packed arrangement — same plate in, same
 * string out; move any module and it changes.
 *
 * Feeds the submit's idempotency signature (see `print-idempotency`), where it
 * covers the one way two submits can differ that none of the user's own inputs
 * would show: the PACKER changing its mind. Every field the panel already
 * hashes (params, bed, tower profile) derives this layout today, so a packer
 * heuristic tweak — or the pending swap onto `@eink/plate-packing` — is exactly
 * the case where the design looks unchanged and the plate isn't. Reusing the
 * key there would make THH replay the previously-arranged job and quietly
 * discard the new arrangement.
 *
 * Coordinates are rounded to a micron before hashing: they come out of
 * floating-point packing arithmetic, and a 1e-12 wobble is not a new plate.
 */
export function kitPlateSignature(layout: KitPlateLayout): string {
  const µm = (mm: number): number => Math.round(mm * 1000)
  const parts = layout.placements
    .map((pl) => `${pl.id}@${µm(pl.xMm)},${µm(pl.yMm)}${pl.rotated ? 'r' : ''}`)
    .sort()
    .join('|')
  return `${µm(layout.bed.wMm)}x${µm(layout.bed.dMm)};t${µm(layout.tower.xMm)},${µm(
    layout.tower.yMm
  )};${parts}`
}

/**
 * The tower footprint to keep clear, from the printer's own bounded profile.
 *
 * Mirrors `towerReserveFromCapability`'s envelope → rect translation (it can't be
 * called directly: the service capability carries `version`/`maxFilaments` that
 * the bundled geometry twin doesn't) and adds the clearance ring the mono
 * placement keeps — TOWER_GAP, plus SUPPORT_SKIRT when supports will be on,
 * which is the exit-155 lesson: supports push the first layer past the model
 * outline while the tower's brim reaches back, and the two must not meet.
 *
 * The ring has to be part of the RESERVE, not left to the packer's gap: the
 * packer inflates each footprint on its high sides only, so a module may sit
 * flush against the low edges of any keep-out.
 */
function plateTowerReserve(
  profile: WipeTowerProfileGeometry,
  supports: boolean
): Extract<TowerReserve, { kind: 'reserve' }> {
  const clear = TOWER_GAP + (supports ? SUPPORT_SKIRT : 0)
  const e = profile.envelopeMm
  return {
    kind: 'reserve',
    profile: profile.profile,
    wMm: e.maxX - e.minX + 2 * clear,
    dMm: e.maxY - e.minY + 2 * clear,
    // Pin such that the envelope sits centred in the reserved rect: the tower
    // spills below-left of its pin, so the pin is NOT the rect's min corner.
    pinOffsetXMm: clear - e.minX,
    pinOffsetYMm: clear - e.minY,
  }
}

/** Maximal free rectangles of `f` once `ex` is carved out (the two overlap-free
 *  cases return `f` untouched). */
function splitRect(f: BedRect, ex: BedRect): BedRect[] {
  const fx1 = f.xMm + f.wMm
  const fy1 = f.yMm + f.dMm
  const ex1 = ex.xMm + ex.wMm
  const ey1 = ex.yMm + ex.dMm
  const disjoint =
    ex.xMm >= fx1 - EPS || ex1 <= f.xMm + EPS || ex.yMm >= fy1 - EPS || ey1 <= f.yMm + EPS
  if (disjoint) return [f]
  const out: BedRect[] = []
  if (ex.xMm > f.xMm + EPS) out.push({ xMm: f.xMm, yMm: f.yMm, wMm: ex.xMm - f.xMm, dMm: f.dMm })
  if (ex1 < fx1 - EPS) out.push({ xMm: ex1, yMm: f.yMm, wMm: fx1 - ex1, dMm: f.dMm })
  if (ex.yMm > f.yMm + EPS) out.push({ xMm: f.xMm, yMm: f.yMm, wMm: f.wMm, dMm: ex.yMm - f.yMm })
  if (ey1 < fy1 - EPS) out.push({ xMm: f.xMm, yMm: ey1, wMm: f.wMm, dMm: fy1 - ey1 })
  return out
}

/** The bed's genuinely usable rectangles at `margin`, printer keep-outs carved
 *  out — what the tower reservation searches. Mirrors the packer's own free-space
 *  seed, which frames-engine keeps private; it comes across with the rest of the
 *  import block when `@eink/plate-packing` publishes. Overlapping candidates are
 *  left in: they only widen the search, never move its answer. */
function bedFreeRects(bed: BedSize, margin: number): BedRect[] {
  const wMm = bed.wMm - 2 * margin
  const dMm = bed.dMm - 2 * margin
  if (wMm <= EPS || dMm <= EPS) return []
  let free: BedRect[] = [{ xMm: margin, yMm: margin, wMm, dMm }]
  for (const ex of bed.exclude ?? []) free = free.flatMap((f) => splitRect(f, ex))
  return free
}

/**
 * Reserve the purge tower, then pack every instance around it onto ONE plate.
 *
 * The tower goes first and the parts pack around the hole it leaves — reversing
 * that order is how a tower ends up on top of a module, which the slicer refuses
 * outright. The reservation is unconditional: like the mono export's pin, it
 * stays available because ticket routing can add a support-interface filament and
 * turn a one-filament plate into a real two-filament slice. Bed area is the
 * cheaper thing to spend.
 *
 * @throws {KitPlateFitError} when the kit needs more than one plate, when a
 * module exceeds the bed alone, or when no rectangle is left for the tower.
 * Phase A ships one plate or nothing.
 */
export function packKitPlate(args: {
  instances: readonly KitPlateInstance[]
  bases: Record<ModuleKind, ModuleBasis>
  /** THH's reported geometry for the selected printer; download-only callers get
   *  the fallback plate. */
  bed?: BedSize
  /** Override the derived inter-module gap. Leave unset — the default follows
   *  `supportsAtSlice`, and that coupling is the whole point (see moduleGapMm). */
  gapMm?: number
  wipeTower?: WipeTowerProfileGeometry
  /** Supports will be on when this plate is sliced (printed feet, or the
   *  operator's ticket style). Widens BOTH the tower's clearance ring and the
   *  gap between modules — supports grow past every outline on the plate, not
   *  just the one the tower happens to sit next to. */
  supportsAtSlice?: boolean
}): KitPlateLayout {
  const {
    instances,
    bases,
    bed = BAMBU_256_BED,
    wipeTower = DEFAULT_WIPE_TOWER_PROFILE,
    supportsAtSlice = false,
  } = args
  const gapMm = args.gapMm ?? moduleGapMm(supportsAtSlice)

  const reserve = plateTowerReserve(wipeTower, supportsAtSlice)
  const tower = placeTowerReserve(bed, reserve, bedFreeRects(bed, towerMargin(bed)))
  if (!tower) {
    throw new KitPlateFitError(
      'no-tower-room',
      [],
      `no clear ${Math.round(reserve.wMm)} × ${Math.round(
        reserve.dMm
      )} mm rectangle for the purge tower on this ${bedLabel(
        bed
      )} — refusing to ship a multi-filament plate the slicer would reject.`,
      'Select a printer with a bigger bed, or print the kit module by module from the zip.'
    )
  }

  const items: PackItem[] = instances.map((inst) => ({
    id: inst.id,
    wMm: bases[inst.kind].wMm,
    hMm: bases[inst.kind].hMm,
  }))
  const packed = packPlates(items, bed, gapMm, tower)
  const byId = new Map(packed.placements.map((pl) => [pl.id, pl]))
  const labelOf = (id: string): string =>
    instances.find((inst) => inst.id === id)?.label ?? `module ${id}`

  // Too-big first: it is the more specific diagnosis, and it also shows up as an
  // overflow (each too-big part is parked on a plate of its own).
  if (packed.tooBig.length > 0) {
    const names = packed.tooBig.map(labelOf)
    throw new KitPlateFitError(
      'too-big',
      names,
      `${names.join(', ')} ${
        names.length === 1 ? 'is' : 'are'
      } too big for this ${bedLabel(bed)} even alone — refusing to ship a plate the printer can't print.`,
      'Scale the design down, or select a printer with a bigger bed.'
    )
  }
  if (packed.plateCount > 1) {
    const spilled = packed.placements.filter((pl) => pl.plate > 0).map((pl) => labelOf(pl.id))
    throw new KitPlateFitError(
      'overflow',
      spilled,
      `this kit needs ${packed.plateCount} build plates — ${spilled.join(
        ', '
      )} won't fit beside the rest on this ${bedLabel(bed)}.`,
      'Refusing to ship a plate with modules missing: print fewer columns, scale the design down, or select a printer with a bigger bed. The kit zip still prints module by module.'
    )
  }

  const placements = instances.map((inst): KitPlatePlacement => {
    const pl = byId.get(inst.id)
    if (!pl) {
      // packPlates returns one placement per item id; a hole means the ids the
      // packer saw and the ids we expanded disagree (programming error).
      throw new Error(`the packer returned no placement for ${inst.label}`)
    }
    const basis = bases[inst.kind]
    return {
      ...inst,
      xMm: pl.xMm,
      yMm: pl.yMm,
      rotated: pl.rotated,
      wMm: pl.rotated ? basis.hMm : basis.wMm,
      hMm: pl.rotated ? basis.wMm : basis.hMm,
    }
  })

  return { placements, tower, bed }
}

// ---- the plate --------------------------------------------------------------

export interface KitPlate extends KitPlateLayout {
  /** The finished single-plate multi-material `.3mf` (zip bytes). */
  readonly bytes: Uint8Array
  /** One entry per emitted body, ascending slot order. */
  readonly bodies: readonly SpoolBodySummary[]
  /** The tower pin written into the plate's project settings. */
  readonly wipeTower: AbacusThreeMf['wipeTower']
}

/**
 * Build the whole kit as ONE plate: expand the plan into instances, gate and
 * classify each module exactly as its standalone 3MF would, pack the footprints
 * around a reserved purge tower, apply each placement rigidly to every body of
 * its module, and emit the lot through the shared bucket/emit tail.
 *
 * Classification happens BEFORE placement, and that ordering is load-bearing:
 * `analyzeModuleShells` reads bead centers at the module's known local x and
 * hard-errors on anything else, so a rotated or translated module would fail its
 * own gate. Placement is the last thing that touches geometry.
 *
 * @throws {KitPlateFitError} when the kit doesn't fit one plate — the caller
 * falls back to the kit zip.
 */
export function buildKitPlateThreeMf(args: {
  /** The snapshot-once module renders — the same bundle the kit zip builds from. */
  parts: ModuleExportParts
  filamentMap: FilamentMap
  slotLabels?: readonly string[]
  supportsAtSlice?: boolean
  bed?: BedSize
  wipeTower?: WipeTowerProfileGeometry
  gapMm?: number
}): KitPlate {
  const {
    parts,
    filamentMap,
    slotLabels,
    supportsAtSlice,
    bed = BAMBU_256_BED,
    wipeTower = DEFAULT_WIPE_TOWER_PROFILE,
    gapMm,
  } = args
  const p = parts.params
  if (!isModular(p)) {
    throw new Error('a kit plate is a modular-mode export — this design is seam_mode "mono"')
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
  const textOf: Record<ModuleKind, ModuleExportParts['leftText']> = {
    left: parts.leftText,
    mid: [], // mid modules never carry text — the mid-variant dedupe depends on it
    right: parts.rightText,
  }

  const instances = kitPlateInstances(p, filamentMap)

  // One gate pass per (kind, column) — every instance of a plan entry shares
  // both, and the geometry is shared across a kind's variants outright (one
  // render per geometry). Placement is what differs, and that comes later.
  const soupCache = new Map<string, ModuleSoups>()
  const soupsFor = (inst: KitPlateInstance): ModuleSoups => {
    const key = `${inst.kind}:${inst.column}`
    const hit = soupCache.get(key)
    if (hit) return hit
    const made = moduleSoups({
      body: bodyOf[inst.kind],
      feet: feetOf[inst.kind],
      text: textOf[inst.kind],
      kind: inst.kind,
      column: inst.column,
      params: p,
      filamentMap,
    })
    soupCache.set(key, made)
    return made
  }

  const bases = {} as Record<ModuleKind, ModuleBasis>
  for (const inst of instances) {
    if (!bases[inst.kind]) bases[inst.kind] = moduleBasis(inst.kind, soupsFor(inst))
  }

  const feetPrinted = instances.some((inst) => soupsFor(inst).feetPrinted)
  const layout = packKitPlate({
    instances,
    bases,
    bed,
    gapMm,
    wipeTower,
    supportsAtSlice: supportsAtSlice || feetPrinted,
  })
  const placementOf = new Map(layout.placements.map((pl) => [pl.id, pl]))

  // Each instance contributes its classified body soup (placed, its shells
  // renumbered into the plate's shell table) plus its already-slotted part
  // soups. The plate's geometry is therefore the same triangles the zip would
  // have shipped, moved as rigid groups — nothing is re-classified after a move.
  const chunks: { positions: Float32Array; triShell: Int32Array; shellBase: number }[] = []
  const slotOfShell: number[] = []
  const partSoups: { slot: number; positions: Float32Array }[] = []
  for (const inst of instances) {
    const soups = soupsFor(inst)
    const basis = bases[inst.kind]
    const at = placementOf.get(inst.id)
    if (!at) throw new Error(`no placement for ${inst.label}`)
    const [main] = placeModuleBodies(
      [{ slot: SLOT_PER_SHELL, positions: soups.mesh.positions }],
      basis,
      at
    )
    chunks.push({
      positions: main.positions,
      triShell: soups.triShell,
      shellBase: slotOfShell.length,
    })
    slotOfShell.push(...soups.slotOfShell)
    for (const soup of placeModuleBodies(soups.partSoups, basis, at)) {
      partSoups.push({ slot: soup.slot, positions: soup.positions })
    }
  }

  const triangleCount = chunks.reduce((n, c) => n + c.triShell.length, 0)
  const positions = new Float32Array(triangleCount * 9)
  const triShell = new Int32Array(triangleCount)
  let triAt = 0
  let posAt = 0
  for (const c of chunks) {
    positions.set(c.positions, posAt)
    posAt += c.positions.length
    for (let t = 0; t < c.triShell.length; t++) triShell[triAt + t] = c.triShell[t] + c.shellBase
    triAt += c.triShell.length
  }

  const built = emitThreeMfBodies({
    mesh: { positions, triangleCount },
    triShell,
    slotOfShell,
    partSoups,
    filamentMap,
    slotLabels,
    feetPrinted,
    supportsAtSlice,
    bed,
    wipeTower,
    // The modules are already where they print, around a tower whose rect the
    // packer kept clear — so the container must not re-center them, and must pin
    // the tower where the reservation is rather than beside the plate's box.
    placedOnBed: { towerPinMm: { x: layout.tower.pinXMm, y: layout.tower.pinYMm } },
  })

  return { ...layout, bytes: built.bytes, bodies: built.bodies, wipeTower: built.wipeTower }
}
