import { describe, expect, it } from 'vitest'
// print-client.ts opens with `import 'server-only'`, which vitest resolves to an
// empty stub via the alias in vitest.config.ts — so the orchestration below is
// unit-testable; the client-bundle poisoning only matters for the real bundler.
import { getLoadedFilaments } from '../print-client'

type MockRes = { status: number; json: () => Promise<unknown> }
const res = (status: number, body: unknown): MockRes => ({ status, json: async () => body })

const PRINTERS = [
  { id: 'p0', multiMaterial: false },
  { id: 'x1c', multiMaterial: true },
]
const FILAMENTS = {
  printerId: 'x1c',
  filaments: [
    { slotId: '0.1', family: 'PLA', colorHex: 'A0A0A0FF', brand: 'Bambu Lab', product: 'PLA Basic' },
  ],
}

// Route by URL so a test can answer /printers and /filaments independently.
const routed =
  (h: { printers?: (url: string) => MockRes; filaments?: (url: string) => MockRes }) =>
  (async (url: string) => {
    if (url.includes('/filaments')) return h.filaments?.(url) ?? res(200, FILAMENTS)
    if (url.includes('/printers')) return h.printers?.(url) ?? res(200, PRINTERS)
    throw new Error(`unexpected url ${url}`)
  }) as unknown as typeof fetch

const TOKEN = { THH_PRINT_TOKEN: 't' }

describe('getLoadedFilaments', () => {
  it('reports not-configured (and never fetches) when no token is set', async () => {
    const fetchImpl = (() => {
      throw new Error('should not fetch without a token')
    }) as unknown as typeof fetch
    expect(await getLoadedFilaments({ env: {}, fetchImpl })).toEqual({
      ok: false,
      reason: 'not-configured',
    })
  })

  it('discovers the multi-material printer, then returns its loaded filaments', async () => {
    const calls: string[] = []
    const fetchImpl = (async (url: string) => {
      calls.push(url)
      return url.includes('/filaments') ? res(200, FILAMENTS) : res(200, PRINTERS)
    }) as unknown as typeof fetch

    const r = await getLoadedFilaments({ env: TOKEN, fetchImpl })
    expect(r.ok).toBe(true)
    if (!r.ok) throw new Error('expected ok')
    expect(r.printerId).toBe('x1c') // the multiMaterial row, not p0
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].slotId).toBe('0.1')
    expect(Number.isNaN(Date.parse(r.fetchedAt))).toBe(false)
    expect(calls[0]).toContain('/api/print/v1/printers')
    expect(calls[1]).toContain('/api/print/v1/printers/x1c/filaments')
  })

  it('honors THH_PRINT_PRINTER_ID and skips discovery', async () => {
    const calls: string[] = []
    const fetchImpl = (async (url: string) => {
      calls.push(url)
      return res(200, FILAMENTS)
    }) as unknown as typeof fetch

    const r = await getLoadedFilaments({
      env: { ...TOKEN, THH_PRINT_PRINTER_ID: 'x1c' },
      fetchImpl,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.printerId).toBe('x1c')
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain('/printers/x1c/filaments')
  })

  it('targets THH_PRINT_ORIGIN with the trailing slash trimmed', async () => {
    let seen = ''
    const fetchImpl = (async (url: string) => {
      seen = url
      return res(200, FILAMENTS)
    }) as unknown as typeof fetch

    await getLoadedFilaments({
      env: { ...TOKEN, THH_PRINT_PRINTER_ID: 'x1c', THH_PRINT_ORIGIN: 'http://lan:8080/' },
      fetchImpl,
    })
    expect(seen).toBe('http://lan:8080/api/print/v1/printers/x1c/filaments')
  })

  it('maps 401 to unauthorized', async () => {
    const fetchImpl = routed({ printers: () => res(401, { error: 'no' }) })
    expect(await getLoadedFilaments({ env: TOKEN, fetchImpl })).toEqual({
      ok: false,
      reason: 'unauthorized',
    })
  })

  it('maps a 5xx to unreachable', async () => {
    const fetchImpl = routed({ printers: () => res(503, {}) })
    expect(await getLoadedFilaments({ env: TOKEN, fetchImpl })).toEqual({
      ok: false,
      reason: 'unreachable',
    })
  })

  it('maps a thrown (network) request to unreachable', async () => {
    const fetchImpl = routed({
      filaments: () => {
        throw new Error('ECONNREFUSED')
      },
    })
    expect(await getLoadedFilaments({ env: TOKEN, fetchImpl })).toEqual({
      ok: false,
      reason: 'unreachable',
    })
  })

  it('reports no-printer when discovery returns an empty list', async () => {
    const fetchImpl = routed({ printers: () => res(200, []) })
    expect(await getLoadedFilaments({ env: TOKEN, fetchImpl })).toEqual({
      ok: false,
      reason: 'no-printer',
    })
  })

  it('maps a 404 on the filaments endpoint to no-printer', async () => {
    const fetchImpl = routed({ filaments: () => res(404, {}) })
    expect(await getLoadedFilaments({ env: TOKEN, fetchImpl })).toEqual({
      ok: false,
      reason: 'no-printer',
    })
  })

  it('maps a non-array printers body to bad-response', async () => {
    const fetchImpl = routed({ printers: () => res(200, { nope: true }) })
    expect(await getLoadedFilaments({ env: TOKEN, fetchImpl })).toEqual({
      ok: false,
      reason: 'bad-response',
    })
  })

  it('accepts a bare filaments array (no {filaments:[…]} envelope)', async () => {
    const fetchImpl = routed({ filaments: () => res(200, FILAMENTS.filaments) })
    const r = await getLoadedFilaments({ env: { ...TOKEN, THH_PRINT_PRINTER_ID: 'x1c' }, fetchImpl })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.rows).toHaveLength(1)
  })
})
