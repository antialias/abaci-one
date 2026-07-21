/**
 * usePrintJobRing — the socket is the ONLY push channel for print-job state
 * (no backstop poll). Pins the reconnect reconcile: every connect edge fires
 * exactly one roster invalidate so rings missed while disconnected are
 * repaired, and rings invalidate roster + job + filament keys.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PRINT_JOB_UPDATED_EVENT } from '@/lib/abacus/print/ring-events'
import { abacusPrintKeys } from '@/lib/queryKeys'
import { usePrintJobRing } from '../usePrintJobRing'

const handlers = new Map<string, (data?: unknown) => void>()
const mockSocket = {
  on: vi.fn((event: string, handler: (data?: unknown) => void): void => {
    handlers.set(event, handler)
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
}

vi.mock('@/lib/socket', () => ({
  createSocket: vi.fn(() => mockSocket),
}))

let queryClient: QueryClient
let invalidateSpy: ReturnType<typeof vi.fn<[], Promise<void>>>

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('usePrintJobRing', () => {
  beforeEach(() => {
    handlers.clear()
    mockSocket.on.mockClear()
    mockSocket.emit.mockClear()
    mockSocket.disconnect.mockClear()
    queryClient = new QueryClient()
    invalidateSpy = vi.fn(async () => {})
    queryClient.invalidateQueries = invalidateSpy as QueryClient['invalidateQueries']
  })

  it('does not connect without a userId', () => {
    renderHook(() => usePrintJobRing(undefined), { wrapper })
    expect(mockSocket.on).not.toHaveBeenCalled()
  })

  it('fires exactly one roster reconcile per connect edge', () => {
    renderHook(() => usePrintJobRing('user-1'), { wrapper })

    handlers.get('connect')?.()
    expect(mockSocket.emit).toHaveBeenCalledWith('join-user-channel', { userId: 'user-1' })
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: abacusPrintKeys.jobs() })

    // A drop + reconnect reconciles again — once per edge, no timers involved.
    handlers.get('disconnect')?.()
    handlers.get('connect')?.()
    expect(invalidateSpy).toHaveBeenCalledTimes(2)
  })

  it('a ring invalidates roster, job, and filament keys', () => {
    renderHook(() => usePrintJobRing('user-1'), { wrapper })

    handlers.get(PRINT_JOB_UPDATED_EVENT)?.({ jobId: 'job-9', printerId: 'printer-2' })

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: abacusPrintKeys.jobs() })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: abacusPrintKeys.job('job-9') })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: abacusPrintKeys.filaments('printer-2'),
    })
  })
})
