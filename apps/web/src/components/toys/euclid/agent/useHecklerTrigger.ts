/**
 * Heckler trigger hook — watches construction state in playground mode
 * and triggers an incoming call when a proposition pattern is detected.
 *
 * Two-stage activation:
 * 1. 'watching' — passive presence (low-confidence match). Avatar fades in.
 * 2. 'ringing'  — phone rings (high-confidence match). User can answer/dismiss.
 *
 * After dismissal, the matched proposition is suppressed for the session.
 */

import { useRef, useState, useCallback, useEffect } from 'react'
import type { ConstructionState } from '../types'
import { matchProposition, type MatchConfidence } from './propositionMatcher'

export type HecklerStage = 'idle' | 'watching' | 'ringing' | 'answered'

export interface HecklerTriggerState {
  /** Current stage of heckler activation. */
  stage: HecklerStage
  /** The proposition the heckler detected (when stage !== 'idle'). */
  matchedPropId: number | null
  /** Description of what was detected. */
  matchDescription: string | null
  /** Call this whenever the construction changes. Debounced internally. */
  notifyConstructionChange: () => void
  /** Answer the incoming call — starts heckler voice session. */
  answer: () => void
  /** Dismiss the incoming call — suppresses this pattern for the session. */
  dismiss: () => void
}

/** Confidence threshold for each stage. */
const STAGE_FOR_CONFIDENCE: Record<MatchConfidence, HecklerStage> = {
  speculative: 'watching',
  likely: 'ringing',
  confirmed: 'ringing',
}

/**
 * Watch construction state for proposition patterns and trigger heckler activation.
 *
 * Only active when `enabled` is true (typically playground mode).
 * Debounces checks by ~500ms to avoid running the matcher on every keystroke.
 */
export function useHecklerTrigger(
  constructionRef: React.RefObject<ConstructionState>,
  enabled: boolean,
  onAnswer?: (propositionId: number) => void
): HecklerTriggerState {
  const [stage, setStage] = useState<HecklerStage>('idle')
  const [matchedPropId, setMatchedPropId] = useState<number | null>(null)
  const [matchDescription, setMatchDescription] = useState<string | null>(null)

  // Refs for stable access in callbacks
  const stageRef = useRef(stage)
  stageRef.current = stage
  const matchedPropIdRef = useRef(matchedPropId)
  matchedPropIdRef.current = matchedPropId

  // Propositions suppressed for the rest of the session
  const suppressedRef = useRef<Set<number>>(new Set())
  // Debounce timer
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Prevent re-triggering after answer
  const answeredRef = useRef(false)

  const runCheck = useCallback(() => {
    if (!enabled || answeredRef.current) return
    const state = constructionRef.current
    if (!state) return

    const match = matchProposition(state)

    if (!match || suppressedRef.current.has(match.propositionId)) {
      // No match or suppressed — fade away if watching
      const cur = stageRef.current
      if (cur === 'watching' || cur === 'ringing') {
        setStage('idle')
        setMatchedPropId(null)
        setMatchDescription(null)
      }
      return
    }

    const targetStage = STAGE_FOR_CONFIDENCE[match.confidence]
    const cur = stageRef.current

    // Only escalate, never de-escalate within a detection
    if (cur === 'idle' || cur === 'watching') {
      // If going from idle to ringing, pass through watching first
      // (the UI will show the avatar briefly before ringing)
      if (cur === 'idle' && targetStage === 'ringing') {
        setStage('ringing')
      } else {
        setStage(targetStage)
      }
      setMatchedPropId(match.propositionId)
      setMatchDescription(match.description)
    }
  }, [enabled, constructionRef])

  /** Call this whenever the construction changes. */
  const notifyConstructionChange = useCallback(() => {
    console.log(
      '[heckler-trigger] notifyConstructionChange, enabled=%s, answered=%s',
      enabled,
      answeredRef.current
    )
    if (!enabled || answeredRef.current) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(runCheck, 500)
  }, [enabled, runCheck])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const answer = useCallback(() => {
    if (stageRef.current !== 'ringing') return
    answeredRef.current = true
    setStage('answered')
    const propId = matchedPropIdRef.current
    if (propId != null) {
      onAnswer?.(propId)
    }
  }, [onAnswer])

  const dismiss = useCallback(() => {
    const propId = matchedPropIdRef.current
    if (propId != null) {
      suppressedRef.current.add(propId)
    }
    setStage('idle')
    setMatchedPropId(null)
    setMatchDescription(null)
  }, [])

  return {
    stage,
    matchedPropId,
    matchDescription,
    notifyConstructionChange,
    answer,
    dismiss,
  }
}
