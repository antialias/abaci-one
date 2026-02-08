'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useAudioHelp } from '@/contexts/AudioHelpContext'
import { feedbackToSequence, problemToSequence } from '@/lib/audio/problemReader'

interface UsePracticeAudioHelpOptions {
  terms: number[] | null
  showingFeedback: boolean
  isCorrect: boolean | null
  correctAnswer: number | null
}

export function usePracticeAudioHelp({
  terms,
  showingFeedback,
  isCorrect,
  correctAnswer,
}: UsePracticeAudioHelpOptions) {
  const { isEnabled, playSequence, stop } = useAudioHelp()
  const lastTermsKeyRef = useRef<string>('')
  const lastFeedbackRef = useRef(false)

  // Auto-read problem when terms change
  useEffect(() => {
    if (!isEnabled || !terms || terms.length === 0) return

    const termsKey = terms.join(',')
    if (termsKey === lastTermsKeyRef.current) return
    lastTermsKeyRef.current = termsKey

    const sequence = problemToSequence(terms)
    if (sequence.length > 0) {
      playSequence(sequence)
    }
  }, [isEnabled, terms, playSequence])

  // Auto-read feedback
  useEffect(() => {
    if (!isEnabled) return

    if (showingFeedback && !lastFeedbackRef.current) {
      lastFeedbackRef.current = true
      if (isCorrect !== null && correctAnswer !== null) {
        const sequence = feedbackToSequence(isCorrect, correctAnswer)
        playSequence(sequence)
      }
    } else if (!showingFeedback) {
      lastFeedbackRef.current = false
    }
  }, [isEnabled, showingFeedback, isCorrect, correctAnswer, playSequence])

  // Stop audio on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])

  const replayProblem = useCallback(() => {
    if (!isEnabled || !terms || terms.length === 0) return
    const sequence = problemToSequence(terms)
    if (sequence.length > 0) {
      playSequence(sequence)
    }
  }, [isEnabled, terms, playSequence])

  return { replayProblem }
}
