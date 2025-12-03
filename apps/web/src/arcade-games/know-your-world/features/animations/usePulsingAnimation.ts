/**
 * Pulsing Animation Utility
 *
 * Provides a reusable sin-wave pulsing animation pattern used for:
 * - Give-up reveal flash
 * - Hint flash
 * - Celebration flash
 *
 * The animation creates smooth on/off pulsing by using:
 * pulseProgress = sin(progress * PI * pulses * 2) * 0.5 + 0.5
 *
 * This produces values oscillating between 0 and 1 over the duration,
 * completing the specified number of full pulse cycles.
 */

import { useCallback, useRef } from 'react'

export interface PulsingAnimationConfig {
  /** Total duration in milliseconds */
  duration: number
  /** Number of complete pulse cycles */
  pulses: number
  /** Called on each animation frame with pulse progress (0-1) */
  onProgress: (progress: number) => void
  /** Called when animation completes naturally (not cancelled) */
  onComplete?: () => void
}

export interface UsePulsingAnimationReturn {
  /**
   * Start a new pulsing animation.
   * Cancels any existing animation first.
   */
  start: (config: PulsingAnimationConfig) => void
  /**
   * Cancel the current animation if running.
   * Does not call onComplete.
   */
  cancel: () => void
  /** Whether an animation is currently running */
  isAnimating: boolean
}

/**
 * Hook for running pulsing animations.
 *
 * @example
 * ```tsx
 * const pulseAnimation = usePulsingAnimation()
 *
 * // Start a 2-second animation with 3 pulses
 * pulseAnimation.start({
 *   duration: 2000,
 *   pulses: 3,
 *   onProgress: (progress) => setFlashProgress(progress),
 *   onComplete: () => setFlashProgress(0),
 * })
 *
 * // Cancel if needed
 * pulseAnimation.cancel()
 * ```
 */
export function usePulsingAnimation(): UsePulsingAnimationReturn {
  const animationFrameRef = useRef<number | null>(null)
  const isCancelledRef = useRef(false)
  const isAnimatingRef = useRef(false)

  const cancel = useCallback(() => {
    isCancelledRef.current = true
    isAnimatingRef.current = false
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const start = useCallback(
    (config: PulsingAnimationConfig) => {
      // Cancel any existing animation
      cancel()

      // Reset cancellation flag for new animation
      isCancelledRef.current = false
      isAnimatingRef.current = true

      const { duration, pulses, onProgress, onComplete } = config
      const startTime = Date.now()

      const animate = () => {
        // Check if cancelled
        if (isCancelledRef.current) {
          return
        }

        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Create pulsing effect: sin wave for smooth on/off
        // This produces values oscillating between 0 and 1
        const pulseProgress = Math.sin(progress * Math.PI * pulses * 2) * 0.5 + 0.5
        onProgress(pulseProgress)

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate)
        } else {
          // Animation complete
          isAnimatingRef.current = false
          animationFrameRef.current = null
          onComplete?.()
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    },
    [cancel]
  )

  return {
    start,
    cancel,
    get isAnimating() {
      return isAnimatingRef.current
    },
  }
}

/**
 * Calculate pulse progress for a given time.
 * Useful for one-off calculations or testing.
 *
 * @param elapsed - Time elapsed since animation start (ms)
 * @param duration - Total animation duration (ms)
 * @param pulses - Number of complete pulse cycles
 * @returns Pulse progress value between 0 and 1
 */
export function calculatePulseProgress(elapsed: number, duration: number, pulses: number): number {
  const progress = Math.min(elapsed / duration, 1)
  return Math.sin(progress * Math.PI * pulses * 2) * 0.5 + 0.5
}
