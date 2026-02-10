import { describe, expect, it, vi, beforeEach } from 'vitest'
import { computeClipHash } from '../clipHash'
import { TtsAudioManager } from '../TtsAudioManager'
import type { TtsInput, TtsConfig, TtsSay } from '../TtsAudioManager'

/** Helper: get the single collected clip from a fresh manager after one register call. */
function registerAndCollect(input: TtsInput, config?: TtsConfig) {
  const m = new TtsAudioManager()
  m.register(input, config)
  return m.getCollection()
}

// ---------------------------------------------------------------------------
// Segment type routing
// ---------------------------------------------------------------------------

describe('register — segment type routing', () => {
  it('string segment uses the string as clip ID', () => {
    const clips = registerAndCollect('number-5')
    expect(clips).toHaveLength(1)
    expect(clips[0].clipId).toBe('number-5')
  })

  it('explicit clip ID object uses clipId field', () => {
    const clips = registerAndCollect({
      clipId: 'feedback-correct',
      tone: 'celebration',
      say: { en: 'Correct!' },
    })
    expect(clips).toHaveLength(1)
    expect(clips[0].clipId).toBe('feedback-correct')
    expect(clips[0].tone).toBe('celebration')
    expect(clips[0].say).toEqual({ en: 'Correct!' })
  })

  it('hash-based segment computes clip ID from content', () => {
    const say = { en: 'hello world' }
    const tone = 'friendly'
    const clips = registerAndCollect({ say, tone })
    expect(clips).toHaveLength(1)
    expect(clips[0].clipId).toBe(computeClipHash(say, tone))
    expect(clips[0].clipId).toMatch(/^h-[0-9a-f]{8}$/)
  })

  it('empty string segment is skipped', () => {
    const clips = registerAndCollect('')
    expect(clips).toHaveLength(0)
  })

  it('array input registers each segment', () => {
    const clips = registerAndCollect(['number-5', 'operator-plus', 'number-3'])
    expect(clips).toHaveLength(3)
    expect(clips.map((c) => c.clipId)).toEqual(['number-5', 'operator-plus', 'number-3'])
  })

  it('mixed array of strings and objects', () => {
    const clips = registerAndCollect([
      'number-5',
      { clipId: 'operator-plus', tone: 'math', say: { en: 'plus' } },
      { say: { en: 'three' }, tone: 'math' },
    ])
    expect(clips).toHaveLength(3)
    expect(clips[0].clipId).toBe('number-5')
    expect(clips[1].clipId).toBe('operator-plus')
    expect(clips[2].clipId).toMatch(/^h-/)
  })
})

// ---------------------------------------------------------------------------
// Config merging (top-level config → segment fields)
// ---------------------------------------------------------------------------

describe('register — config merging', () => {
  it('top-level tone applies to string segments', () => {
    const clips = registerAndCollect('greeting', { tone: 'warm' })
    expect(clips[0].tone).toBe('warm')
  })

  it('segment tone overrides top-level tone', () => {
    const clips = registerAndCollect({ clipId: 'greeting', tone: 'cold' }, { tone: 'warm' })
    expect(clips[0].tone).toBe('cold')
  })

  it('top-level say applies to string segments', () => {
    const clips = registerAndCollect('greeting', {
      say: { en: 'Hello' },
    })
    expect(clips[0].say).toEqual({ en: 'Hello' })
  })

  it('segment say merges with top-level say (segment wins)', () => {
    const clips = registerAndCollect(
      { clipId: 'greeting', say: { en: 'Hi', es: 'Hola' } },
      { say: { en: 'Hello', fr: 'Bonjour' } }
    )
    // Segment 'en' overrides top-level 'en'; top-level 'fr' survives
    expect(clips[0].say).toEqual({ en: 'Hi', es: 'Hola', fr: 'Bonjour' })
  })

  it('top-level config fills in missing tone on hash segment', () => {
    const say: TtsSay = { en: 'Dynamic text' }
    const clips = registerAndCollect({ say }, { tone: 'tutorial' })
    // The hash should incorporate the top-level tone
    expect(clips[0].clipId).toBe(computeClipHash(say, 'tutorial'))
    expect(clips[0].tone).toBe('tutorial')
  })

  it('hash segment tone overrides top-level tone for hash computation', () => {
    const say: TtsSay = { en: 'Dynamic text' }
    const clips = registerAndCollect({ say, tone: 'override' }, { tone: 'default' })
    expect(clips[0].clipId).toBe(computeClipHash(say, 'override'))
    expect(clips[0].tone).toBe('override')
  })

  it('top-level say merges into hash computation', () => {
    // Top-level say { en: 'base' } + segment say { en: 'override' }
    // Segment wins → canonical text is 'override'
    const clips = registerAndCollect(
      { say: { en: 'override' } },
      { say: { en: 'base' }, tone: 'tone' }
    )
    expect(clips[0].clipId).toBe(computeClipHash({ en: 'override' }, 'tone'))
  })

  it('hash uses merged say (top + segment) for computation', () => {
    // Top say provides en, segment provides es.
    // Canonical text = en (from top). Hash includes tone.
    const clips = registerAndCollect(
      { say: { es: 'hola' }, tone: 'bilingual' },
      { say: { en: 'hello' } }
    )
    const mergedSay = { en: 'hello', es: 'hola' }
    expect(clips[0].clipId).toBe(computeClipHash(mergedSay, 'bilingual'))
  })
})

// ---------------------------------------------------------------------------
// Idempotent re-registration and merging across calls
// ---------------------------------------------------------------------------

describe('register — re-registration', () => {
  it('duplicate string registration merges say maps', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const m = new TtsAudioManager()
    m.register('clip-1', { say: { en: 'Hello' } })
    m.register('clip-1', { say: { es: 'Hola' } })
    const clips = m.getCollection()
    expect(clips).toHaveLength(1)
    expect(clips[0].say).toEqual({ en: 'Hello', es: 'Hola' })
  })

  it('duplicate registration fills in tone if previously empty', () => {
    const m = new TtsAudioManager()
    m.register('clip-1')
    m.register('clip-1', { tone: 'warm' })
    expect(m.getCollection()[0].tone).toBe('warm')
  })

  it('duplicate registration does NOT overwrite existing tone', () => {
    const m = new TtsAudioManager()
    m.register('clip-1', { tone: 'original' })
    m.register('clip-1', { tone: 'attempted-override' })
    expect(m.getCollection()[0].tone).toBe('original')
  })

  it('hash-based re-registration with identical content is idempotent', () => {
    const m = new TtsAudioManager()
    const seg = { say: { en: 'same text' }, tone: 'same tone' }
    m.register(seg)
    m.register(seg)
    expect(m.getCollection()).toHaveLength(1)
  })

  it('hash-based segments with different text are separate entries', () => {
    const m = new TtsAudioManager()
    m.register({ say: { en: 'text A' }, tone: 'tone' })
    m.register({ say: { en: 'text B' }, tone: 'tone' })
    expect(m.getCollection()).toHaveLength(2)
  })

  it('hash-based segments with different tone are separate entries', () => {
    const m = new TtsAudioManager()
    m.register({ say: { en: 'same' }, tone: 'happy' })
    m.register({ say: { en: 'same' }, tone: 'sad' })
    expect(m.getCollection()).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Clobber detection
// ---------------------------------------------------------------------------

describe('register — clobber detection', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('warns when explicit string ID is re-registered with different say text', () => {
    const m = new TtsAudioManager()
    m.register('my-clip', { say: { en: 'Hello' } })
    m.register('my-clip', { say: { en: 'Goodbye' } })
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('my-clip')
    expect(warnSpy.mock.calls[0][0]).toContain('Hello')
    expect(warnSpy.mock.calls[0][0]).toContain('Goodbye')
  })

  it('warns when explicit clipId object is re-registered with different text', () => {
    const m = new TtsAudioManager()
    m.register({ clipId: 'x', say: { en: 'old' } })
    m.register({ clipId: 'x', say: { en: 'new' } })
    expect(warnSpy).toHaveBeenCalledOnce()
  })

  it('does NOT warn when explicit ID is re-registered with same text', () => {
    const m = new TtsAudioManager()
    m.register('my-clip', { say: { en: 'Same' } })
    m.register('my-clip', { say: { en: 'Same' } })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does NOT warn for hash-based segments (they cannot clobber)', () => {
    const m = new TtsAudioManager()
    m.register({ say: { en: 'text A' }, tone: 'tone' })
    m.register({ say: { en: 'text B' }, tone: 'tone' })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does NOT warn when first registration has no say text', () => {
    const m = new TtsAudioManager()
    m.register('my-clip') // no say
    m.register('my-clip', { say: { en: 'Hello' } })
    // Old canonical is '' (empty) — should not trigger warning
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('does NOT warn when new registration has no say text', () => {
    const m = new TtsAudioManager()
    m.register('my-clip', { say: { en: 'Hello' } })
    m.register('my-clip') // no say
    // New canonical is '' (empty) — should not trigger warning
    expect(warnSpy).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('register — edge cases', () => {
  it('segment with clipId = "" is skipped (hasExplicitClipId passes but empty string filtered)', () => {
    // clipId of '' is truthy for 'clipId' in check but empty string is falsy
    const clips = registerAndCollect({ clipId: '', say: { en: 'x' } })
    expect(clips).toHaveLength(0)
  })

  it('hash-based segment with empty say map produces a clip ID', () => {
    const clips = registerAndCollect({ say: {}, tone: 'some-tone' })
    expect(clips).toHaveLength(1)
    expect(clips[0].clipId).toBe(computeClipHash({}, 'some-tone'))
  })

  it('hash-based segment with empty tone', () => {
    const say = { en: 'hello' }
    const clips = registerAndCollect({ say, tone: '' })
    expect(clips[0].clipId).toBe(computeClipHash(say, ''))
  })

  it('hash-based segment with no tone falls back to top-level', () => {
    const say = { en: 'hello' }
    const clips = registerAndCollect({ say }, { tone: 'fallback' })
    expect(clips[0].clipId).toBe(computeClipHash(say, 'fallback'))
  })

  it('hash-based segment with no tone and no top-level tone uses empty string', () => {
    const say = { en: 'hello' }
    const clips = registerAndCollect({ say })
    expect(clips[0].clipId).toBe(computeClipHash(say, ''))
  })

  it('array with duplicate string IDs produces one collection entry', () => {
    const m = new TtsAudioManager()
    m.register(['a', 'b', 'a'])
    expect(m.getCollection()).toHaveLength(2)
  })

  it('array with duplicate hash-based segments produces one collection entry', () => {
    const m = new TtsAudioManager()
    const seg = { say: { en: 'same' }, tone: 'same' }
    m.register([seg, seg])
    expect(m.getCollection()).toHaveLength(1)
  })

  it('many unique hash-based segments all produce unique IDs', () => {
    const m = new TtsAudioManager()
    for (let i = 0; i < 100; i++) {
      m.register({ say: { en: `text-${i}` }, tone: 'tone' })
    }
    const ids = new Set(m.getCollection().map((c) => c.clipId))
    expect(ids.size).toBe(100)
  })
})
