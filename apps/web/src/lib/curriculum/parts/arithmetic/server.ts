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

import type { SessionPart } from '@/db/schema/session-plans'
import type { KindTry, PartKind } from '../kind'
import { arithmeticProgress } from './report'
import {
  type ArithmeticContent,
  type ArithmeticItem,
  type ArithmeticState,
  expectedArithmeticItem,
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

  acceptsDoOver: (slots, _state, tries, itemId) =>
    slots.some((s) => s.slotId === itemId) && tries.some((t) => t.itemId === itemId),

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
}
