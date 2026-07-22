/**
 * useAbacusPrintJobs (gh#9) — the roster read + the two resolve actions. Pins
 * the request shapes THH's start/cancel endpoints require (acknowledge list;
 * stopPrint flag) and the single invariant that keeps state fresh without a
 * poll: a successful action invalidates the same roster key the doorbell ring
 * uses, so both converge on one refetch. A refusal throws a PrintServiceError
 * (honest coded copy) and invalidates nothing.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PrintServiceError } from '@/components/create/abacus/print-submit-failure'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'
import { useAbacusPrintJobs, useCancelPrintJob, useStartPrintJob } from '../useAbacusPrintJobs'

vi.mock('@/lib/queryClient', () => ({ api: vi.fn() }))
const mockApi = vi.mocked(api)

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}
function fail(status: number, body: unknown): Response {
  return { ok: false, status, json: async () => body } as unknown as Response
}

let queryClient: QueryClient
let invalidateSpy: ReturnType<typeof vi.fn<[], Promise<void>>>

beforeEach(() => {
  mockApi.mockReset()
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  invalidateSpy = vi.fn(async () => {})
  queryClient.invalidateQueries = invalidateSpy as QueryClient['invalidateQueries']
})

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useStartPrintJob', () => {
  it('posts the acknowledge list and invalidates the roster', async () => {
    mockApi.mockResolvedValue(ok({ jobId: 'j1' }))
    const { result } = renderHook(() => useStartPrintJob(), { wrapper })

    await result.current.mutateAsync({ jobId: 'j1', acknowledge: ['bed_not_clear', 'verdict:x'] })

    expect(mockApi).toHaveBeenCalledWith('abacus/print/jobs/j1/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledge: ['bed_not_clear', 'verdict:x'] }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: abacusPrintKeys.jobs() })
  })

  it('throws a PrintServiceError on refusal and invalidates nothing', async () => {
    mockApi.mockResolvedValue(fail(409, { detail: { code: 'acknowledgement_required' } }))
    const { result } = renderHook(() => useStartPrintJob(), { wrapper })

    await expect(
      result.current.mutateAsync({ jobId: 'j1', acknowledge: [] })
    ).rejects.toBeInstanceOf(PrintServiceError)
    expect(invalidateSpy).not.toHaveBeenCalled()
  })
})

describe('useCancelPrintJob', () => {
  it('posts the stopPrint flag and invalidates the roster', async () => {
    mockApi.mockResolvedValue(ok({}))
    const { result } = renderHook(() => useCancelPrintJob(), { wrapper })

    await result.current.mutateAsync({ jobId: 'j9', stopPrint: true })

    expect(mockApi).toHaveBeenCalledWith('abacus/print/jobs/j9/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopPrint: true }),
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: abacusPrintKeys.jobs() })
  })
})

describe('useAbacusPrintJobs', () => {
  it('reads the proxy roster and returns normalized rows', async () => {
    mockApi.mockResolvedValue(ok({ jobs: [{ jobId: 'j1', phase: 'ready', startPolicy: 'hold' }] }))
    const { result } = renderHook(() => useAbacusPrintJobs({ enabled: true }), { wrapper })

    await waitFor(() => expect(result.current.jobRows).toHaveLength(1))
    expect(mockApi).toHaveBeenCalledWith('abacus/print/jobs')
    expect(result.current.jobRows[0]).toMatchObject({
      id: 'j1',
      phase: 'ready',
      startPolicy: 'hold',
      attention: [],
    })
  })

  it('does not fetch when disabled', () => {
    renderHook(() => useAbacusPrintJobs({ enabled: false }), { wrapper })
    expect(mockApi).not.toHaveBeenCalled()
  })
})
