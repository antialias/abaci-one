/**
 * Animation Controller Hook
 *
 * Consolidates animation state for give-up, hint, and celebration animations.
 * Uses the underlying usePulsingAnimation hook for consistent animation behavior.
 */

import { useCallback, useMemo, useRef, useState } from 'react'

import type { CelebrationType } from '../../Provider'
import { CELEBRATION_TIMING } from '../../utils/celebration'
import { usePulsingAnimation } from './usePulsingAnimation'

// ============================================================================
// Types
// ============================================================================

export interface AnimationControllerState {
  // Give-up reveal
  giveUpProgress: number
  isGiveUpAnimating: boolean

  // Hint
  hintProgress: number
  isHintAnimating: boolean

  // Celebration
  celebrationProgress: number
  /** Celebration doesn't have a separate boolean - it's derived from whether celebration is active */
}

export interface AnimationControllerActions {
  /**
   * Start the give-up reveal animation.
   * @param onComplete Called after animation and cooldown complete
   */
  startGiveUp: (onComplete: () => void) => void

  /**
   * Cancel the give-up animation and reset state.
   */
  cancelGiveUp: () => void

  /**
   * Start the hint animation.
   * @param onComplete Called when animation completes
   */
  startHint: (onComplete: () => void) => void

  /**
   * Cancel the hint animation and reset state.
   */
  cancelHint: () => void

  /**
   * Start the celebration animation.
   * @param celebrationType The type of celebration ('lightning' | 'standard' | 'hard-earned')
   */
  startCelebration: (celebrationType: CelebrationType) => void

  /**
   * Cancel the celebration animation and reset state.
   */
  cancelCelebration: () => void

  /**
   * Cancel all animations and reset all state.
   */
  cancelAll: () => void
}

export type AnimationController = AnimationControllerState & AnimationControllerActions

// ============================================================================
// Constants
// ============================================================================

const GIVE_UP_ANIMATION = {
  duration: 2000,
  pulses: 3,
  cooldownMs: 500, // Wait before cleanup
}

const HINT_ANIMATION = {
  duration: 1500,
  pulses: 2,
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook that consolidates animation state for give-up, hint, and celebration.
 *
 * Uses usePulsingAnimation internally for consistent pulsing behavior.
 * All animation state is managed in one place, making it easier to coordinate
 * and debug animations.
 *
 * @example
 * ```tsx
 * const animations = useAnimationController()
 *
 * // Start give-up animation
 * animations.startGiveUp(() => {
 *   // Clear reveal state after animation
 *   setGiveUpReveal(null)
 * })
 *
 * // Use progress values in render
 * <path opacity={animations.giveUpProgress} />
 * ```
 */
export function useAnimationController(): AnimationController {
  // ----- Give-up state -----
  const [giveUpProgress, setGiveUpProgress] = useState(0)
  const [isGiveUpAnimating, setIsGiveUpAnimating] = useState(false)
  const giveUpPulsing = usePulsingAnimation()
  const giveUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const giveUpIsCancelledRef = useRef(false)

  // ----- Hint state -----
  const [hintProgress, setHintProgress] = useState(0)
  const [isHintAnimating, setIsHintAnimating] = useState(false)
  const hintPulsing = usePulsingAnimation()

  // ----- Celebration state -----
  const [celebrationProgress, setCelebrationProgress] = useState(0)
  const celebrationPulsing = usePulsingAnimation()

  // ----- Give-up actions -----
  const startGiveUp = useCallback(
    (onComplete: () => void) => {
      giveUpIsCancelledRef.current = false
      setIsGiveUpAnimating(true)

      giveUpPulsing.start({
        duration: GIVE_UP_ANIMATION.duration,
        pulses: GIVE_UP_ANIMATION.pulses,
        onProgress: (pulseProgress) => {
          if (!giveUpIsCancelledRef.current) {
            setGiveUpProgress(pulseProgress)
          }
        },
        onComplete: () => {
          // Wait for cooldown before cleanup
          giveUpTimeoutRef.current = setTimeout(() => {
            if (!giveUpIsCancelledRef.current) {
              setGiveUpProgress(0)
              setIsGiveUpAnimating(false)
              onComplete()
            }
          }, GIVE_UP_ANIMATION.cooldownMs)
        },
      })
    },
    [giveUpPulsing]
  )

  const cancelGiveUp = useCallback(() => {
    giveUpIsCancelledRef.current = true
    giveUpPulsing.cancel()
    if (giveUpTimeoutRef.current) {
      clearTimeout(giveUpTimeoutRef.current)
      giveUpTimeoutRef.current = null
    }
    setGiveUpProgress(0)
    setIsGiveUpAnimating(false)
  }, [giveUpPulsing])

  // ----- Hint actions -----
  const startHint = useCallback(
    (onComplete: () => void) => {
      setIsHintAnimating(true)

      hintPulsing.start({
        duration: HINT_ANIMATION.duration,
        pulses: HINT_ANIMATION.pulses,
        onProgress: setHintProgress,
        onComplete: () => {
          setHintProgress(0)
          setIsHintAnimating(false)
          onComplete()
        },
      })
    },
    [hintPulsing]
  )

  const cancelHint = useCallback(() => {
    hintPulsing.cancel()
    setHintProgress(0)
    setIsHintAnimating(false)
  }, [hintPulsing])

  // ----- Celebration actions -----
  const startCelebration = useCallback(
    (celebrationType: CelebrationType) => {
      const timing = CELEBRATION_TIMING[celebrationType]

      // Calculate pulses based on celebration type (matching MapRenderer behavior)
      const pulses = celebrationType === 'lightning' ? 2 : celebrationType === 'standard' ? 3 : 4

      celebrationPulsing.start({
        duration: timing.totalDuration,
        pulses,
        onProgress: setCelebrationProgress,
        // No onComplete - animation runs until cancelled
      })
    },
    [celebrationPulsing]
  )

  const cancelCelebration = useCallback(() => {
    celebrationPulsing.cancel()
    setCelebrationProgress(0)
  }, [celebrationPulsing])

  // ----- Cancel all -----
  const cancelAll = useCallback(() => {
    cancelGiveUp()
    cancelHint()
    cancelCelebration()
  }, [cancelGiveUp, cancelHint, cancelCelebration])

  // ----- Return memoized controller -----
  return useMemo(
    () => ({
      // State
      giveUpProgress,
      isGiveUpAnimating,
      hintProgress,
      isHintAnimating,
      celebrationProgress,
      // Actions
      startGiveUp,
      cancelGiveUp,
      startHint,
      cancelHint,
      startCelebration,
      cancelCelebration,
      cancelAll,
    }),
    [
      giveUpProgress,
      isGiveUpAnimating,
      hintProgress,
      isHintAnimating,
      celebrationProgress,
      startGiveUp,
      cancelGiveUp,
      startHint,
      cancelHint,
      startCelebration,
      cancelCelebration,
      cancelAll,
    ]
  )
}
