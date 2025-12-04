/**
 * Hint Animation Hook
 *
 * Manages the pulsing animation effect when a hint is shown to highlight
 * the target region on the map.
 *
 * Usage:
 * ```tsx
 * const { hintFlashProgress, isHintAnimating } = useHintAnimation({
 *   hintActive: props.hintActive,
 * })
 * ```
 */

'use client'

import { useEffect, useState } from 'react'
import { usePulsingAnimation } from '../animations'

// ============================================================================
// Types
// ============================================================================

export interface HintActive {
  regionId: string
  timestamp: number
}

export interface UseHintAnimationOptions {
  /** The currently active hint, or null if no hint */
  hintActive: HintActive | null
}

export interface UseHintAnimationReturn {
  /** Pulsing value 0-1 for flash animation */
  hintFlashProgress: number
  /** Whether animation is currently in progress */
  isHintAnimating: boolean
}

// ============================================================================
// Constants
// ============================================================================

/** Duration of the hint animation in milliseconds */
const HINT_ANIMATION_DURATION = 1500

/** Number of pulses during the hint animation */
const HINT_ANIMATION_PULSES = 2

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing hint pulsing animation.
 *
 * When hintActive changes (detected by timestamp), triggers a brief pulsing
 * animation to draw attention to the target region.
 *
 * @param options - Configuration options
 * @returns Hint animation state
 */
export function useHintAnimation(options: UseHintAnimationOptions): UseHintAnimationReturn {
  const { hintActive } = options

  // Animation state
  const [hintFlashProgress, setHintFlashProgress] = useState(0)
  const [isHintAnimating, setIsHintAnimating] = useState(false)

  // Animation controller
  const hintAnimation = usePulsingAnimation()

  // Hint animation effect - brief pulse to highlight target region
  useEffect(() => {
    if (!hintActive) {
      setHintFlashProgress(0)
      setIsHintAnimating(false)
      return
    }

    // Start animation
    setIsHintAnimating(true)

    // Animation: 2 pulses over 1.5 seconds (shorter than give-up)
    hintAnimation.start({
      duration: HINT_ANIMATION_DURATION,
      pulses: HINT_ANIMATION_PULSES,
      onProgress: setHintFlashProgress,
      onComplete: () => {
        setHintFlashProgress(0)
        setIsHintAnimating(false)
      },
    })

    // Cleanup
    return () => {
      hintAnimation.cancel()
    }
  }, [hintActive?.timestamp, hintAnimation]) // Re-run when timestamp changes

  return {
    hintFlashProgress,
    isHintAnimating,
  }
}
