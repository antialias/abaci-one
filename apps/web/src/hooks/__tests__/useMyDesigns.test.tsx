/**
 * useMyDesigns (Gitea #11) — the client side of "my abacuses".
 *
 * Two things here are load-bearing rather than cosmetic. Removing is a HIDE, so
 * the undo offer has to carry the removed design's NAME (the row it came from is
 * gone by then, and "Removed that design" is a worse sentence than "Removed
 * 'Ada's abacus'"). And un-sharing must NOT drop a row from the list: the design
 * is still yours, and #24's promise is that a public design always has a control
 * naming it — only the server decides whether an un-shared row also leaves.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMyDesigns } from '../useMyDesigns'

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })
  vi.clearAllMocks()
  global.fetch = vi.fn()
})

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

const design = (over: Record<string, unknown> = {}) => ({
  id: 'dsn-1',
  name: null,
  sharedAt: null,
  createdAt: 1_700_000_000_000,
  cols: 13,
  label: 'Mira',
  ...over,
})

const respond = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

/** the initial list load, then whatever the mutations get */
const seed = (designs: unknown[], truncated = false) => {
  vi.mocked(global.fetch).mockResolvedValue(respond(200, { designs, truncated }))
}

const loaded = async (designs: unknown[], truncated = false) => {
  seed(designs, truncated)
  const { result } = renderHook(() => useMyDesigns(), { wrapper })
  await waitFor(() => expect(result.current.designs).toHaveLength(designs.length))
  return result
}

describe('useMyDesigns', () => {
  it('reports the list, its cap, and how much of it is public', async () => {
    const result = await loaded(
      [design(), design({ id: 'dsn-2', sharedAt: 1_700_000_000_000 })],
      true
    )
    expect(result.current.sharedCount).toBe(1)
    expect(result.current.truncated).toBe(true)
  })

  it('survives a list that fails to load', async () => {
    vi.mocked(global.fetch).mockResolvedValue(respond(500, { error: 'boom' }))
    const { result } = renderHook(() => useMyDesigns(), { wrapper })
    await waitFor(() => expect(result.current.designs).toEqual([]))
    expect(result.current.truncated).toBe(false)
  })

  it('renames in place, and PATCHes only the name', async () => {
    const result = await loaded([design({ name: 'Old' })])
    vi.mocked(global.fetch).mockResolvedValue(respond(200, { id: 'dsn-1', name: 'New' }))

    await act(async () => {
      result.current.rename('dsn-1', 'New')
    })

    await waitFor(() => expect(result.current.designs[0].name).toBe('New'))
    const [url, init] = vi.mocked(global.fetch).mock.calls.at(-1) as [string, RequestInit]
    expect(url).toContain('abacus/designs/dsn-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'New' })
  })

  it('removes optimistically and offers it back BY NAME', async () => {
    const result = await loaded([design({ name: 'Ada’s abacus' }), design({ id: 'dsn-2' })])
    vi.mocked(global.fetch).mockResolvedValue(respond(200, { id: 'dsn-1', hidden: true }))

    await act(async () => {
      result.current.remove(result.current.designs[0])
    })

    await waitFor(() => expect(result.current.designs.map((d) => d.id)).toEqual(['dsn-2']))
    // the row is gone, so the OFFER is the only thing left that knows the name
    expect(result.current.undoable).toEqual({ id: 'dsn-1', name: 'Ada’s abacus' })
    const [, init] = vi.mocked(global.fetch).mock.calls.at(-1) as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ hidden: true })
  })

  it('undo un-hides and clears the offer', async () => {
    const result = await loaded([design({ name: 'Ada’s abacus' })])
    vi.mocked(global.fetch).mockResolvedValue(respond(200, {}))
    await act(async () => {
      result.current.remove(result.current.designs[0])
    })
    await waitFor(() => expect(result.current.undoable).not.toBeNull())

    seed([design({ name: 'Ada’s abacus' })])
    await act(async () => {
      result.current.undoRemove('dsn-1')
    })

    await waitFor(() => expect(result.current.undoable).toBeNull())
    await waitFor(() => expect(result.current.designs).toHaveLength(1))
    const patches = vi
      .mocked(global.fetch)
      .mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PATCH')
    expect(JSON.parse(patches.at(-1)?.[1]?.body as string)).toEqual({ hidden: false })
  })

  it('keeps a row after un-sharing it — un-share is not remove', async () => {
    const result = await loaded([design({ sharedAt: 1_700_000_000_000 })])
    // the DELETE, then the refetch it triggers: the server stays authoritative
    // about whether an un-shared row also LEAVES the list (it does only if the
    // row was hidden too), so the hook must not decide that for itself
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(respond(200, { shared: false, sharedAt: null }))
      .mockResolvedValue(respond(200, { designs: [design({ sharedAt: null })], truncated: false }))

    await act(async () => {
      result.current.unshare('dsn-1')
    })

    await waitFor(() => expect(result.current.designs[0]?.sharedAt).toBeNull())
    expect(result.current.designs).toHaveLength(1)
    const deletes = vi
      .mocked(global.fetch)
      .mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE')
    expect(deletes).toHaveLength(1)
    expect(deletes[0][0]).toContain('abacus/designs/dsn-1/share')
  })

  it('surfaces a failed removal without dropping the row', async () => {
    const result = await loaded([design({ name: 'Ada’s abacus' })])
    vi.mocked(global.fetch).mockResolvedValue(respond(500, { error: 'boom' }))

    await act(async () => {
      result.current.remove(result.current.designs[0])
    })

    await waitFor(() => expect(result.current.removeFailed).toBe(true))
    expect(result.current.designs).toHaveLength(1)
    expect(result.current.undoable).toBeNull()
  })
})
