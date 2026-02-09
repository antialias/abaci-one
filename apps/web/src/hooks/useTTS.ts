'use client'

import { useCallback, useEffect } from 'react'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'

/**
 * Declare a TTS utterance at the usage site and get a play function.
 *
 * On render: registers the (text, tone) pair with the manager.
 * Returns a stable callback that speaks the text via browser TTS.
 *
 * @param text  The text to speak (empty string skips registration)
 * @param options.tone  Freeform tone description (used for future generation)
 */
export function useTTS(text: string, options: { tone: string }): () => Promise<void> {
  const manager = useAudioManagerInstance()

  // Register on render (idempotent)
  useEffect(() => {
    if (text) {
      manager.register(text, options.tone)
    }
  }, [manager, text, options.tone])

  return useCallback(
    () => manager.speak(text, options.tone),
    [manager, text, options.tone]
  )
}
