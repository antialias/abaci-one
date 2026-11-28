/**
 * Phase 3c client contract of the session-plan mutations (plan of record §3.3,
 * §7 Phase 3c): a try outside practicing applies the plan the 409 carries; a
 * try lost to write contention is resent once with the same body and, failing
 * again, resyncs with no message; a flow event with a stale token refetches.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionPlan, SlotResultSubmission } from '@/db/schema/session-plans'
import { sessionPlanKeys } from '@/lib/queryKeys'
import {
  isQuietFlowEventFailure,
  isQuietTryWriteFailure,
  NotPracticingClientError,
  StaleFlowVersionClientError,
  TryNotSavedError,
  useCompletePartTransition,
  useRecordSlotResult,
} from '../useSessionPlan'

let queryClient: QueryClient
let fetchMock: ReturnType<typeof vi.fn>

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const plan = (overrides: Partial<SessionPlan> = {}) =>
  ({ id: 'plan-1', flowState: 'practicing', flowVersion: 2, ...overrides }) as SessionPlan

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const submission = {
  tryId: '00000000-0000-4000-8000-000000000001',
  partIndex: 0,
} as SlotResultSubmission & { partIndex: number; tryId: string }

/** Requests sent to a URL path, in order, with their parsed bodies. */
const sent = (path: string) =>
  fetchMock.mock.calls
    .filter(([url]) => String(url).endsWith(path))
    .map(([, init]) => (init?.body ? JSON.parse(String(init.body)) : undefined))

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  fetchMock = vi.fn()
  global.fetch = fetchMock as unknown as typeof fetch
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('useRecordSlotResult (Phase 3c)', () => {
  it('a 409 not_practicing applies the plan it carries and is quiet', async () => {
    const inTransition = plan({ flowState: 'part_transition', flowVersion: 3 })
    fetchMock.mockResolvedValueOnce(
      json(409, { code: 'not_practicing', error: 'not practicing', plan: inTransition })
    )
    const { result } = renderHook(() => useRecordSlotResult(), { wrapper })

    const error = await result.current
      .mutateAsync({ playerId: 'p1', planId: 'plan-1', result: submission })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(NotPracticingClientError)
    expect(isQuietTryWriteFailure(error)).toBe(true)
    expect(queryClient.getQueryData(sessionPlanKeys.active('p1'))).toEqual(inTransition)
    expect(queryClient.getQueryData(sessionPlanKeys.detail('plan-1'))).toEqual(inTransition)
    // Applied, not refetched: one request in all
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a 503 write_contention is resent once with the same tryId, and the reply lands', async () => {
    const next = plan({ flowVersion: 2 })
    fetchMock
      .mockResolvedValueOnce(json(503, { code: 'write_contention', error: 'busy' }))
      .mockResolvedValueOnce(json(200, { plan: next }))
    const { result } = renderHook(() => useRecordSlotResult(), { wrapper })

    const landed = await result.current.mutateAsync({
      playerId: 'p1',
      planId: 'plan-1',
      result: submission,
    })

    expect(landed).toEqual(next)
    const bodies = sent('/sessions/plans/plan-1')
    expect(bodies).toHaveLength(2)
    expect(bodies.map((b) => b.result.tryId)).toEqual([submission.tryId, submission.tryId])
  })

  it('contention on the resend too: quiet, and the plan is refetched', async () => {
    fetchMock
      .mockResolvedValueOnce(json(503, { code: 'write_contention', error: 'busy' }))
      .mockResolvedValueOnce(json(503, { code: 'write_contention', error: 'busy' }))
      .mockResolvedValue(json(200, { plan: plan() }))
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useRecordSlotResult(), { wrapper })

    const error = await result.current
      .mutateAsync({ playerId: 'p1', planId: 'plan-1', result: submission })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TryNotSavedError)
    expect((error as TryNotSavedError).contention).toBe(true)
    expect(isQuietTryWriteFailure(error)).toBe(true)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: sessionPlanKeys.active('p1') })
    expect(sent('/sessions/plans/plan-1')).toHaveLength(2)
  })

  it('a network failure twice is not quiet (the kid is told plainly)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useRecordSlotResult(), { wrapper })

    const error = await result.current
      .mutateAsync({ playerId: 'p1', planId: 'plan-1', result: submission })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(TryNotSavedError)
    expect((error as TryNotSavedError).contention).toBe(false)
    expect(isQuietTryWriteFailure(error)).toBe(false)
  })
})

describe('useCompletePartTransition (Phase 3c)', () => {
  it('a 409 STALE_FLOW_VERSION fetches the plan, which drives the screen, quietly', async () => {
    const fresh = plan({ flowState: 'part_transition', flowVersion: 5 })
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith('/flow-events')
        ? json(409, { code: 'STALE_FLOW_VERSION', error: 'stale' })
        : json(200, { plan: fresh })
    )
    // A mounted active-plan query, as PracticeClient has
    queryClient.setQueryData(sessionPlanKeys.active('p1'), plan({ flowVersion: 4 }))
    const { result } = renderHook(() => useCompletePartTransition(), { wrapper })

    const error = await result.current
      .mutateAsync({
        playerId: 'p1',
        planId: 'plan-1',
        expectedFlowVersion: 4,
        shouldRunBreak: false,
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(StaleFlowVersionClientError)
    expect(isQuietFlowEventFailure(error)).toBe(true)
    expect(queryClient.getQueryData(sessionPlanKeys.active('p1'))).toEqual(fresh)
    // Sent once: a 4xx is never resent
    expect(sent('/flow-events')).toHaveLength(1)
    // The client still sends shouldRunBreak for one release
    expect(sent('/flow-events')[0]).toMatchObject({
      event: { type: 'PART_TRANSITION_COMPLETED', shouldRunBreak: false },
      expectedFlowVersion: 4,
    })
  })

  it('a 503 on a flow event is resent once, immediately', async () => {
    const next = plan({ flowState: 'practicing', flowVersion: 5 })
    fetchMock
      .mockResolvedValueOnce(json(503, { code: 'write_contention', error: 'busy' }))
      .mockResolvedValueOnce(json(200, { plan: next }))
    const { result } = renderHook(() => useCompletePartTransition(), { wrapper })

    const landed = await result.current.mutateAsync({
      playerId: 'p1',
      planId: 'plan-1',
      expectedFlowVersion: 4,
      shouldRunBreak: false,
    })

    expect(landed).toEqual(next)
    expect(sent('/flow-events')).toHaveLength(2)
    expect(queryClient.getQueryData(sessionPlanKeys.active('p1'))).toEqual(next)
  })

  it('an adult ended the session during the countdown: the ended plan lands, quietly', async () => {
    // The kid's event meets a completed plan: 409 INVALID_FLOW_TRANSITION, not stale
    const ended = plan({
      flowState: 'completed',
      status: 'completed',
      flowVersion: 5,
    } as Partial<SessionPlan>)
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith('/flow-events')
        ? json(409, { code: 'INVALID_FLOW_TRANSITION', error: 'not allowed from completed' })
        : String(url).endsWith('/sessions/plans/plan-1')
          ? json(200, { plan: ended })
          : json(200, { plan: null })
    )
    queryClient.setQueryData(
      sessionPlanKeys.active('p1'),
      plan({ flowState: 'part_transition', flowVersion: 4 })
    )
    const { result } = renderHook(() => useCompletePartTransition(), { wrapper })

    const error = await result.current
      .mutateAsync({
        playerId: 'p1',
        planId: 'plan-1',
        expectedFlowVersion: 4,
        shouldRunBreak: false,
      })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect(isQuietFlowEventFailure(error)).toBe(true)
    // The ended plan, by id (the active query would answer null), not the transition
    expect(queryClient.getQueryData(sessionPlanKeys.active('p1'))).toEqual(ended)
    expect(queryClient.getQueryData(sessionPlanKeys.detail('plan-1'))).toEqual(ended)
  })

  it('a failure that leaves the plan in the transition is not quiet (the kid taps again)', async () => {
    const still = plan({
      flowState: 'part_transition',
      flowVersion: 4,
      status: 'in_progress',
    } as Partial<SessionPlan>)
    fetchMock.mockImplementation(async (url: string) =>
      String(url).endsWith('/flow-events')
        ? json(400, { error: 'bad request' })
        : json(200, { plan: still })
    )
    const { result } = renderHook(() => useCompletePartTransition(), { wrapper })

    const error = await result.current
      .mutateAsync({
        playerId: 'p1',
        planId: 'plan-1',
        expectedFlowVersion: 4,
        shouldRunBreak: false,
      })
      .catch((e: unknown) => e)

    expect(isQuietFlowEventFailure(error)).toBe(false)
    expect(queryClient.getQueryData(sessionPlanKeys.active('p1'))).toEqual(still)
  })
})
