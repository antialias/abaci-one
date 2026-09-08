/**
 * Two-stage feet print (Gitea #38 — THH split/chain, things-haunt-house#456).
 *
 * The printed TPU feet stand the frame `feet_proud` mm off the bed. A two-stage
 * print runs the layers below that seam from the EXTERNAL spool (soft TPU95 the
 * AMS can't feed) and everything above it from the AMS, off ONE slice: Stage A
 * is the full AMS filament list + `split`, Stage B the same list + `chain`. THH
 * admits Stage B only when its model bytes AND resolved filament plan equal
 * Stage A's, so everything here is a pure function of the design and rides
 * both tickets identically.
 *
 * This is an OPTION at submit time, never a design parameter: with a TPU-for-AMS
 * tray loaded the single-job path stays the default, and the feet geometry is
 * the same either way — only the feed source differs.
 */
import type { ParamScalarValue, TicketStyle } from '@eink/print-dialog'
import { coPrintGroup, type FilamentCatalog, type FilamentSpool } from './abacus-catalog'
import type { FilamentMap, Params } from './abacus-model'

/** Stage A: split the slice at the seam; the below-seam half prints from the external feed. */
export interface TwoStageSplit {
  readonly atZMm: number
  readonly feed: { readonly external: true; readonly family: string }
}

/** Stage B: consume the half Stage A retained. */
export interface TwoStageChain {
  readonly continuesJobId: string
}

/** A filament-class overlay for one ticket entry: vector keys carry exactly one
 *  element (each `filament_{i}.json` describes one filament). */
export type SeamToolOverrides = Readonly<
  Record<string, ParamScalarValue | readonly [ParamScalarValue]>
>

/** The external feed's family. THH alias-folds it against filaments[0]'s family
 *  (TPU-AMS ≡ TPU), so an AMS "TPU for AMS" tray as filament 0 matches. */
export const TWO_STAGE_FEED_FAMILY = 'TPU'

/**
 * `style.process` keys the mode owns, on BOTH stages (the identity gate needs the
 * same resolved plan). Seam solidity first: a split through a merged solid leaves
 * Stage A's top layers as sparse infill with no top shell (the foot's top is
 * interior to the feet+frame union), so Stage B's first layer would land on open
 * infill — 100 % rectilinear infill plus interface shells make the seam a solid
 * bond (things-haunt-house#462 is the gateway-side seam band that retires this).
 * The speeds are the soft-TPU95 recipe proven on the #456 coupon: the slice takes
 * filament 0's AMS-TPU profile and TPU95 slips at those speeds (things-haunt-house#461
 * retires this by applying a feed-side profile below the seam only).
 */
export const TWO_STAGE_PROCESS: Readonly<Record<string, TicketStyle['process'][string]>> = {
  sparse_infill_density: 100,
  sparse_infill_pattern: 'rectilinear',
  interface_shells: true,
  initial_layer_speed: 15,
  initial_layer_infill_speed: 18,
  initial_layer_acceleration: 300,
  outer_wall_speed: 25,
  inner_wall_speed: 30,
  sparse_infill_speed: 30,
  internal_solid_infill_speed: 30,
  top_surface_speed: 25,
  gap_infill_speed: 25,
}

/** `filaments[0].overrides` — the seam tool's filament overlay, on BOTH stages:
 *  3 mm³/s max volumetric, a 40 °C plate, fan off for the first 3 layers. Same
 *  provenance as the process keys above (the #456 coupon recipe). */
export const TWO_STAGE_SEAM_TOOL_OVERRIDES: SeamToolOverrides = {
  filament_max_volumetric_speed: [3],
  hot_plate_temp_initial_layer: [40],
  hot_plate_temp: [40],
  textured_plate_temp_initial_layer: [40],
  textured_plate_temp: [40],
  close_fan_the_first_x_layers: [3],
}

/** The style a two-stage ticket rides: the operator's style with the mode's keys
 *  forced over it. The editor's value is untouched — this applies at submit. */
export function withTwoStageProcess(style: TicketStyle): TicketStyle {
  return { ...style, process: { ...style.process, ...TWO_STAGE_PROCESS } }
}

export type TwoStageUnavailableReason =
  /** `feet_mode` isn't `'printed'`, or the plan placed no feet role. */
  | 'feet-not-printed'
  /** A module kit packs many parts; the seam contract is one object on the plate. */
  | 'kit'
  /** The catalog isn't the live AMS roster — nothing to chain on. */
  | 'no-roster'
  /** The feet already print from the external spool (the #19 no-AMS shape). */
  | 'feet-slot-external'
  /** The feet tray isn't TPU — a TPU95 external feed has nothing to bond to. */
  | 'feet-not-tpu'

export type TwoStageAvailability =
  | {
      readonly ok: true
      /** The AMS tray the feet print from — filament 0, the seam tool. */
      readonly feetSlot: FilamentSpool
      readonly feedFamily: string
      /** The seam: the frame's bottom face sits `feet_proud` mm above the plate. */
      readonly atZMm: number
    }
  | { readonly ok: false; readonly reason: TwoStageUnavailableReason }

/** Whether the design + roster can print in two stages, and the seam if so. */
export function twoStageAvailability(input: {
  params: Pick<Params, 'feet_mode' | 'feet_proud'>
  filamentMap: Pick<FilamentMap, 'feet'>
  catalog: FilamentCatalog
  kit?: boolean
}): TwoStageAvailability {
  const { params, filamentMap, catalog, kit = false } = input
  if (params.feet_mode !== 'printed' || filamentMap.feet === undefined) {
    return { ok: false, reason: 'feet-not-printed' }
  }
  if (kit) return { ok: false, reason: 'kit' }
  if (catalog.source !== 'thh-ams') return { ok: false, reason: 'no-roster' }
  const feetSlot = catalog.spools[filamentMap.feet]
  if (!feetSlot) return { ok: false, reason: 'feet-not-printed' }
  if (feetSlot.external) return { ok: false, reason: 'feet-slot-external' }
  if (coPrintGroup(feetSlot.material) !== TWO_STAGE_FEED_FAMILY) {
    return { ok: false, reason: 'feet-not-tpu' }
  }
  return { ok: true, feetSlot, feedFamily: TWO_STAGE_FEED_FAMILY, atZMm: params.feet_proud }
}

function positiveNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** The layer height the ticket style resolves to: an explicit process override,
 *  else the height in the preset's name ("0.20mm-standard"). null = not knowable
 *  here — THH's slice is the ground truth and fails `split_failed` if it misses. */
export function effectiveLayerHeightMm(style: TicketStyle | null): number | null {
  const explicit = positiveNumber(style?.process?.layer_height)
  if (explicit !== null) return explicit
  const m = style?.basePreset ? /(\d+(?:\.\d+)?)\s*mm/i.exec(style.basePreset) : null
  return m ? positiveNumber(m[1]) : null
}

export interface SeamCheck {
  readonly atZMm: number
  readonly layerHeightMm: number | null
  readonly firstLayerMm: number | null
  /** true only when the heights are KNOWN and the seam lands between layers —
   *  THH can only split on a layer boundary (`split_failed` otherwise, minutes
   *  into a slice rather than at submit). Unknown heights don't block. */
  readonly misses: boolean
}

/** Does the seam land on a layer boundary? `feet_proud` 1.6 is 8 layers at 0.2
 *  and 10 at 0.16 — but a 0.25 layer, or a 0.2 first layer over 0.16 layers, misses. */
export function checkSeam(atZMm: number, style: TicketStyle | null): SeamCheck {
  const layerHeightMm = effectiveLayerHeightMm(style)
  const firstLayerMm = positiveNumber(style?.process?.initial_layer_print_height) ?? layerHeightMm
  if (layerHeightMm === null || firstLayerMm === null) {
    return { atZMm, layerHeightMm, firstLayerMm, misses: false }
  }
  const k = (atZMm - firstLayerMm) / layerHeightMm
  const onBoundary = k > -1e-6 && Math.abs(k - Math.round(k)) < 1e-6
  return { atZMm, layerHeightMm, firstLayerMm, misses: !onBoundary }
}

/**
 * What the panel keeps between Stage A and Stage B. THH does not persist or echo
 * `split`, so the client is the only party that knows which job was a Stage A —
 * and Stage A prints for the better part of an hour, so this outlives the tab.
 */
export interface TwoStageRecord {
  readonly v: 1
  readonly printerId: string
  readonly stageAJobId: string
  /** SHA-256 (hex) of the Stage A model bytes. Stage B refuses to submit anything
   *  else: a chained job with DIFFERENT bytes isn't rejected by THH — it slices on
   *  its own and silently prints the whole model. */
  readonly modelSha256: string
  /** The design signature Stage A was built from, so the hand-off can say "the
   *  design changed" before a rebuild even starts. */
  readonly designSig: string
  readonly atZMm: number
  readonly feedFamily: string
  readonly name: string
  readonly submittedAt: number
  /** Set once Stage B is submitted, so the hand-off can point at its job card
   *  (and offer a re-submit if that job fails or is canceled before it starts). */
  readonly stageBJobId?: string
}

type RecordStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The browser's localStorage, or null where there is none (SSR, sandboxed frames). */
export function safeStorage(): RecordStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const twoStageStorageKey = (printerId: string): string => `abacus.two-stage.${printerId}`

export function loadTwoStageRecord(
  storage: RecordStorage | null | undefined,
  printerId: string
): TwoStageRecord | null {
  try {
    const raw = storage?.getItem(twoStageStorageKey(printerId))
    if (!raw) return null
    const rec = JSON.parse(raw) as Partial<TwoStageRecord> | null
    return rec &&
      rec.v === 1 &&
      rec.printerId === printerId &&
      typeof rec.stageAJobId === 'string' &&
      typeof rec.modelSha256 === 'string' &&
      typeof rec.designSig === 'string' &&
      typeof rec.atZMm === 'number'
      ? (rec as TwoStageRecord)
      : null
  } catch {
    return null
  }
}

export function saveTwoStageRecord(
  storage: RecordStorage | null | undefined,
  record: TwoStageRecord
): void {
  try {
    storage?.setItem(twoStageStorageKey(record.printerId), JSON.stringify(record))
  } catch {
    // quota / private mode: the hand-off then lives only as long as the tab
  }
}

export function clearTwoStageRecord(
  storage: RecordStorage | null | undefined,
  printerId: string
): void {
  try {
    storage?.removeItem(twoStageStorageKey(printerId))
  } catch {
    // nothing to clear
  }
}

/** Hex SHA-256 of the model bytes — the same digest THH keys the retained half on. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // A fresh copy: `bytes` may be a view into a larger (or shared) buffer.
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The job id in a submit response, as the proxy relays it (`jobId`, `id`, or `job.id`). */
export function jobIdFromSubmitBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const rec = body as Record<string, unknown>
  const job = rec.job && typeof rec.job === 'object' ? (rec.job as Record<string, unknown>) : null
  const id = rec.jobId ?? rec.id ?? job?.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

/** Stage B was asked for with a model whose bytes are not the ones Stage A shipped. */
export class TwoStageDriftError extends Error {
  readonly record: TwoStageRecord
  constructor(record: TwoStageRecord) {
    super(
      'The design changed since Stage A — its 3MF no longer matches the bytes the print service retained, and a chained job with different bytes would silently print the whole model. Print Stage A again, or restore the design.'
    )
    this.name = 'TwoStageDriftError'
    this.record = record
  }
}

/** What the hand-off card shows, from the record and the roster's phases. */
export type HandoffView =
  /** Stage A hasn't completed (phase null = not in the job list yet). */
  | { readonly kind: 'stage-a-running'; readonly phase: string | null }
  | { readonly kind: 'stage-a-ended'; readonly phase: string }
  /** `retry`: a submitted Stage B failed or was canceled before it started. */
  | { readonly kind: 'ready-for-b'; readonly retry: boolean }
  | { readonly kind: 'stage-b-open'; readonly phase: string | null }
  | { readonly kind: 'done' }

const ended = (phase: string | null): phase is string => phase === 'failed' || phase === 'canceled'

export function handoffView(
  record: TwoStageRecord,
  phaseOf: (jobId: string) => string | null
): HandoffView {
  if (record.stageBJobId) {
    const b = phaseOf(record.stageBJobId)
    if (b === 'completed') return { kind: 'done' }
    if (ended(b)) return { kind: 'ready-for-b', retry: true }
    return { kind: 'stage-b-open', phase: b }
  }
  const a = phaseOf(record.stageAJobId)
  if (a === 'completed') return { kind: 'ready-for-b', retry: false }
  if (ended(a)) return { kind: 'stage-a-ended', phase: a }
  return { kind: 'stage-a-running', phase: a }
}

/** The hand-off between the stages, in the order the operator does it. */
export const STAGE_B_HANDOFF_STEPS: readonly string[] = [
  'Leave the plate exactly where it is — Stage B prints onto the feet.',
  'Unload the external TPU95 spool and reconnect the AMS PTFE tube.',
  'Check the AMS TPU tray the feet were mapped to is still loaded.',
  'Submit Stage B below, then start it from its job card once the printer clears the spool check.',
]
