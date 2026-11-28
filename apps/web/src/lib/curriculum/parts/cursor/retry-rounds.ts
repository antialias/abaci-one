/**
 * The shared cursor "items with retry rounds and do-overs" (practice-kinds
 * plan §1.3, decision K4): a part's items in order, then up to `maxRounds`
 * retry rounds of the items answered wrong, a do-over that redeems a wrong
 * item, and practice-only do-overs of a right one. Any kind whose content is a
 * list of items with stable ids composes its cursor from this; the general
 * `PartKind` contract stays for a kind that moves differently.
 *
 * Generalized from the first kind's cursor (it composes this since K3). Item
 * content is the kind's: the cursor knows an item by its `itemId` and its
 * position in `items(content)`, nothing else.
 *
 * **The stored encoding is not this module's vocabulary.** A part's state is
 * stored in `part_states` under the field names the first kind gave it
 * before kinds existed: `slotIndex` (the next item on the first pass),
 * `retry.currentEpoch` (the running round), `pendingRetries` /
 * `currentEpochItems` (the queues, each entry `{ slotId, originalSlotIndex,
 * epochNumber }` = item id, item index, round), `currentRetryIndex` and
 * `redeemedSlots` (item indices). They are kept byte for byte, key order
 * included, so an image from before K3 reads a part this cursor moved (D9)
 * and the golden replay is unchanged. Renaming them is its own decision
 * (a normalizer and a release gap); nothing here needs it. The API speaks
 * index, round and queue.
 *
 * Pure and client-safe: type-only imports of the contract.
 */

import type { DoOverRefusal, KindTry, PartProgress } from '../kind'

/** Retry rounds after the first pass, unless a kind says otherwise (original + 2 = 3 tries). */
export const DEFAULT_MAX_ROUNDS = 2

/** A queued retry as stored (encoding names): item id, item index, the round it is queued for. */
export interface QueuedRetry {
  slotId: string
  originalSlotIndex: number
  epochNumber: number
}

/** A part's retry rounds as stored (encoding names); absent until the part's first wrong try. */
export interface RetryRounds<Q extends QueuedRetry = QueuedRetry> {
  /** The running round: 0 while on the first pass */
  currentEpoch: number
  /** Queued for the next round */
  pendingRetries: Q[]
  /** The running round's queue */
  currentEpochItems: Q[]
  /** Position in the running round's queue */
  currentRetryIndex: number
  /** Item indices redeemed by a do-over: skipped in a running round */
  redeemedSlots?: number[]
}

/** A part's cursor, its `part_states` entry (encoding names). */
export interface RetryRoundsState<Q extends QueuedRetry = QueuedRetry> {
  /** The next item on the first pass; parked at the item count during retry rounds */
  slotIndex: number
  retry: RetryRounds<Q> | undefined
}

/** The item the cursor shows next, with where it stands. */
export type RetryRoundItem<Item, Q extends QueuedRetry = QueuedRetry> = Item & {
  /** Position in `items(content)` */
  itemIndex: number
  /** 0 on the first pass, 1.. in a retry round */
  round: number
  /** Position in the running round's queue; null on the first pass */
  retryIndex: number | null
  /** The queued entry it is shown from in a retry round; null on the first pass */
  queued: Q | null
}

export interface RetryRoundsOptions<Item, Q extends QueuedRetry> {
  /** Retry rounds after the first pass; default 2. 0 = no retries */
  maxRounds?: number
  /**
   * The queued entry stored for an item answered wrong. Default: the three
   * positional fields. A kind may store a snapshot beside them (fields an
   * older image reads from the queue); the returned object's key order is
   * the stored bytes.
   */
  queue?(shown: RetryRoundItem<Item, Q>, position: QueuedRetry): Q
  /**
   * The item a queued entry is shown as in a retry round. Default: the item
   * at its index when the ids agree, else the item with its id; an entry
   * naming no item is skipped. A kind whose queued entries carry what it
   * shows (a snapshot, `queue`) may show the entry itself, as the first kind
   * always has, whatever the content holds now.
   */
  queuedItemOf?(list: readonly Item[], queued: Q): Item | undefined
}

/** The cursor half of `PartKind`, plus the moves a kind composing it may reuse. */
export interface RetryRoundsCursor<Content, Item, Q extends QueuedRetry> {
  readonly maxRounds: number
  initialState(content: Content): RetryRoundsState<Q>
  expectedItem(content: Content, state: RetryRoundsState<Q>): RetryRoundItem<Item, Q> | null
  acceptsDoOver(
    content: Content,
    state: RetryRoundsState<Q>,
    tries: readonly KindTry[],
    itemId: string
  ): boolean
  whyNotDoOver(
    content: Content,
    state: RetryRoundsState<Q>,
    tries: readonly KindTry[],
    itemId: string
  ): DoOverRefusal | null
  applyTry(
    content: Content,
    state: RetryRoundsState<Q>,
    tries: readonly KindTry[],
    t: KindTry
  ): RetryRoundsState<Q>
  applyTryAside(
    content: Content,
    state: RetryRoundsState<Q>,
    tries: readonly KindTry[],
    t: KindTry
  ): RetryRoundsState<Q>
  isDone(content: Content, state: RetryRoundsState<Q>): boolean
  progress(content: Content, state: RetryRoundsState<Q>, tries: readonly KindTry[]): PartProgress
  roundsRemaining(content: Content, state: RetryRoundsState<Q>, itemId: string): number
  itemPositionOf(item: RetryRoundItem<Item, Q>): { itemId: string; round: number }
  /** Start the next round when nothing is left to show; clear the rounds when none can start */
  settle(content: Content, state: RetryRoundsState<Q>): RetryRoundsState<Q>
  /** A correct, counted do-over's redemption without settling; `state` itself when nothing changes */
  redeem(content: Content, state: RetryRoundsState<Q>, t: KindTry): RetryRoundsState<Q>
}

/** Whether a round is running (encoding: a non-empty running queue past round 0). */
function isRoundRunning<Q extends QueuedRetry>(
  retry: RetryRounds<Q> | undefined
): retry is RetryRounds<Q> {
  if (!retry) return false
  return retry.currentEpochItems.length > 0 && retry.currentEpoch > 0
}

function emptyRounds<Q extends QueuedRetry>(): RetryRounds<Q> {
  return {
    currentEpoch: 0,
    pendingRetries: [],
    currentEpochItems: [],
    currentRetryIndex: 0,
  }
}

/**
 * The cursor for a kind whose content lists its items (`items`, in order,
 * each with a stable `itemId`).
 */
export function retryRoundsCursor<
  Content,
  Item extends { itemId: string },
  Q extends QueuedRetry = QueuedRetry,
>(
  items: (content: Content) => readonly Item[],
  opts: RetryRoundsOptions<Item, Q> = {}
): RetryRoundsCursor<Content, Item, Q> {
  const maxRounds = opts.maxRounds ?? DEFAULT_MAX_ROUNDS
  const queue =
    opts.queue ??
    ((_shown: RetryRoundItem<Item, Q>, position: QueuedRetry) => ({ ...position }) as Q)

  /** The item a queued entry names: at its index, else by id; undefined when gone */
  const itemAt =
    opts.queuedItemOf ??
    ((list: readonly Item[], q: Q): Item | undefined => {
      const atIndex = list[q.originalSlotIndex]
      if (atIndex && atIndex.itemId === q.slotId) return atIndex
      return list.find((i) => i.itemId === q.slotId)
    })

  function expectedItem(
    content: Content,
    state: RetryRoundsState<Q>
  ): RetryRoundItem<Item, Q> | null {
    const list = items(content)
    const { retry } = state
    if (isRoundRunning(retry)) {
      const running = retry.currentEpochItems
      for (let retryIndex = retry.currentRetryIndex; retryIndex < running.length; retryIndex++) {
        const q = running[retryIndex]
        if (retry.redeemedSlots?.includes(q.originalSlotIndex)) continue
        const item = itemAt(list, q)
        if (!item) continue
        return {
          ...item,
          itemIndex: q.originalSlotIndex,
          round: q.epochNumber,
          retryIndex,
          queued: q,
        }
      }
      return null
    }
    const item = list[state.slotIndex]
    if (!item) return null
    return { ...item, itemIndex: state.slotIndex, round: 0, retryIndex: null, queued: null }
  }

  function settle(content: Content, state: RetryRoundsState<Q>): RetryRoundsState<Q> {
    const { slotIndex } = state
    let retry = state.retry
    for (;;) {
      if (expectedItem(content, { slotIndex, retry })) return { slotIndex, retry }
      if (!retry || retry.pendingRetries.length === 0 || retry.currentEpoch >= maxRounds) break
      // Start the next round; the first-pass index stays parked at the end
      retry = {
        ...retry,
        currentEpoch: retry.currentEpoch + 1,
        currentEpochItems: [...retry.pendingRetries],
        pendingRetries: [],
        currentRetryIndex: 0,
      }
    }
    // Nothing left (all right, redeemed, or out of rounds): the part is done
    if (retry) {
      retry = { ...retry, currentEpochItems: [], currentRetryIndex: 0, pendingRetries: [] }
    }
    return { slotIndex, retry }
  }

  /**
   * Step past the item just answered (a first try or a retry), then settle. A
   * wrong answer queues the item for the next round; in the last round it is
   * not queued again (its answer is divulged).
   */
  function stepPast(
    content: Content,
    state: RetryRoundsState<Q>,
    shown: RetryRoundItem<Item, Q>,
    isCorrect: boolean
  ): RetryRoundsState<Q> {
    let retry = state.retry
    if (!isCorrect && shown.round < maxRounds) {
      const queued = queue(shown, {
        slotId: shown.itemId,
        originalSlotIndex: shown.itemIndex,
        epochNumber: shown.round + 1,
      })
      const base = retry ?? emptyRounds<Q>()
      retry = { ...base, pendingRetries: [...base.pendingRetries, queued] }
    }
    if (shown.retryIndex !== null && retry) {
      retry = { ...retry, currentRetryIndex: shown.retryIndex + 1 }
    }
    return settle(content, {
      slotIndex: state.slotIndex + (shown.retryIndex === null ? 1 : 0),
      retry,
    })
  }

  /** Redeem the item at `index`: it leaves the queue and is skipped in a running round. */
  function redeemAt(state: RetryRoundsState<Q>, index: number): RetryRoundsState<Q> {
    const { retry } = state
    if (!retry) return state
    const redeemed = retry.redeemedSlots || []
    return {
      slotIndex: state.slotIndex,
      retry: {
        ...retry,
        pendingRetries: retry.pendingRetries.filter((q) => q.originalSlotIndex !== index),
        redeemedSlots: redeemed.includes(index) ? [...redeemed] : [...redeemed, index],
      },
    }
  }

  function redeem(content: Content, state: RetryRoundsState<Q>, t: KindTry): RetryRoundsState<Q> {
    if (t.practiceOnly || !t.isCorrect || !state.retry) return state
    const index = items(content).findIndex((i) => i.itemId === t.itemId)
    if (index < 0) return state
    return redeemAt(state, index)
  }

  /**
   * Whether the item's answer was shown: a wrong try in the last round there
   * is. That is a wrong retry at round `maxRounds` or later, exactly the
   * first kind's rule before K3 (its first tries are round 0, and a first
   * try is never counted, whatever round a row names); with no retry rounds
   * (`maxRounds` 0) the first pass is the last round, so a wrong first try.
   */
  function divulged(tries: readonly KindTry[], itemId: string): boolean {
    return tries.some(
      (t) =>
        t.itemId === itemId &&
        !t.isCorrect &&
        ((t.kind === 'retry' && t.round >= maxRounds) || (t.kind === 'first' && maxRounds === 0))
    )
  }

  function whyNotDoOver(
    content: Content,
    _state: RetryRoundsState<Q>,
    tries: readonly KindTry[],
    itemId: string
  ): DoOverRefusal | null {
    if (!items(content).some((i) => i.itemId === itemId)) return 'unknown_item'
    if (!tries.some((t) => t.itemId === itemId)) return 'no_try'
    return divulged(tries, itemId) ? 'divulged' : null
  }

  return {
    maxRounds,

    initialState: () => ({ slotIndex: 0, retry: undefined }),

    expectedItem,

    // A do-over of an item with a try, unless its answer was divulged
    acceptsDoOver: (content, state, tries, itemId) =>
      whyNotDoOver(content, state, tries, itemId) === null,

    whyNotDoOver,

    applyTry(content, state, _tries, t) {
      if (t.kind === 'do_over') {
        const redeemed = redeem(content, state, t)
        // A redemption that empties the running round settles like a try does
        return redeemed === state ? state : settle(content, redeemed)
      }
      const shown = expectedItem(content, state)
      if (!shown || shown.itemId !== t.itemId) {
        throw new Error(`applyTry: try for ${t.itemId}, expected ${shown?.itemId ?? '(none)'}`)
      }
      return stepPast(content, state, shown, t.isCorrect)
    },

    // A do-over outside the part being practiced redeems without settling
    applyTryAside: (content, state, _tries, t) => redeem(content, state, t),

    isDone: (content, state) => expectedItem(content, state) === null,

    progress(content, state) {
      const total = items(content).length
      return { done: Math.min(state.slotIndex, total), total }
    },

    /**
     * Rounds still to come for `itemId` after a wrong try where it stands now:
     * the shown item's `maxRounds − round` (0 = a wrong try divulges its
     * answer, feedback's "show the answer"); a queued item's from the round
     * it is queued for; an item not reached yet has every round; an item
     * past (right, redeemed, or out of rounds) has none.
     */
    roundsRemaining(content, state, itemId) {
      const shown = expectedItem(content, state)
      if (shown && shown.itemId === itemId) return Math.max(0, maxRounds - shown.round)
      const { retry } = state
      const list = items(content)
      const index = list.findIndex((i) => i.itemId === itemId)
      if (index < 0) return 0
      if (!retry?.redeemedSlots?.includes(index)) {
        const running = isRoundRunning(retry)
          ? retry.currentEpochItems.slice(retry.currentRetryIndex)
          : []
        const q = [...running, ...(retry?.pendingRetries ?? [])].find(
          (e) => e.originalSlotIndex === index
        )
        if (q) return Math.max(0, maxRounds - q.epochNumber)
      }
      return index >= state.slotIndex ? maxRounds : 0
    },

    itemPositionOf: (item) => ({ itemId: item.itemId, round: item.round }),

    settle,
    redeem,
  }
}
