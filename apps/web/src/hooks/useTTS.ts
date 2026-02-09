'use client'

import { useCallback, useEffect } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import type { TtsInput, TtsConfig } from '@/lib/audio/TtsAudioManager'

/**
 * Declare a TTS utterance at the usage site and get a play function.
 *
 * On render: registers the input with the manager.
 * Returns a stable callback that speaks via the voice chain.
 *
 * @param input  A clip ID string, or an array of TtsSegments
 * @param config  Optional config: { tone?, say? }
 */
export function useTTS(input: TtsInput, config?: TtsConfig): () => Promise<void> {
  const manager = useAudioManagerInstance()

  // Register on render (idempotent)
  useEffect(() => {
    manager.register(input, config)
  }, [manager, input, config])

  return useCallback(
    () => manager.speak(input, config),
    [manager, input, config]
  )
}
