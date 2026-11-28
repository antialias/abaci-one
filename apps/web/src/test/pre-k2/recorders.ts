/**
 * VERBATIM copy of the two K1 recorders, `recordSlotResult` and
 * `recordRedoResult`, with their helpers, from
 * `src/lib/curriculum/session-planner.ts` at 208433adb (before practice-kinds
 * K2, lines 1359-2081): the "rollback target" side of `record-try-k2.test.ts`,
 * which shows a K2 bundle's superset body recorded by a K1 server (§3.3).
 * Only imports changed (paths repointed), and the two judge-parity counters K2
 * deleted from `lib/metrics.ts` are local no-ops here. It runs against this
 * tree's shared modules (row CAS, flow machine, normalizer, arithmetic kind),
 * which K2 leaves as they were except arithmetic's `acceptsDoOver`, which now
 * also refuses a divulged answer (the copy's own divulged check after it is
 * then never reached). Never edit the logic.
 */
import {
  itemSlotIndexOfRow,
  retryRoundOfRow,
  tryKindOfRow,
  tryRoundOfRow,
} from '@/db/schema/legacy-try-fields'
import { sameProblem } from '@/db/schema/session-plan-helpers'
import {
  currentItemOf,
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
  type TryEvidence,
  type TryOutcome,
} from '@/db/schema/session-plans'
import { arithmeticCursorSlotIndex } from '@/lib/curriculum/parts/arithmetic/session-view'
import { MAX_RETRY_EPOCHS } from '@/lib/curriculum/parts/arithmetic/state'
import type { AnyPartKind } from '@/lib/curriculum/parts/kind'
import { kindIdOf, partKindOf } from '@/lib/curriculum/parts/registry'
import { recordSkillAttemptsWithHelp } from '@/lib/curriculum/progress-manager'
import { noWrite, type SessionPlanPatch, withRowCas } from '@/lib/curriculum/row-cas'
import { applyFlowEvent, type RecordedTry } from '@/lib/curriculum/session-flow'
import { sanitizeResultTiming } from '@/lib/curriculum/timing/response-time-guard'
import { weightOfTry } from '@/lib/curriculum/try-weight'
import { revokeSharesForSession } from '@/lib/session-share'

// The K1 counters (deleted in K2): no-ops here
const practiceTriesJudgedTotal = { inc: (_labels: Record<string, string>) => {} }
const practiceJudgeDisagreementsTotal = { inc: (_labels: Record<string, string>) => {} }

/**
 * A try was submitted for a different item than the one the server expects
 * next, and it is not a resubmit of the try just recorded. The client's plan is
 * stale; the route answers 409 and the client refetches.
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
 * §1.1, Phase 3c). Replaces Phase 3a's implicit `PART_TRANSITION_COMPLETED` for
 * a try in `part_transition` and its `INVALID_FLOW_TRANSITION` for a try during
 * a break.
 */
export class NotPracticingError extends Error {
  readonly code = 'not_practicing'
  constructor(public readonly plan: SessionPlan) {
    super(`The session is in ${plan.flowState}, not practicing; the try was not recorded`)
    this.name = 'NotPracticingError'
  }
}

/**
 * A submitted try without the fields only the server stamps. Clients from
 * before Phase 1 send `isRetry`/`epochNumber` guesses and `masteryWeight`;
 * `epochNumber` stays (it tells a resubmit from the next round), the rest go.
 * A `tryId` not in the form the client mints (see `isClientTryId`) is treated
 * as absent: the server mints one and the exact-match rule applies.
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
    tryId,
    ...rest
  } = submission
  if (tryId !== undefined && !isClientTryId(tryId)) {
    console.warn('[session-planner] ignoring malformed tryId', {
      tryId: String(tryId).slice(0, 80),
    })
    return rest as Unstamped<T>
  }
  return (tryId === undefined ? rest : { ...rest, tryId }) as Unstamped<T>
}

/**
 * A submission without the legacy try fields a client may still send
 * (`epochNumber` is read before this, to tell a resubmit from the next round;
 * the others are dropped by `withoutServerStamps`). New rows carry none of
 * them since Phase 6b-1 (§10 P6b1-4).
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

/** Whether a try with this id is already recorded (idempotent record by `tryId`). */
function isRecordedTry(plan: SessionPlan, tryId: string | undefined): boolean {
  return tryId !== undefined && plan.results.some((r) => r.tryId === tryId)
}

/**
 * The outcome of a try sent in the legacy body (`record`/`record_redo`), the
 * only body there is until K2. A skip arrives as `handleSkip` has always sent
 * it (`ActiveSession.tsx`): the correct answer, wrong, with manual help. The
 * one place this heuristic lives (practice-kinds plan K1a): every other
 * reader takes `outcome` from the row. A client's verdict is its own judge
 * (`answer === problem.answer`), so an answered try that stores the correct
 * answer is never wrong and cannot be taken for a skip.
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

/**
 * The row with its try envelope stamped (practice-kinds plan §1.3, K1a):
 * `itemId`, `outcome` (from the legacy body), `answer` (null unless
 * answered), `evidence` (the kind's `evidenceOf`) and `payload` (arithmetic:
 * `{ kind: 'arithmetic' }`; its snapshot stays in the top-level fields, which
 * are written as they always were, K14).
 *
 * The server judges an answered try with the kind's `judge`. K1a is
 * behaviour-identical: the row keeps the client's verdict, the one every
 * client and reader acts on today, and the judgement (with any
 * disagreement) is returned for the recorder to count and log once its write
 * commits (`reportJudgement`), never stored, so no kid's record changes.
 * Storing the server's verdict waits for zero disagreements in production
 * (plan §8, amendment A1; K2).
 */
function withTryEnvelope(
  part: SessionPart,
  kind: AnyPartKind,
  itemId: string,
  row: SlotResult
): { row: SlotResult; evidence: TryEvidence | null; judgement: TryJudgement } {
  const outcome = outcomeOfLegacyBody(row)
  const answer = outcome === 'answered' ? row.studentAnswer : null
  const verdict = outcome === 'answered' && kind.judge(kind.contentOf(part), itemId, answer)
  const disagreement =
    verdict === row.isCorrect
      ? null
      : { tryId: row.tryId, itemId, outcome, clientVerdict: row.isCorrect, judge: verdict }
  const payload = { kind: kindIdOf(part) }
  const evidence = kind.evidenceOf(part, {
    result: row,
    outcome,
    payload: kind.payloadOf({ ...row, payload }),
  })
  return {
    row: { ...row, itemId, outcome, answer, evidence, payload },
    evidence,
    judgement: { kind: payload.kind, outcome, disagreement },
  }
}

/** The server's judge and the client's verdict on one try, when they differ. */
interface JudgeDisagreement {
  tryId: string | undefined
  itemId: string
  outcome: TryOutcome
  clientVerdict: boolean
  judge: boolean
}

/** The server's judgement of one try: what the parity counters label it by. */
interface TryJudgement {
  /** The part kind (`arithmetic`) */
  kind: string
  outcome: TryOutcome
  disagreement: JudgeDisagreement | null
}

/**
 * Judge parity (K1a): counted and logged once per recorded try, after its
 * write commits, never per CAS attempt (plan §8, amendment A1 reads the
 * counters from Prometheus).
 */
function reportJudgement(
  recorder: 'slot' | 'redo',
  caller: string,
  planId: string,
  { kind, outcome, disagreement }: TryJudgement
): void {
  practiceTriesJudgedTotal.inc({ kind, outcome })
  if (!disagreement) return
  practiceJudgeDisagreementsTotal.inc({ kind, recorder })
  console.warn(`[${caller}] judge disagrees with the client verdict; storing the client's`, {
    planId,
    ...disagreement,
  })
}

/** Revoke any active share links once a session completes (non-critical). */
async function revokeSharesIfComplete(planId: string, isComplete: boolean, caller: string) {
  if (!isComplete) return
  try {
    await revokeSharesForSession(planId)
  } catch (shareError) {
    // Non-critical: log and continue (session already completed successfully)
    console.error(`[${caller}] revokeSharesForSession FAILED:`, shareError)
  }
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

/** What a committed try write reports back to its recorder, for side effects and traces. */
interface RecordedTryOutcome {
  previousPartIndex: number
  previousSlotIndex: number
  inRetryEpoch: boolean
  /** The stamped evidence: what the skill-attempt bump reads after commit */
  evidence: TryEvidence | null
  /** Counted and logged after commit, once per recorded try */
  judgement: TryJudgement
}

/**
 * Record a result for the current item and advance to the next.
 *
 * `recordTry` = `withRowCas(planId, plan => idempotency check → kind → machine)`
 * (plan of record §7 Phase 3a). Every attempt re-reads the row, so a request
 * that lost a race against the same `tryId` sees it recorded and returns
 * without a second write or a second skill-attempt bump (§10 P1-10).
 *
 * The try is attributed to the item the current part's state names
 * (`currentItemOf`: `part_states` since Phase 5, the legacy cursor for a row
 * without it or with a stale entry; the item the client shows), identified by
 * content: the submitted `problem` and `slotIndex` must be that
 * item's (and `epochNumber`, when sent, its round). The submitted `slotId` is
 * not trusted: older clients can send the previous slot's id after an
 * optimistic advance, so the stored `slotId` is always the item's own.
 *
 * Idempotent by `tryId`: a try whose id is already recorded returns the plan
 * unchanged. Without a `tryId` (clients from before Phase 1), a resubmit that
 * equals the last recorded try exactly (slot, round when sent, problem, answer)
 * returns the plan unchanged. Anything else that is not the current item
 * throws SlotResultMismatchError.
 *
 * The server stamps `kind`, `round`, `practiceOnly`, `partIndex` and
 * `masteryWeight` (weightOfTry); client-sent values for them are ignored. The
 * flow machine (`TRY_RECORDED`) moves the part's cursor through its kind and
 * decides the rhythm.
 */
export async function recordSlotResult(
  planId: string,
  submission: SlotResultSubmission
): Promise<SessionPlan> {
  const { partIndex: submittedPartIndex, ...submitted } = withoutServerStamps(submission)
  // Server-side timing backstop (#156): cap any value that outran the absolute
  // ceiling (stale/hostile clients, clock anomalies) before it is ever stored
  // or fed to BKT via recordSkillAttemptsWithHelp below. Independently
  // deployable — this alone ends unbounded writes even if the client guard
  // never ran. Client-capped values pass through untouched.
  const result = { ...submitted, ...sanitizeResultTiming(submitted) }
  const traceStart = Date.now()

  const {
    plan: updated,
    value: outcome,
    committed,
  } = await withRowCas<RecordedTryOutcome | null>(planId, (plan) => {
    // Defensive check: ensure parts array exists and is valid
    if (!plan.parts || !Array.isArray(plan.parts)) {
      throw new Error(
        `Plan ${planId} has invalid parts: ${typeof plan.parts} (status: ${plan.status}, partIndex: ${plan.currentPartIndex})`
      )
    }
    if (plan.parts.length === 0) {
      throw new Error(`Plan ${planId} has empty parts array`)
    }
    // Defensive check: ensure results array exists
    if (!plan.results || !Array.isArray(plan.results)) {
      throw new Error(`Plan ${planId} has invalid results: ${typeof plan.results} (expected array)`)
    }

    // A try already recorded (a resend after a lost reply, a double submit,
    // or the request this one raced)
    if (isRecordedTry(plan, result.tryId)) {
      console.log('[recordSlotResult] duplicate tryId ignored', { planId, tryId: result.tryId })
      return noWrite(null)
    }

    // Attribute the try to the item the student is shown, by content. Checked
    // before the position checks so a resubmit of a session's final answer is
    // still a no-op.
    const expected = currentItemOf(plan)
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
      (submittedPartIndex === undefined || t.partIndex === submittedPartIndex) &&
      t.slotIndex === result.slotIndex &&
      (result.epochNumber === undefined || (t.epochNumber ?? 0) === result.epochNumber) &&
      sameProblem(t.problem, result.problem)
    const isExpectedItem =
      !!expected && isSubmittedTry({ ...expected, slotIndex: expected.originalSlotIndex })
    if (!isExpectedItem) {
      // The stored row's kind, round and item position come from the
      // normalizer (`legacy-try-fields.ts`), so a row without the legacy try
      // fields (Phase 6b-1) reads the same (§10 P6b-6)
      const lastTry = [...plan.results].reverse().find((r) => tryKindOfRow(r) !== 'do_over')
      const lastTryPartNumber = lastTry?.partNumber
      if (
        result.tryId === undefined &&
        lastTry &&
        isSubmittedTry({
          partIndex: plan.parts.findIndex((p) => p.partNumber === lastTryPartNumber),
          slotIndex: itemSlotIndexOfRow(lastTry),
          epochNumber: retryRoundOfRow(lastTry),
          problem: lastTry.problem,
        }) &&
        lastTry.studentAnswer === result.studentAnswer
      ) {
        console.log('[recordSlotResult] duplicate submit ignored', {
          planId,
          slotId: result.slotId,
        })
        return noWrite(null)
      }
    }
    // A live session whose next step is a transition or a break takes no try,
    // whatever item it names: the client applies the plan sent back (Phase 3c).
    // Resubmits of a recorded try were answered above, so a resend of a part's
    // final try stays a no-op.
    if (plan.status === 'in_progress' && (plan.flowState ?? 'practicing') !== 'practicing') {
      throw new NotPracticingError(plan)
    }
    if (!expected || !isExpectedItem) {
      throw new SlotResultMismatchError(result.slotId, expected?.slotId ?? null)
    }
    if (result.slotId !== expected.slotId) {
      console.log(
        '[recordSlotResult] submitted slotId lags the answered problem; storing its own',
        {
          planId,
          submittedSlotId: result.slotId,
          slotId: expected.slotId,
        }
      )
    }

    if (plan.currentPartIndex < 0 || plan.currentPartIndex >= plan.parts.length) {
      throw new Error(
        `Plan ${planId} has invalid currentPartIndex: ${plan.currentPartIndex} (parts.length: ${plan.parts.length})`
      )
    }

    const currentPart = plan.parts[plan.currentPartIndex]
    if (!currentPart) throw new Error(`Invalid part index: ${plan.currentPartIndex}`)

    console.log('[GBTRACE][server]', 'record-slot-result-start', {
      ts: new Date().toISOString(),
      planId,
      playerId: plan.playerId,
      currentPartIndex: plan.currentPartIndex,
      currentSlotIndex: arithmeticCursorSlotIndex(plan),
      currentPartNumber: currentPart.partNumber,
      currentPartType: currentPart.type,
      submittedSlotIndex: result.slotIndex,
      isCorrect: result.isCorrect,
    })

    // Defensive check: ensure slots array exists
    if (!currentPart.slots || !Array.isArray(currentPart.slots)) {
      throw new Error(
        `Plan ${planId} part ${plan.currentPartIndex} has invalid slots: ${typeof currentPart.slots}`
      )
    }

    const partIndex = plan.currentPartIndex
    const inRetryEpoch = expected.retryIndex !== null
    const epochNumber = expected.epochNumber
    const originalSlotIndex = expected.originalSlotIndex
    const kind = inRetryEpoch ? ('retry' as const) : ('first' as const)

    // The row carries the try record only: the legacy try fields (`isRetry`,
    // `epochNumber`, `isManualRedo`, `originalSlotIndex`) are not written
    // since Phase 6b-1; every reader takes kind, round and item position
    // through the normalizer (`legacy-try-fields.ts`, §10 P6b1-4)
    const {
      row: newResult,
      evidence,
      judgement,
    } = withTryEnvelope(currentPart, partKindOf(currentPart), expected.slotId, {
      ...withoutLegacyTryFields(result),
      tryId: result.tryId ?? mintTryId(),
      kind,
      round: epochNumber,
      practiceOnly: false,
      partIndex,
      slotId: expected.slotId,
      slotIndex: originalSlotIndex,
      partNumber: currentPart.partNumber,
      timestamp: new Date(),
      masteryWeight: weightOfTry({
        kind,
        round: epochNumber,
        isCorrect: result.isCorrect,
        practiceOnly: false,
      }),
    })

    return {
      write: tryWrite(plan, newResult, {
        partIndex,
        itemId: expected.slotId,
        kind,
        round: epochNumber,
        practiceOnly: false,
        isCorrect: result.isCorrect,
      }),
      value: {
        previousPartIndex: plan.currentPartIndex,
        previousSlotIndex: arithmeticCursorSlotIndex(plan),
        inRetryEpoch,
        evidence,
        judgement,
      },
    }
  })

  if (!committed || !outcome) return updated

  // Update global skill mastery timestamps with help tracking. Once per
  // recorded try: only the request whose write committed gets here.
  // Note: masteryWeight is applied by BKT when it reads SlotResults (not here)
  reportJudgement('slot', 'recordSlotResult', planId, outcome.judgement)
  const { evidence } = outcome
  if (evidence && evidence.skills.length > 0) {
    const skillResults = evidence.skills.map((skillId) => ({
      skillId,
      isCorrect: result.isCorrect,
    }))
    try {
      await recordSkillAttemptsWithHelp(
        updated.playerId,
        skillResults,
        result.hadHelp,
        result.responseTimeMs
      )
    } catch (skillError) {
      console.error(`[recordSlotResult] recordSkillAttemptsWithHelp FAILED:`, skillError)
      throw skillError
    }
  }

  const isComplete = updated.status === 'completed'
  await revokeSharesIfComplete(planId, isComplete, 'recordSlotResult')

  console.log('[GBTRACE][server]', 'record-slot-result-finish', {
    ts: new Date().toISOString(),
    planId,
    playerId: updated.playerId,
    durationMs: Date.now() - traceStart,
    previousPartIndex: outcome.previousPartIndex,
    previousSlotIndex: outcome.previousSlotIndex,
    nextPartIndex: updated.currentPartIndex,
    nextSlotIndex: arithmeticCursorSlotIndex(updated),
    partTransitioned: updated.currentPartIndex > outcome.previousPartIndex,
    flowState: updated.flowState,
    inRetryEpoch: outcome.inRetryEpoch,
    isComplete,
    status: updated.status,
  })

  return updated
}

/** What a committed do-over write reports back to its recorder, for side effects. */
interface RecordedDoOver {
  practiceOnly: boolean
  /** The stamped evidence: what the skill-attempt bump reads after commit */
  evidence: TryEvidence | null
  /** Counted and logged after commit, once per recorded try */
  judgement: TryJudgement
}

/**
 * Context for a manual redo operation
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
 * Record a do-over (the student tapped a finished problem to do it again).
 * Every do-over is recorded (Phase 1), as a try of kind `do_over`, through the
 * same CAS write and flow machine as `recordSlotResult`.
 *
 * - Idempotent by `tryId`, like recordSlotResult.
 * - `round` = the item's earlier tries that are not practice-only.
 * - A do-over of an item whose latest such try was correct is `practiceOnly`:
 *   weight 0, no skill-attempt bump, no redemption, skipped by every mastery,
 *   readiness, gate, health and verdict reader.
 * - Otherwise it weighs weightOfTry: 1/2^round, right or wrong (Phase 1w), and a
 *   correct one redeems the item from the retry queue. If that leaves the current retry
 *   round with nothing to show, the cursor settles exactly as after a try: next
 *   round, next part, or completion. Only in the part being practiced while
 *   practicing; anywhere else the kind records it aside.
 * - Never steps the session position past an item.
 *
 * The item is the slot `redoContext` names: by `itemId` when sent (indices sent
 * beside it must agree, else MalformedDoOverError, a 400), else by its
 * indices. A do-over of an unknown item, of a slot with no try yet, or whose
 * problem is not the submitted one, throws SlotResultMismatchError.
 */
export async function recordRedoResult(
  planId: string,
  submission: Omit<SlotResult, 'timestamp' | 'partNumber'>,
  redoContext: RedoContext
): Promise<SessionPlan> {
  const unstamped = withoutServerStamps(submission)
  // Server-side timing backstop (#156): symmetric with recordSlotResult — cap
  // any value above the absolute ceiling before storing or feeding BKT.
  const result = { ...unstamped, ...sanitizeResultTiming(unstamped) }

  const {
    plan: updated,
    value: recorded,
    committed,
  } = await withRowCas<RecordedDoOver | null>(planId, (plan) => {
    if (isRecordedTry(plan, result.tryId)) {
      console.log('[recordRedoResult] duplicate tryId ignored', { planId, tryId: result.tryId })
      return noWrite(null)
    }

    const located = doOverItemOf(plan.parts, redoContext)
    if (!located) throw new SlotResultMismatchError(result.slotId, null)
    const { partIndex, slotIndex } = located

    // Validate part index
    if (partIndex < 0 || partIndex >= plan.parts.length) {
      throw new Error(`Invalid part index: ${partIndex}`)
    }

    const part = plan.parts[partIndex]
    const kind = partKindOf(part)
    const slot = part.slots?.[slotIndex]
    const tries = normalizeTries(plan.id, plan.parts, plan.results || [])
    if (
      !slot ||
      !kind.acceptsDoOver(kind.contentOf(part), partStateOf(plan, partIndex), tries, slot.slotId) ||
      !sameProblem(slot.problem, result.problem)
    ) {
      throw new SlotResultMismatchError(result.slotId, null)
    }
    const priorTries = tries.filter((t) => t.itemId === slot.slotId)

    // Reject redo if the answer was already divulged (student exhausted all
    // retries wrong). Rows read through the normalizer (§10 P6b-6).
    const answerWasDivulged = (plan.results || []).some(
      (r) =>
        r.partNumber === part.partNumber &&
        itemSlotIndexOfRow(r) === slotIndex &&
        !r.isCorrect &&
        // a wrong try of the last retry round (a do-over is never a retry);
        // the dots' copy reads the same (`SessionProgressIndicator`)
        tryKindOfRow(r) === 'retry' &&
        tryRoundOfRow(r) >= MAX_RETRY_EPOCHS
    )
    if (answerWasDivulged) {
      throw new Error(
        `Cannot redo slot ${slotIndex} in part ${partIndex}: answer was already revealed after exhausting retries`
      )
    }

    const { round, practiceOnly } = doOverStamp(priorTries)
    // No legacy try fields since Phase 6b-1 (§10 P6b1-4): `kind` says do-over
    const {
      row: newResult,
      evidence,
      judgement,
    } = withTryEnvelope(part, kind, slot.slotId, {
      ...withoutLegacyTryFields(result),
      tryId: result.tryId ?? mintTryId(),
      kind: 'do_over',
      round,
      practiceOnly,
      partIndex,
      slotId: slot.slotId,
      slotIndex,
      partNumber: part.partNumber,
      timestamp: new Date(),
      masteryWeight: weightOfTry({
        kind: 'do_over',
        round,
        isCorrect: result.isCorrect,
        practiceOnly,
      }),
    })

    return {
      write: tryWrite(plan, newResult, {
        partIndex,
        itemId: slot.slotId,
        kind: 'do_over',
        round,
        practiceOnly,
        isCorrect: result.isCorrect,
      }),
      value: { practiceOnly, evidence, judgement },
    }
  })

  if (!committed || recorded === null) return updated

  // Update global skill mastery timestamps (not for practice-only: no pedagogical effect)
  reportJudgement('redo', 'recordRedoResult', planId, recorded.judgement)
  const { practiceOnly, evidence } = recorded
  if (!practiceOnly && evidence && evidence.skills.length > 0) {
    const skillResults = evidence.skills.map((skillId) => ({
      skillId,
      isCorrect: result.isCorrect,
    }))
    try {
      await recordSkillAttemptsWithHelp(
        updated.playerId,
        skillResults,
        result.hadHelp ?? false,
        result.responseTimeMs
      )
    } catch (skillError) {
      console.error(`[recordRedoResult] recordSkillAttemptsWithHelp FAILED:`, skillError)
      // Don't throw - redo result was already recorded
    }
  }

  await revokeSharesIfComplete(planId, updated.status === 'completed', 'recordRedoResult')

  return updated
}
