// @vitest-environment node

import { createHmac } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { kidSongsDoorbellAttemptsTotal, kidSongsDoorbellRingsTotal } from '@/lib/metrics'
import { ringKidSongsDoorbell } from '../doorbell'

const URL = 'http://192.168.86.51:9117/v1/abaci-song-sync'
const SECRET = 'a'.repeat(32)

function response(status: number): Response {
  return { status } as Response
}

/** Reads one counter sample out of prom-client rather than trusting a spy. */
async function rings(): Promise<Record<string, number>> {
  const { values } = await kidSongsDoorbellRingsTotal.get()
  return Object.fromEntries(values.map((sample) => [String(sample.labels.outcome), sample.value]))
}

async function attempts(): Promise<number> {
  const { values } = await kidSongsDoorbellAttemptsTotal.get()
  return values[0]?.value ?? 0
}

describe('ringKidSongsDoorbell', () => {
  const originalEnvironment = { ...process.env }
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    kidSongsDoorbellRingsTotal.reset()
    kidSongsDoorbellAttemptsTotal.reset()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-30T12:00:00Z'))
    process.env.KID_SONGS_DOORBELL_URL = URL
    process.env.KID_SONGS_DOORBELL_SECRET = SECRET
    fetchMock = vi.fn().mockResolvedValue(response(202))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    process.env = { ...originalEnvironment }
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('sends compact JSON with a matching HMAC and a two-second timeout', async () => {
    await ringKidSongsDoorbell()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(URL)
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"timestamp":1788091200}')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-Abaci-Signature': `sha256=${createHmac('sha256', SECRET).update(init.body as string).digest('hex')}`,
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('silently does nothing when the URL is absent', async () => {
    delete process.env.KID_SONGS_DOORBELL_URL
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await ringKidSongsDoorbell()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(warning).not.toHaveBeenCalled()
  })

  it.each([
    ['wrong URL', 'http://example.test/', SECRET],
    ['short secret', URL, 'too-short'],
    ['missing secret', URL, undefined],
  ])('warns and returns for %s', async (_name, url, secret) => {
    process.env.KID_SONGS_DOORBELL_URL = url
    if (secret === undefined) delete process.env.KID_SONGS_DOORBELL_SECRET
    else process.env.KID_SONGS_DOORBELL_SECRET = secret
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await ringKidSongsDoorbell()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(warning).toHaveBeenCalledTimes(1)
  })

  it('stops without retrying on a nonretryable 4xx', async () => {
    fetchMock.mockResolvedValue(response(401))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await ringKidSongsDoorbell()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalledWith('[kid-songs-doorbell] Delivery rejected with HTTP 401')
  })

  it.each([408, 425, 429, 500, 503])('retries HTTP %s after exactly 1 second', async (status) => {
    fetchMock.mockResolvedValueOnce(response(status)).mockResolvedValueOnce(response(202))

    const delivery = ringKidSongsDoorbell()
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    await delivery

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives each request a two-second abort deadline', async () => {
    vi.useRealTimers()
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      expect(init.signal).toBeDefined()
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true })
      })
    })
    fetchMock.mockResolvedValueOnce(response(202))

    const startedAt = Date.now()
    await ringKidSongsDoorbell()

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(2_000)
    expect(Date.now() - startedAt).toBeLessThan(3_500)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 5_000)

  it('retries network failures and uses delays of one then three seconds', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const delivery = ringKidSongsDoorbell()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(2_999)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    await delivery

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(warning).toHaveBeenCalledTimes(1)
  })

  it('creates a fresh timestamp, body, HMAC, and abort signal for every retry', async () => {
    fetchMock.mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(503)).mockResolvedValue(response(202))

    const delivery = ringKidSongsDoorbell()
    await vi.advanceTimersByTimeAsync(1_000)
    await vi.advanceTimersByTimeAsync(3_000)
    await delivery

    const requests = fetchMock.mock.calls.map(([, init]) => init as RequestInit)
    expect(requests.map((request) => request.body)).toEqual([
      '{"timestamp":1788091200}',
      '{"timestamp":1788091201}',
      '{"timestamp":1788091204}',
    ])
    expect(new Set(requests.map((request) => request.signal)).size).toBe(3)
    for (const request of requests) {
      expect((request.headers as Record<string, string>)['X-Abaci-Signature']).toBe(
        `sha256=${createHmac('sha256', SECRET).update(request.body as string).digest('hex')}`
      )
    }
  })

  it('never rejects even when fetch and warning logging throw', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'warn').mockImplementation(() => {
      throw new Error('logger failed')
    })

    const delivery = ringKidSongsDoorbell()
    await vi.advanceTimersByTimeAsync(4_000)

    await expect(delivery).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  describe('metrics', () => {
    it('counts a delivered ring and its single attempt', async () => {
      await ringKidSongsDoorbell()

      expect(await rings()).toEqual({ delivered: 1 })
      expect(await attempts()).toBe(1)
    })

    it('counts an unconfigured ring without an attempt', async () => {
      delete process.env.KID_SONGS_DOORBELL_URL

      await ringKidSongsDoorbell()

      expect(await rings()).toEqual({ unconfigured: 1 })
      expect(await attempts()).toBe(0)
    })

    it('counts a misconfigured ring without an attempt', async () => {
      process.env.KID_SONGS_DOORBELL_SECRET = 'too-short'
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      await ringKidSongsDoorbell()

      expect(await rings()).toEqual({ misconfigured: 1 })
      expect(await attempts()).toBe(0)
    })

    it('counts a non-retryable status as rejected', async () => {
      fetchMock.mockResolvedValue(response(401))
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      await ringKidSongsDoorbell()

      expect(await rings()).toEqual({ rejected: 1 })
      expect(await attempts()).toBe(1)
    })

    it('counts three attempts but one exhausted ring when delivery never lands', async () => {
      // This is the case the receiver cannot see: from its side nothing happened
      // at all, so a ring that never arrived is only ever visible here.
      fetchMock.mockRejectedValue(new Error('offline'))
      vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      const delivery = ringKidSongsDoorbell()
      await vi.advanceTimersByTimeAsync(4_000)
      await delivery

      expect(await rings()).toEqual({ exhausted: 1 })
      expect(await attempts()).toBe(3)
    })

    it('counts a retried-then-delivered ring once, with both attempts', async () => {
      fetchMock.mockResolvedValueOnce(response(503)).mockResolvedValue(response(202))

      const delivery = ringKidSongsDoorbell()
      await vi.advanceTimersByTimeAsync(1_000)
      await delivery

      expect(await rings()).toEqual({ delivered: 1 })
      expect(await attempts()).toBe(2)
    })

    it('still resolves when the counters themselves throw', async () => {
      // The guarantee under test is the emitter's, not prom-client's: a broken
      // counter must not be what makes a best-effort ring observable.
      vi.spyOn(kidSongsDoorbellRingsTotal, 'inc').mockImplementation(() => {
        throw new Error('registry exploded')
      })
      vi.spyOn(kidSongsDoorbellAttemptsTotal, 'inc').mockImplementation(() => {
        throw new Error('registry exploded')
      })

      await expect(ringKidSongsDoorbell()).resolves.toBeUndefined()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
