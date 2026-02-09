'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'

const INST =
  'Patiently guiding a young child through an abacus tutorial. Clear, slow, friendly.'
const CELEB = 'Proudly encouraging a child. Warm and affirming.'

interface UseTutorialAudioHelpOptions {
  currentStepIndex: number
  stepTitle: string | undefined
}

export function useTutorialAudioHelp({
  currentStepIndex,
  stepTitle,
}: UseTutorialAudioHelpOptions) {
  const { isEnabled, stop } = useAudioManager()
  const lastStepIndexRef = useRef<number>(-1)

  const sayWelcome = useTTS('Welcome!', { tone: INST })
  const sayLookAtAbacus = useTTS('Look at the abacus', { tone: INST })
  const sayTapTheBead = useTTS('Tap the bead', { tone: INST })
  const sayThisIsOne = useTTS('This is one', { tone: INST })
  const sayMoveBeadUp = useTTS('Move the bead up', { tone: INST })
  const sayThisIsFive = useTTS('This is five', { tone: INST })

  // For unmapped steps, use the step title directly
  const saySynth = useTTS(stepTitle ?? '', { tone: INST })

  const steps = useMemo(
    () => [
      sayWelcome,
      sayLookAtAbacus,
      sayTapTheBead,
      sayThisIsOne,
      sayMoveBeadUp,
      sayThisIsFive,
    ],
    [sayWelcome, sayLookAtAbacus, sayTapTheBead, sayThisIsOne, sayMoveBeadUp, sayThisIsFive]
  )

  useEffect(() => {
    if (!isEnabled) return
    if (currentStepIndex === lastStepIndexRef.current) return
    lastStepIndexRef.current = currentStepIndex

    const stepFn = steps[currentStepIndex]
    if (stepFn) {
      stepFn()
    } else if (stepTitle) {
      saySynth()
    }
  }, [isEnabled, currentStepIndex, stepTitle, steps, saySynth])

  // Cleanup on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])
}
