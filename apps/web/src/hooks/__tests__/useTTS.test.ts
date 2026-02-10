import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { TtsInput, TtsConfig, TtsAudioManager } from '@/lib/audio/TtsAudioManager'
import { computeClipHash } from '@/lib/audio/clipHash'

// ---------------------------------------------------------------------------
// Mock the AudioManagerContext so useTTS gets a controllable manager
// ---------------------------------------------------------------------------

const mockManager = {
  register: vi.fn(),
  speak: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/contexts/AudioManagerContext', () => ({
  useAudioManagerInstance: () => mockManager,
}))

// Import after mock so the mock is in place
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useTTS } = await import('../useTTS')

beforeEach(() => {
  mockManager.register.mockClear()
  mockManager.speak.mockClear()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderUseTTS(input: TtsInput, config?: TtsConfig) {
  return renderHook(
    ({ input, config }) => useTTS(input, config),
    { initialProps: { input, config } },
  )
}

// ---------------------------------------------------------------------------
// Basic behavior
// ---------------------------------------------------------------------------

describe('useTTS — basic', () => {
  it('registers hook input on mount', () => {
    renderUseTTS('clip-1', { tone: 'warm' })
    expect(mockManager.register).toHaveBeenCalledWith('clip-1', { tone: 'warm' })
  })

  it('speak() with no args passes hook input and config to manager', async () => {
    const { result } = renderUseTTS('clip-1', { tone: 'warm' })
    await act(() => result.current())
    expect(mockManager.speak).toHaveBeenCalledWith(
      'clip-1',
      expect.objectContaining({ tone: 'warm' }),
    )
  })

  it('returns a stable function reference for identical content', () => {
    const { result, rerender } = renderUseTTS('clip-1')
    const fn1 = result.current
    rerender({ input: 'clip-1', config: undefined })
    expect(result.current).toBe(fn1)
  })

  it('returns a new function reference when content changes', () => {
    const { result, rerender } = renderUseTTS('clip-1')
    const fn1 = result.current
    rerender({ input: 'clip-2', config: undefined })
    expect(result.current).not.toBe(fn1)
  })
})

// ---------------------------------------------------------------------------
// Content-based stability (no useMemo needed by caller)
// ---------------------------------------------------------------------------

describe('useTTS — content stability', () => {
  it('object input is stable when content is the same (no useMemo needed)', () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTTS({ say: { en: text }, tone: 'tone' }),
      { initialProps: { text: 'hello' } },
    )
    const fn1 = result.current
    // Re-render with a new object that has the same content
    rerender({ text: 'hello' })
    expect(result.current).toBe(fn1)
  })

  it('object input produces new reference when content changes', () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTTS({ say: { en: text }, tone: 'tone' }),
      { initialProps: { text: 'hello' } },
    )
    const fn1 = result.current
    rerender({ text: 'goodbye' })
    expect(result.current).not.toBe(fn1)
  })

  it('config object is stable when content is the same', () => {
    const { result, rerender } = renderHook(
      ({ tone }) => useTTS('clip', { tone }),
      { initialProps: { tone: 'warm' } },
    )
    const fn1 = result.current
    rerender({ tone: 'warm' })
    expect(result.current).toBe(fn1)
  })
})

// ---------------------------------------------------------------------------
// Speak overrides — input replacement
// ---------------------------------------------------------------------------

describe('useTTS — speak override input', () => {
  it('speak(overrideInput) replaces hook input', async () => {
    const { result } = renderUseTTS('default-clip')
    await act(() => result.current('override-clip'))
    expect(mockManager.speak).toHaveBeenCalledWith(
      'override-clip',
      expect.any(Object),
    )
  })

  it('speak(hashSegment) replaces hook input with hash-based segment', async () => {
    const { result } = renderUseTTS('default-clip')
    await act(() => result.current({ say: { en: 'dynamic' }, tone: 'eager' }))
    expect(mockManager.speak).toHaveBeenCalledWith(
      { say: { en: 'dynamic' }, tone: 'eager' },
      expect.any(Object),
    )
  })

  it('speak(array) replaces hook input with array', async () => {
    const { result } = renderUseTTS('default-clip')
    const arr = ['a', 'b', 'c']
    await act(() => result.current(arr))
    expect(mockManager.speak).toHaveBeenCalledWith(arr, expect.any(Object))
  })
})

// ---------------------------------------------------------------------------
// Three-tier config merge
// ---------------------------------------------------------------------------

describe('useTTS — three-tier config merge', () => {
  it('implicit config (tone from hook segment) is the weakest default', async () => {
    // Hook input has tone on the segment
    const { result } = renderUseTTS({ say: { en: 'default' }, tone: 'implicit-tone' })
    // Speak with no config override — implicit tone should flow through
    await act(() => result.current({ say: { en: 'override' } }))
    expect(mockManager.speak).toHaveBeenCalledWith(
      { say: { en: 'override' } },
      expect.objectContaining({ tone: 'implicit-tone' }),
    )
  })

  it('hook config overrides implicit config', async () => {
    // Hook input has tone='implicit', hook config has tone='explicit'
    const { result } = renderUseTTS(
      { say: { en: 'text' }, tone: 'implicit' },
      { tone: 'explicit' },
    )
    await act(() => result.current({ say: { en: 'override' } }))
    expect(mockManager.speak).toHaveBeenCalledWith(
      { say: { en: 'override' } },
      expect.objectContaining({ tone: 'explicit' }),
    )
  })

  it('speak config overrides hook config', async () => {
    const { result } = renderUseTTS('clip', { tone: 'hook-tone' })
    await act(() => result.current('other-clip', { tone: 'speak-tone' }))
    expect(mockManager.speak).toHaveBeenCalledWith(
      'other-clip',
      expect.objectContaining({ tone: 'speak-tone' }),
    )
  })

  it('speak config overrides implicit config', async () => {
    const { result } = renderUseTTS({ say: { en: 'x' }, tone: 'implicit' })
    await act(() =>
      result.current({ say: { en: 'y' } }, { tone: 'speak-override' }),
    )
    expect(mockManager.speak).toHaveBeenCalledWith(
      { say: { en: 'y' } },
      expect.objectContaining({ tone: 'speak-override' }),
    )
  })

  it('all three tiers present: speak > hook config > implicit', async () => {
    const { result } = renderUseTTS(
      { say: { en: 'text' }, tone: 'tier-1' },
      { tone: 'tier-2' },
    )
    // speak config = tier-3 should win
    await act(() => result.current('clip', { tone: 'tier-3' }))
    expect(mockManager.speak).toHaveBeenCalledWith(
      'clip',
      expect.objectContaining({ tone: 'tier-3' }),
    )
  })

  it('partial speak config merges (say from implicit, tone from speak)', async () => {
    const { result } = renderUseTTS({
      say: { en: 'implicit-text' },
      tone: 'implicit-tone',
    })
    // Override tone but not say
    await act(() => result.current(undefined, { tone: 'new-tone' }))
    const calledConfig = mockManager.speak.mock.calls[0][1] as TtsConfig
    expect(calledConfig.tone).toBe('new-tone')
    expect(calledConfig.say).toEqual({ en: 'implicit-text' })
  })

  it('say maps merge across tiers (implicit say + speak config say)', async () => {
    const { result } = renderUseTTS(
      { say: { en: 'english' }, tone: 'tone' },
      { say: { fr: 'francais' } },
    )
    // Speak config adds another locale
    await act(() => result.current(undefined, { say: { es: 'espanol' } }))
    // Spread order: { ...implicit, ...hookConfig, ...speakConfig }
    // implicit.say = { en: 'english' }, hookConfig.say = { fr: 'francais' }, speakConfig.say = { es: 'espanol' }
    // But say is an object value, not deep merged — last spread wins the key.
    // So the effective say should be speakConfig.say = { es: 'espanol' }
    const calledConfig = mockManager.speak.mock.calls[0][1] as TtsConfig
    expect(calledConfig.say).toEqual({ es: 'espanol' })
  })
})

// ---------------------------------------------------------------------------
// Implicit config extraction edge cases
// ---------------------------------------------------------------------------

describe('useTTS — implicit config extraction', () => {
  it('string input produces no implicit config', async () => {
    const { result } = renderUseTTS('clip')
    await act(() => result.current({ say: { en: 'override' } }))
    const calledConfig = mockManager.speak.mock.calls[0][1] as TtsConfig
    // No implicit tone, no hook config → tone should be undefined
    expect(calledConfig.tone).toBeUndefined()
  })

  it('array input produces no implicit config', async () => {
    const { result } = renderUseTTS(['a', 'b'])
    await act(() => result.current({ say: { en: 'override' } }))
    const calledConfig = mockManager.speak.mock.calls[0][1] as TtsConfig
    expect(calledConfig.tone).toBeUndefined()
  })

  it('explicit clipId object extracts tone and say', async () => {
    const { result } = renderUseTTS({
      clipId: 'x',
      tone: 'extracted-tone',
      say: { en: 'extracted-say' },
    })
    await act(() => result.current('other-clip'))
    const calledConfig = mockManager.speak.mock.calls[0][1] as TtsConfig
    expect(calledConfig.tone).toBe('extracted-tone')
    expect(calledConfig.say).toEqual({ en: 'extracted-say' })
  })

  it('hash-based segment extracts tone and say', async () => {
    const { result } = renderUseTTS({
      say: { en: 'hello' },
      tone: 'friendly',
    })
    await act(() => result.current('one-off-clip'))
    const calledConfig = mockManager.speak.mock.calls[0][1] as TtsConfig
    expect(calledConfig.tone).toBe('friendly')
    expect(calledConfig.say).toEqual({ en: 'hello' })
  })

  it('hash-based segment with no tone extracts only say', async () => {
    const { result } = renderUseTTS({ say: { en: 'hello' } })
    await act(() => result.current('clip'))
    const calledConfig = mockManager.speak.mock.calls[0][1] as TtsConfig
    expect(calledConfig.tone).toBeUndefined()
    expect(calledConfig.say).toEqual({ en: 'hello' })
  })

  it('explicit clipId object with no tone or say extracts nothing', async () => {
    const { result } = renderUseTTS({ clipId: 'bare' })
    await act(() => result.current('other'))
    const calledConfig = mockManager.speak.mock.calls[0][1] as TtsConfig
    expect(calledConfig.tone).toBeUndefined()
    expect(calledConfig.say).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// speak() with undefined vs no-arg
// ---------------------------------------------------------------------------

describe('useTTS — speak argument handling', () => {
  it('speak() with no args uses hook input', async () => {
    const { result } = renderUseTTS('hook-clip', { tone: 'warm' })
    await act(() => result.current())
    expect(mockManager.speak).toHaveBeenCalledWith(
      'hook-clip',
      expect.objectContaining({ tone: 'warm' }),
    )
  })

  it('speak(undefined) uses hook input (same as no args)', async () => {
    const { result } = renderUseTTS('hook-clip')
    await act(() => result.current(undefined))
    expect(mockManager.speak).toHaveBeenCalledWith('hook-clip', expect.any(Object))
  })

  it('speak(undefined, config) uses hook input with config override', async () => {
    const { result } = renderUseTTS('hook-clip', { tone: 'default' })
    await act(() => result.current(undefined, { tone: 'override' }))
    expect(mockManager.speak).toHaveBeenCalledWith(
      'hook-clip',
      expect.objectContaining({ tone: 'override' }),
    )
  })

  it('speak("") passes empty string as input (not hook default)', async () => {
    const { result } = renderUseTTS('hook-clip')
    await act(() => result.current(''))
    expect(mockManager.speak).toHaveBeenCalledWith('', expect.any(Object))
  })
})

// ---------------------------------------------------------------------------
// Re-render behavior
// ---------------------------------------------------------------------------

describe('useTTS — re-render with updated hook input', () => {
  it('speak() after rerender uses the latest hook input', async () => {
    const { result, rerender } = renderUseTTS('clip-1')
    rerender({ input: 'clip-2', config: undefined })
    await act(() => result.current())
    expect(mockManager.speak).toHaveBeenCalledWith('clip-2', expect.any(Object))
  })

  it('speak() after rerender uses the latest hook config', async () => {
    const { result, rerender } = renderUseTTS('clip', { tone: 'old' })
    rerender({ input: 'clip', config: { tone: 'new' } })
    await act(() => result.current())
    expect(mockManager.speak).toHaveBeenCalledWith(
      'clip',
      expect.objectContaining({ tone: 'new' }),
    )
  })

  it('implicit config updates when hook input changes', async () => {
    const { result, rerender } = renderHook(
      ({ tone }) => useTTS({ say: { en: 'x' }, tone }),
      { initialProps: { tone: 'old-implicit' } },
    )
    rerender({ tone: 'new-implicit' })
    // Speak override should inherit the new implicit tone
    await act(() => result.current('one-off'))
    expect(mockManager.speak).toHaveBeenCalledWith(
      'one-off',
      expect.objectContaining({ tone: 'new-implicit' }),
    )
  })
})
