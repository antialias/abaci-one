'use client'

import { useEffect, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'

// Stable tone constants
const INSTRUCTION_TONE =
  'Patiently guiding a young child through a geometry construction. Clear, steady, encouraging.'
const CELEBRATION_TONE =
  'Warmly congratulating a child on completing a geometric proof. Genuinely happy and impressed.'

interface UseEuclidAudioHelpOptions {
  /** The current step instruction text */
  instruction: string
  /** Whether the entire construction is complete */
  isComplete: boolean
}

export function useEuclidAudioHelp({
  instruction,
  isComplete,
}: UseEuclidAudioHelpOptions) {
  const { isEnabled, stop } = useAudioManager()

  const sayInstruction = useTTS(instruction, { tone: INSTRUCTION_TONE })
  const sayCelebration = useTTS(
    isComplete ? 'Equilateral triangle constructed! Well done!' : '',
    { tone: CELEBRATION_TONE },
  )

  // Auto-play when instruction changes
  const prevInstructionRef = useRef('')
  useEffect(() => {
    if (!isEnabled || !instruction || instruction === prevInstructionRef.current) return
    prevInstructionRef.current = instruction
    sayInstruction()
  }, [isEnabled, instruction, sayInstruction])

  // Auto-play celebration on completion
  const playedCelebrationRef = useRef(false)
  useEffect(() => {
    if (!isEnabled || !isComplete || playedCelebrationRef.current) return
    playedCelebrationRef.current = true
    sayCelebration()
  }, [isEnabled, isComplete, sayCelebration])

  // Stop audio on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])

  return { replay: sayInstruction }
}
