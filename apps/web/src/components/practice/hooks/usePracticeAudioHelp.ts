'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'
import { termsToClipIds } from '@/lib/audio/termsToClipIds'
import { buildFeedbackClipIds } from '@/lib/audio/buildFeedbackClipIds'
import { calculateStreak } from '@/lib/calculateStreak'

interface UsePracticeAudioHelpOptions {
  terms: number[] | null
  showingFeedback: boolean
  isCorrect: boolean | null
  correctAnswer: number | null
  results?: boolean[]
}

export function usePracticeAudioHelp({
  terms,
  showingFeedback,
  isCorrect,
  correctAnswer,
  results,
}: UsePracticeAudioHelpOptions) {
  const { stop } = useAudioManager()

  const streak = useMemo(
    () => (results ? calculateStreak(results) : 0),
    [results]
  )

  const problemClipIds = useMemo(
    () => (terms ? termsToClipIds(terms) : []),
    [terms]
  )

  const feedbackClipIds = useMemo(
    () =>
      showingFeedback && isCorrect !== null && correctAnswer !== null
        ? buildFeedbackClipIds(isCorrect, correctAnswer, { streak })
        : [],
    [showingFeedback, isCorrect, correctAnswer, streak]
  )

  const sayProblem = useTTS(problemClipIds, {
    tone: 'math-dictation',
  })
  const sayFeedback = useTTS(feedbackClipIds, {
    tone: isCorrect ? 'celebration' : 'corrective',
  })

  // Auto-play problem when terms change
  const prevTermsRef = useRef<number[] | null>(null)
  useEffect(() => {
    if (problemClipIds.length === 0 || terms === prevTermsRef.current) return
    prevTermsRef.current = terms
    sayProblem()
  }, [problemClipIds, terms, sayProblem])

  // Auto-play feedback
  const playedFeedbackRef = useRef(false)
  useEffect(() => {
    if (feedbackClipIds.length === 0 || playedFeedbackRef.current) return
    playedFeedbackRef.current = true
    sayFeedback()
  }, [feedbackClipIds, sayFeedback])

  // Reset feedback flag
  useEffect(() => {
    if (!showingFeedback) playedFeedbackRef.current = false
  }, [showingFeedback])

  // Stop audio on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])

  // Wrap to prevent React onClick from passing MouseEvent as overrideInput
  return { replayProblem: useCallback(() => sayProblem(), [sayProblem]) }
}
