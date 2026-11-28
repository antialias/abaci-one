/**
 * The shared cursor (practice-kinds §1.3, K3) on an item type that is not
 * arithmetic's: spelling words. Arithmetic's use of it is
 * `arithmetic-kind.test.ts`, the golden replay and
 * `src/test/retry-rounds-k2-parity.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import { retryRoundsCursor } from '../cursor/retry-rounds'
import type { KindTry } from '../kind'

interface Word {
  itemId: string
  word: string
}

type Content = { words: Word[] }

const content: Content = {
  words: [
    { itemId: 'w0', word: 'cat' },
    { itemId: 'w1', word: 'dog' },
    { itemId: 'w2', word: 'emu' },
  ],
}

const cursor = retryRoundsCursor((c: Content) => c.words)

const t = (itemId: string, isCorrect: boolean, over: Partial<KindTry> = {}): KindTry => ({
  itemId,
  kind: 'first',
  round: 0,
  practiceOnly: false,
  isCorrect,
  ...over,
})

/** Answer whatever is shown, right or wrong by item id. */
function answerShown(state: ReturnType<typeof cursor.initialState>, wrong: Set<string>) {
  const shown = cursor.expectedItem(content, state)!
  const kind = shown.retryIndex === null ? 'first' : 'retry'
  return {
    shown,
    next: cursor.applyTry(
      content,
      state,
      [],
      t(shown.itemId, !wrong.has(shown.itemId), { kind, round: shown.round })
    ),
  }
}

describe('retryRoundsCursor over a non-arithmetic item', () => {
  it('first pass in order, then the wrong items in retry rounds, until done', () => {
    let s = cursor.initialState(content)
    const seen: [string, number, string][] = []
    const wrong = new Set(['w1'])
    while (!cursor.isDone(content, s)) {
      const { shown, next } = answerShown(s, wrong)
      seen.push([shown.itemId, shown.round, shown.word])
      s = next
    }
    // w1 is wrong every time: first pass, round 1, round 2, then divulged
    expect(seen).toEqual([
      ['w0', 0, 'cat'],
      ['w1', 0, 'dog'],
      ['w2', 0, 'emu'],
      ['w1', 1, 'dog'],
      ['w1', 2, 'dog'],
    ])
    expect(cursor.progress(content, s, [])).toEqual({ done: 3, total: 3 })
    expect(cursor.expectedItem(content, s)).toBeNull()
  })

  it('shows an item with where it stands: index, round, queue position', () => {
    let s = cursor.applyTry(content, cursor.initialState(content), [], t('w0', false))
    expect(cursor.expectedItem(content, s)).toEqual({
      itemId: 'w1',
      word: 'dog',
      itemIndex: 1,
      round: 0,
      retryIndex: null,
      queued: null,
    })
    s = cursor.applyTry(content, s, [], t('w1', true))
    s = cursor.applyTry(content, s, [], t('w2', true))
    const shown = cursor.expectedItem(content, s)!
    expect(shown).toMatchObject({
      itemId: 'w0',
      word: 'cat',
      itemIndex: 0,
      round: 1,
      retryIndex: 0,
    })
    // The default queued entry is the positional encoding only
    expect(shown.queued).toEqual({ slotId: 'w0', originalSlotIndex: 0, epochNumber: 1 })
    expect(cursor.itemPositionOf(shown)).toEqual({ itemId: 'w0', round: 1 })
  })

  it('refuses a try for anything but the shown item', () => {
    expect(() => cursor.applyTry(content, cursor.initialState(content), [], t('w2', true))).toThrow(
      /expected w0/
    )
  })

  it('a correct counted do-over redeems a queued item; practice-only or wrong changes nothing', () => {
    const s = cursor.applyTry(content, cursor.initialState(content), [], t('w0', false))
    for (const doOver of [
      t('w0', true, { kind: 'do_over', practiceOnly: true }),
      t('w0', false, { kind: 'do_over' }),
    ]) {
      expect(cursor.applyTry(content, s, [], doOver)).toBe(s)
      expect(cursor.applyTryAside(content, s, [], doOver)).toBe(s)
    }
    const redeemed = cursor.applyTry(content, s, [], t('w0', true, { kind: 'do_over', round: 1 }))
    expect(redeemed.retry).toMatchObject({ pendingRetries: [], redeemedSlots: [0] })
    expect(s.retry?.pendingRetries).toHaveLength(1) // pure
  })

  it('a redemption that empties the running round settles in the part; aside it does not', () => {
    let s = cursor.initialState(content)
    s = cursor.applyTry(content, s, [], t('w0', false))
    s = cursor.applyTry(content, s, [], t('w1', true))
    s = cursor.applyTry(content, s, [], t('w2', true))
    expect(cursor.expectedItem(content, s)).toMatchObject({ itemId: 'w0', round: 1 })
    const doOver = t('w0', true, { kind: 'do_over', round: 1 })
    const inPart = cursor.applyTry(content, s, [], doOver)
    expect(cursor.isDone(content, inPart)).toBe(true)
    expect(inPart.retry).toMatchObject({ currentEpochItems: [], currentRetryIndex: 0 })
    const aside = cursor.applyTryAside(content, s, [], doOver)
    expect(aside.retry?.currentEpochItems).toHaveLength(1) // not settled
    expect(cursor.isDone(content, aside)).toBe(true) // the redeemed item is skipped
  })

  it('do-overs: an item of the part with a try, unless its answer was divulged', () => {
    const s = cursor.initialState(content)
    const tries = [t('w0', true), t('w1', false), t('w1', false, { kind: 'retry', round: 1 })]
    expect(cursor.whyNotDoOver(content, s, tries, 'w0')).toBeNull()
    expect(cursor.whyNotDoOver(content, s, tries, 'w1')).toBeNull()
    expect(cursor.whyNotDoOver(content, s, tries, 'w2')).toBe('no_try')
    expect(cursor.whyNotDoOver(content, s, tries, 'zz')).toBe('unknown_item')
    const divulged = [...tries, t('w1', false, { kind: 'retry', round: 2 })]
    expect(cursor.whyNotDoOver(content, s, divulged, 'w1')).toBe('divulged')
    expect(cursor.acceptsDoOver(content, s, divulged, 'w1')).toBe(false)
    expect(cursor.acceptsDoOver(content, s, divulged, 'w0')).toBe(true)
  })

  it('roundsRemaining reaches 0 exactly where a wrong try divulges', () => {
    let s = cursor.initialState(content)
    expect(cursor.roundsRemaining(content, s, 'w2')).toBe(2) // not reached
    const wrong = new Set(['w0'])
    const remainingWhenShown: number[] = []
    while (!cursor.isDone(content, s)) {
      const shown = cursor.expectedItem(content, s)!
      if (shown.itemId === 'w0') remainingWhenShown.push(cursor.roundsRemaining(content, s, 'w0'))
      s = answerShown(s, wrong).next
    }
    expect(remainingWhenShown).toEqual([2, 1, 0])
    expect(cursor.roundsRemaining(content, s, 'w0')).toBe(0)
    expect(cursor.roundsRemaining(content, s, 'w1')).toBe(0) // passed
    expect(cursor.roundsRemaining(content, s, 'zz')).toBe(0)
  })

  it('maxRounds 0: one try per item, a wrong one divulges and is not queued', () => {
    const once = retryRoundsCursor((c: Content) => c.words, { maxRounds: 0 })
    let s = once.initialState(content)
    expect(once.roundsRemaining(content, s, 'w0')).toBe(0)
    s = once.applyTry(content, s, [], t('w0', false))
    expect(s.retry).toBeUndefined()
    expect(once.whyNotDoOver(content, s, [t('w0', false)], 'w0')).toBe('divulged')
    s = once.applyTry(content, s, [], t('w1', false))
    s = once.applyTry(content, s, [], t('w2', true))
    expect(once.isDone(content, s)).toBe(true)
  })

  it("a kind's queued entry carries its snapshot, in the key order it returns", () => {
    const snapshotting = retryRoundsCursor((c: Content) => c.words, {
      queue: (shown, at) => ({
        slotId: at.slotId,
        originalSlotIndex: at.originalSlotIndex,
        word: shown.word,
        epochNumber: at.epochNumber,
      }),
    })
    const state = snapshotting.applyTry(
      content,
      snapshotting.initialState(content),
      [],
      t('w0', false)
    )
    expect(JSON.stringify(state.retry?.pendingRetries[0])).toBe(
      '{"slotId":"w0","originalSlotIndex":0,"word":"cat","epochNumber":1}'
    )
  })
})
