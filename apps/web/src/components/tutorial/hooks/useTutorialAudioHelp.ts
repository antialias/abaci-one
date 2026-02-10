'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'

interface UseTutorialAudioHelpOptions {
  currentStepIndex: number
  stepTitle: string | undefined
}

export function useTutorialAudioHelp({ currentStepIndex, stepTitle }: UseTutorialAudioHelpOptions) {
  const { isEnabled, stop } = useAudioManager()
  const lastStepIndexRef = useRef<number>(-1)

  const sayWelcome = useTTS('tutorial-welcome', {
    tone: 'tutorial-instruction',
    say: { en: 'Welcome to the tutorial!' },
  })
  const sayLookAtAbacus = useTTS('tutorial-look-at-abacus', {
    tone: 'tutorial-instruction',
    say: { en: 'Look at the abacus.' },
  })
  const sayTapTheBead = useTTS('tutorial-tap-the-bead', {
    tone: 'tutorial-instruction',
    say: { en: 'Tap the bead.' },
  })
  const sayThisIsOne = useTTS('tutorial-this-is-one', {
    tone: 'tutorial-instruction',
    say: { en: 'This is one.' },
  })
  const sayMoveBeadUp = useTTS('tutorial-move-bead-up', {
    tone: 'tutorial-instruction',
    say: { en: 'Move the bead up.' },
  })
  const sayThisIsFive = useTTS('tutorial-this-is-five', {
    tone: 'tutorial-instruction',
    say: { en: 'This is five.' },
  })

  // For unmapped steps, use a synthetic clip ID with the step title as say text
  const synthClipId = stepTitle ? `tutorial-step-${currentStepIndex}` : ''
  const saySynth = useTTS(synthClipId, {
    tone: 'tutorial-instruction',
    say: stepTitle ? { en: stepTitle } : undefined,
  })

  const steps = useMemo(
    () => [sayWelcome, sayLookAtAbacus, sayTapTheBead, sayThisIsOne, sayMoveBeadUp, sayThisIsFive],
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
