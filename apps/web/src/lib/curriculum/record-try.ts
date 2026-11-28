/**
 * One recorder for every live try (practice-kinds plan of record §1.3, K2).
 *
 * `recordTry` = `withRowCas(planId, plan => idempotency → kind → expected
 * item → judge → evidence → machine)`. It replaces `recordSlotResult` and
 * `recordRedoResult`: a first try, a retry and a do-over all come through
 * here, from any of the three bodies the wire carries (§3.3):
 *
 * - `record` / `record_redo` with the legacy body (every open bundle from
 *   before K2) or the K2 superset body (the legacy fields plus `itemId`,
 *   `outcome`, `answer`, `payload`). Both are located by content as before
 *   (problem, slot, round; `redoContext` for a do-over), so the same try gives
 *   the same row whichever body carries it;
 * - `record_try` with the envelope (`TrySubmission`), located by `itemId`
 *   through the kind's `expectedItem` / `acceptsDoOver`. Unused by the client
 *   until K4.
 *
 * The server is the only judge (amendment A1): the stored `isCorrect` is
 * `kind.judge(...)` on an answered try, false otherwise. A legacy body's
 * `isCorrect` is not compared with anything; it is read only to recognise a
 * skip as `handleSkip` has always sent it (`outcomeOfLegacyBody`). The verdict
 * stored is returned beside the plan (amendment A11), for a duplicate the
 * verdict of the row already stored.
 */

import { itemSlotIndexOfRow, retryRoundOfRow, tryKindOfRow } from '@/db/schema/legacy-try-fields'
import { sameProblem } from '@/db/schema/session-plan-helpers'
import {
  doOverStamp,
  isClientTryId,
  mintTryId,
  normalizeTries,
  partStateOf,
} from '@/db/schema/session-plan-normalize'
import {
  calculateSessionHealth,
  type GeneratedProblem,
  type SessionPart,
  type SessionPlan,
  type SlotResult,
  type SlotResultSubmission,
  type StoredTry,
  type TryEvidence,
  type TryKind,
  type TryOutcome,
  type TryPayload,
} from '@/db/schema/session-plans'
import { revokeSharesForSession } from '@/lib/session-share'
import { arithmeticCursorSlotIndex } from './parts/arithmetic/session-view'
import type { AnyPartKind } from './parts/kind'
import { findPartKind, kindIdOf } from './parts/registry'
import { recordSkillAttemptsWithHelp } from './progress-manager'
import { noWrite, type SessionPlanPatch, withRowCas } from './row-cas'
import { applyFlowEvent, type RecordedTry } from './session-flow'
import { sanitizeResultTiming } from './timing/response-time-guard'
import { weightOfTry } from './try-weight'

// ============================================================================
// Errors (re-exported by session-planner.ts, where routes and tests import them)
// ============================================================================

/**
 * A try was submitted for a different item than the one the server expects
 * next, and it is not a resubmit of the try just recorded; or a do-over the
 * kind does not accept (no try yet, another problem, an answer already
 * divulged). The client's plan is stale; the route answers 409 and the client
 * refetches.
 */
export class SlotResultMismatchError extends Error {
  constructor(
    public readonly submittedSlotId: string | undefined,
    public readonly expectedSlotId: string | null
  ) {
    super(
      `Answer is for slot ${submittedSlotId ?? '(none)'}, but the current problem is ${expectedSlotId ?? '(none)'}`
    )
    this.name = 'SlotResultMismatchError'
  }
}

/**
 * A do-over whose `itemId` and indices name different slots: a client bug, not
 * a stale plan, so the route answers 400 rather than the quiet 409 refetch
 * that would drop the kid's do-over without a word (§10 P5a-7).
 */
export class MalformedDoOverError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly originalPartIndex: number | undefined,
    public readonly originalSlotIndex: number | undefined
  ) {
    super(
      `Do-over names item ${itemId} but part ${originalPartIndex}, slot ${originalSlotIndex}, which is another slot`
    )
    this.name = 'MalformedDoOverError'
  }
}

/**
 * A first or retry try reached a live session that is not `practicing` (a part
 * transition or a break owns the next step). Nothing is recorded; the route
 * answers 409 `not_practicing` with this plan in the body, and the client
 * applies it, which renders the transition or break screen (plan of record
 * §1.1, Phase 3c).
 */
export class NotPracticingError extends Error {
  readonly code = 'not_practicing'
  constructor(public readonly plan: SessionPlan) {
    super(`The session is in ${plan.flowState}, not practicing; the try was not recorded`)
    this.name = 'NotPracticingError'
  }
}

/**
 * A try for a part whose kind this image does not know (a newer image's part,
 * read after a rollback). Nothing is recorded; the route answers 409
 * `unknown_kind`, which the client resyncs quietly (practice-kinds K2, R14).
 */
export class UnknownKindError extends Error {
  readonly code = 'unknown_kind'
  constructor(public readonly kind: string) {
    super(`Unknown part kind: ${kind.slice(0, 40)}; the try was not recorded`)
    this.name = 'UnknownKindError'
  }
}

/** A `record_try` body that is not a `TrySubmission`: a client bug; the route answers 400. */
export class MalformedTrySubmissionError extends Error {
  readonly code = 'MALFORMED_TRY'
  constructor(reason: string) {
    super(`Malformed try submission: ${reason}`)
    this.name = 'MalformedTrySubmissionError'
  }
}

// ============================================================================
// Bodies
// ============================================================================

/**
 * Context for a manual redo (`record_redo`).
 */
export interface RedoContext {
  /**
   * The item being redone (its slot id), sent by clients from Phase 5 on. When
   * present it names the item; the indices, which those clients keep sending
   * for servers from before it, must name the same slot.
   */
  itemId?: string
  /** Part index of the problem being redone */
  originalPartIndex: number
  /** Slot index of the problem being redone */
  originalSlotIndex: number
  /**
   * Whether the original answer was correct, as the client saw it. Sent for
   * servers from before Phase 1; this server derives it from the item's tries.
   */
  originalWasCorrect?: boolean
}

/** The envelope fields a K2 superset body carries beside the legacy ones (§3.3). */
interface SupersetFields {
  itemId?: string
  outcome?: TryOutcome
  answer?: unknown
  payload?: TryPayload
}

/** A `record_redo` body (legacy or superset). */
export type RedoSubmission = Omit<SlotResult, 'timestamp' | 'partNumber'>

/** The two legacy actions, with the legacy or the superset body. */
export type LegacySubmission =
  | { action: 'record'; result: SlotResultSubmission }
  | { action: 'record_redo'; result: RedoSubmission; redoContext: RedoContext }

/** A try in the envelope (`record_try`, §1.3). */
export interface TrySubmission {
  tryId: string
  partIndex: number
  itemId: string
  mode: 'first_or_retry' | 'do_over'
  outcome: TryOutcome
  /** null unless answered */
  answer: unknown | null
  payload: TryPayload
  timing: Pick<
    StoredTry,
    | 'responseTimeMs'
    | 'responseTimeMsRaw'
    | 'wasIdleCapped'
    | 'capReason'
    | 'capThresholdMs'
    | 'capSource'
    | 'hiddenTimeExcludedMs'
  >
  help: Pick<StoredTry, 'hadHelp' | 'incorrectAttempts' | 'helpTrigger'>
}

/** The verdict stored for a try, returned with the plan (amendment A11). */
export interface TryVerdict {
  tryId: string
  isCorrect: boolean
  outcome: TryOutcome
}

export interface RecordTryResult {
  plan: SessionPlan
  /** The try just recorded, or the one already stored for a duplicate; null when none is found */
  try: TryVerdict | null
}

const OUTCOMES: readonly TryOutcome[] = ['answered', 'skipped', 'timeout']
const isOutcome = (v: unknown): v is TryOutcome => OUTCOMES.includes(v as TryOutcome)

/**
 * A `record_try` body checked for shape (the route's 400). Only the fields the
 * recorder reads are checked; timing and help pass through the same guards
 * as a legacy body's.
 */
export function parseTrySubmission(body: unknown): TrySubmission {
  if (!body || typeof body !== 'object') throw new MalformedTrySubmissionError('not an object')
  const b = body as Record<string, unknown>
  if (!isClientTryId(b.tryId)) throw new MalformedTrySubmissionError('tryId')
  if (typeof b.partIndex !== 'number' || !Number.isInteger(b.partIndex)) {
    throw new MalformedTrySubmissionError('partIndex')
  }
  if (typeof b.itemId !== 'string' || b.itemId.length === 0) {
    throw new MalformedTrySubmissionError('itemId')
  }
  if (b.mode !== 'first_or_retry' && b.mode !== 'do_over') {
    throw new MalformedTrySubmissionError('mode')
  }
  if (!isOutcome(b.outcome)) throw new MalformedTrySubmissionError('outcome')
  const payload = b.payload as TryPayload | undefined
  if (!payload || typeof payload !== 'object' || typeof payload.kind !== 'string') {
    throw new MalformedTrySubmissionError('payload')
  }
  const timing = (b.timing ?? {}) as TrySubmission['timing']
  if (typeof timing.responseTimeMs !== 'number') {
    throw new MalformedTrySubmissionError('timing.responseTimeMs')
  }
  const help = (b.help ?? {}) as Partial<TrySubmission['help']>
  return {
    tryId: b.tryId,
    partIndex: b.partIndex,
    itemId: b.itemId,
    mode: b.mode,
    outcome: b.outcome,
    answer: b.outcome === 'answered' ? (b.answer ?? null) : null,
    payload,
    timing,
    help: {
      hadHelp: help.hadHelp === true,
      incorrectAttempts: typeof help.incorrectAttempts === 'number' ? help.incorrectAttempts : 0,
      ...(help.helpTrigger !== undefined ? { helpTrigger: help.helpTrigger } : {}),
    },
  }
}

/**
 * A submitted try without the fields only the server stamps. Clients from
 * before Phase 1 send `isRetry`/`epochNumber` guesses and `masteryWeight`;
 * `epochNumber` stays (it tells a resubmit from the next round), the rest go.
 * A `tryId` not in the form the client mints (see `isClientTryId`) is treated
 * as absent: the server mints one and the exact-match rule applies. The
 * superset body's envelope fields go too: the server computes its own, so the
 * superset and the legacy body give the same row, byte for byte.
 */
type Unstamped<T> = Omit<
  T,
  | 'kind'
  | 'round'
  | 'practiceOnly'
  | 'masteryWeight'
  | 'isRetry'
  | 'originalSlotIndex'
  | 'voided'
  | 'attachmentId'
  | keyof SupersetFields
  | 'evidence'
>

function withoutServerStamps<T extends Partial<SlotResult>>(submission: T): Unstamped<T> {
  const {
    kind: _kind,
    round: _round,
    practiceOnly: _practiceOnly,
    masteryWeight: _masteryWeight,
    isRetry: _isRetry,
    originalSlotIndex: _originalSlotIndex,
    voided: _voided,
    attachmentId: _attachmentId,
    itemId: _itemId,
    outcome: _outcome,
    answer: _answer,
    evidence: _evidence,
    payload: _payload,
    clientVerdict: _clientVerdict,
    tryId,
    ...rest
  } = submission as T & SupersetFields & { clientVerdict?: unknown }
  if (tryId !== undefined && !isClientTryId(tryId)) {
    console.warn('[record-try] ignoring malformed tryId', {
      tryId: String(tryId).slice(0, 80),
    })
    return rest as Unstamped<T>
  }
  return (tryId === undefined ? rest : { ...rest, tryId }) as Unstamped<T>
}

/**
 * A submission without the legacy try fields a client may still send
 * (`epochNumber` is read before this, to tell a resubmit from the next round).
 * New rows carry none of them since Phase 6b-1 (§10 P6b1-4).
 */
function withoutLegacyTryFields<T extends Partial<SlotResult>>(
  submission: T
): Omit<T, 'isRetry' | 'epochNumber' | 'isManualRedo' | 'originalSlotIndex'> {
  const {
    isRetry: _isRetry,
    epochNumber: _epochNumber,
    isManualRedo: _isManualRedo,
    originalSlotIndex: _originalSlotIndex,
    ...rest
  } = submission
  return rest
}

/**
 * The outcome of a try sent in a legacy body: a skip arrives as `handleSkip`
 * has always sent it (`ActiveSession.tsx`): the correct answer, marked wrong,
 * with manual help. The one place this heuristic lives (practice-kinds plan
 * K1a); a superset body names its outcome, and every reader takes `outcome`
 * from the row. The body's `isCorrect` is read here only as part of that
 * signal; it is never stored or compared.
 */
function outcomeOfLegacyBody(
  body: Pick<SlotResult, 'hadHelp' | 'helpTrigger' | 'studentAnswer' | 'isCorrect' | 'problem'>
): TryOutcome {
  return body.hadHelp &&
    body.helpTrigger === 'manual' &&
    body.studentAnswer === body.problem?.answer &&
    !body.isCorrect
    ? 'skipped'
    : 'answered'
}

// ============================================================================
// The recorder
// ============================================================================

/** The submission after the body shape is gone: what the CAS decision reads. */
type Normalized =
  | {
      shape: 'legacy'
      mode: 'first_or_retry'
      tryId: string | undefined
      /** The body as stored (server stamps, legacy try fields and envelope fields removed) */
      fields: Omit<SlotResult, 'timestamp' | 'partNumber' | 'slotId' | 'slotIndex'>
      /** Located by content (`problem`, `slotIndex`, `epochNumber`, `partIndex` when sent) */
      match: {
        partIndex: number | undefined
        slotId: string | undefined
        slotIndex: number
        epochNumber: number | undefined
        problem: GeneratedProblem | undefined
        studentAnswer: number
      }
      outcome: TryOutcome | undefined
    }
  | {
      shape: 'legacy'
      mode: 'do_over'
      tryId: string | undefined
      fields: Omit<SlotResult, 'timestamp' | 'partNumber' | 'slotId' | 'slotIndex'>
      redoContext: RedoContext
      slotId: string | undefined
      problem: GeneratedProblem | undefined
      outcome: TryOutcome | undefined
    }
  | { shape: 'envelope'; mode: TrySubmission['mode']; tryId: string; s: TrySubmission }

/** Legacy shape → what the decision reads (§3.3); content-matching kept for bodies without `itemId`. */
function normalizeSubmission(s: TrySubmission | LegacySubmission): Normalized {
  if (!('action' in s)) {
    const sub = parseTrySubmission(s)
    return { shape: 'envelope', mode: sub.mode, tryId: sub.tryId, s: sub }
  }
  const explicit = (s.result as SupersetFields).outcome
  const outcome = isOutcome(explicit) ? explicit : undefined
  if (s.action === 'record') {
    const { partIndex, ...unstamped } = withoutServerStamps(s.result)
    // Server-side timing backstop (#156): cap any value that outran the
    // absolute ceiling before it is stored or fed to BKT
    const result = { ...unstamped, ...sanitizeResultTiming(unstamped) }
    const { slotId, slotIndex, ...fields } = withoutLegacyTryFields(result)
    return {
      shape: 'legacy',
      mode: 'first_or_retry',
      tryId: result.tryId,
      fields,
      match: {
        partIndex,
        slotId,
        slotIndex,
        epochNumber: result.epochNumber,
        problem: result.problem,
        studentAnswer: result.studentAnswer,
      },
      outcome,
    }
  }
  const unstamped = withoutServerStamps(s.result)
  const result = { ...unstamped, ...sanitizeResultTiming(unstamped) }
  const { slotId, slotIndex: _slotIndex, ...fields } = withoutLegacyTryFields(result)
  return {
    shape: 'legacy',
    mode: 'do_over',
    tryId: result.tryId,
    fields,
    redoContext: s.redoContext,
    slotId,
    problem: result.problem,
    outcome,
  }
}

/**
 * Where the do-over's item is: the slot whose id is `itemId` when sent (null
 * when no slot has it; MalformedDoOverError when indices sent beside it name
 * another slot), else the slot the indices name.
 */
function doOverItemOf(
  parts: readonly SessionPart[],
  context: RedoContext
): { partIndex: number; slotIndex: number } | null {
  if (context.itemId === undefined) {
    return { partIndex: context.originalPartIndex, slotIndex: context.originalSlotIndex }
  }
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const slots = parts[partIndex].slots
    const slotIndex = Array.isArray(slots)
      ? slots.findIndex((slot) => slot.slotId === context.itemId)
      : -1
    if (slotIndex < 0) continue
    const disagrees =
      (typeof context.originalPartIndex === 'number' && context.originalPartIndex !== partIndex) ||
      (typeof context.originalSlotIndex === 'number' && context.originalSlotIndex !== slotIndex)
    if (disagrees) {
      throw new MalformedDoOverError(
        context.itemId,
        context.originalPartIndex,
        context.originalSlotIndex
      )
    }
    return { partIndex, slotIndex }
  }
  return null
}

/** The part's kind, or UnknownKindError (409 `unknown_kind`). */
function knownKindOf(part: SessionPart): AnyPartKind {
  const kind = findPartKind(part)
  if (!kind) throw new UnknownKindError(String(kindIdOf(part)))
  return kind
}

/** Whether a try with this id is already recorded (idempotent record by `tryId`). */
function isRecordedTry(plan: SessionPlan, tryId: string | undefined): boolean {
  return tryId !== undefined && plan.results.some((r) => r.tryId === tryId)
}

/** The stored verdict of a row of `plan` (its normalized try: old rows derive `outcome`). */
function verdictOfRow(plan: SessionPlan, row: SlotResult | undefined): TryVerdict | null {
  if (!row) return null
  const t = normalizeTries(plan.id, plan.parts, plan.results).find((x) => x.result === row)
  return t ? { tryId: t.tryId, isCorrect: t.isCorrect, outcome: t.outcome } : null
}

/** Elapsed practice time for session health: since the start, 0 before it. */
function elapsedSinceStart(plan: SessionPlan): number {
  return plan.startedAt ? Date.now() - plan.startedAt.getTime() : 0
}

/** The row write for a recorded try: the machine's patch plus session health. */
function tryWrite(plan: SessionPlan, row: SlotResult, t: RecordedTry): SessionPlanPatch {
  const { patch } = applyFlowEvent(plan, { type: 'TRY_RECORDED', row, try: t })
  return {
    ...patch,
    sessionHealth: calculateSessionHealth(
      { ...plan, results: patch.results ?? plan.results },
      elapsedSinceStart(plan)
    ),
  }
}

/** Revoke any active share links once a session completes (non-critical). */
async function revokeSharesIfComplete(planId: string, isComplete: boolean) {
  if (!isComplete) return
  try {
    await revokeSharesForSession(planId)
  } catch (shareError) {
    // Non-critical: log and continue (session already completed successfully)
    console.error('[recordTry] revokeSharesForSession FAILED:', shareError)
  }
}

/** Where a try goes, once located and checked. */
interface Target {
  partIndex: number
  part: SessionPart
  kind: AnyPartKind
  itemId: string
  tryKind: TryKind
  round: number
  practiceOnly: boolean
  /** The kind's top-level fields for the row (arithmetic: `slotId`, `slotIndex`, and for an envelope its snapshot) */
  snapshot: Partial<SlotResult>
  /** The stored payload */
  payload: TryPayload
}

/** What a committed try reports to the code after its write. */
interface Committed {
  verdict: TryVerdict
  mode: Normalized['mode']
  practiceOnly: boolean
  evidence: TryEvidence | null
  hadHelp: boolean | undefined
  responseTimeMs: number
  previousPartIndex: number
  previousSlotIndex: number
  inRetryEpoch: boolean
}

type Decision = { committed: Committed } | { duplicate: TryVerdict | null }

/**
 * Locate a first or retry try sent in a legacy body: by content, the item the
 * student is shown (`expectedItem` of the current part's state; the client's
 * `getCurrentProblemInfo` makes the same decision). The submitted `slotId` is
 * not trusted: older clients can send the previous slot's id after an
 * optimistic advance, so the stored `slotId` is always the item's own.
 * Without a `tryId` (clients from before Phase 1), a resubmit that equals the
 * last recorded try exactly (slot, round when sent, problem, answer) is a
 * duplicate.
 */
function locateLegacyFirstOrRetry(
  plan: SessionPlan,
  n: Extract<Normalized, { shape: 'legacy'; mode: 'first_or_retry' }>
): Target | { duplicate: TryVerdict | null } {
  const { match } = n
  // A part this image cannot record into: refused before anything else
  const named = plan.parts[match.partIndex ?? plan.currentPartIndex]
  if (named) knownKindOf(named)

  const currentPart = plan.parts[plan.currentPartIndex]
  const currentKind = currentPart ? findPartKind(currentPart) : undefined
  const expected =
    currentPart && currentKind && kindIdOf(currentPart) === 'arithmetic'
      ? (currentKind.expectedItem(
          currentKind.contentOf(currentPart),
          partStateOf(plan, plan.currentPartIndex)
        ) as {
          slotId: string
          originalSlotIndex: number
          epochNumber: number
          retryIndex: number | null
          problem: GeneratedProblem | undefined
        } | null)
      : null
  //
  // Transitional gap: clients from before this check send no epochNumber (or
  // partIndex). For them a resubmit of a wrong answer to a part's last slot,
  // arriving once that slot's first retry is current, has the same content as
  // the retry and is recorded as it. Clients that send epochNumber are exact.
  const isSubmittedTry = (t: {
    partIndex: number
    slotIndex: number
    epochNumber?: number
    problem: GeneratedProblem | undefined
  }) =>
    (match.partIndex === undefined || t.partIndex === match.partIndex) &&
    t.slotIndex === match.slotIndex &&
    (match.epochNumber === undefined || (t.epochNumber ?? 0) === match.epochNumber) &&
    sameProblem(t.problem, match.problem)
  const isExpectedItem =
    !!expected &&
    isSubmittedTry({
      partIndex: plan.currentPartIndex,
      slotIndex: expected.originalSlotIndex,
      epochNumber: expected.epochNumber,
      problem: expected.problem,
    })
  if (!isExpectedItem) {
    // The stored row's kind, round and item position come from the
    // normalizer (`legacy-try-fields.ts`), so a row without the legacy try
    // fields (Phase 6b-1) reads the same (§10 P6b-6)
    const lastTry = [...plan.results].reverse().find((r) => tryKindOfRow(r) !== 'do_over')
    const lastTryPartNumber = lastTry?.partNumber
    if (
      n.tryId === undefined &&
      lastTry &&
      isSubmittedTry({
        partIndex: plan.parts.findIndex((p) => p.partNumber === lastTryPartNumber),
        slotIndex: itemSlotIndexOfRow(lastTry),
        epochNumber: retryRoundOfRow(lastTry),
        problem: lastTry.problem,
      }) &&
      lastTry.studentAnswer === match.studentAnswer
    ) {
      console.log('[recordTry] duplicate submit ignored', { planId: plan.id, slotId: match.slotId })
      return { duplicate: verdictOfRow(plan, lastTry) }
    }
  }
  // A live session whose next step is a transition or a break takes no try,
  // whatever item it names: the client applies the plan sent back (Phase 3c).
  // Resubmits of a recorded try were answered above, so a resend of a part's
  // final try stays a no-op.
  if (plan.status === 'in_progress' && (plan.flowState ?? 'practicing') !== 'practicing') {
    throw new NotPracticingError(plan)
  }
  if (!expected || !isExpectedItem || !currentPart || !currentKind) {
    throw new SlotResultMismatchError(match.slotId, expected?.slotId ?? null)
  }
  if (match.slotId !== expected.slotId) {
    console.log('[recordTry] submitted slotId lags the answered problem; storing its own', {
      planId: plan.id,
      submittedSlotId: match.slotId,
      slotId: expected.slotId,
    })
  }
  if (!Array.isArray(currentPart.slots)) {
    throw new Error(
      `Plan ${plan.id} part ${plan.currentPartIndex} has invalid slots: ${typeof currentPart.slots}`
    )
  }
  const inRetry = expected.retryIndex !== null
  return {
    partIndex: plan.currentPartIndex,
    part: currentPart,
    kind: currentKind,
    itemId: expected.slotId,
    tryKind: inRetry ? 'retry' : 'first',
    round: expected.epochNumber,
    practiceOnly: false,
    snapshot: { slotId: expected.slotId, slotIndex: expected.originalSlotIndex },
    payload: { kind: kindIdOf(currentPart) },
  }
}

/**
 * Locate a do-over sent in a legacy body: the slot `redoContext` names, by
 * `itemId` when sent (indices sent beside it must agree, else
 * MalformedDoOverError, a 400), else by its indices. A do-over of an unknown
 * item, one the kind does not accept (no try yet, an answer already divulged)
 * or whose problem is not the submitted one throws SlotResultMismatchError.
 */
function locateLegacyDoOver(
  plan: SessionPlan,
  n: Extract<Normalized, { shape: 'legacy'; mode: 'do_over' }>
): Target {
  const located = doOverItemOf(plan.parts, n.redoContext)
  if (!located) throw new SlotResultMismatchError(n.slotId, null)
  const { partIndex, slotIndex } = located
  if (partIndex < 0 || partIndex >= plan.parts.length) {
    throw new Error(`Invalid part index: ${partIndex}`)
  }
  const part = plan.parts[partIndex]
  const kind = knownKindOf(part)
  const slot = part.slots?.[slotIndex]
  const tries = normalizeTries(plan.id, plan.parts, plan.results || [])
  if (
    !slot ||
    !kind.acceptsDoOver(kind.contentOf(part), partStateOf(plan, partIndex), tries, slot.slotId) ||
    !sameProblem(slot.problem, n.problem)
  ) {
    throw new SlotResultMismatchError(n.slotId, null)
  }
  const { round, practiceOnly } = doOverStamp(tries.filter((t) => t.itemId === slot.slotId))
  return {
    partIndex,
    part,
    kind,
    itemId: slot.slotId,
    tryKind: 'do_over',
    round,
    practiceOnly,
    snapshot: { slotId: slot.slotId, slotIndex },
    payload: { kind: kindIdOf(part) },
  }
}

/** The id and round of an expected item (the kind's, else the item's own `itemId`, round 0). */
function itemPositionOf(
  kind: AnyPartKind,
  item: unknown
): { itemId: string; round: number } | null {
  if (kind.itemPositionOf) return kind.itemPositionOf(item)
  const itemId = (item as { itemId?: unknown } | null)?.itemId
  return typeof itemId === 'string' ? { itemId, round: 0 } : null
}

/** Locate a try sent in the envelope (`record_try`): by `itemId`, through the kind. */
function locateEnvelope(plan: SessionPlan, s: TrySubmission): Target {
  const part = plan.parts[s.partIndex]
  if (!part) throw new SlotResultMismatchError(s.itemId, null)
  const kind = knownKindOf(part)
  const content = kind.contentOf(part)
  const state = partStateOf(plan, s.partIndex)
  let tryKind: TryKind
  let round: number
  let practiceOnly: boolean
  if (s.mode === 'first_or_retry') {
    if (plan.status === 'in_progress' && (plan.flowState ?? 'practicing') !== 'practicing') {
      throw new NotPracticingError(plan)
    }
    const expected =
      s.partIndex === plan.currentPartIndex ? kind.expectedItem(content, state) : null
    const position = expected === null ? null : itemPositionOf(kind, expected)
    if (!position || position.itemId !== s.itemId) {
      throw new SlotResultMismatchError(s.itemId, position?.itemId ?? null)
    }
    tryKind = position.round > 0 ? 'retry' : 'first'
    round = position.round
    practiceOnly = false
  } else {
    const tries = normalizeTries(plan.id, plan.parts, plan.results || [])
    if (!kind.acceptsDoOver(content, state, tries, s.itemId)) {
      throw new SlotResultMismatchError(s.itemId, null)
    }
    ;({ round, practiceOnly } = doOverStamp(tries.filter((t) => t.itemId === s.itemId)))
    tryKind = 'do_over'
  }
  const snapshot = kind.snapshotOf
    ? kind.snapshotOf(content, s.itemId, s)
    : { fields: {}, payload: s.payload }
  if (!snapshot) throw new SlotResultMismatchError(s.itemId, null)
  return {
    partIndex: s.partIndex,
    part,
    kind,
    itemId: s.itemId,
    tryKind,
    round,
    practiceOnly,
    snapshot: snapshot.fields,
    payload: { ...snapshot.payload, kind: kindIdOf(part) },
  }
}

/** The row's own fields before the server's stamps: the body's, or the envelope's timing and help. */
function bodyFieldsOf(n: Normalized): Partial<SlotResult> {
  if (n.shape === 'legacy') return n.fields
  const timing = { ...n.s.timing, ...sanitizeResultTiming(n.s.timing) }
  return { ...timing, ...n.s.help }
}

/**
 * Record a try: a first try, a retry or a do-over, from any body (§1.3, §3.3).
 *
 * Idempotent by `tryId`: a try whose id is already recorded returns the plan
 * unchanged with the verdict already stored. Every CAS attempt re-reads the
 * row, so a request that lost a race against the same `tryId` sees it
 * recorded and returns without a second write or a second skill-attempt bump
 * (§10 P1-10).
 *
 * The server stamps `kind`, `round`, `practiceOnly`, `partIndex`,
 * `masteryWeight` (weightOfTry), the envelope and the verdict; client-sent
 * values for them are ignored. The flow machine (`TRY_RECORDED`) moves the
 * part's cursor through its kind and decides the rhythm. A do-over of an
 * item whose latest counted try was correct is practice-only (weight 0, no
 * skill-attempt bump).
 */
export async function recordTry(
  planId: string,
  submission: TrySubmission | LegacySubmission
): Promise<RecordTryResult> {
  const n = normalizeSubmission(submission)
  const traceStart = Date.now()

  const { plan: updated, value: decision } = await withRowCas<Decision>(planId, (plan) => {
    if (!plan.parts || !Array.isArray(plan.parts)) {
      throw new Error(
        `Plan ${planId} has invalid parts: ${typeof plan.parts} (status: ${plan.status}, partIndex: ${plan.currentPartIndex})`
      )
    }
    if (plan.parts.length === 0) throw new Error(`Plan ${planId} has empty parts array`)
    if (!plan.results || !Array.isArray(plan.results)) {
      throw new Error(`Plan ${planId} has invalid results: ${typeof plan.results} (expected array)`)
    }

    // A try already recorded (a resend after a lost reply, a double submit,
    // or the request this one raced)
    if (isRecordedTry(plan, n.tryId)) {
      console.log('[recordTry] duplicate tryId ignored', { planId, tryId: n.tryId })
      return noWrite({
        duplicate: verdictOfRow(
          plan,
          plan.results.find((r) => r.tryId === n.tryId)
        ),
      })
    }

    const located =
      n.shape === 'envelope'
        ? locateEnvelope(plan, n.s)
        : n.mode === 'first_or_retry'
          ? locateLegacyFirstOrRetry(plan, n)
          : locateLegacyDoOver(plan, n)
    if ('duplicate' in located) return noWrite(located)
    const t = located
    const content = t.kind.contentOf(t.part)

    if (n.mode === 'first_or_retry') {
      console.log('[GBTRACE][server]', 'record-slot-result-start', {
        ts: new Date().toISOString(),
        planId,
        playerId: plan.playerId,
        currentPartIndex: plan.currentPartIndex,
        currentSlotIndex: arithmeticCursorSlotIndex(plan),
        currentPartNumber: t.part.partNumber,
        currentPartType: t.part.type,
        submittedSlotIndex: t.snapshot.slotIndex,
        progress: t.kind.progress(content, partStateOf(plan, t.partIndex), []),
      })
    }

    const fields = bodyFieldsOf(n)
    const outcome =
      n.shape === 'envelope'
        ? n.s.outcome
        : (n.outcome ?? outcomeOfLegacyBody(fields as SlotResult))
    const answer =
      outcome !== 'answered'
        ? null
        : n.shape === 'envelope'
          ? n.s.answer
          : (fields as SlotResult).studentAnswer
    // The server is the only judge (amendment A1)
    const isCorrect = outcome === 'answered' && t.kind.judge(content, t.itemId, answer)

    // The row carries the try record only: no legacy try fields since 6b-1
    // (§10 P6b1-4); the top-level arithmetic fields as always (K14)
    const stamped = {
      ...fields,
      ...(n.shape === 'envelope' ? t.snapshot : {}),
      isCorrect,
      tryId: n.tryId ?? mintTryId(),
      kind: t.tryKind,
      round: t.round,
      practiceOnly: t.practiceOnly,
      partIndex: t.partIndex,
      ...(n.shape === 'legacy' ? t.snapshot : {}),
      partNumber: t.part.partNumber,
      timestamp: new Date(),
      masteryWeight: weightOfTry({
        kind: t.tryKind,
        round: t.round,
        isCorrect,
        practiceOnly: t.practiceOnly,
      }),
    } as SlotResult
    const evidence = t.kind.evidenceOf(t.part, {
      result: stamped,
      outcome,
      payload: t.kind.payloadOf({ ...stamped, payload: t.payload }),
    })
    const row: SlotResult = {
      ...stamped,
      itemId: t.itemId,
      outcome,
      answer,
      evidence,
      payload: t.payload,
    }

    return {
      write: tryWrite(plan, row, {
        partIndex: t.partIndex,
        itemId: t.itemId,
        kind: t.tryKind,
        round: t.round,
        practiceOnly: t.practiceOnly,
        isCorrect,
      }),
      value: {
        committed: {
          verdict: { tryId: row.tryId as string, isCorrect, outcome },
          mode: n.mode,
          practiceOnly: t.practiceOnly,
          evidence,
          hadHelp: row.hadHelp,
          responseTimeMs: row.responseTimeMs,
          previousPartIndex: plan.currentPartIndex,
          previousSlotIndex: arithmeticCursorSlotIndex(plan),
          inRetryEpoch: t.tryKind === 'retry',
        },
      },
    }
  })

  if ('duplicate' in decision) return { plan: updated, try: decision.duplicate }
  const c = decision.committed

  // Update global skill mastery timestamps with help tracking. Once per
  // recorded try: only the request whose write committed gets here; never for
  // a practice-only do-over (no pedagogical effect). masteryWeight is applied
  // by BKT when it reads the rows, not here.
  if (!c.practiceOnly && c.evidence && c.evidence.skills.length > 0) {
    const skillResults = c.evidence.skills.map((skillId) => ({
      skillId,
      isCorrect: c.verdict.isCorrect,
    }))
    try {
      await recordSkillAttemptsWithHelp(
        updated.playerId,
        skillResults,
        // as each recorder passed it before K2: a do-over defaulted it
        (c.mode === 'do_over' ? (c.hadHelp ?? false) : c.hadHelp) as boolean,
        c.responseTimeMs
      )
    } catch (skillError) {
      console.error('[recordTry] recordSkillAttemptsWithHelp FAILED:', skillError)
      // A first or retry try fails loudly (as it always has); a do-over's write
      // is already recorded and the bump is not worth failing it for
      if (c.mode === 'first_or_retry') throw skillError
    }
  }

  const isComplete = updated.status === 'completed'
  await revokeSharesIfComplete(planId, isComplete)

  if (c.mode === 'first_or_retry') {
    console.log('[GBTRACE][server]', 'record-slot-result-finish', {
      ts: new Date().toISOString(),
      planId,
      playerId: updated.playerId,
      durationMs: Date.now() - traceStart,
      previousPartIndex: c.previousPartIndex,
      previousSlotIndex: c.previousSlotIndex,
      nextPartIndex: updated.currentPartIndex,
      nextSlotIndex: arithmeticCursorSlotIndex(updated),
      partTransitioned: updated.currentPartIndex > c.previousPartIndex,
      flowState: updated.flowState,
      inRetryEpoch: c.inRetryEpoch,
      isComplete,
      status: updated.status,
    })
  }

  return { plan: updated, try: c.verdict }
}
