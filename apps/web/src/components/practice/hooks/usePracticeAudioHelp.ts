'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'
import { termsToSentence } from '@/lib/audio/termsToSentence'
import { buildFeedbackText } from '@/lib/audio/buildFeedbackText'

const MATH_TONE =
  'Speaking clearly and steadily, reading a math problem to a young child. Pause slightly between each number and operator.'
const CELEBRATION_TONE =
  'Warmly congratulating a child. Genuinely encouraging and happy.'
const CORRECTIVE_TONE =
  'Gently guiding a child after a wrong answer. Kind, not disappointed.'

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
  const { stop } = useAudioManager()

  const problemText = useMemo(
    () => (terms ? termsToSentence(terms) : ''),
    [terms]
  )
  const feedbackText = useMemo(
    () =>
      showingFeedback && isCorrect !== null && correctAnswer !== null
        ? buildFeedbackText(isCorrect, correctAnswer)
        : '',
    [showingFeedback, isCorrect, correctAnswer]
  )

  const sayProblem = useTTS(problemText, { tone: MATH_TONE })
  const sayFeedback = useTTS(feedbackText, {
    tone: isCorrect ? CELEBRATION_TONE : CORRECTIVE_TONE,
  })

  // Auto-play problem when terms change
  const prevTermsRef = useRef<number[] | null>(null)
  useEffect(() => {
    if (!problemText || terms === prevTermsRef.current) return
    prevTermsRef.current = terms
    sayProblem()
  }, [problemText, terms, sayProblem])

  // Auto-play feedback
  const playedFeedbackRef = useRef(false)
  useEffect(() => {
    if (!feedbackText || playedFeedbackRef.current) return
    playedFeedbackRef.current = true
    sayFeedback()
  }, [feedbackText, sayFeedback])

  // Reset feedback flag
  useEffect(() => {
    if (!showingFeedback) playedFeedbackRef.current = false
  }, [showingFeedback])

  // Stop audio on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])

  return { replayProblem: sayProblem }
}
