/**
 * useFilamentPlan (Gitea #37) — the cache contract for THH's advisory planner.
 *
 * The authority swap made a synchronous local match into a network read, and the
 * user's directive on that was: async everywhere, correctness carried by keying
 * and invalidation rather than by purity. So this file tests the keying and the
 * invalidation, which is where that correctness now lives:
 *
 *   • the key names BOTH inputs the answer depends on — the request bytes and the
 *     roster bytes — so a cached plan can be stale-by-eviction but never wrong
 *   • equal questions share one fetch (the pinned/unpinned pair costs one request
 *     until a pin actually differs)
 *   • the read never fires against a roster we haven't seen
 *   • failures degrade to a reason, never to a throw or an endless spinner
 *   • a key change holds the previous answer rather than blanking the studio
 *   • a coded refusal ({detail:{code,message}}) is carried with the service's
 *     own words, not collapsed into a status — told apart by SHAPE, because the
 *     proxy's own 4xx wear a different envelope
 */
import type { FilamentPlanRequestV1 } from '@eink/print-dialog'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'
import { useFilamentPlan } from '../useFilamentPlan'

vi.mock('@/lib/queryClient', () => ({ api: vi.fn() }))
const mockApi = vi.mocked(api)

const request = (colorHex: string): FilamentPlanRequestV1 => ({
  schemaVersion: 1,
  palette: [{ id: 'frame', colorHex, roleSignals: ['model'] }],
})

const planBody = (slotId: string) => ({
  contractVersion: 'filament-plan/v1',
  plannerVersion: '1.0.0',
  printerId: 'p1',
  rosterFingerprint: 'rf-1',
  status: 'satisfied',
  assignments: [
    {
      paletteId: 'frame',
      status: 'matched',
      filament: {
        slotId,
        external: false,
        family: 'PLA',
        supportKind: null,
        colorHex: '#101010',
        brand: null,
        product: null,
        profileKey: null,
        remainingPct: null,
      },
      deltaE00: 0,
      reasons: [],
      relaxations: [],
    },
  ],
  warnings: [],
})

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response
}
function err(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response
}
/** A THH-minted refusal, relayed byte-faithfully by the proxy. */
function refusal(status: number, code: string, message: string): Response {
  return { ok: false, status, json: async () => ({ detail: { code, message } }) } as unknown as Response
}

let queryClient: QueryClient
beforeEach(() => {
  mockApi.mockReset()
  mockApi.mockResolvedValue(ok(planBody('0.1')))
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const base = { printerId: 'p1', request: request('#123456'), rosterSignature: 'roster-a' }

describe('useFilamentPlan — the read', () => {
  it('POSTs the request to the printer-scoped proxy route and returns the plan', async () => {
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    expect(result.current.plan?.assignments[0].filament?.slotId).toBe('0.1')
    const [path, init] = mockApi.mock.calls[0]
    expect(path).toBe('abacus/print/printers/p1/filament-plan')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual(base.request)
  })

  it('passes the connection through as a query param when one is selected', async () => {
    const { result } = renderHook(
      () => useFilamentPlan({ ...base, connectionId: 'c 1' }),
      { wrapper }
    )
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    expect(mockApi.mock.calls[0][0]).toBe('abacus/print/printers/p1/filament-plan?connectionId=c%201')
  })
})

describe('useFilamentPlan — when it refuses to ask', () => {
  const silent = async (over: Parameters<typeof useFilamentPlan>[0]) => {
    const { result } = renderHook(() => useFilamentPlan(over), { wrapper })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(mockApi).not.toHaveBeenCalled()
    expect(result.current.plan).toBeNull()
  }

  it('does not ask before a printer is discovered', () => silent({ ...base, printerId: null }))

  it('does not ask when there is nothing to plan', () => silent({ ...base, request: null }))

  it('does not ask against a roster it has not seen', () =>
    // An empty signature is "the roster read hasn't landed", which the key cannot
    // distinguish from "a roster with nothing loaded" — so the plan would be cached
    // under a key that means two different things.
    silent({ ...base, rosterSignature: '' }))

  it('does not ask when the caller has the print path disabled', () =>
    silent({ ...base, enabled: false }))
})

describe('useFilamentPlan — keying', () => {
  it('names both the request and the roster, so neither can change unnoticed', () => {
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    expect(result.current).toBeDefined()
    const key = queryClient.getQueryCache().getAll()[0].queryKey as readonly unknown[]
    expect(key).toEqual(
      abacusPrintKeys.filamentPlan('p1', JSON.stringify(base.request), 'roster-a', undefined)
    )
    // and it sits under the print prefix, so a connection switch or a manual
    // refresh busting `abacusPrintKeys.all` reaches it
    expect(key.slice(0, abacusPrintKeys.all.length)).toEqual([...abacusPrintKeys.all])
  })

  it('re-asks when the DESIGN changes', async () => {
    const { result, rerender } = renderHook((props: { colorHex: string }) =>
      useFilamentPlan({ ...base, request: request(props.colorHex) }), {
      wrapper,
      initialProps: { colorHex: '#123456' },
    })
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    expect(mockApi).toHaveBeenCalledTimes(1)
    rerender({ colorHex: '#abcdef' })
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2))
  })

  it('re-asks when the ROSTER changes, without anyone invalidating anything', async () => {
    // The invalidation story: nothing busts this query on a spool change. The
    // roster read refetches, its raw rows produce a new signature, and the plan
    // moves to a different key on its own.
    const { result, rerender } = renderHook((props: { sig: string }) =>
      useFilamentPlan({ ...base, rosterSignature: props.sig }), {
      wrapper,
      initialProps: { sig: 'roster-a' },
    })
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    rerender({ sig: 'roster-b' })
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2))
  })

  it('does NOT re-ask for a question it has already answered', async () => {
    const { result, rerender } = renderHook((props: { sig: string }) =>
      useFilamentPlan({ ...base, rosterSignature: props.sig }), {
      wrapper,
      initialProps: { sig: 'roster-a' },
    })
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    rerender({ sig: 'roster-b' })
    await waitFor(() => expect(mockApi).toHaveBeenCalledTimes(2))
    rerender({ sig: 'roster-a' })
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    // back to a key already in cache: no third request, and staleTime is Infinity
    // so nothing refetches behind it either
    expect(mockApi).toHaveBeenCalledTimes(2)
  })

  it('two identical questions share ONE fetch', async () => {
    // The studio asks twice — "with my pins" and "what would you pick" — and with
    // nothing pinned those are byte-equal requests. Equal keys are what make the
    // second query free rather than a duplicate round trip.
    const { result } = renderHook(
      () => [useFilamentPlan(base), useFilamentPlan(base)] as const,
      { wrapper }
    )
    await waitFor(() => expect(result.current[0].plan).not.toBeNull())
    expect(result.current[1].plan).not.toBeNull()
    expect(mockApi).toHaveBeenCalledTimes(1)
  })
})

describe('useFilamentPlan — holding the previous answer', () => {
  it('keeps the last plan on screen while a new key resolves', async () => {
    const { result, rerender } = renderHook((props: { sig: string }) =>
      useFilamentPlan({ ...base, rosterSignature: props.sig }), {
      wrapper,
      initialProps: { sig: 'roster-a' },
    })
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    expect(result.current.isPlaceholder).toBe(false)

    // second answer differs, and resolves only when we let it
    let release: (() => void) | undefined
    mockApi.mockImplementation(
      () => new Promise<Response>((r) => { release = () => r(ok(planBody('0.2'))) })
    )
    rerender({ sig: 'roster-b' })

    // the studio does not blank: the old assignment is still there, flagged as held
    await waitFor(() => expect(result.current.isPlaceholder).toBe(true))
    expect(result.current.plan?.assignments[0].filament?.slotId).toBe('0.1')

    release?.()
    await waitFor(() => expect(result.current.plan?.assignments[0].filament?.slotId).toBe('0.2'))
    expect(result.current.isPlaceholder).toBe(false)
  })
})

describe('useFilamentPlan — degrading', () => {
  it.each([
    [404, 'not-configured'],
    [502, 'unreachable'],
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [400, 'error'], // an UNSTRUCTURED 400 — no {detail} envelope, so no refusal
    [500, 'error'],
  ])('turns HTTP %i into the %s reason, never a throw', async (status, reason) => {
    mockApi.mockResolvedValue(err(status as number))
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.unavailable).toBe(reason))
    expect(result.current.plan).toBeNull()
    // and it settles — never a spinner with no way out
    expect(result.current.isLoading).toBe(false)
  })

  it('degrades a body that is not a plan rather than consuming it as assignments', async () => {
    // A proxy error page or a stray HTML body must not reach `materialize` as an
    // assignment list. `readFilamentPlanResponse` is the boundary guard.
    mockApi.mockResolvedValue(ok({ hello: 'world' }))
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.unavailable).toBe('error'))
    expect(result.current.plan).toBeNull()
  })

  it('degrades a transport failure', async () => {
    mockApi.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.unavailable).toBe('error'))
  })

  it('a degraded PLAN is not a failure — it is a 200 the studio renders as warnings', async () => {
    mockApi.mockResolvedValue(ok({ ...planBody('0.1'), status: 'degraded' }))
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    expect(result.current.plan?.status).toBe('degraded')
    expect(result.current.unavailable).toBeNull()
  })
})

describe('useFilamentPlan — a refusal is not a failure', () => {
  it("a coded 4xx becomes 'refused' and carries the service's words", async () => {
    mockApi.mockResolvedValue(
      refusal(400, 'palette_too_large', 'palette supports at most 8 entries')
    )
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.unavailable).toBe('refused'))
    expect(result.current.unavailableDetail).toBe('palette supports at most 8 entries')
    expect(result.current.plan).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })

  it("a 400 the PROXY emitted (ambiguous connection) stays 'error'", async () => {
    // Shape, not status: the proxy's own failures are {error: string}, and an
    // ambiguous connection needs the Settings remediation, not refusal copy.
    mockApi.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Multiple connections — pass ?connectionId=' }),
    } as unknown as Response)
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.unavailable).toBe('error'))
    expect(result.current.unavailableDetail).toBeNull()
  })

  it("a coded 401 is still 'unauthorized' — an expired token is not a refusal", async () => {
    // THH relays its auth failures in the SAME {detail:{code,message}} envelope.
    // Classifying by shape alone would eat the re-pair remediation.
    mockApi.mockResolvedValue(refusal(401, 'unauthorized', 'token expired'))
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.unavailable).toBe('unauthorized'))
    expect(result.current.unavailableDetail).toBeNull()
  })

  it('a non-JSON error body still degrades by status', async () => {
    // A 502 whose body is an HTML error page must stay 'unreachable' — the body
    // read is guarded on its own, not left to the outer catch.
    mockApi.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)
    const { result } = renderHook(() => useFilamentPlan(base), { wrapper })
    await waitFor(() => expect(result.current.unavailable).toBe('unreachable'))
  })

  it('a refusal clears when a new question is answered', async () => {
    mockApi.mockResolvedValue(
      refusal(400, 'palette_too_large', 'palette supports at most 8 entries')
    )
    const { result, rerender } = renderHook((props: { sig: string }) =>
      useFilamentPlan({ ...base, rosterSignature: props.sig }), {
      wrapper,
      initialProps: { sig: 'roster-a' },
    })
    await waitFor(() => expect(result.current.unavailable).toBe('refused'))

    mockApi.mockResolvedValue(ok(planBody('0.1')))
    rerender({ sig: 'roster-b' })
    await waitFor(() => expect(result.current.plan).not.toBeNull())
    // reason and detail come off the same query.data, so both clear together —
    // no stale sentence can survive a success
    expect(result.current.unavailable).toBeNull()
    expect(result.current.unavailableDetail).toBeNull()
  })
})
