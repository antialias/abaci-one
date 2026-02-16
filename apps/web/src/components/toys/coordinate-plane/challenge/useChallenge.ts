import { useRef, useState, useCallback, useEffect } from 'react'
import type { ChallengeState, ChallengePhase } from './types'
import type { WordProblem, DifficultyLevel } from '../wordProblems/types'
import type { RulerState } from '../ruler/types'
import type { CoordinatePlaneState } from '../types'
import { generateWordProblem } from '../wordProblems/generate'
import { checkAnswer } from './answerCheck'

const PRESENT_DELAY_MS = 300
const CELEBRATE_DURATION_MS = 600
const REVEAL_STEP_MS = 500

interface UseChallengeOptions {
  rulerRef: React.MutableRefObject<RulerState>
  stateRef: React.MutableRefObject<CoordinatePlaneState>
  rulerVersion: number
  enabled: boolean
  onComplete?: (problem: WordProblem, attempts: number) => void
  /** Called when a new problem is summoned, to trigger viewport animation */
  onSummon?: (problem: WordProblem) => void
}

export function useChallenge({
  rulerRef,
  stateRef,
  rulerVersion,
  enabled,
  onComplete,
  onSummon,
}: UseChallengeOptions) {
  const challengeRef = useRef<ChallengeState>({
    phase: 'idle',
    problem: null,
    attempts: 0,
    phaseStartTime: 0,
    revealStep: 0,
  })
  const [challengeVersion, setChallengeVersion] = useState(0)

  const updatePhase = useCallback((phase: ChallengePhase) => {
    challengeRef.current.phase = phase
    challengeRef.current.phaseStartTime = performance.now()
    setChallengeVersion(v => v + 1)
  }, [])

  /** Summon a new problem */
  const summonProblem = useCallback((difficulty: DifficultyLevel = 3) => {
    const seed = Math.floor(Math.random() * 0xFFFFFFFF)
    const problem = generateWordProblem(seed, difficulty)
    challengeRef.current.problem = problem
    challengeRef.current.attempts = 0
    challengeRef.current.revealStep = 0

    // Start with auto-adjusting phase (viewport animation)
    updatePhase('auto-adjusting')
    onSummon?.(problem)

    // After a brief delay for viewport animation, transition to presenting
    setTimeout(() => {
      if (challengeRef.current.phase === 'auto-adjusting') {
        updatePhase('presenting')
        // After slide-in animation, transition to solving
        setTimeout(() => {
          if (challengeRef.current.phase === 'presenting') {
            updatePhase('solving')
          }
        }, PRESENT_DELAY_MS)
      }
    }, 600) // viewport animation duration
  }, [enabled, updatePhase, onSummon])

  /** Dismiss the current problem */
  const dismissProblem = useCallback(() => {
    updatePhase('idle')
    challengeRef.current.problem = null
  }, [updatePhase])

  /** Check the answer when ruler changes during solving phase */
  useEffect(() => {
    if (challengeRef.current.phase !== 'solving') return
    if (!challengeRef.current.problem) return

    const ruler = rulerRef.current
    const problem = challengeRef.current.problem
    const { correct } = checkAnswer(ruler.ax, ruler.ay, ruler.bx, ruler.by, problem)

    if (correct) {
      challengeRef.current.attempts += 1
      updatePhase('celebrating')

      // After celebration, start reveal
      setTimeout(() => {
        if (challengeRef.current.phase === 'celebrating') {
          updatePhase('revealing')
          startRevealSequence()
        }
      }, CELEBRATE_DURATION_MS)
    }
  }, [rulerVersion, updatePhase]) // eslint-disable-line react-hooks/exhaustive-deps

  /** Step through reveal annotations one at a time */
  const startRevealSequence = useCallback(() => {
    const problem = challengeRef.current.problem
    if (!problem) return

    const annotatedTags = problem.spans.filter(s => s.tag && s.tag !== 'context' && s.tag !== 'question')
    const totalSteps = annotatedTags.length

    let step = 0
    const interval = setInterval(() => {
      step++
      challengeRef.current.revealStep = step
      setChallengeVersion(v => v + 1)

      if (step >= totalSteps) {
        clearInterval(interval)
        updatePhase('revealed')
        onComplete?.(problem, challengeRef.current.attempts)
      }
    }, REVEAL_STEP_MS)

    return () => clearInterval(interval)
  }, [updatePhase, onComplete])

  return {
    challengeRef,
    challengeVersion,
    summonProblem,
    dismissProblem,
    phase: challengeRef.current.phase,
    problem: challengeRef.current.problem,
  }
}
