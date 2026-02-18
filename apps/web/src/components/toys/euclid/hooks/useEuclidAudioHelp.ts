'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManager } from '@/hooks/useAudioManager'
import type { ExplorationNarration } from '../propositions/explorationNarration'

// Stable tone constants
const INSTRUCTION_TONE =
  'Patiently guiding a young child through a geometry construction. Clear, steady, encouraging.'
const CELEBRATION_TONE =
  'Warmly congratulating a child on completing a geometric proof. Genuinely happy and impressed.'
const EXPLORATION_TONE =
  'Warmly encouraging a young child to explore and discover geometry. Curious, playful, genuinely excited.'

interface UseEuclidAudioHelpOptions {
  /** The current step instruction text */
  instruction: string
  /** Whether the entire construction is complete */
  isComplete: boolean
  /** Custom celebration message (defaults to generic) */
  celebrationText?: string
  /** Proposition-specific exploration narration (intro + per-point tips) */
  explorationNarration?: ExplorationNarration
}

export function useEuclidAudioHelp({
  instruction,
  isComplete,
  celebrationText = 'Construction complete! Well done!',
  explorationNarration,
}: UseEuclidAudioHelpOptions) {
  const { isEnabled, stop } = useAudioManager()

  const sayInstruction = useTTS(instruction, { tone: INSTRUCTION_TONE })
  const sayCelebration = useTTS(
    isComplete ? celebrationText : '',
    { tone: CELEBRATION_TONE },
  )

  // Register exploration intro for pre-caching (only when narration exists)
  const sayExplorationIntro = useTTS(
    explorationNarration?.introSpeech ?? '',
    { tone: EXPLORATION_TONE },
  )

  // Speaker for dynamic per-point tips (tone set via config, text provided at call time)
  const sayPointTip = useTTS('', { tone: EXPLORATION_TONE })

  // Auto-play when instruction changes
  const prevInstructionRef = useRef('')
  useEffect(() => {
    if (!isEnabled || !instruction || instruction === prevInstructionRef.current) return
    prevInstructionRef.current = instruction
    sayInstruction()
  }, [isEnabled, instruction, sayInstruction])

  // Auto-play celebration or exploration intro on completion
  const playedCelebrationRef = useRef(false)
  const playedExplorationRef = useRef(false)
  useEffect(() => {
    if (!isEnabled || !isComplete) return

    if (explorationNarration && !playedExplorationRef.current) {
      playedExplorationRef.current = true
      playedCelebrationRef.current = true // suppress generic celebration
      sayExplorationIntro()
    } else if (!playedCelebrationRef.current) {
      playedCelebrationRef.current = true
      sayCelebration()
    }
  }, [isEnabled, isComplete, sayCelebration, sayExplorationIntro, explorationNarration])

  // Reset exploration state when rewinding (isComplete goes false)
  useEffect(() => {
    if (!isComplete) {
      playedExplorationRef.current = false
      playedCelebrationRef.current = false
      narratedPointsRef.current = new Set()
      playedBreakdownRef.current = false
    }
  }, [isComplete])

  // Track which points have already had their tip narrated
  const narratedPointsRef = useRef<Set<string>>(new Set())

  const handleDragStart = useCallback(
    (pointId: string) => {
      if (!isEnabled || !explorationNarration) return
      if (narratedPointsRef.current.has(pointId)) return

      const tip = explorationNarration.pointTips.find(t => t.pointId === pointId)
      if (!tip) return

      narratedPointsRef.current.add(pointId)
      sayPointTip({ say: { en: tip.speech } })
    },
    [isEnabled, explorationNarration, sayPointTip],
  )

  // One-shot breakdown narration when the construction falls apart during drag
  const playedBreakdownRef = useRef(false)

  const handleConstructionBreakdown = useCallback(
    () => {
      if (!isEnabled || !explorationNarration?.breakdownTip) return
      if (playedBreakdownRef.current) return

      playedBreakdownRef.current = true
      sayPointTip({ say: { en: explorationNarration.breakdownTip } })
    },
    [isEnabled, explorationNarration, sayPointTip],
  )

  // Stop audio on unmount
  useEffect(() => {
    return () => stop()
  }, [stop])

  return { replay: sayInstruction, handleDragStart, handleConstructionBreakdown }
}
