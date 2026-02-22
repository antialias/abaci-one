'use client'

import { useCallback, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'

/**
 * Smart TTS for the typing game.
 * Speaks encouragement early on, then goes silent after the kid gets it.
 *
 * Word-speaking and spell-back are subject to suppression after 3 consecutive
 * clean words. Difficulty advances reset suppression so the child hears the
 * new word spoken aloud again.
 */
export function useTypingTTS() {
  const speak = useTTS({
    tone: 'Gently encouraging a young child learning to type.',
    say: { en: 'Type each letter!' },
  })

  const instructionCount = useRef(0)
  const suppressedRef = useRef(false)
  const MAX_INSTRUCTIONS = 6

  const speakIfAllowed = useCallback(
    (text: string) => {
      if (suppressedRef.current) return
      if (instructionCount.current >= MAX_INSTRUCTIONS) {
        suppressedRef.current = true
        return
      }
      instructionCount.current++
      speak({ say: { en: text } })
    },
    [speak]
  )

  const speakGameStart = useCallback(() => {
    speakIfAllowed('Type each letter!')
  }, [speakIfAllowed])

  const speakWordComplete = useCallback(() => {
    speakIfAllowed('Great job!')
  }, [speakIfAllowed])

  /** Say the word aloud (e.g. "cat!"). Subject to suppression. */
  const speakWord = useCallback(
    (word: string) => {
      speakIfAllowed(word)
    },
    [speakIfAllowed]
  )

  /** Spell then say: "C. A. T. cat!". Subject to suppression. */
  const spellBack = useCallback(
    (word: string) => {
      const spelled = word
        .toUpperCase()
        .split('')
        .join('. ')
      speakIfAllowed(`${spelled}. ${word}!`)
    },
    [speakIfAllowed]
  )

  const speakDifficultyAdvance = useCallback(() => {
    // Always speak on difficulty advance (reset suppression for this)
    instructionCount.current = Math.min(instructionCount.current, MAX_INSTRUCTIONS - 1)
    suppressedRef.current = false
    speakIfAllowed('Wow, bigger words!')
  }, [speakIfAllowed])

  const speakTimerWarning = useCallback(() => {
    speakIfAllowed('Ten seconds left!')
  }, [speakIfAllowed])

  /** Call after 3 consecutive clean words to suppress further TTS */
  const suppressAfterCleanStreak = useCallback(() => {
    suppressedRef.current = true
  }, [])

  const reset = useCallback(() => {
    instructionCount.current = 0
    suppressedRef.current = false
  }, [])

  return {
    speakGameStart,
    speakWordComplete,
    speakWord,
    spellBack,
    speakDifficultyAdvance,
    speakTimerWarning,
    suppressAfterCleanStreak,
    reset,
  }
}
