/**
 * The arithmetic part kind: slots, retry rounds and do-overs behind the
 * `PartKind` contract (session architecture §1.2, Phase 2).
 *
 * `Content` = the part's slots, `State` = the cursor and its retry round
 * (`{ slotIndex, retry }`, the part's `part_states` entry, see `state.ts`),
 * `Item` = the slot or retry-round item shown next.
 *
 * Pure (no database, no server-only imports), so the registry can be read on
 * either side; the name follows the plan's module layout.
 */

import type { SessionPart, SlotResult, TryEvidence } from '@/db/schema/session-plans'
import type { KindTry, KindTryRecord, PartKind } from '../kind'
import { formatProblemExpression } from './describe'
import { arithmeticProgress } from './report'
import {
  type ArithmeticContent,
  type ArithmeticItem,
  type ArithmeticState,
  expectedArithmeticItem,
  MAX_RETRY_EPOCHS,
  redeemSlot,
  settleArithmetic,
  stepPastItem,
} from './state'

/**
 * A do-over's effect without settling: a correct do-over of an item whose
 * latest counted try was wrong redeems it; anything else (practice-only,
 * wrong, a part with no retry state) returns `state` itself.
 *
 * The kind's `applyTryAside`: a do-over outside the part being practiced
 * (another part, or a break) redeems without settling (§10 P2-3).
 */
export function redeemByDoOver(
  slots: ArithmeticContent,
  state: ArithmeticState,
  t: KindTry
): ArithmeticState {
  if (t.practiceOnly || !t.isCorrect || !state.retry) return state
  const slotIndex = slots.findIndex((s) => s.slotId === t.itemId)
  if (slotIndex < 0) return state
  return redeemSlot(state, slotIndex)
}

/**
 * The presentation an arithmetic part's tries were practiced in: its `type`.
 * A part stored without one (old or hand-made rows), or no part at all, is
 * 'linear', as every evidence reader read it before K1b (`partType ??
 * 'linear'`); `evidenceOfRow` derives an unstamped row's evidence from it.
 */
export function arithmeticPresentationOf(part: { type?: unknown } | undefined): string {
  return typeof part?.type === 'string' ? part.type : 'linear'
}

/**
 * What an arithmetic try is evidence of: the skills the row says it exercised
 * and its part's presentation. `skillsExercised` is today's evidence, the
 * list every BKT reader and the skill-attempt bump read; it is not always the
 * problem's `skillsRequired` (seeded rows store every skill a problem used,
 * the journey simulator the skills it challenged). A row without a
 * `skillsExercised` array is not evidence, as every reader skips it today
 * (`session-planner.ts` history, `evidence-query.ts` `toBktEvidence`).
 */
export function arithmeticEvidenceOf(
  part: { type?: unknown } | undefined,
  row: Pick<SlotResult, 'skillsExercised'>
): TryEvidence | null {
  const skills: unknown = row.skillsExercised
  if (!Array.isArray(skills)) return null
  return { skills: skills as string[], presentation: arithmeticPresentationOf(part) }
}

export const arithmeticKind: PartKind<
  ArithmeticContent,
  ArithmeticState,
  ArithmeticItem,
  SessionPart
> = {
  id: 'arithmetic',

  contentOf: (part) => part.slots,

  // Sessions from before problem pre-generation have slots without problems
  isPlayable: (slots) => slots.every((slot) => !!slot.problem),

  initialState: () => ({ slotIndex: 0, retry: undefined }),

  expectedItem: expectedArithmeticItem,

  // A do-over of an item with a try, unless its answer was divulged (a wrong
  // try of the last retry round, which shows the answer; the dots' copy reads
  // the same, `SessionProgressIndicator`). Moved here from `recordRedoResult`
  // in K2, where it was a plain Error (500); refused here it is the
  // recorder's quiet 409 `SLOT_MISMATCH` (R14).
  acceptsDoOver: (slots, _state, tries, itemId) =>
    slots.some((s) => s.slotId === itemId) &&
    tries.some((t) => t.itemId === itemId) &&
    !answerWasDivulged(tries, itemId),

  applyTry(slots, state, _tries, t) {
    if (t.kind === 'do_over') {
      const redeemed = redeemByDoOver(slots, state, t)
      // A redemption that empties the running round settles like a try does
      return redeemed === state ? state : settleArithmetic(slots, redeemed)
    }
    const item = expectedArithmeticItem(slots, state)
    if (!item || item.slotId !== t.itemId) {
      throw new Error(
        `arithmetic applyTry: try for ${t.itemId}, expected ${item?.slotId ?? '(none)'}`
      )
    }
    return stepPastItem(slots, state, item, t.isCorrect)
  },

  // Redeem without settling, as recordRedoResult did before Phase 3a (§10 P2-3)
  applyTryAside: (slots, state, _tries, t) => redeemByDoOver(slots, state, t),

  isDone: (slots, state) => expectedArithmeticItem(slots, state) === null,

  progress: (slots, state) => arithmeticProgress(slots, state),

  judge(slots, itemId, answer) {
    const problem = slots.find((s) => s.slotId === itemId)?.problem
    return problem !== undefined && answer === problem.answer
  },

  evidenceOf: (part, t: KindTryRecord) => arithmeticEvidenceOf(part, t.result),

  describe(_part, t) {
    const problem = t.payload.problem as SlotResult['problem'] | undefined
    if (!problem || !Array.isArray(problem.terms)) return 'a problem'
    return formatProblemExpression(problem.terms, problem.answer)
  },

  // The stored payload is `{ kind: 'arithmetic' }`: the snapshot stays at top
  // level (K6, K14), and the in-memory payload lifts it
  payloadOf: (row) => ({
    ...(row.payload ?? { kind: 'arithmetic' }),
    problem: row.problem,
    usedOnScreenAbacus: row.usedOnScreenAbacus,
  }),

  // What the ledger adapter copies today (L/ledger/adapters/problem-result.ts)
  presentationOf: (part) => ({
    layer: part.type ?? 'linear',
    modality: 'visual',
    abacusAvailable: part.useAbacus,
    input: 'keypad',
  }),

  // A part stored without a type (old or hand-made rows) is 'linear', main's
  // default for evidence; null stays reserved for "not evidence".
  bktMode: (part) => (typeof part.type === 'string' ? part.type : 'linear'),

  // A retry item shares its slot's id; its round is the retry round
  itemPositionOf: (item) => ({ itemId: item.slotId, round: item.epochNumber }),

  // A `record_try` row keeps the top-level snapshot every older reader reads
  // (K6, K14); a skip or timeout in today's frozen projection (§3.1, S4)
  snapshotOf(slots, itemId, t) {
    const slotIndex = slots.findIndex((s) => s.slotId === itemId)
    const problem = slots[slotIndex]?.problem
    if (!problem) return null
    const answered = t.outcome === 'answered'
    return {
      fields: {
        slotId: itemId,
        slotIndex,
        problem,
        studentAnswer: answered ? (t.answer as number) : problem.answer,
        skillsExercised: problem.skillsRequired,
        usedOnScreenAbacus: t.payload.usedOnScreenAbacus === true,
        ...(answered ? {} : { hadHelp: true, helpTrigger: 'manual' as const }),
      },
      payload: { kind: 'arithmetic' },
    }
  },
}

/** Whether the item's answer was shown: a wrong try of the last retry round. */
function answerWasDivulged(tries: readonly KindTry[], itemId: string): boolean {
  return tries.some(
    (t) => t.itemId === itemId && !t.isCorrect && t.kind === 'retry' && t.round >= MAX_RETRY_EPOCHS
  )
}
