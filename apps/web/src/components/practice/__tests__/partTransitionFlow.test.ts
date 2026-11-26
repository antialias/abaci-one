import { describe, expect, it } from 'vitest'
import type { SessionPlan } from '@/db/schema/session-plans'
import {
  nextCompletionRequest,
  partTransitionKey,
  transitionCompletionToSend,
} from '../partTransitionFlow'

const parts = [{}, {}, {}] as SessionPlan['parts']
const plan = (flowState: SessionPlan['flowState'], currentPartIndex: number) => ({
  id: 'plan-1',
  flowState,
  currentPartIndex,
  parts,
})

describe('partTransitionKey', () => {
  it('names the transition from flowState alone, also for a freshly loaded plan', () => {
    expect(partTransitionKey(plan('part_transition', 1))).toBe('plan-1:1')
    expect(partTransitionKey(plan('part_transition', 2))).toBe('plan-1:2')
  })

  it('is null outside part_transition, or with no part to start', () => {
    expect(partTransitionKey(plan('practicing', 1))).toBeNull()
    expect(partTransitionKey(plan('break_pending', 1))).toBeNull()
    expect(partTransitionKey(plan('part_transition', 3))).toBeNull()
  })
})

describe('transitionCompletionToSend', () => {
  const key = 'plan-1:1'
  const asked = nextCompletionRequest(null, key)

  it('waits until the screen asks', () => {
    expect(
      transitionCompletionToSend({
        key,
        flowVersion: 3,
        request: null,
        inFlight: false,
        sent: null,
      })
    ).toBeNull()
  })

  it('sends once per token', () => {
    const token = transitionCompletionToSend({
      key,
      flowVersion: 3,
      request: asked,
      inFlight: false,
      sent: null,
    })
    expect(token).toBe('plan-1:1@3#1')
    expect(
      transitionCompletionToSend({
        key,
        flowVersion: 3,
        request: asked,
        inFlight: false,
        sent: token,
      })
    ).toBeNull()
  })

  it('a stale token: the refetched plan at a newer version sends again with it', () => {
    expect(
      transitionCompletionToSend({
        key,
        flowVersion: 4,
        request: asked,
        inFlight: false,
        sent: 'plan-1:1@3#1',
      })
    ).toBe('plan-1:1@4#1')
  })

  it('a failure that left the version as it was waits for the kid to ask again', () => {
    const again = nextCompletionRequest(asked, key)
    expect(again.n).toBe(2)
    expect(
      transitionCompletionToSend({
        key,
        flowVersion: 3,
        request: again,
        inFlight: false,
        sent: 'plan-1:1@3#1',
      })
    ).toBe('plan-1:1@3#2')
  })

  it('never sends while one is in flight, nor for another transition', () => {
    expect(
      transitionCompletionToSend({
        key,
        flowVersion: 3,
        request: asked,
        inFlight: true,
        sent: null,
      })
    ).toBeNull()
    expect(
      transitionCompletionToSend({
        key: 'plan-1:2',
        flowVersion: 3,
        request: asked,
        inFlight: false,
        sent: null,
      })
    ).toBeNull()
    expect(
      transitionCompletionToSend({
        key: null,
        flowVersion: 3,
        request: asked,
        inFlight: false,
        sent: null,
      })
    ).toBeNull()
  })

  it('a new transition starts its asks at 1', () => {
    expect(nextCompletionRequest(asked, 'plan-1:2')).toEqual({ key: 'plan-1:2', n: 1 })
  })
})
