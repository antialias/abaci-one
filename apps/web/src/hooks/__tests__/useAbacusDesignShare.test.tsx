/**
 * useAbacusDesignShare (Gitea #24) — pins the distinction the UI's honesty
 * rests on: a 404 ("not yours") and a failed request are NOT the same answer.
 * Collapsing them is what made the studio tell a stranger reading a shared
 * design that only they could open it, and made one flaky response render an
 * owner's shared design as private with no way to revoke it.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAbacusDesignShare } from '../useAbacusDesignShare'

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    // the hook supplies its own `retry` predicate — only the backoff is the
    // test's business, so a retry pass doesn't cost seconds
    defaultOptions: { queries: { retryDelay: 0 } },
  })
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const respond = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

describe('useAbacusDesignShare', () => {
  it('reports manageable state for a design that is yours', async () => {
    vi.mocked(global.fetch).mockResolvedValue(respond(200, { shared: true, sharedAt: 1_700_000 }))
    const { result } = renderHook(() => useAbacusDesignShare('dsn-1'), { wrapper })

    await waitFor(() => expect(result.current.access).toBe('manageable'))
    expect(result.current.shared).toBe(true)
    expect(result.current.canShare).toBe(true)
  })

  it('calls a 404 "not-yours" — a settled answer, never retried', async () => {
    vi.mocked(global.fetch).mockResolvedValue(respond(404, { error: 'Design not found' }))
    const { result } = renderHook(() => useAbacusDesignShare('dsn-2'), { wrapper })

    await waitFor(() => expect(result.current.access).toBe('not-yours'))
    expect(result.current.canShare).toBe(false)
    // asking again cannot change the answer, so it must not be asked again
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries a failed request and lands on "unknown", never on a false "private"', async () => {
    vi.mocked(global.fetch).mockResolvedValue(respond(500, { error: 'boom' }))
    const { result } = renderHook(() => useAbacusDesignShare('dsn-3'), { wrapper })

    // gate on the retries, not on `access` — 'unknown' is also the loading
    // state, so asserting it first would pass before anything had happened
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3)) // attempt + two retries
    await waitFor(() => expect(result.current.isError).toBe(false)) // the READ never shouts
    // crucially NOT 'not-yours' and NOT a claim of privacy — the UI must be
    // able to tell "we don't know" from "only you"
    expect(result.current.access).toBe('unknown')
    expect(result.current.canShare).toBe(false)
  })

  it('heals when a retry succeeds — a blip must not latch', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(respond(500, { error: 'boom' }))
      .mockResolvedValue(respond(200, { shared: true, sharedAt: 1_700_000 }))
    const { result } = renderHook(() => useAbacusDesignShare('dsn-4'), { wrapper })

    await waitFor(() => expect(result.current.access).toBe('manageable'))
    expect(result.current.shared).toBe(true)
  })

  it('asks nothing, and claims nothing, with no saved design', () => {
    const { result } = renderHook(() => useAbacusDesignShare(null), { wrapper })
    expect(result.current.access).toBe('unknown')
    expect(result.current.canShare).toBe(false)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
