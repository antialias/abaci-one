/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockRecordTtsUsage = vi.fn()
vi.mock('@/lib/ai-usage/helpers', () => ({
  recordTtsUsage: (...args: unknown[]) => mockRecordTtsUsage(...args),
}))

import { AiFeature } from '@/lib/ai-usage/features'
import {
  describeSpeechFailure,
  elevenLabsErrorMessage,
  listElevenLabsVoices,
  SPEECH_TIMEOUT_MS,
  SpeechError,
  speechRequestText,
  synthesizeSpeech,
} from '../synthesize'

const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'
const VOICE = `el-${VOICE_ID}`
const BASE = 'http://door.test:8788/elevenlabs'

const fetchMock = vi.fn()

function audioResponse(bytes = [0x49, 0x44, 0x33]) {
  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: { 'Content-Type': 'audio/mpeg' },
  })
}

function sentBody(call = 0): { text: string; model_id: string } {
  return JSON.parse(fetchMock.mock.calls[call][1].body)
}

async function expectSpeechError(p: Promise<unknown>): Promise<SpeechError> {
  try {
    await p
  } catch (err) {
    expect(err).toBeInstanceOf(SpeechError)
    return err as SpeechError
  }
  throw new Error('expected a SpeechError')
}

beforeEach(() => {
  vi.stubEnv('ELEVENLABS_API_BASE_URL', `${BASE}/`)
  vi.stubEnv('ELEVENLABS_MUSIC_API_KEY', 'proxy-login')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  mockRecordTtsUsage.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('synthesizeSpeech request', () => {
  it("posts text and model to the door's text-to-speech route with the proxy login", async () => {
    fetchMock.mockResolvedValue(audioResponse())

    const result = await synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'Seven plus two' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer proxy-login',
      'Content-Type': 'application/json',
    })
    // Only fields the door accepts: no voice_settings, no previous/next text.
    expect(sentBody()).toEqual({ text: 'Seven plus two', model_id: 'eleven_v3' })
    expect(result.audio).toEqual(Buffer.from([0x49, 0x44, 0x33]))
    expect(result.model).toBe('eleven_v3')
    expect(result.characters).toBe('Seven plus two'.length)
  })
})

describe('tone', () => {
  it('leads with the tag for a registered tone', async () => {
    fetchMock.mockResolvedValue(audioResponse())
    await synthesizeSpeech({
      timeoutMs: 1000,
      voice: VOICE,
      text: 'You got it!',
      tone: 'celebration',
    })
    expect(sentBody().text).toBe('[excited] You got it!')
  })

  it('sends neutral tones with no tag', async () => {
    fetchMock.mockResolvedValue(audioResponse())
    await synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'seven', tone: 'math-dictation' })
    expect(sentBody().text).toBe('seven')
  })

  it('maps a free-text direction onto a known tag, never into brackets verbatim', async () => {
    fetchMock.mockResolvedValue(audioResponse())
    await synthesizeSpeech({
      timeoutMs: 1000,
      voice: VOICE,
      text: 'Look up.',
      tone: 'Hushed, floating awe. Like drifting through deep space.',
    })
    expect(sentBody().text).toBe('[whispers] Look up.')
  })

  it("turns brackets in the clip's own words into parentheses", async () => {
    fetchMock.mockResolvedValue(audioResponse())
    await synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'Press [Enter] now' })
    expect(sentBody().text).toBe('Press (Enter) now')
  })
})

describe('length guard (refuse, never split)', () => {
  it('refuses text over 1000 characters without calling the door', async () => {
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'a'.repeat(1001) })
    )
    expect(err.kind).toBe('too-long')
    expect(err.httpStatus).toBe(400)
    expect(err.message).toMatch(/1001 characters/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends exactly 1000 characters', async () => {
    fetchMock.mockResolvedValue(audioResponse())
    await synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'a'.repeat(1000) })
    expect(sentBody().text).toHaveLength(1000)
  })

  it('drops the tag rather than exceed the limit', () => {
    expect(speechRequestText('a'.repeat(995), 'celebration')).toBe('a'.repeat(995))
    expect(speechRequestText('a'.repeat(980), 'celebration')).toBe(`[excited] ${'a'.repeat(980)}`)
  })

  it('refuses empty text', async () => {
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: '   ' })
    )
    expect(err.kind).toBe('empty')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('voices that may not generate', () => {
  it.each(['onyx', 'nova', 'Thomas Hallock', 'el-', 'el-../x'])(
    'refuses %j without calling the door',
    async (voice) => {
      const err = await expectSpeechError(
        synthesizeSpeech({ timeoutMs: 1000, voice, text: 'hello' })
      )
      expect(err.kind).toBe('not-generatable')
      expect(err.httpStatus).toBe(400)
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('says a retired voice still plays', async () => {
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 1000, voice: 'onyx', text: 'hello' })
    )
    expect(err.message).toMatch(/retired OpenAI voice/)
    expect(err.message).toMatch(/still play/)
  })
})

describe('error mapping', () => {
  it("reads ElevenLabs' {detail: {status, message}} shape", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ detail: { status: 'invalid_model', message: 'model not allowed' } }),
        { status: 400 }
      )
    )
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'hi' })
    )
    expect(err.kind).toBe('upstream')
    expect(err.httpStatus).toBe(502)
    expect(err.upstreamStatus).toBe(400)
    expect(err.message).toBe('ElevenLabs HTTP 400: model not allowed')
  })

  it('reads validation lists and plain text', () => {
    expect(
      elevenLabsErrorMessage(JSON.stringify({ detail: [{ msg: 'extra field' }, { msg: 'bad' }] }))
    ).toBe('extra field; bad')
    expect(elevenLabsErrorMessage(JSON.stringify({ detail: 'quota exceeded' }))).toBe(
      'quota exceeded'
    )
    expect(elevenLabsErrorMessage('CONNECT only on this port')).toBe('CONNECT only on this port')
  })

  it('keeps the status where the bulk task looks for it', async () => {
    fetchMock.mockResolvedValue(new Response('{"detail":"nope"}', { status: 401 }))
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'hi' })
    )
    expect(describeSpeechFailure(err.message, VOICE)).toMatch(/ELEVENLABS_MUSIC_API_KEY/)
  })

  it('maps an unreachable door to upstream', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'hi' })
    )
    expect(err.kind).toBe('upstream')
    expect(err.message).toMatch(/fetch failed/)
  })

  it('maps a missing login to config (503)', async () => {
    vi.stubEnv('ELEVENLABS_MUSIC_API_KEY', '')
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'hi' })
    )
    expect(err.kind).toBe('config')
    expect(err.httpStatus).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('usage', () => {
  const usage = { userId: 'user-1', feature: AiFeature.TTS_CLIP }

  it('records the exact text sent, tag included, under the model', async () => {
    fetchMock.mockResolvedValue(audioResponse())
    await synthesizeSpeech({
      timeoutMs: 1000,
      voice: VOICE,
      text: 'You got it!',
      tone: 'celebration',
      usage,
    })
    expect(mockRecordTtsUsage).toHaveBeenCalledWith('[excited] You got it!', 'eleven_v3', usage)
  })

  it('records nothing when the door fails', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 500 }))
    await expectSpeechError(synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'hi', usage }))
    expect(mockRecordTtsUsage).not.toHaveBeenCalled()
  })

  it('records nothing without a usage context', async () => {
    fetchMock.mockResolvedValue(audioResponse())
    await synthesizeSpeech({ timeoutMs: 1000, voice: VOICE, text: 'hi' })
    expect(mockRecordTtsUsage).not.toHaveBeenCalled()
  })
})

describe('listElevenLabsVoices', () => {
  it("reads the door's /v1/voices, sorted by name, dropping ids that aren't path-safe", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        voices: [
          { voice_id: 'bbb222', name: 'Rachel', category: 'premade' },
          { voice_id: '../etc', name: 'Evil' },
          { voice_id: 'aaa111', name: 'Adam' },
        ],
      })
    )
    const voices = await listElevenLabsVoices()
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/v1/voices`)
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer proxy-login',
    })
    expect(voices).toEqual([
      { voiceId: 'aaa111', name: 'Adam', category: null },
      { voiceId: 'bbb222', name: 'Rachel', category: 'premade' },
    ])
  })
})

describe('timeouts', () => {
  /** A door that never answers: resolves only when the request is aborted. */
  function stuckDoor() {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
    )
  }

  it('gives up on a stuck door after timeoutMs with a 504 upstream error', async () => {
    stuckDoor()
    const started = Date.now()
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 50, voice: VOICE, text: 'hi' })
    )
    expect(err.kind).toBe('upstream')
    expect(err.httpStatus).toBe(504)
    expect(err.message).toBe('ElevenLabs timed out after 50 ms')
    expect(Date.now() - started).toBeLessThan(2000)
    expect(mockRecordTtsUsage).not.toHaveBeenCalled()
  })

  it('a refused connection is a 502, not a timeout', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    const err = await expectSpeechError(
      synthesizeSpeech({ timeoutMs: 50, voice: VOICE, text: 'hi' })
    )
    expect(err.httpStatus).toBe(502)
    expect(err.message).toBe('Could not reach ElevenLabs: fetch failed')
  })

  it('the voice list has its own timeout', async () => {
    stuckDoor()
    const realTimeout = AbortSignal.timeout.bind(AbortSignal)
    const spy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => realTimeout(20))
    try {
      const err = await expectSpeechError(listElevenLabsVoices())
      expect(spy).toHaveBeenCalledWith(SPEECH_TIMEOUT_MS.voiceList)
      expect(err.httpStatus).toBe(504)
    } finally {
      spy.mockRestore()
    }
  })

  it('on-demand waits only a few seconds; bulk waits longer', () => {
    expect(SPEECH_TIMEOUT_MS.onDemand).toBeLessThanOrEqual(6_000)
    expect(SPEECH_TIMEOUT_MS.bulk).toBeGreaterThan(SPEECH_TIMEOUT_MS.onDemand)
  })
})
