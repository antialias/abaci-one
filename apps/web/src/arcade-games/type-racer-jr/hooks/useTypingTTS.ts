'use client'

import { useCallback, useRef, useState } from 'react'
import { useTTS } from '@/hooks/useTTS'

/**
 * Smart TTS for the typing game.
 *
 * - `announceWord` says the word aloud, then (for the first few words) spells
 *   the letters. Chained via await so they don't talk over each other.
 * - Encouragement messages suppress after repeated use.
 * - A global mute toggle silences everything.
 */
export function useTypingTTS() {
  const speak = useTTS({
    tone: 'Gently encouraging a young child learning to type.',
    say: { en: 'Type each letter!' },
  })

  const [muted, setMuted] = useState(false)

  const instructionCount = useRef(0)
  const suppressedRef = useRef(false)
  const MAX_INSTRUCTIONS = 6

  /**
   * Announce a new word: say it aloud, then spell the letters (first few only).
   * Chained sequentially so they don't overlap.
   */
  const announceWord = useCallback(
    async (word: string) => {
      if (muted) return

      // Always say the word
      await speak({ say: { en: word } })

      // Spell the letters for the first few words (subject to suppression)
      if (!suppressedRef.current && instructionCount.current < MAX_INSTRUCTIONS) {
        instructionCount.current++
        const spelled = word.toUpperCase().split('').join('. ')
        await speak({ say: { en: `${spelled}.` } })
      }
    },
    [speak, muted]
  )

  const speakGameStart = useCallback(async () => {
    if (muted) return
    await speak({ say: { en: 'Type each letter!' } })
  }, [speak, muted])

  const speakWordComplete = useCallback(async () => {
    if (muted) return
    if (suppressedRef.current) return
    if (instructionCount.current >= MAX_INSTRUCTIONS) {
      suppressedRef.current = true
      return
    }
    instructionCount.current++
    await speak({ say: { en: 'Great job!' } })
  }, [speak, muted])

  const speakDifficultyAdvance = useCallback(async () => {
    if (muted) return
    // Reset suppression so the child hears encouragement again
    instructionCount.current = Math.min(instructionCount.current, MAX_INSTRUCTIONS - 1)
    suppressedRef.current = false
    await speak({ say: { en: 'Wow, bigger words!' } })
  }, [speak, muted])

  const speakTimerWarning = useCallback(async () => {
    if (muted) return
    await speak({ say: { en: 'Ten seconds left!' } })
  }, [speak, muted])

  const toggleMute = useCallback(() => {
    setMuted((prev) => !prev)
  }, [])

  const reset = useCallback(() => {
    instructionCount.current = 0
    suppressedRef.current = false
  }, [])

  return {
    announceWord,
    speakGameStart,
    speakWordComplete,
    speakDifficultyAdvance,
    speakTimerWarning,
    toggleMute,
    isMuted: muted,
    reset,
  }
}
