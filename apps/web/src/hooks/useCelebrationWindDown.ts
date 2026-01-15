/**
 * Hook for managing celebration wind-down state
 *
 * Tracks when a skill unlock celebration started and provides
 * smooth progress updates via requestAnimationFrame.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { windDownProgress } from '@/utils/interpolate'

// =============================================================================
// Types & Constants
// =============================================================================

interface CelebrationState {
  skillId: string
  startedAt: number
  confettiFired: boolean
}

const CELEBRATION_STORAGE_KEY = 'skill-celebration-state'

// =============================================================================
// localStorage Helpers
// =============================================================================

function getCelebrationState(): CelebrationState | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(CELEBRATION_STORAGE_KEY)
    if (!stored) return null
    return JSON.parse(stored) as CelebrationState
  } catch {
    return null
  }
}

function setCelebrationState(state: CelebrationState): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(CELEBRATION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore localStorage errors
  }
}

function markConfettiFired(skillId: string): void {
  const state = getCelebrationState()
  if (state && state.skillId === skillId) {
    setCelebrationState({ ...state, confettiFired: true })
  }
}

// =============================================================================
// Hook
// =============================================================================

interface UseCelebrationWindDownOptions {
  /** The skill ID that was unlocked */
  skillId: string
  /** Whether this mode requires a tutorial (celebration only for tutorial-required skills) */
  tutorialRequired: boolean
  /** Whether to enable the celebration (pass false to skip) */
  enabled?: boolean
  /** Speed multiplier for testing (1 = normal, 10 = 10x faster, 60 = see full transition in 1 second) */
  speedMultiplier?: number
  /** Force a specific progress value (for Storybook stories) */
  forceProgress?: number
}

interface UseCelebrationWindDownResult {
  /** Progress from 0 (full celebration) to 1 (fully normal) */
  progress: number
  /** Whether confetti should be fired (only true once per skill) */
  shouldFireConfetti: boolean
  /** Current oscillation value for wiggle animation (-1 to 1) */
  oscillation: number
  /** Mark confetti as fired (call after firing) */
  onConfettiFired: () => void
  /** Whether we're in celebration mode at all */
  isCelebrating: boolean
}

export function useCelebrationWindDown({
  skillId,
  tutorialRequired,
  enabled = true,
  speedMultiplier = 1,
  forceProgress,
}: UseCelebrationWindDownOptions): UseCelebrationWindDownResult {
  const [progress, setProgress] = useState(1) // Start at 1 (normal) until we check state
  const [shouldFireConfetti, setShouldFireConfetti] = useState(false)
  const [oscillation, setOscillation] = useState(0)
  const [isCelebrating, setIsCelebrating] = useState(false)

  const rafIdRef = useRef<number | null>(null)
  const confettiFiredRef = useRef(false)
  const startTimeRef = useRef<number | null>(null)

  const onConfettiFired = useCallback(() => {
    if (skillId) {
      markConfettiFired(skillId)
      confettiFiredRef.current = true
      setShouldFireConfetti(false)
    }
  }, [skillId])

  useEffect(() => {
    // If forceProgress is set, use it directly (for Storybook)
    if (forceProgress !== undefined) {
      setProgress(forceProgress)
      setIsCelebrating(forceProgress < 1)
      // Still calculate oscillation for wiggle
      const osc = Math.sin(Date.now() / 250)
      setOscillation(osc)

      // Keep updating oscillation
      const animate = () => {
        const osc = Math.sin(Date.now() / 250)
        setOscillation(osc)
        rafIdRef.current = requestAnimationFrame(animate)
      }
      rafIdRef.current = requestAnimationFrame(animate)

      return () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
        }
      }
    }

    // Don't celebrate if disabled or no tutorial required
    if (!enabled || !tutorialRequired || !skillId) {
      setProgress(1)
      setIsCelebrating(false)
      setShouldFireConfetti(false)
      return
    }

    // Check existing celebration state
    const existingState = getCelebrationState()

    if (!existingState || existingState.skillId !== skillId) {
      // New skill unlock! Start fresh celebration
      const newState: CelebrationState = {
        skillId,
        startedAt: Date.now(),
        confettiFired: false,
      }
      setCelebrationState(newState)
      startTimeRef.current = Date.now()
      setProgress(0)
      setIsCelebrating(true)
      setShouldFireConfetti(true)
      confettiFiredRef.current = false
    } else {
      // Existing celebration - calculate current progress
      startTimeRef.current = existingState.startedAt
      const elapsed = (Date.now() - existingState.startedAt) * speedMultiplier
      const currentProgress = windDownProgress(elapsed)
      setProgress(currentProgress)
      setIsCelebrating(currentProgress < 1)

      // Only fire confetti if it hasn't been fired yet
      if (!existingState.confettiFired && !confettiFiredRef.current) {
        setShouldFireConfetti(true)
      }
    }

    // Animation loop for smooth updates
    const animate = () => {
      const state = getCelebrationState()
      if (!state || state.skillId !== skillId) {
        setProgress(1)
        setIsCelebrating(false)
        return
      }

      // Apply speed multiplier to elapsed time
      const elapsed = (Date.now() - state.startedAt) * speedMultiplier
      const newProgress = windDownProgress(elapsed)

      setProgress(newProgress)
      setIsCelebrating(newProgress < 1)

      // Oscillation for wiggle (period of ~500ms, also sped up)
      const osc = Math.sin((Date.now() * speedMultiplier) / 250)
      setOscillation(osc)

      if (newProgress < 1) {
        rafIdRef.current = requestAnimationFrame(animate)
      }
    }

    rafIdRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [skillId, tutorialRequired, enabled, speedMultiplier, forceProgress])

  return {
    progress,
    shouldFireConfetti,
    oscillation,
    onConfettiFired,
    isCelebrating,
  }
}
