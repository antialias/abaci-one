/**
 * The cursor half of `arithmeticKind` at 0551921da (before practice-kinds K3):
 * VERBATIM copies of `redeemByDoOver`, the kind's `applyTry`,
 * `applyTryAside`, `acceptsDoOver`/`whyNotDoOver` and their helpers from
 * `src/lib/curriculum/parts/arithmetic/server.ts`, over the verbatim pre-K3
 * state (`./arithmetic-state`). Only imports changed and the methods are
 * gathered in one object. Never edit the logic.
 */
import type { DoOverRefusal, KindTry } from '@/lib/curriculum/parts/kind'
import {
  type ArithmeticContent,
  type ArithmeticState,
  expectedArithmeticItem,
  MAX_RETRY_EPOCHS,
  redeemSlot,
  settleArithmetic,
  stepPastItem,
} from './arithmetic-state'

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

export const k2ArithmeticCursor = {
  initialState: (): ArithmeticState => ({ slotIndex: 0, retry: undefined }),
  expectedItem: expectedArithmeticItem,
  acceptsDoOver: (
    slots: ArithmeticContent,
    _state: ArithmeticState,
    tries: readonly KindTry[],
    itemId: string
  ) => arithmeticDoOverRefusal(slots, tries, itemId) === null,

  whyNotDoOver: (
    slots: ArithmeticContent,
    _state: ArithmeticState,
    tries: readonly KindTry[],
    itemId: string
  ) => arithmeticDoOverRefusal(slots, tries, itemId),

  applyTry(
    slots: ArithmeticContent,
    state: ArithmeticState,
    _tries: readonly KindTry[],
    t: KindTry
  ): ArithmeticState {
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
  applyTryAside: (
    slots: ArithmeticContent,
    state: ArithmeticState,
    _tries: readonly KindTry[],
    t: KindTry
  ) => redeemByDoOver(slots, state, t),

  isDone: (slots: ArithmeticContent, state: ArithmeticState) =>
    expectedArithmeticItem(slots, state) === null,
}

/** Why a do-over of `itemId` is refused (the 409's `reason`, K2), null when it is taken. */
function arithmeticDoOverRefusal(
  slots: ArithmeticContent,
  tries: readonly KindTry[],
  itemId: string
): DoOverRefusal | null {
  if (!slots.some((s) => s.slotId === itemId)) return 'unknown_item'
  if (!tries.some((t) => t.itemId === itemId)) return 'no_try'
  return answerWasDivulged(tries, itemId) ? 'divulged' : null
}

/** Whether the item's answer was shown: a wrong try of the last retry round. */
function answerWasDivulged(tries: readonly KindTry[], itemId: string): boolean {
  return tries.some(
    (t) => t.itemId === itemId && !t.isCorrect && t.kind === 'retry' && t.round >= MAX_RETRY_EPOCHS
  )
}
