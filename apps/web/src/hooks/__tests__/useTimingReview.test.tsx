import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { curriculumKeys, timingReviewKeys } from '@/lib/queryKeys'
import type { TimingReviewData } from '@/lib/curriculum/timing/review-types'
import {
  useConfirmTiming,
  useReviewSlotResult,
  useTimingReview,
  useUnconfirmTiming,
} from '../useTimingReview'

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const mockData: TimingReviewData = {
  assessment: {
    avgSecondsPerProblem: 45,
    secondsPerTerm: 15,
    secondsPerProblemExcludingFlagged: null,
    sampleCount: 8,
    isDefault: false,
    tier1Count: 1,
    tier2Count: 0,
    unresolvedCount: 1,
    affectedSessions: [],
    windowSessionCount: 3,
  },
  flagged: [],
  deletedSessions: [],
}

describe('useTimingReview (read)', () => {
  it('fetches the timing-review endpoint for the player', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response)

    const { result } = renderHook(() => useTimingReview('player-1'), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData)
    expect(global.fetch).toHaveBeenCalledWith('/api/curriculum/player-1/timing-review', undefined)
  })

  it('is keyed on timingReviewKeys.detail so mutations invalidate it', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockData,
    } as Response)

    renderHook(() => useTimingReview('player-1'), { wrapper })

    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(queryClient.getQueryData(timingReviewKeys.detail('player-1'))).toEqual(mockData)
  })

  it('does not fetch for an empty playerId', () => {
    const { result } = renderHook(() => useTimingReview(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('surfaces the server error message', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Not authorized' }),
    } as Response)

    const { result } = renderHook(() => useTimingReview('player-1'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error?.message).toBe('Not authorized')
  })
})

describe('useReviewSlotResult (write) invalidates the review cache', () => {
  it('PATCHes the tries route (by tryId, §10 P6b1-12) and invalidates timingReviewKeys.detail', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useReviewSlotResult(), { wrapper })

    result.current.mutate({
      playerId: 'player-1',
      planId: 'session-1',
      tryId: '0b6f6c1e-2f9a-4c3e-9d8a-1f2e3d4c5b6a',
      action: { action: 'confirm_timing' },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/tries/0b6f6c1e-2f9a-4c3e-9d8a-1f2e3d4c5b6a',
      expect.objectContaining({ method: 'PATCH' })
    )
    expect(spy).toHaveBeenCalledWith({ queryKey: timingReviewKeys.detail('player-1') })
  })

  it('an attempt from an older server (no tryId) goes to the index route, never tries/undefined (D9, §10 P6b1-12a)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)

    const { result } = renderHook(() => useReviewSlotResult(), { wrapper })

    // What a pod from before P6b1-12 sends: resultIndex only
    result.current.mutate({
      playerId: 'player-1',
      planId: 'session-1',
      tryId: undefined,
      resultIndex: 3,
      action: { action: 'confirm_timing' },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/results/3',
      expect.objectContaining({ method: 'PATCH' })
    )
  })

  it('with both, the id wins; with neither, nothing is sent', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)

    const { result } = renderHook(() => useReviewSlotResult(), { wrapper })
    result.current.mutate({
      playerId: 'player-1',
      planId: 'session-1',
      tryId: 'legacy:session-1:3',
      resultIndex: 3,
      action: { action: 'confirm_timing' },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/tries/legacy%3Asession-1%3A3',
      expect.objectContaining({ method: 'PATCH' })
    )

    vi.mocked(global.fetch).mockClear()
    const { result: bare } = renderHook(() => useReviewSlotResult(), { wrapper })
    bare.current.mutate({
      playerId: 'player-1',
      planId: 'session-1',
      action: { action: 'confirm_timing' },
    })
    await waitFor(() => expect(bare.current.isError).toBe(true))
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('useConfirmTiming / useUnconfirmTiming (write)', () => {
  it('confirm PATCHes confirm_timing and invalidates the same key families', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
    const spy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useConfirmTiming(), { wrapper })
    result.current.mutate({
      playerId: 'player-1',
      planId: 'session-1',
      tryId: '0b6f6c1e-2f9a-4c3e-9d8a-1f2e3d4c5b6a',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/tries/0b6f6c1e-2f9a-4c3e-9d8a-1f2e3d4c5b6a',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'confirm_timing' }),
      })
    )
    expect(spy).toHaveBeenCalledWith({ queryKey: timingReviewKeys.detail('player-1') })
    expect(spy).toHaveBeenCalledWith({ queryKey: curriculumKeys.detail('player-1') })
  })

  it('unconfirm PATCHes unconfirm_timing', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, json: async () => ({}) } as Response)

    const { result } = renderHook(() => useUnconfirmTiming(), { wrapper })
    result.current.mutate({
      playerId: 'player-1',
      planId: 'session-1',
      tryId: '0b6f6c1e-2f9a-4c3e-9d8a-1f2e3d4c5b6a',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/curriculum/player-1/sessions/plans/session-1/tries/0b6f6c1e-2f9a-4c3e-9d8a-1f2e3d4c5b6a',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ action: 'unconfirm_timing' }),
      })
    )
  })
})
