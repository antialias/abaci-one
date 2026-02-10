'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import type { TtsInput, TtsConfig } from '@/lib/audio/TtsAudioManager'

/**
 * Extract tone/say from a hook's input segment to use as implicit config defaults.
 *
 * When the hook input is an object segment (explicit-ID or hash-based), its
 * tone and say become the weakest-priority defaults for speak() overrides.
 * This means `useTTS({ say, tone })` + `speak({ say: other })` inherits the tone.
 *
 * For string or array inputs there is nothing to extract — returns `{}`.
 */
function extractImplicitConfig(input: TtsInput): TtsConfig {
  if (typeof input === 'string' || Array.isArray(input)) return {}
  const result: TtsConfig = {}
  if ('tone' in input && input.tone !== undefined) result.tone = input.tone
  if ('say' in input && input.say !== undefined) result.say = input.say
  return result
}

/**
 * Declare a TTS utterance and get a speak function with inherited defaults.
 *
 * On render the hook registers its input with the manager for clip collection.
 * It returns a speak function that plays audio via the voice chain.
 *
 * Callers do NOT need to memoize the input or config objects —
 * the hook uses content-based serialization for dep tracking internally.
 *
 * ## Speak function overrides
 *
 * The returned function accepts optional overrides so it can double as a
 * reusable speaker within a component:
 *
 * ```typescript
 * const speak = useTTS({ tone: 'tutorial' })
 *
 * speak()                                  // plays hook defaults
 * speak({ say: { en: 'Dynamic text' } })   // inherits tone from hook
 * speak('other-clip', { tone: 'custom' })  // overrides everything
 * ```
 *
 * ### Default inheritance (merge order, weakest to strongest)
 *
 * 1. **Implicit config** — tone/say extracted from the hook's input segment
 * 2. **Hook config** — explicit second arg to `useTTS(input, config)`
 * 3. **Speak config** — second arg to `speak(input, config)`
 *
 * Segment-level fields (tone/say directly on the speak input segment) take
 * final precedence via the manager's existing `resolveSegment` logic.
 *
 * ### Registration
 *
 * The hook registers its *own* input on render (for clip collection).
 * Override clips passed to speak() are registered at call time by the
 * manager — they will appear in the collection once played.
 *
 * @param input  A clip ID string, a TtsSegment object, or an array of TtsSegments
 * @param config  Optional shared defaults: { tone?, say? }
 */
export function useTTS(
  input: TtsInput,
  config?: TtsConfig
): (overrideInput?: TtsInput, overrideConfig?: TtsConfig) => Promise<void> {
  const manager = useAudioManagerInstance()

  // Stable content key — avoids requiring callers to memoize objects
  const inputKey = JSON.stringify(input)
  const configKey = JSON.stringify(config)

  // Latest values in refs for the actual register/speak calls
  const inputRef = useRef(input)
  const configRef = useRef(config)
  inputRef.current = input
  configRef.current = config

  // Implicit config extracted from hook input segment (tone/say as defaults)
  const implicitConfigRef = useRef<TtsConfig>({})
  implicitConfigRef.current = extractImplicitConfig(input)

  // Register when content changes (idempotent)
  useEffect(() => {
    manager.register(inputRef.current, configRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, inputKey, configKey])

  return useCallback(
    (overrideInput?: TtsInput, overrideConfig?: TtsConfig) => {
      const effectiveInput = overrideInput !== undefined ? overrideInput : inputRef.current
      const effectiveConfig: TtsConfig = {
        ...implicitConfigRef.current,
        ...configRef.current,
        ...overrideConfig,
      }
      return manager.speak(effectiveInput, effectiveConfig)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manager, inputKey, configKey]
  )
}
