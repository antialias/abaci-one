/**
 * Practice-kinds K3: arithmetic's cursor, now composed from the shared
 * `parts/cursor/retry-rounds.ts`, moves a part exactly as the K2 image's
 * did, and stores the same bytes (key order included) in `part_states`.
 *
 * Both sides take the same try from the same state at every step: the K3
 * kind (`arithmeticKind`) and the K2 cursor (`test/pre-k3/`, verbatim
 * copies of the code before the extraction). The stored state must be
 * byte-identical (`JSON.stringify`), and the item each side would show from
 * it must be the same, so a K2 pod after a rollback reads, and carries on, a
 * part K3 moved (§3.3 K3 row), and the reverse. The golden replay compares
 * through a snapshot serializer that sorts keys; this compares the bytes.
 */

import { describe, expect, it } from 'vitest'
import type { ProblemSlot } from '@/db/schema/session-plans'
import { arithmeticKind } from '@/lib/curriculum/parts/arithmetic/server'
import type { ArithmeticState } from '@/lib/curriculum/parts/arithmetic/state'
import type { KindTry } from '@/lib/curriculum/parts/kind'
import { k2ArithmeticCursor } from './pre-k3/arithmetic-cursor'

function slot(i: number): ProblemSlot {
  return {
    slotId: `s${i}`,
    index: i,
    purpose: (['focus', 'reinforce', 'review', 'challenge'] as const)[i % 4],
    constraints: {},
    problem: { terms: [i, 2], answer: i + 2, skillsRequired: [`skill.${i}`] },
  }
}

/** Deterministic, so a failure names its seed. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const bytes = (x: unknown) => JSON.stringify(x)

/** One walk: tries, wrong answers, do-overs in and outside the part, until done. */
function walk(seed: number, slotCount: number) {
  const random = rng(seed)
  const slots = Array.from({ length: slotCount }, (_, i) => slot(i))
  let state: ArithmeticState = arithmeticKind.initialState(slots)
  expect(bytes(state)).toBe(bytes(k2ArithmeticCursor.initialState()))
  const tries: KindTry[] = []
  let steps = 0

  const compare = (s: ArithmeticState, label: string) => {
    // The item each image shows from this state: the K2 image reading K3's bytes
    const read = JSON.parse(bytes(s)) as ArithmeticState
    expect(bytes(arithmeticKind.expectedItem(slots, read)), label).toBe(
      bytes(k2ArithmeticCursor.expectedItem(slots, read))
    )
    expect(arithmeticKind.isDone(slots, read), label).toBe(k2ArithmeticCursor.isDone(slots, read))
  }

  while (!arithmeticKind.isDone(slots, state) && steps < 200) {
    steps++
    const label = `seed ${seed} step ${steps}`
    const roll = random()
    let t: KindTry
    let aside = false
    if (roll < 0.2 && tries.length > 0) {
      // A do-over of an item with a try; aside = outside the part being practiced
      const itemId = tries[Math.floor(random() * tries.length)].itemId
      for (const id of [itemId, 'nope', slots[Math.floor(random() * slotCount)].slotId]) {
        expect(arithmeticKind.whyNotDoOver?.(slots, state, tries, id), `${label} ${id}`).toBe(
          k2ArithmeticCursor.whyNotDoOver(slots, state, tries, id)
        )
      }
      if (!arithmeticKind.acceptsDoOver(slots, state, tries, itemId)) continue
      const counted = tries.filter((x) => x.itemId === itemId && !x.practiceOnly)
      const latest = counted[counted.length - 1]
      t = {
        itemId,
        kind: 'do_over',
        round: counted.length,
        practiceOnly: latest?.isCorrect === true,
        isCorrect: random() < 0.6,
      }
      aside = random() < 0.3
    } else {
      const item = arithmeticKind.expectedItem(slots, state)!
      t = {
        itemId: item.slotId,
        kind: item.retryIndex === null ? 'first' : 'retry',
        round: item.epochNumber,
        practiceOnly: false,
        isCorrect: random() < 0.45,
      }
    }
    const next = aside
      ? arithmeticKind.applyTryAside(slots, state, tries, t)
      : arithmeticKind.applyTry(slots, state, tries, t)
    const k2Next = aside
      ? k2ArithmeticCursor.applyTryAside(slots, state, tries, t)
      : k2ArithmeticCursor.applyTry(slots, state, tries, t)
    expect(bytes(next), label).toBe(bytes(k2Next))
    // Unchanged state is the same object on both sides (the recorder writes no entry)
    expect(next === state, label).toBe(k2Next === state)
    compare(next, label)
    tries.push(t)
    // Carry on from either image's bytes: they are the same
    state = random() < 0.5 ? next : (JSON.parse(bytes(k2Next)) as ArithmeticState)
  }
  return { steps, state }
}

describe('the shared cursor stores what the K2 cursor stored (K3)', () => {
  it('300 seeded walks: byte-identical part_states and the same item at every step', () => {
    let totalSteps = 0
    let withRetries = 0
    let withRedemptions = 0
    for (let seed = 1; seed <= 300; seed++) {
      const { steps, state } = walk(seed, 1 + (seed % 7))
      totalSteps += steps
      if (state.retry) withRetries++
      if (state.retry?.redeemedSlots?.length) withRedemptions++
    }
    // The walks reach what they are meant to compare
    expect(totalSteps).toBeGreaterThan(2000)
    expect(withRetries).toBeGreaterThan(150)
    expect(withRedemptions).toBeGreaterThan(20)
  })

  // A queue the slots do not match (hand-built, or a slot id that changed):
  // K2 showed a retry from its queued entry alone, and so does K3.
  it('a stale or hand-built queue: the same item, the same moves', () => {
    const slots = Array.from({ length: 5 }, (_, i) => slot(i))
    const queued = (slotId: string, originalSlotIndex: number) => ({
      slotId,
      originalSlotIndex,
      problem: { terms: [9, 9], answer: 18, skillsRequired: [] },
      epochNumber: 1,
      originalPurpose: 'review' as const,
    })
    const states: ArithmeticState[] = [
      [queued('stale-A', 1), queued('stale-B', 3)],
      [queued('s1', 4), queued('s9', 9)],
      [queued('gone', 7)],
    ].map((items) => ({
      slotIndex: 5,
      retry: {
        currentEpoch: 1,
        pendingRetries: [],
        currentEpochItems: items,
        currentRetryIndex: 0,
        redeemedSlots: [4],
      },
    }))
    for (const [n, state] of states.entries()) {
      const shown = arithmeticKind.expectedItem(slots, state)
      expect(bytes(shown), `state ${n}`).toBe(bytes(k2ArithmeticCursor.expectedItem(slots, state)))
      if (!shown) continue
      for (const isCorrect of [true, false]) {
        const t: KindTry = {
          itemId: shown.slotId,
          kind: 'retry',
          round: shown.epochNumber,
          practiceOnly: false,
          isCorrect,
        }
        expect(bytes(arithmeticKind.applyTry(slots, state, [], t)), `state ${n} ${isCorrect}`).toBe(
          bytes(k2ArithmeticCursor.applyTry(slots, state, [], t))
        )
      }
    }
  })

  it('a queued retry still carries the problem and the purpose, in the stored key order', () => {
    const slots = [slot(0), slot(1)]
    const state = arithmeticKind.applyTry(slots, arithmeticKind.initialState(slots), [], {
      itemId: 's0',
      kind: 'first',
      round: 0,
      practiceOnly: false,
      isCorrect: false,
    })
    expect(Object.keys(state.retry!.pendingRetries[0])).toEqual([
      'slotId',
      'originalSlotIndex',
      'problem',
      'epochNumber',
      'originalPurpose',
    ])
    expect(state.retry!.pendingRetries[0]).toMatchObject({
      problem: slots[0].problem,
      originalPurpose: 'focus',
    })
  })
})
