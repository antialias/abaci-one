'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'
import { termsToClipIds } from '@/lib/audio/termsToClipIds'
import { termsToSentence } from '@/lib/audio/termsToSentence'
import { buildFeedbackClipIds } from '@/lib/audio/buildFeedbackClipIds'
import { buildFeedbackText } from '@/lib/audio/buildFeedbackText'

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

  const problemClipIds = useMemo(
    () => (terms ? termsToClipIds(terms) : []),
    [terms]
  )
  const problemSay = useMemo(
    () => (terms ? termsToSentence(terms) : ''),
    [terms]
  )

  const feedbackClipIds = useMemo(
    () =>
      showingFeedback && isCorrect !== null && correctAnswer !== null
        ? buildFeedbackClipIds(isCorrect, correctAnswer)
        : [],
    [showingFeedback, isCorrect, correctAnswer]
  )
  const feedbackSay = useMemo(
    () =>
      showingFeedback && isCorrect !== null && correctAnswer !== null
        ? buildFeedbackText(isCorrect, correctAnswer)
        : '',
    [showingFeedback, isCorrect, correctAnswer]
  )

  const sayProblem = useTTS(problemClipIds, {
    tone: 'math-dictation',
    say: problemSay ? { en: problemSay } : undefined,
  })
  const sayFeedback = useTTS(feedbackClipIds, {
    tone: isCorrect ? 'celebration' : 'corrective',
    say: feedbackSay ? { en: feedbackSay } : undefined,
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

  return { replayProblem: sayProblem }
}
