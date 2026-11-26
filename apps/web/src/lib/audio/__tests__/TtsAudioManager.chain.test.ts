import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { characterChain, TtsAudioManager } from '../TtsAudioManager'
import type { VoiceSourceData } from '../voiceSource'
import { BrowserTtsVoice, PregeneratedVoice, SubtitleVoice } from '../voiceSource'

/**
 * Drives TtsAudioManager.speak() through real voice chains. Only the edges
 * are stubbed: fetch (manifest + generate-clip), the Audio element, and
 * URL.createObjectURL. The chain walk itself is the code under test.
 */

const PROD_CHAIN: VoiceSourceData[] = [
  { type: 'pregenerated', name: 'onyx' },
  { type: 'pregenerated', name: 'nova' },
  { type: 'custom', name: 'Thomas Hallock' },
  { type: 'generate' },
  { type: 'subtitle' },
]

const EUCLID = 'el-onwK4e9ZLuTAKqWW03F9'

let fetchMock: ReturnType<typeof vi.fn>
let audioUrls: string[]

function stubFetch(clipIdsByVoice: Record<string, string[]>, generate: () => Response) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.startsWith('/api/audio/collected-clips/manifest')) {
      return new Response(JSON.stringify({ clipIdsByVoice }), { status: 200 })
    }
    if (url === '/api/audio/generate-clip') return generate()
    // Collection flushes and anything else: accept and ignore.
    return new Response('{}', { status: 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
}

function generateCalls() {
  return fetchMock.mock.calls.filter(([u]) => String(u) === '/api/audio/generate-clip')
}

/** Speak and capture any subtitle shown, dismissing it so speak() returns. */
async function speakCapturingSubtitle(
  m: TtsAudioManager,
  ...args: Parameters<TtsAudioManager['speak']>
): Promise<string[]> {
  const subtitles: string[] = []
  const unsubscribe = m.subscribe(() => {
    const text = m.getSnapshot().subtitleText
    if (text && subtitles[subtitles.length - 1] !== text) {
      subtitles.push(text)
      queueMicrotask(() => m.dismissSubtitle())
    }
  })
  await m.speak(...args)
  unsubscribe()
  return subtitles
}

beforeEach(() => {
  audioUrls = []
  vi.stubGlobal(
    'Audio',
    class {
      volume = 1
      playbackRate = 1
      preservesPitch = true
      readyState = 0
      duration = 1
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      constructor(readonly url: string) {
        audioUrls.push(url)
      }
      addEventListener() {}
      pause() {}
      play() {
        setTimeout(() => this.onended?.(), 0)
        return Promise.resolve()
      }
    }
  )
  // jsdom has no object URLs; define them for the duration of each test.
  Object.assign(URL, {
    createObjectURL: () => 'blob:generated',
    revokeObjectURL: () => {},
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("prod's chain (retired voices first, then generate)", () => {
  it('a clip missing everywhere makes no generate-clip call and ends at the subtitle', async () => {
    stubFetch({ onyx: ['other-clip'], nova: [], 'Thomas Hallock': [] }, () => {
      throw new Error('generate-clip must not be called')
    })
    const m = new TtsAudioManager()
    await m.loadPregenManifest(PROD_CHAIN)
    m.configure({ enabled: true })

    const subtitles = await speakCapturingSubtitle(m, {
      clipId: 'brand-new-line',
      say: { en: 'A line nobody has generated yet.' },
    })

    expect(generateCalls()).toHaveLength(0)
    expect(audioUrls).toHaveLength(0)
    expect(subtitles).toEqual(['A line nobody has generated yet.'])
  })

  it('a clip the retired voice has still plays from disk', async () => {
    stubFetch({ onyx: ['old-line'] }, () => {
      throw new Error('generate-clip must not be called')
    })
    const m = new TtsAudioManager()
    await m.loadPregenManifest(PROD_CHAIN)
    m.configure({ enabled: true })

    const subtitles = await speakCapturingSubtitle(m, { clipId: 'old-line', say: { en: 'Old.' } })

    expect(audioUrls).toEqual(['/api/audio/clips/onyx/old-line'])
    expect(subtitles).toEqual([])
    expect(generateCalls()).toHaveLength(0)
  })
})

describe('a character speaks only in its own voice', () => {
  it("generates a missing line in the character's voice, never another voice's cached clip", async () => {
    // onyx HAS this clip; Euclid doesn't. Euclid must not borrow onyx.
    stubFetch(
      { onyx: ['prop-1-step-1'] },
      () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    )
    const m = new TtsAudioManager()
    await m.loadPregenManifest(PROD_CHAIN)
    m.configure({ enabled: true })

    await speakCapturingSubtitle(
      m,
      { clipId: 'prop-1-step-1', say: { en: 'Describe a circle.' } },
      { prependChain: [new PregeneratedVoice(EUCLID)] }
    )

    const calls = generateCalls()
    expect(calls).toHaveLength(1)
    expect(JSON.parse(String(calls[0][1]?.body)).voice).toBe(EUCLID)
    expect(audioUrls).toEqual(['blob:generated'])
    expect(audioUrls).not.toContain('/api/audio/clips/onyx/prop-1-step-1')
  })

  it('when generation fails (door timed out), falls to the subtitle, not another voice', async () => {
    stubFetch(
      { onyx: ['prop-1-step-1'] },
      () =>
        new Response(JSON.stringify({ error: 'ElevenLabs timed out after 5000 ms' }), {
          status: 504,
        })
    )
    const m = new TtsAudioManager()
    await m.loadPregenManifest(PROD_CHAIN)
    m.configure({ enabled: true })

    const subtitles = await speakCapturingSubtitle(
      m,
      { clipId: 'prop-1-step-1', say: { en: 'Describe a circle.' } },
      { prependChain: [new PregeneratedVoice(EUCLID)] }
    )

    expect(generateCalls()).toHaveLength(1)
    expect(audioUrls).toEqual([])
    expect(subtitles).toEqual(['Describe a circle.'])
  })

  it("plays the character's own cached clip when it has one", async () => {
    stubFetch({ onyx: ['prop-1-step-1'] }, () => {
      throw new Error('generate-clip must not be called')
    })
    const m = new TtsAudioManager()
    await m.loadPregenManifest(PROD_CHAIN)
    m.configure({ enabled: true })
    // The character's clips arrive via the provider's manifest load.
    ;(m as unknown as { _pregenClipIds: Map<string, Set<string>> })._pregenClipIds.set(
      EUCLID,
      new Set(['prop-1-step-1'])
    )

    await speakCapturingSubtitle(
      m,
      { clipId: 'prop-1-step-1', say: { en: 'Describe a circle.' } },
      { prependChain: [new PregeneratedVoice(EUCLID)] }
    )

    expect(audioUrls).toEqual([`/api/audio/clips/${EUCLID}/prop-1-step-1`])
  })
})

describe('characterChain', () => {
  it("keeps only the global chain's voiceless fallbacks", () => {
    const chain = characterChain(
      [new PregeneratedVoice(EUCLID)],
      [new PregeneratedVoice('onyx'), new BrowserTtsVoice(), new SubtitleVoice()]
    )
    expect(chain.map((s) => s.toJSON())).toEqual([
      { type: 'pregenerated', name: EUCLID },
      { type: 'generate' },
      { type: 'browser-tts' },
      { type: 'subtitle' },
    ])
  })

  it('ends at a subtitle when the global chain has no voiceless fallback', () => {
    const chain = characterChain([new PregeneratedVoice(EUCLID)], [new PregeneratedVoice('onyx')])
    expect(chain.map((s) => s.type)).toEqual(['pregenerated', 'generate', 'subtitle'])
  })
})
