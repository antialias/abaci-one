import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PairingArtifactError, pairWithService, parsePairingArtifact } from '../pairing'
import { PrintServiceError } from '../print-service-fetch'

describe('parsePairingArtifact', () => {
  it('splits CODE@host and defaults to https', () => {
    expect(parsePairingArtifact('A5DV9NPG@things.haunt.house')).toEqual({
      code: 'A5DV9NPG',
      origin: 'https://things.haunt.house',
    })
  })

  it('splits on the LAST @ (codes are opaque and may contain @)', () => {
    expect(parsePairingArtifact('we@ird@code@things.haunt.house')).toEqual({
      code: 'we@ird@code',
      origin: 'https://things.haunt.house',
    })
  })

  it('preserves an explicit scheme and port', () => {
    expect(parsePairingArtifact('CODE@http://192.168.86.202:8080')).toEqual({
      code: 'CODE',
      origin: 'http://192.168.86.202:8080',
    })
  })

  it('trims surrounding whitespace', () => {
    expect(parsePairingArtifact('  CODE@things.haunt.house \n')).toEqual({
      code: 'CODE',
      origin: 'https://things.haunt.house',
    })
  })

  it('rejects input without both sides of an @', () => {
    for (const bad of ['nocode', '@host.only', 'code@', '@', '']) {
      expect(() => parsePairingArtifact(bad)).toThrow(PairingArtifactError)
    }
  })

  it('rejects hosts carrying a path or query', () => {
    expect(() => parsePairingArtifact('CODE@things.haunt.house/admin')).toThrow(
      PairingArtifactError
    )
    expect(() => parsePairingArtifact('CODE@things.haunt.house?x=1')).toThrow(PairingArtifactError)
  })
})

describe('pairWithService', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs {code, name} to /pair without auth and returns the token', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ token: 'durable-token' })))

    const result = await pairWithService({
      origin: 'https://things.haunt.house',
      code: 'CODE',
      clientName: 'abaci.one (u@example.com)',
    })

    expect(result).toEqual({ token: 'durable-token' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://things.haunt.house/api/print/v1/pair')
    expect(init.method).toBe('POST')
    expect((init.headers as Headers).has('Authorization')).toBe(false)
    expect(JSON.parse(init.body)).toEqual({ code: 'CODE', name: 'abaci.one (u@example.com)' })
  })

  it('surfaces the service error envelope for a bad code', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: { code: 'invalid_code', message: 'expired' } }), {
        status: 400,
      })
    )
    const err = await pairWithService({
      origin: 'https://things.haunt.house',
      code: 'STALE',
      clientName: 'abaci.one',
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PrintServiceError)
    expect(err.code).toBe('invalid_code')
  })

  it('treats a 200 without a token as bad_response', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true })))
    const err = await pairWithService({
      origin: 'https://things.haunt.house',
      code: 'CODE',
      clientName: 'abaci.one',
    }).catch((e) => e)
    expect(err).toBeInstanceOf(PrintServiceError)
    expect(err.code).toBe('bad_response')
  })
})
