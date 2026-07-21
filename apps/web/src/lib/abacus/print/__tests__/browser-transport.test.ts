/**
 * Browser transport adapter tests (#9): the connectionId selector rides as a
 * query param on every URL shape, the session path stays cookie'd and
 * cache-bypassed, and only real AbortSignals reach the DOM fetch.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProxyTransportFetch } from '../browser-transport'

function stubFetch(status = 200) {
  // 204/304 are null-body statuses — the Response constructor rejects a body there.
  const response = new Response(status === 204 || status === 304 ? null : '{}', { status })
  const mock = vi.fn(async (_url: string, _init?: RequestInit) => response)
  vi.stubGlobal('fetch', mock)
  return { mock, response }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createProxyTransportFetch', () => {
  it('appends connectionId to a bare URL', async () => {
    const { mock } = stubFetch()
    await createProxyTransportFetch('conn-1')('/api/abacus/print/capabilities')
    expect(mock).toHaveBeenCalledWith(
      '/api/abacus/print/capabilities?connectionId=conn-1',
      expect.anything()
    )
  })

  it('appends with & when the URL already has a query', async () => {
    const { mock } = stubFetch()
    await createProxyTransportFetch('conn-1')('/api/abacus/print/jobs?limit=5')
    expect(mock).toHaveBeenCalledWith(
      '/api/abacus/print/jobs?limit=5&connectionId=conn-1',
      expect.anything()
    )
  })

  it('URL-encodes the connection id', async () => {
    const { mock } = stubFetch()
    await createProxyTransportFetch('a b&c')('/x')
    expect(mock).toHaveBeenCalledWith('/x?connectionId=a%20b%26c', expect.anything())
  })

  it('leaves the URL alone when no connection is selected (sole-connection fallback)', async () => {
    const { mock } = stubFetch()
    await createProxyTransportFetch()('/api/abacus/print/capabilities')
    expect(mock).toHaveBeenCalledWith('/api/abacus/print/capabilities', expect.anything())
  })

  it('sends cookies and bypasses the HTTP cache (the kit owns ETag revalidation)', async () => {
    const { mock } = stubFetch()
    await createProxyTransportFetch('conn-1')('/x', {
      method: 'GET',
      headers: { 'if-none-match': 'W/"abc"' },
    })
    expect(mock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'GET',
        headers: { 'if-none-match': 'W/"abc"' },
        credentials: 'same-origin',
        cache: 'no-store',
      })
    )
  })

  it('forwards a real AbortSignal and drops a structural one', async () => {
    const { mock } = stubFetch()
    const real = new AbortController().signal
    const transport = createProxyTransportFetch('conn-1')

    await transport('/x', { signal: real })
    expect(mock.mock.calls[0][1]).toMatchObject({ signal: real })

    const structural = {
      aborted: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }
    await transport('/x', { signal: structural })
    expect(mock.mock.calls[1][1]).toMatchObject({ signal: undefined })
  })

  it('returns the Response as-is (it satisfies TransportResponse structurally)', async () => {
    const { response } = stubFetch(304)
    const result = await createProxyTransportFetch('conn-1')('/x')
    expect(result).toBe(response)
    expect(result.status).toBe(304)
  })
})
