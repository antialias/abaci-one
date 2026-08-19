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
 * IMPORT NOTE. The packer and the tower reserve come from `@eink/plate-packing`
 * (eink PR #569 lifted them out of `@eink/frames-engine`). `meshBounds`
 * deliberately stays behind: it reads triangles, and the point of the
 * extraction is that the packing package is geometry over numbers — no STL, no
 * 3MF, no DOM. `BedSize`/`BedRect` are declared identically in both packages
 * and structurally interchangeable, which is why the four other abacus files
 * that only name the TYPE can keep importing it beside the function they feed
 * it to. The swap was NOT a no-op — see `packKitPlate` on tower candidates.
 */
import { meshBounds } from '@eink/frames-engine/print-bundle'
import {
  type BedRect,
  type BedSize,
  type PackItem,
  type PlacedTower,
  packPlates,
  type TowerReserve,
  towerMargin,
  towerPlacementCandidates,
} from '@eink/plate-packing'
import { type AbacusThreeMf, emitThreeMfBodies, type SpoolBodySummary } from './abacus-3mf'
import {
  BAMBU_256_BED,
  DEFAULT_WIPE_TOWER_PROFILE,
  envelopeForFilaments,
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
 * How far ONE module's first layer reaches past its declared outline, per side.
 *
 * Both numbers are THH's published `clearance.outlineGrowthMm` (things-haunt-house
 * #434), folded out of the very presets it slices us with rather than measured
 * here:
 *   - no supports: `brim_object_gap` 0.1 + `brim_width` 5 = 5.1
 *   - supports:    + `support_object_xy_distance` 0.35 + `support_expansion` 0 = 5.45
 *
 * Restated as constants only because the live block rides on an unmerged service
 * change; read them off the printer row once it lands, and delete these.
 *
 * NOT included, deliberately: the skirt. `skirt_loops` is 0 on every intent — no
 * skirt is drawn at all — and a skirt would ring the plate's convex hull anyway,
 * never the space between two modules. `SUPPORT_SKIRT` (8 mm) is still right for
 * the tower ring, which is a different measurement of a different thing; using it
 * here spent ~5 mm of bed per gap on a loop this printer never prints.
 */
const MODULE_GROWTH_MM = 5.1
const MODULE_GROWTH_SUPPORTED_MM = 5.45

/** One module's first-layer reach past its declared outline, per side. */
const moduleGrowthMm = (supports: boolean): number =>
  supports ? MODULE_GROWTH_SUPPORTED_MM : MODULE_GROWTH_MM

/**
 * Gap between neighbouring modules — BOTH grow, so it's twice one module's
 * reach, never once. The same reach must also be LEFT AT THE BED EDGE, where
 * there is no neighbour to share it with — that single-growth margin is
 * `firstLayerBed`'s job, not this gap's.
 *
 * The 4 mm this started as is the shared bundler's default, and it is wrong for a
 * kit in both states: it doesn't hold two brims. What it is NOT is the cause of
 * the exit 192 this file used to blame it for — see `clearOfKeepOuts`. Two modules
 * whose brims overlap slice without complaint; they just print fused.
 */
const moduleGapMm = (supports: boolean): number => 2 * moduleGrowthMm(supports)

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
  /** The plate can't be slid off the printer's keep-out zone (see `clearOfKeepOuts`). */
  | 'keep-out'

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
 * The tower footprint to keep clear, from the printer's own bounded profile —
 * sized to the envelope row for the filament count this plate will actually load,
 * not the profile's worst case (see `envelopeForFilaments`).
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
  supports: boolean,
  filaments?: number
): Extract<TowerReserve, { kind: 'reserve' }> {
  const clear = TOWER_GAP + (supports ? SUPPORT_SKIRT : 0)
  const e = envelopeForFilaments(profile, filaments)
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

/**
 * Slide the whole layout until it clears the printer's keep-out zones — the real
 * cause of exit 192, "Object conflicts were detected".
 *
 * Orca's `layered_print_cleareance_valid` (libslic3r/Print.cpp) has exactly three
 * hard refusals, and all three are keep-out intersections: a model volume's
 * CONVEX HULL against `bed_exclude_area`, the same against the clumping-detection
 * area, and the prime tower's rect against `bed_exclude_area`. Everything else it
 * finds — parts overlapping each other, the tower overlapping a part — it records
 * as a warning and slices anyway. No amount of inter-module spacing has ever been
 * able to cause a 192, and the gap this file widened to chase one never could.
 *
 * The hull is the whole trap. `emitThreeMfBodies` merges every module riding a
 * filament slot into ONE volume, so a body's hull is the hull of modules scattered
 * across the plate — and the hull of an L-shaped arrangement covers the notch the
 * packer carefully carved out. The 13-module plate that took a 192 on 2026-08-05
 * (staged as `29037c8a….raw.3mf`) had ZERO vertices inside the X1C's 18 × 28 mm
 * cutter corner and was refused anyway, because two bodies spanned from one side
 * of that corner to the other. Nudging the identical plate 28.5 mm in +y sliced it
 * clean.
 *
 * So the invariant a packed plate has to keep is not about its parts, it is about
 * its BOUNDING BOX: no keep-out may touch it. Sliding the layout bodily preserves
 * every internal clearance exactly — the tower moves with the modules — which is
 * why this runs after packing rather than shrinking the region packed into. A pure
 * inset would spend a 256-wide strip of bed to avoid an 18 × 28 corner.
 *
 * And the box that has to stay clear is the FIRST-LAYER box, not the outline
 * box — the exit-154 half of the story. Brim and supports grow each module by
 * `growthMm` per side past its declared outline, so the box tested here is built
 * from the GROWN module rects (the tower rect stays as-is: its reserve already
 * carries `TOWER_GAP` + `SUPPORT_SKIRT` of ring, see `plateTowerReserve`). A
 * plate whose outline sat exactly at y = 0 was legal by the old outline test and
 * still sliced its support brim into unprintable area.
 */
function clearOfKeepOuts(
  bed: BedSize,
  modules: readonly BedRect[],
  tower: BedRect,
  growthMm: number
): { dxMm: number; dyMm: number } | null {
  const rects: BedRect[] = [
    ...modules.map((r) => ({
      xMm: r.xMm - growthMm,
      yMm: r.yMm - growthMm,
      wMm: r.wMm + 2 * growthMm,
      dMm: r.dMm + 2 * growthMm,
    })),
    tower,
  ]
  const box = {
    x0: Math.min(...rects.map((r) => r.xMm)),
    y0: Math.min(...rects.map((r) => r.yMm)),
    x1: Math.max(...rects.map((r) => r.xMm + r.wMm)),
    y1: Math.max(...rects.map((r) => r.yMm + r.dMm)),
  }
  const excludes = (bed.exclude ?? []).map((e) => ({
    x0: e.xMm,
    y0: e.yMm,
    x1: e.xMm + e.wMm,
    y1: e.yMm + e.dMm,
  }))
  const clears = (dx: number, dy: number): boolean => {
    const b = { x0: box.x0 + dx, y0: box.y0 + dy, x1: box.x1 + dx, y1: box.y1 + dy }
    // Bounds = no first-layer extrusion off the bed — the exit-154 belt.
    if (b.x0 < -EPS || b.y0 < -EPS || b.x1 > bed.wMm + EPS || b.y1 > bed.dMm + EPS) return false
    return !excludes.some(
      (e) => b.x0 < e.x1 - EPS && b.x1 > e.x0 + EPS && b.y0 < e.y1 - EPS && b.y1 > e.y0 + EPS
    )
  }

  // Staying put is always the first candidate; the rest are the minimal single-axis
  // pushes that clear one zone. With several zones a push can land on another, so
  // every candidate is re-checked against all of them and the shortest survivor wins.
  const candidates: { dx: number; dy: number }[] = [{ dx: 0, dy: 0 }]
  for (const e of excludes) {
    candidates.push(
      { dx: e.x1 - box.x0, dy: 0 },
      { dx: e.x0 - box.x1, dy: 0 },
      { dx: 0, dy: e.y1 - box.y0 },
      { dx: 0, dy: e.y0 - box.y1 }
    )
  }
  let best: { dxMm: number; dyMm: number } | null = null
  for (const c of candidates) {
    if (!clears(c.dx, c.dy)) continue
    const move = Math.hypot(c.dx, c.dy)
    if (best === null || move < Math.hypot(best.dxMm, best.dyMm) - EPS) {
      best = { dxMm: c.dx, dyMm: c.dy }
    }
  }
  return best
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
 *  import block when `@eink/plate-packing` publishes. Because it is that mirror,
 *  it must be handed the SAME bed object `packPlates` gets — the `firstLayerBed`,
 *  not the printer's — or the tower search and the pack disagree about where the
 *  free space is. That identity is load-bearing, not hygiene. Overlapping
 *  candidates are left in: they only widen the search, never move its answer. */
function bedFreeRects(bed: BedSize, margin: number): BedRect[] {
  const wMm = bed.wMm - 2 * margin
  const dMm = bed.dMm - 2 * margin
  if (wMm <= EPS || dMm <= EPS) return []
  let free: BedRect[] = [{ xMm: margin, yMm: margin, wMm, dMm }]
  for (const ex of bed.exclude ?? []) free = free.flatMap((f) => splitRect(f, ex))
  return free
}

/**
 * The bed as the PACKER and the tower search must see it: usable margin raised
 * to one module's first-layer growth, and every printer keep-out inflated by the
 * same growth on all sides.
 *
 * This is the exit-154 lesson (prod, 2026-08-18). `packPlates` seeds its free
 * space at `bed.marginMm ?? 0`, and this bed never set a margin — so modules
 * packed FLUSH against the bed edge: outline legal, first layer (brim +
 * supports, `moduleGrowthMm` past the outline) extruding off the bed. Orca's
 * multi-extruder post-slice check refuses that plate with exit 154, "Found
 * G-code in unprintable area". The keep-outs are unprintable area too, so they
 * grow by the same reach.
 *
 * PACKING VIEW ONLY: `KitPlateLayout.bed` always reports the printer's real
 * bed. The preview draws `bed.exclude` verbatim, and an inflated zone presented
 * as the printer's own would be a lie. Spreading `...bed` keeps any future
 * `BedSize` field. An inflated zone may reach negative coordinates; that is
 * fine — both `splitRect` and the packer's own carve clip against the free rect.
 */
function firstLayerBed(bed: BedSize, growthMm: number): BedSize {
  return {
    ...bed,
    marginMm: Math.max(bed.marginMm ?? 0, growthMm),
    ...(bed.exclude
      ? {
          exclude: bed.exclude.map((e) => ({
            xMm: e.xMm - growthMm,
            yMm: e.yMm - growthMm,
            wMm: e.wMm + 2 * growthMm,
            dMm: e.dMm + 2 * growthMm,
          })),
        }
      : {}),
  }
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
 * WHICH CORNER THE TOWER TAKES IS PART OF THE SEARCH, NOT AN INPUT TO IT. The
 * tower is placed by hugging a corner of the bed's free space, and for a full
 * plate the corner it picks decides whether the kit fits at all: the reserve is
 * a ~98 × 91 mm hole, and 13 modules pack differently around a hole in the back
 * left than one in the front right. That is not a preference, it is the
 * difference between a plate and a refusal — and worse, between a plate that can
 * be slid clear of the printer's keep-out and one that cannot (see
 * `clearOfKeepOuts`; the slide needs slack in a bed dimension, and the losing
 * arrangement leaves 16.7 mm where it needs 18).
 *
 * So every viable spot is tried, best corner-hugger first, and the first that
 * yields a complete single-plate layout WITH a clear slide wins. Unconstrained
 * plates therefore cost exactly one pack, as before — the loop only spins for
 * kits that are actually tight. `towerPlacementCandidates` returns the list for
 * precisely this reason; taking `[0]` (which is what `placeTowerReserve` is)
 * made the flagship 13-column printed-feet kit's fit depend on how the upstream
 * packer happened to break a scoring tie, and a tie-break moving in
 * `@eink/plate-packing` 1.0.0 is what surfaced it.
 *
 * @throws {KitPlateFitError} when the kit needs more than one plate, when a
 * module exceeds the bed alone, when no rectangle is left for the tower, or when
 * no tower spot leaves a layout that clears the keep-outs. Phase A ships one
 * plate or nothing.
 */
export function packKitPlate(args: {
  instances: readonly KitPlateInstance[]
  bases: Record<ModuleKind, ModuleBasis>
  /** THH's reported geometry for the selected printer; download-only callers get
   *  the fallback plate. */
  bed?: BedSize
  /** Override the derived inter-module gap. Leave unset — the default follows
   *  `supportsAtSlice`, and that coupling is the whole point (see moduleGapMm).
   *  Moves the INTER-MODULE gap only: the bed-edge margin follows
   *  `supportsAtSlice` regardless, because clearing the bed edge is physics,
   *  not a preference. */
  gapMm?: number
  wipeTower?: WipeTowerProfileGeometry
  /** Supports will be on when this plate is sliced (printed feet, or the
   *  operator's ticket style). Widens BOTH the tower's clearance ring and the
   *  gap between modules — supports grow past every outline on the plate, not
   *  just the one the tower happens to sit next to. */
  supportsAtSlice?: boolean
  /** How many filaments this plate will load once the ticket resolves. Picks the
   *  tower's envelope row — a three-filament kit purges into a far shallower band
   *  than the profile's six-filament bound, and on a full bed that is the
   *  difference between one plate and a refusal. */
  filaments?: number
}): KitPlateLayout {
  const {
    instances,
    bases,
    bed = BAMBU_256_BED,
    wipeTower = DEFAULT_WIPE_TOWER_PROFILE,
    supportsAtSlice = false,
    filaments,
  } = args
  const gapMm = args.gapMm ?? moduleGapMm(supportsAtSlice)
  const growthMm = moduleGrowthMm(supportsAtSlice)
  const packBed = firstLayerBed(bed, growthMm)

  const reserve = plateTowerReserve(wipeTower, supportsAtSlice, filaments)
  // The tower searches the SAME first-layer bed the packer packs. Its edge law
  // is untouched by that: `towerMargin` is max(marginMm, TOWER_EDGE 16) and the
  // growth is ≤ 5.45, so 16 still dominates — the tower already keeps a stricter
  // edge than a module needs. Candidate ORDER is unchanged too: `cornerPull`
  // scores off `bed.wMm`/`bed.dMm`, which `firstLayerBed` never touches.
  const towerSpots = towerPlacementCandidates(
    packBed,
    reserve,
    bedFreeRects(packBed, towerMargin(packBed))
  )
  if (towerSpots.length === 0) {
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

  // Report the FIRST spot's refusal when none works. It is the corner the tower
  // would have taken on its own, so the diagnosis a user reads is the one that
  // describes the plate they asked for, not whichever of a dozen fallbacks
  // happened to fail last.
  let firstRefusal: KitPlateFitError | null = null
  for (const tower of towerSpots) {
    try {
      return layoutAroundTower({ instances, bases, bed, packBed, growthMm, gapMm, tower })
    } catch (err) {
      if (!(err instanceof KitPlateFitError)) throw err
      firstRefusal ??= err
    }
  }
  // Unreachable-by-construction guard: the loop either returns or records a
  // refusal, and towerSpots is non-empty above.
  throw firstRefusal ?? new Error('packKitPlate: no tower spot tried')
}

/** One tower spot, fully evaluated: pack the modules around it and slide the
 *  result clear of the printer's keep-outs, or refuse. Split out of {@link
 *  packKitPlate} so the spot search reads as a search. */
function layoutAroundTower(args: {
  instances: readonly KitPlateInstance[]
  bases: Record<ModuleKind, ModuleBasis>
  /** The printer's real bed — what refusals name and what the layout reports. */
  bed: BedSize
  /** The `firstLayerBed` — what the packer packs into. */
  packBed: BedSize
  growthMm: number
  gapMm: number
  tower: PlacedTower
}): KitPlateLayout {
  const { instances, bases, bed, packBed, growthMm, gapMm, tower } = args

  const items: PackItem[] = instances.map((inst) => ({
    id: inst.id,
    wMm: bases[inst.kind].wMm,
    hMm: bases[inst.kind].hMm,
  }))
  const packed = packPlates(items, packBed, gapMm, tower)
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

  const packedPlacements = instances.map((inst): KitPlatePlacement => {
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

  // The plate's FIRST-LAYER box has to clear the printer's keep-outs and the
  // bed edges, not just its parts' outlines — Orca hulls each volume, our
  // volumes span the plate, and brim/supports grow every module by `growthMm`
  // per side. See clearOfKeepOuts.
  const shift = clearOfKeepOuts(
    bed,
    packedPlacements.map((pl) => ({ xMm: pl.xMm, yMm: pl.yMm, wMm: pl.wMm, dMm: pl.hMm })),
    { xMm: tower.xMm, yMm: tower.yMm, wMm: tower.wMm, dMm: tower.dMm },
    growthMm
  )
  if (!shift) {
    throw new KitPlateFitError(
      'keep-out',
      [],
      `this kit fills the ${bedLabel(
        bed
      )} so completely that it can't be slid clear of the printer's keep-out zone — the slicer would refuse it as an object conflict.`,
      'Print fewer columns, scale the design down, or select a printer with a bigger bed. The kit zip still prints module by module.'
    )
  }
  const placements =
    shift.dxMm === 0 && shift.dyMm === 0
      ? packedPlacements
      : packedPlacements.map((pl) => ({
          ...pl,
          xMm: pl.xMm + shift.dxMm,
          yMm: pl.yMm + shift.dyMm,
        }))
  const placedTower =
    shift.dxMm === 0 && shift.dyMm === 0
      ? tower
      : {
          ...tower,
          xMm: tower.xMm + shift.dxMm,
          yMm: tower.yMm + shift.dyMm,
          pinXMm: tower.pinXMm + shift.dxMm,
          pinYMm: tower.pinYMm + shift.dyMm,
        }

  return { placements, tower: placedTower, bed }
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

/** Everything decided about a kit plate BEFORE any triangle moves — the shared
 *  head of {@link planKitPlate} and {@link buildKitPlateThreeMf}. */
export interface KitPlatePlan {
  /** Where every module and the tower land. What a bed preview draws. */
  readonly layout: KitPlateLayout
  readonly instances: readonly KitPlateInstance[]
  readonly bases: Record<ModuleKind, ModuleBasis>
  /** This kit's gated soups, memoized per (kind, column). */
  readonly soupsFor: (inst: KitPlateInstance) => ModuleSoups
  /** Some module prints its own feet, so this plate slices with supports on
   *  whatever the ticket style says — it widens the gaps and the tower ring. */
  readonly feetPrinted: boolean
  /** Filaments this plate resolves to, `extraFilaments` included. Picks the
   *  tower's envelope row. */
  readonly filaments: number
}

/** The inputs that decide a plate's ARRANGEMENT. `buildKitPlateThreeMf` takes
 *  these plus the emit-only ones (`slotLabels`), so a preview and the submit it
 *  previews are the same call with the same answer. */
export interface KitPlatePlanArgs {
  /** The snapshot-once module renders — the same bundle the kit zip builds from. */
  parts: ModuleExportParts
  filamentMap: FilamentMap
  supportsAtSlice?: boolean
  bed?: BedSize
  wipeTower?: WipeTowerProfileGeometry
  gapMm?: number
  /** Filaments the ticket will add beyond the plate's own bodies — the
   *  support-interface spool. A download adds none. */
  extraFilaments?: number
}

/**
 * Gate every module, measure its basis, and pack the plate — everything up to
 * but not including the emit.
 *
 * Split out of {@link buildKitPlateThreeMf} so the bed preview and the submit
 * can't disagree about where things land. The preview is only honest if it is
 * the SAME arrangement that ships, including the refusals: a preview computed
 * from a cheaper model of the geometry would eventually draw a plate that fits
 * while the submit refuses, or worse, draw one that fits while a different one
 * prints. So this returns the real layout off the real renders, and the caller
 * that wants bytes pays only the emit on top.
 *
 * @throws {KitPlateFitError} when the kit doesn't fit one plate — which a
 * preview renders as the refusal it is, rather than hiding until submit.
 */
export function planKitPlate(args: KitPlatePlanArgs): KitPlatePlan {
  const {
    parts,
    filamentMap,
    supportsAtSlice,
    bed = BAMBU_256_BED,
    wipeTower = DEFAULT_WIPE_TOWER_PROFILE,
    gapMm,
    extraFilaments = 0,
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

  // The tower's reservation has to be sized BEFORE the pack, so the filament count
  // has to be known before the bodies are emitted. It is: a body is emitted per slot
  // that carries geometry, and the slots are fixed once every instance is gated —
  // placement moves triangles, it never changes which filament they print on. The
  // emit tail recomputes the same set from the same soups, so the reserved hole and
  // the count reported to the service are the same number by construction.
  const plateSlots = new Set<number>()
  for (const inst of instances) {
    const soups = soupsFor(inst)
    for (const slot of soups.slotOfShell) plateSlots.add(slot)
    for (const soup of soups.partSoups) plateSlots.add(soup.slot)
  }

  const filaments = plateSlots.size + extraFilaments
  const layout = packKitPlate({
    instances,
    bases,
    bed,
    gapMm,
    wipeTower,
    supportsAtSlice: supportsAtSlice || feetPrinted,
    filaments,
  })
  return { layout, instances, bases, soupsFor, feetPrinted, filaments }
}

/**
 * Build the whole kit as ONE plate: plan it ({@link planKitPlate}), then apply
 * each placement rigidly to every body of its module and emit the lot through
 * the shared bucket/emit tail.
 *
 * Classification happens BEFORE placement, and that ordering is load-bearing:
 * `analyzeModuleShells` reads bead centers at the module's known local x and
 * hard-errors on anything else, so a rotated or translated module would fail its
 * own gate. Placement is the last thing that touches geometry.
 *
 * @throws {KitPlateFitError} when the kit doesn't fit one plate — the caller
 * falls back to the kit zip.
 */
export function buildKitPlateThreeMf(
  args: KitPlatePlanArgs & { slotLabels?: readonly string[] }
): KitPlate {
  const {
    filamentMap,
    slotLabels,
    supportsAtSlice,
    bed = BAMBU_256_BED,
    wipeTower = DEFAULT_WIPE_TOWER_PROFILE,
    extraFilaments = 0,
  } = args
  const { layout, instances, bases, soupsFor, feetPrinted } = planKitPlate(args)
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
    extraFilaments,
  })

  return { ...layout, bytes: built.bytes, bodies: built.bodies, wipeTower: built.wipeTower }
}
