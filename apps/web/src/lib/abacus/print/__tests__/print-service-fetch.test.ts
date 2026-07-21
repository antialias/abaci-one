import { randomBytes } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { seal } from '@/lib/secret-box'
import {
  PRINT_SERVICE_BASE_PATH,
  PrintServiceError,
  ensureOk,
  printServiceFetch,
} from '../print-service-fetch'

const KEY = randomBytes(32).toString('base64')

describe('printServiceFetch', () => {
  let savedKey: string | undefined
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    savedKey = process.env.SECRET_BOX_KEY
    process.env.SECRET_BOX_KEY = KEY
    fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    if (savedKey === undefined) delete process.env.SECRET_BOX_KEY
    else process.env.SECRET_BOX_KEY = savedKey
    vi.unstubAllGlobals()
  })

  it('hits ${origin}/api/print/v1${path} with the unsealed bearer token', async () => {
    await printServiceFetch(
      { origin: 'https://things.haunt.house', tokenSealed: seal('the-token') },
      '/printers'
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`https://things.haunt.house${PRINT_SERVICE_BASE_PATH}/printers`)
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer the-token')
    expect(init.cache).toBe('no-store')
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('tolerates a trailing slash on the origin', async () => {
    await printServiceFetch(
      { origin: 'https://things.haunt.house/', tokenSealed: seal('t') },
      '/jobs'
    )
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://things.haunt.house${PRINT_SERVICE_BASE_PATH}/jobs`
    )
  })

  it('sends no Authorization header when tokenSealed is absent (pairing)', async () => {
    await printServiceFetch({ origin: 'https://things.haunt.house' }, '/pair', {
      method: 'POST',
      body: JSON.stringify({ code: 'x' }),
    })
    const [, init] = fetchMock.mock.calls[0]
    expect((init.headers as Headers).has('Authorization')).toBe(false)
    expect(init.method).toBe('POST')
  })

  it('preserves caller headers alongside the injected ones', async () => {
    await printServiceFetch(
      { origin: 'https://things.haunt.house', tokenSealed: seal('t') },
      '/capabilities',
      { headers: { 'If-None-Match': '"abc"' } }
    )
    const headers = fetchMock.mock.calls[0][1].headers as Headers
    expect(headers.get('If-None-Match')).toBe('"abc"')
    expect(headers.get('Authorization')).toBe('Bearer t')
  })

  it('returns non-2xx responses raw (proxy pass-through)', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 304 }))
    const res = await printServiceFetch(
      { origin: 'https://things.haunt.house', tokenSealed: seal('t') },
      '/capabilities'
    )
    expect(res.status).toBe(304)
  })

  it('normalizes network failure into PrintServiceError(0, unreachable)', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const err = await printServiceFetch(
      { origin: 'https://things.haunt.house', tokenSealed: seal('t') },
      '/printers'
    ).catch((e) => e)
    expect(err).toBeInstanceOf(PrintServiceError)
    expect(err.status).toBe(0)
    expect(err.code).toBe('unreachable')
    expect(err.message).toContain('fetch failed')
  })

  it('normalizes timeout aborts the same way', async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new DOMException('The operation timed out.', 'TimeoutError'))
    )
    const err = await printServiceFetch(
      { origin: 'https://things.haunt.house', tokenSealed: seal('t') },
      '/printers'
    ).catch((e) => e)
    expect(err).toBeInstanceOf(PrintServiceError)
    expect(err.code).toBe('unreachable')
  })
})

describe('ensureOk', () => {
  it('passes ok responses through untouched', async () => {
    const res = new Response('{"printers":[]}', { status: 200 })
    expect(await ensureOk(res)).toBe(res)
  })

  it("parses the service's {detail:{code,message}} envelope", async () => {
    const res = new Response(
      JSON.stringify({ detail: { code: 'invalid_style', message: 'unknown key: brim' } }),
      { status: 400 }
    )
    const err = await ensureOk(res).catch((e) => e)
    expect(err).toBeInstanceOf(PrintServiceError)
    expect(err.status).toBe(400)
    expect(err.code).toBe('invalid_style')
    expect(err.message).toBe('unknown key: brim')
  })

  it('falls back to bad_response for non-JSON error bodies', async () => {
    const res = new Response('<html>502 Bad Gateway</html>', { status: 502 })
    const err = await ensureOk(res).catch((e) => e)
    expect(err).toBeInstanceOf(PrintServiceError)
    expect(err.status).toBe(502)
    expect(err.code).toBe('bad_response')
    expect(err.message).toBe('print service returned 502')
  })

  it('falls back to bad_response for JSON without the envelope', async () => {
    const res = new Response(JSON.stringify({ error: 'nope' }), { status: 401 })
    const err = await ensureOk(res).catch((e) => e)
    expect(err.status).toBe(401)
    expect(err.code).toBe('bad_response')
  })
})
