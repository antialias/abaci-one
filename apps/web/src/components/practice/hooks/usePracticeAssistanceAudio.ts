'use client'

import { useEffect, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import {
  ENCOURAGING_CLIPS,
  OFFERING_HELP_CLIPS,
  TRY_USING_HELP,
} from '@/lib/audio/clips/assistance'
import type { AssistanceStateName } from './useProgressiveAssistance'

interface UsePracticeAssistanceAudioOptions {
  assistanceState: AssistanceStateName
  showWrongAnswerSuggestion: boolean
  replayProblem: () => void
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Speaks audio cues when the progressive assistance state machine transitions.
 *
 * Escalation is gentle:
 * - idle → encouraging: silent replay of the problem (no spoken text)
 * - encouraging → offeringHelp: spoken "Need some help?" prompt
 * - showWrongAnswerSuggestion becomes true: spoken "This is tricky!" prompt
 */
export function usePracticeAssistanceAudio({
  assistanceState,
  showWrongAnswerSuggestion,
  replayProblem,
}: UsePracticeAssistanceAudioOptions) {
  const prevStateRef = useRef<AssistanceStateName>(assistanceState)
  const prevWrongSuggestionRef = useRef(showWrongAnswerSuggestion)

  // Pre-register clips so they can be collected/preloaded
  const sayOfferingHelp = useTTS(pickRandom(OFFERING_HELP_CLIPS), {
    tone: 'encouragement',
  })
  const sayTryUsingHelp = useTTS(TRY_USING_HELP, {
    tone: 'encouragement',
  })

  useEffect(() => {
    const prevState = prevStateRef.current
    const prevWrong = prevWrongSuggestionRef.current
    prevStateRef.current = assistanceState
    prevWrongSuggestionRef.current = showWrongAnswerSuggestion

    // idle → encouraging: replay the problem audio (subtle nudge, no spoken text)
    if (prevState === 'idle' && assistanceState === 'encouraging') {
      replayProblem()
      return
    }

    // encouraging → offeringHelp: speak a help prompt
    if (prevState === 'encouraging' && assistanceState === 'offeringHelp') {
      sayOfferingHelp(pickRandom(OFFERING_HELP_CLIPS))
      return
    }

    // Wrong answer suggestion just appeared: speak "try using help"
    if (!prevWrong && showWrongAnswerSuggestion) {
      sayTryUsingHelp()
      return
    }
  }, [
    assistanceState,
    showWrongAnswerSuggestion,
    replayProblem,
    sayOfferingHelp,
    sayTryUsingHelp,
  ])
}
