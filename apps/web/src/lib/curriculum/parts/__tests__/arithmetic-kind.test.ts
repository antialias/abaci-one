/**
 * The arithmetic kind behind the contract (Phase 2). Behaviour identity of the
 * try path is `src/test/part-kind-golden-replay.test.ts`; these pin the
 * registry, the re-exports and the kind's smaller methods.
 */

import { describe, expect, it } from 'vitest'
import * as helpers from '@/db/schema/session-plan-helpers'
import type { ProblemSlot, SessionPart } from '@/db/schema/session-plans'
import * as schemaReexports from '@/db/schema/session-plans'
import * as report from '../arithmetic/report'
import { arithmeticKind, redeemByDoOver } from '../arithmetic/server'
import * as state from '../arithmetic/state'
import type { KindTry } from '../kind'
import { findPartKind, isPartPlayable, kindIdOf, partKindOf, plannedItemCount } from '../registry'

function slot(i: number, withProblem = true): ProblemSlot {
  return {
    slotId: `s${i}`,
    index: i,
    purpose: 'focus',
    constraints: {},
    ...(withProblem ? { problem: { terms: [i, 1], answer: i + 1, skillsRequired: [] } } : {}),
  }
}

function part(type: SessionPart['type'], slots = [slot(0), slot(1), slot(2)]): SessionPart {
  return {
    partNumber: 1,
    type,
    format: type === 'linear' ? 'linear' : 'vertical',
    useAbacus: type === 'abacus',
    slots,
    estimatedMinutes: 2,
  }
}

const t = (itemId: string, isCorrect: boolean, over: Partial<KindTry> = {}): KindTry => ({
  itemId,
  kind: 'first',
  round: 0,
  practiceOnly: false,
  isCorrect,
  ...over,
})

describe('registry', () => {
  it('reads a part without kind as arithmetic', () => {
    expect(kindIdOf({})).toBe('arithmetic')
    expect(partKindOf({})).toBe(arithmeticKind)
    expect(partKindOf({ kind: 'arithmetic' })).toBe(arithmeticKind)
  })

  it('finds no kind for an unknown id, including prototype keys', () => {
    expect(findPartKind({ kind: 'constructor' })).toBeUndefined()
    expect(findPartKind({ kind: 'toString' })).toBeUndefined()
    expect(() => partKindOf({ kind: 'nope' })).toThrow(/Unknown part kind/)
  })

  it('isPlayable replaces the pre-generated-problems test', () => {
    expect(isPartPlayable(part('abacus'))).toBe(true)
    expect(isPartPlayable(part('abacus', [slot(0), slot(1, false)]))).toBe(false)
    expect(isPartPlayable(part('abacus', []))).toBe(true) // as the old loop: no slot, nothing missing
  })

  it('planned items are the slots', () => {
    expect(plannedItemCount(part('linear'))).toBe(3)
  })
})

describe('the Phase 2 re-export shims are gone (Phase 6b-1)', () => {
  it('the arithmetic helpers are imported from parts/arithmetic only', () => {
    for (const name of [
      'resolveCurrentItem',
      'getCurrentProblemInfo',
      'isInRetryEpoch',
      'needsRetryTransition',
      'MAX_RETRY_EPOCHS',
      'calculateTotalProblemsWithRetries',
      'initRetryState',
    ]) {
      expect(helpers).not.toHaveProperty(name)
      expect(schemaReexports).not.toHaveProperty(name)
    }
    expect(state.MAX_RETRY_EPOCHS).toBe(2)
    expect(typeof report.calculateTotalProblemsWithRetries).toBe('function')
    // initRetryState wrote the legacy retry_state; it is deleted with the write
    expect(state).not.toHaveProperty('initRetryState')
  })
})

describe('arithmeticKind', () => {
  const slots = [slot(0), slot(1), slot(2)]

  it('walks first tries to done, queueing a wrong answer into a retry round', () => {
    let s = arithmeticKind.initialState(slots)
    s = arithmeticKind.applyTry(slots, s, [], t('s0', false))
    expect(s.retry?.pendingRetries.map((r) => r.slotId)).toEqual(['s0'])
    s = arithmeticKind.applyTry(slots, s, [], t('s1', true))
    s = arithmeticKind.applyTry(slots, s, [], t('s2', true))
    // round 1 started by the settle
    expect(s).toMatchObject({ slotIndex: 3, retry: { currentEpoch: 1, pendingRetries: [] } })
    expect(arithmeticKind.expectedItem(slots, s)).toMatchObject({ slotId: 's0', epochNumber: 1 })
    expect(arithmeticKind.isDone(slots, s)).toBe(false)
    s = arithmeticKind.applyTry(slots, s, [], t('s0', true, { kind: 'retry', round: 1 }))
    expect(arithmeticKind.isDone(slots, s)).toBe(true)
    expect(s.retry).toMatchObject({
      currentEpochItems: [],
      pendingRetries: [],
      currentRetryIndex: 0,
    })
  })

  it('refuses a first try for an item other than the expected one', () => {
    expect(() =>
      arithmeticKind.applyTry(slots, arithmeticKind.initialState(slots), [], t('s1', true))
    ).toThrow(/expected s0/)
  })

  it('a do-over that redeems nothing returns the same state object', () => {
    const s = arithmeticKind.applyTry(slots, arithmeticKind.initialState(slots), [], t('s0', false))
    for (const doOver of [
      t('s0', true, { kind: 'do_over', practiceOnly: true }),
      t('s0', false, { kind: 'do_over' }),
    ]) {
      expect(arithmeticKind.applyTry(slots, s, [], doOver)).toBe(s)
      expect(redeemByDoOver(slots, s, doOver)).toBe(s)
    }
    const fresh = arithmeticKind.initialState(slots) // no retry state
    expect(arithmeticKind.applyTry(slots, fresh, [], t('s0', true, { kind: 'do_over' }))).toBe(
      fresh
    )
  })

  it('a correct do-over of a queued item redeems it', () => {
    const s = arithmeticKind.applyTry(slots, arithmeticKind.initialState(slots), [], t('s0', false))
    const next = arithmeticKind.applyTry(slots, s, [], t('s0', true, { kind: 'do_over', round: 1 }))
    expect(next.retry).toMatchObject({ pendingRetries: [], redeemedSlots: [0] })
    expect(next.slotIndex).toBe(1)
    expect(s.retry?.pendingRetries).toHaveLength(1) // pure: the input is untouched
  })

  it('accepts a do-over only of an item of the part with a try', () => {
    const tries = [t('s0', true)]
    expect(
      arithmeticKind.acceptsDoOver(slots, arithmeticKind.initialState(slots), tries, 's0')
    ).toBe(true)
    expect(
      arithmeticKind.acceptsDoOver(slots, arithmeticKind.initialState(slots), tries, 's1')
    ).toBe(false)
    expect(
      arithmeticKind.acceptsDoOver(slots, arithmeticKind.initialState(slots), [t('x', true)], 'x')
    ).toBe(false)
  })

  it('judge, progress and presentation', () => {
    expect(arithmeticKind.judge(slots, 's2', 3)).toBe(true)
    expect(arithmeticKind.judge(slots, 's2', 4)).toBe(false)
    expect(arithmeticKind.judge(slots, 'nope', 3)).toBe(false)
    expect(arithmeticKind.progress(slots, { slotIndex: 5, retry: undefined }, [])).toEqual({
      done: 3,
      total: 3,
    })
    expect(arithmeticKind.presentationOf(part('abacus'))).toEqual({
      layer: 'abacus',
      modality: 'visual',
      abacusAvailable: true,
      input: 'keypad',
    })
  })
})
