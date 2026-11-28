/**
 * The optional optimistic check of a kind's browser half (practice-kinds
 * K3, amendment A11): display only, and the server's verdict wins.
 */

import { describe, expect, it } from 'vitest'
import { arithmeticBrowserKind } from '../arithmetic/browser'
import { arithmeticKind } from '../arithmetic/server'
import { type BrowserKind, optimisticVerdictOf, settledVerdictOf } from '../browser-kind'

const slots = [
  {
    slotId: 's0',
    index: 0,
    purpose: 'focus' as const,
    constraints: {},
    problem: { terms: [3, 4], answer: 7, skillsRequired: [] },
  },
]

describe('the optimistic check', () => {
  it("arithmetic's agrees with its judge on the shown item", () => {
    const item = arithmeticKind.expectedItem(slots, arithmeticKind.initialState(slots))!
    for (const answer of [7, 8, 0]) {
      expect(arithmeticBrowserKind.check!(item, answer)).toBe(
        arithmeticKind.judge(slots, 's0', answer)
      )
    }
    expect(optimisticVerdictOf(arithmeticBrowserKind, item, 7)).toBe('correct')
    expect(optimisticVerdictOf(arithmeticBrowserKind, item, 8)).toBe('incorrect')
    // An item without a problem cannot be checked here: never shown as right
    expect(arithmeticBrowserKind.check!({ ...item, problem: undefined }, 7)).toBe(false)
  })

  it('a kind without one waits for the server', () => {
    const silent: BrowserKind<{ itemId: string }> = { id: 'read_abacus' }
    expect(optimisticVerdictOf(silent, { itemId: 'r0' }, 3)).toBe('pending')
    expect(settledVerdictOf('pending', null)).toBe('pending')
    expect(settledVerdictOf('pending', { isCorrect: true })).toBe('correct')
  })

  it("the server's verdict wins when the reply arrives", () => {
    expect(settledVerdictOf('correct', { isCorrect: false })).toBe('incorrect')
    expect(settledVerdictOf('incorrect', { isCorrect: true })).toBe('correct')
    expect(settledVerdictOf('incorrect', null)).toBe('incorrect')
  })
})
