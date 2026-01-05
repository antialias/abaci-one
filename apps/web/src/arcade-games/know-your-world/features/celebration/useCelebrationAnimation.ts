/**
 * Celebration Animation Hook
 *
 * Manages the pulsing gold flash animation effect when a player finds
 * the correct region on the map.
 *
 * The animation timing varies by celebration type:
 * - Lightning: 2 pulses (fast find)
 * - Standard: 3 pulses (normal find)
 * - Slow/other: 4 pulses (took longer)
 *
 * Usage:
 * ```tsx
 * const { celebrationFlashProgress } = useCelebrationAnimation({
 *   celebration,
 * })
 * ```
 */

"use client";

import { useEffect, useState } from "react";
import { usePulsingAnimation } from "../animations";
import { CELEBRATION_TIMING } from "../../utils/celebration";
import type { CelebrationType } from "../../Provider";

// ============================================================================
// Types
// ============================================================================

export interface Celebration {
  regionId: string;
  regionName: string;
  type: CelebrationType;
  startTime: number;
}

export interface UseCelebrationAnimationOptions {
  /** The current celebration state, or null if not celebrating */
  celebration: Celebration | null;
}

export interface UseCelebrationAnimationReturn {
  /** Pulsing value 0-1 for gold flash animation */
  celebrationFlashProgress: number;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing celebration pulsing animation.
 *
 * When celebration starts (detected by startTime), triggers a pulsing
 * gold flash animation. The number of pulses varies by celebration type.
 *
 * @param options - Configuration options
 * @returns Celebration animation state
 */
export function useCelebrationAnimation(
  options: UseCelebrationAnimationOptions,
): UseCelebrationAnimationReturn {
  const { celebration } = options;

  // Animation state
  const [celebrationFlashProgress, setCelebrationFlashProgress] = useState(0);

  // Animation controller
  const celebrationAnimation = usePulsingAnimation();

  // Celebration animation effect - gold flash when region found
  useEffect(() => {
    if (!celebration) {
      setCelebrationFlashProgress(0);
      return;
    }

    // Animation: pulsing gold flash during celebration
    const timing = CELEBRATION_TIMING[celebration.type];
    const pulses =
      celebration.type === "lightning"
        ? 2
        : celebration.type === "standard"
          ? 3
          : 4;

    celebrationAnimation.start({
      duration: timing.totalDuration,
      pulses,
      onProgress: setCelebrationFlashProgress,
      // No onComplete - animation just runs until cleanup
    });

    // Cleanup
    return () => {
      celebrationAnimation.cancel();
    };
  }, [celebration?.startTime, celebrationAnimation]);

  return {
    celebrationFlashProgress,
  };
}
