/**
 * The legacy try actions, `record` and `record_redo`, as arithmetic's wire
 * (practice-kinds §3.3, K2). Every bundle before K4 sends them with
 * arithmetic's body: a slot, a slot index, a retry round (`epochNumber`) and a
 * problem; a do-over names its slot in `redoContext`. This module turns that
 * body into the row's fields and locates the try by content, as
 * `recordSlotResult` / `recordRedoResult` did before K2; the recorder
 * (`record-try.ts`) calls it through `parts/legacy-wire.ts` and names no kind.
 *
 * The K2 superset body (the legacy fields plus `itemId`, `outcome`, `answer`,
 * `payload`) is located the same way, by content, so the same try gives the
 * same row whichever body carries it; only its explicit `outcome` is read.
 */

import { itemSlotIndexOfRow, retryRoundOfRow, tryKindOfRow } from '@/db/schema/legacy-try-fields'
import { sameProblem } from '@/db/schema/session-plan-helpers'
import {
  doOverStamp,
  isClientTryId,
  normalizeTries,
  partStateOf,
} from '@/db/schema/session-plan-normalize'
import type {
  GeneratedProblem,
  SessionPart,
  SessionPlan,
  SlotResult,
  SlotResultSubmission,
  TryOutcome,
  TryPayload,
} from '@/db/schema/session-plans'
import {
  isLiveButNotPracticing,
  knownKindOf,
  MalformedDoOverError,
  NotPracticingError,
  SlotResultMismatchError,
} from '../../record-try-errors'
import { sanitizeResultTiming } from '../../timing/response-time-guard'
import type { LegacyLocated, LegacyTry, LegacyWire } from '../legacy-wire'
import { findPartKind, kindIdOf } from '../registry'
import type { ArithmeticItem } from './state'

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

/** A `record_redo` body (legacy or superset). */
export type RedoSubmission = Omit<SlotResult, 'timestamp' | 'partNumber'>

/** The two legacy actions, with the legacy or the superset body. */
export type LegacySubmission =
  | { action: 'record'; result: SlotResultSubmission }
  | { action: 'record_redo'; result: RedoSubmission; redoContext: RedoContext }

/** The envelope fields a K2 superset body carries beside the legacy ones (§3.3). */
interface SupersetFields {
  itemId?: string
  outcome?: TryOutcome
  answer?: unknown
  payload?: TryPayload
}

const OUTCOMES: readonly TryOutcome[] = ['answered', 'skipped', 'timeout']
const isOutcome = (v: unknown): v is TryOutcome => OUTCOMES.includes(v as TryOutcome)

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

/** A legacy body after its shape is gone: what the CAS decision reads. */
export type ArithmeticLegacyTry = LegacyTry &
  (
    | {
        mode: 'first_or_retry'
        /** Located by content (`problem`, `slotIndex`, `epochNumber`, `partIndex` when sent) */
        match: {
          partIndex: number | undefined
          slotId: string | undefined
          slotIndex: number
          epochNumber: number | undefined
          problem: GeneratedProblem | undefined
          studentAnswer: number
        }
      }
    | {
        mode: 'do_over'
        redoContext: RedoContext
        slotId: string | undefined
        problem: GeneratedProblem | undefined
      }
  )

function normalize(s: LegacySubmission): ArithmeticLegacyTry {
  const explicit = (s.result as SupersetFields).outcome
  // Server-side timing backstop (#156): cap any value that outran the
  // absolute ceiling before it is stored or fed to BKT
  if (s.action === 'record') {
    const { partIndex, ...unstamped } = withoutServerStamps(s.result)
    const result = { ...unstamped, ...sanitizeResultTiming(unstamped) }
    const { slotId, slotIndex, ...fields } = withoutLegacyTryFields(result)
    const outcome = isOutcome(explicit) ? explicit : outcomeOfLegacyBody(result)
    return {
      mode: 'first_or_retry',
      tryId: result.tryId,
      fields,
      outcome,
      answer: outcome === 'answered' ? result.studentAnswer : null,
      submittedItemId: slotId,
      match: {
        partIndex,
        slotId,
        slotIndex,
        epochNumber: result.epochNumber,
        problem: result.problem,
        studentAnswer: result.studentAnswer,
      },
    }
  }
  const unstamped = withoutServerStamps(s.result)
  const result = { ...unstamped, ...sanitizeResultTiming(unstamped) }
  const { slotId, slotIndex: _slotIndex, ...fields } = withoutLegacyTryFields(result)
  const outcome = isOutcome(explicit) ? explicit : outcomeOfLegacyBody(result)
  return {
    mode: 'do_over',
    tryId: result.tryId,
    fields,
    outcome,
    answer: outcome === 'answered' ? result.studentAnswer : null,
    submittedItemId: slotId,
    redoContext: s.redoContext,
    slotId,
    problem: result.problem,
  }
}

// ============================================================================
// Locating
// ============================================================================

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

/**
 * Locate a first or retry try sent in a legacy body: by content, the item the
 * student is shown (`expectedItem` of the current part's state; the client's
 * `getCurrentProblemInfo` makes the same decision). The submitted `slotId` is
 * not trusted: older clients can send the previous slot's id after an
 * optimistic advance, so the stored `slotId` is always the item's own.
 * Without a `tryId` (clients from before Phase 1), a resubmit that equals the
 * last recorded try exactly (slot, round when sent, problem, answer) is a
 * duplicate.
 *
 * Order: a resubmit, then `not_practicing`, then an unknown kind, then a
 * mismatch. A resubmit is answered from the stored row whatever the kind, and
 * an old bundle never sees `unknown_kind` for a try the session cannot take
 * anyway (K2 review).
 */
function locateFirstOrRetry(
  plan: SessionPlan,
  n: Extract<ArithmeticLegacyTry, { mode: 'first_or_retry' }>
): LegacyLocated | { duplicate: SlotResult } {
  const { match } = n
  const currentPart = plan.parts[plan.currentPartIndex]
  const currentKind = currentPart ? findPartKind(currentPart) : undefined
  const expected =
    currentPart && currentKind && kindIdOf(currentPart) === 'arithmetic'
      ? (currentKind.expectedItem(
          currentKind.contentOf(currentPart),
          partStateOf(plan, plan.currentPartIndex)
        ) as ArithmeticItem | null)
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
      return { duplicate: lastTry }
    }
  }
  // A live session whose next step is a transition or a break takes no try,
  // whatever item it names: the client applies the plan sent back (Phase 3c).
  // Resubmits of a recorded try were answered above, so a resend of a part's
  // final try stays a no-op.
  if (isLiveButNotPracticing(plan)) throw new NotPracticingError(plan)
  // A part this image cannot record into
  const named = plan.parts[match.partIndex ?? plan.currentPartIndex]
  if (named) knownKindOf(named)
  if (!expected || !isExpectedItem || !currentPart || !currentKind) {
    throw new SlotResultMismatchError(match.slotId, expected?.slotId ?? null, 'not_current')
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
  return {
    partIndex: plan.currentPartIndex,
    itemId: expected.slotId,
    tryKind: expected.retryIndex !== null ? 'retry' : 'first',
    round: expected.epochNumber,
    practiceOnly: false,
    snapshot: { slotId: expected.slotId, slotIndex: expected.originalSlotIndex },
  }
}

/**
 * Locate a do-over sent in a legacy body: the slot `redoContext` names, by
 * `itemId` when sent (indices sent beside it must agree, else
 * MalformedDoOverError, a 400), else by its indices. A do-over of an unknown
 * item, one the kind does not accept (no try yet, an answer already divulged)
 * or whose problem is not the submitted one throws SlotResultMismatchError
 * with that reason.
 */
function locateDoOver(
  plan: SessionPlan,
  n: Extract<ArithmeticLegacyTry, { mode: 'do_over' }>
): LegacyLocated {
  const located = doOverItemOf(plan.parts, n.redoContext)
  if (!located) throw new SlotResultMismatchError(n.slotId, null, 'unknown_item')
  const { partIndex, slotIndex } = located
  if (partIndex < 0 || partIndex >= plan.parts.length) {
    throw new Error(`Invalid part index: ${partIndex}`)
  }
  const part = plan.parts[partIndex]
  const kind = knownKindOf(part)
  const slot = part.slots?.[slotIndex]
  if (!slot) throw new SlotResultMismatchError(n.slotId, null, 'unknown_item')
  const tries = normalizeTries(plan.id, plan.parts, plan.results || [])
  const content = kind.contentOf(part)
  const state = partStateOf(plan, partIndex)
  if (!kind.acceptsDoOver(content, state, tries, slot.slotId)) {
    const reason = kind.whyNotDoOver?.(content, state, tries, slot.slotId) ?? 'not_accepted'
    throw new SlotResultMismatchError(n.slotId, null, reason)
  }
  if (!sameProblem(slot.problem, n.problem)) {
    throw new SlotResultMismatchError(n.slotId, null, 'different_problem')
  }
  const { round, practiceOnly } = doOverStamp(tries.filter((t) => t.itemId === slot.slotId))
  return {
    partIndex,
    itemId: slot.slotId,
    tryKind: 'do_over',
    round,
    practiceOnly,
    snapshot: { slotId: slot.slotId, slotIndex },
  }
}

/** The legacy actions as arithmetic's wire (bound in `parts/legacy-wire.ts`). */
export const arithmeticLegacyWire: LegacyWire<LegacySubmission, ArithmeticLegacyTry> = {
  normalize,
  locate: (plan, t) =>
    t.mode === 'first_or_retry' ? locateFirstOrRetry(plan, t) : locateDoOver(plan, t),
}
