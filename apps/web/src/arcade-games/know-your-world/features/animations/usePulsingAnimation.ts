import { useCallback, useMemo, useRef } from "react";

export interface PulsingAnimationOptions {
  /** Duration of the animation in milliseconds */
  duration: number;
  /** Number of pulses during the animation */
  pulses: number;
  /** Called on each animation frame with the pulse progress (0-1) */
  onProgress: (pulseProgress: number) => void;
  /** Called when the animation completes naturally (not cancelled) */
  onComplete?: () => void;
}

/**
 * Hook for creating pulsing animations using requestAnimationFrame.
 *
 * The pulsing effect uses a sine wave for smooth on/off transitions:
 * `sin(progress * π * pulses * 2) * 0.5 + 0.5`
 *
 * This creates a value that oscillates between 0 and 1 for the specified
 * number of pulses over the duration.
 *
 * @example
 * ```tsx
 * const { start, cancel } = usePulsingAnimation()
 *
 * useEffect(() => {
 *   start({
 *     duration: 2000,
 *     pulses: 3,
 *     onProgress: (progress) => setFlashProgress(progress),
 *     onComplete: () => console.log('Animation complete')
 *   })
 *   return () => cancel()
 * }, [start, cancel])
 * ```
 */
export function usePulsingAnimation() {
  const animationFrameId = useRef<number | null>(null);
  const isCancelled = useRef(false);

  const cancel = useCallback(() => {
    isCancelled.current = true;
    if (animationFrameId.current !== null) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  }, []);

  const start = useCallback(
    (options: PulsingAnimationOptions) => {
      const { duration, pulses, onProgress, onComplete } = options;

      // Cancel any existing animation
      cancel();

      // Reset cancellation flag for new animation
      isCancelled.current = false;

      const startTime = Date.now();

      const animate = () => {
        if (isCancelled.current) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Create pulsing effect: sin wave for smooth on/off
        const pulseProgress =
          Math.sin(progress * Math.PI * pulses * 2) * 0.5 + 0.5;
        onProgress(pulseProgress);

        if (progress < 1) {
          animationFrameId.current = requestAnimationFrame(animate);
        } else {
          animationFrameId.current = null;
          onComplete?.();
        }
      };

      animationFrameId.current = requestAnimationFrame(animate);
    },
    [cancel],
  );

  // Memoize the returned object to prevent re-renders when used as a dependency
  return useMemo(() => ({ start, cancel }), [start, cancel]);
}
