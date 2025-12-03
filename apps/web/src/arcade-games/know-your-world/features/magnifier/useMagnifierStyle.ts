/**
 * Magnifier Style Hook
 *
 * Memoizes heat-based styling calculations for the magnifier and crosshair.
 * Consolidates repeated calls to getHeatBorderColors and getHeatCrosshairStyle.
 */

import { useMemo } from 'react'
import {
  getHeatBorderColors,
  getHeatCrosshairStyle,
  type HeatBorderStyle,
  type HeatCrosshairStyle,
} from '../../utils/heatStyles'
import type { FeedbackType } from '../../utils/hotColdPhrases'

// ============================================================================
// Types
// ============================================================================

export interface MagnifierStyleInputs {
  /** Current hot/cold feedback type */
  feedbackType: FeedbackType | null
  /** Whether dark mode is active */
  isDark: boolean
  /** Whether hot/cold feedback is enabled */
  hotColdEnabled: boolean
}

export interface MagnifierStyleResult {
  /** Crosshair styling (color, opacity, rotation speed, glow) */
  crosshairStyle: HeatCrosshairStyle
  /** Border styling for magnifier (border color, glow, width) */
  borderStyle: HeatBorderStyle
  /** Target rotation speed in degrees per second (derived from crosshairStyle) */
  rotationSpeedDegPerSec: number
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Memoizes heat-based magnifier styling calculations.
 *
 * Instead of calling getHeatCrosshairStyle and getHeatBorderColors multiple times
 * in the render path, this hook computes them once and memoizes the result.
 *
 * @example
 * ```tsx
 * const { crosshairStyle, borderStyle, rotationSpeedDegPerSec } = useMagnifierStyle({
 *   feedbackType: hotColdFeedbackType,
 *   isDark,
 *   hotColdEnabled: effectiveHotColdEnabled,
 * })
 * ```
 */
export function useMagnifierStyle({
  feedbackType,
  isDark,
  hotColdEnabled,
}: MagnifierStyleInputs): MagnifierStyleResult {
  return useMemo(() => {
    const crosshairStyle = getHeatCrosshairStyle(feedbackType, isDark, hotColdEnabled)
    const borderStyle = getHeatBorderColors(feedbackType, isDark)

    // Convert rotation speed from degrees/frame@60fps to degrees/second
    const rotationSpeedDegPerSec = crosshairStyle.rotationSpeed * 60

    return {
      crosshairStyle,
      borderStyle,
      rotationSpeedDegPerSec,
    }
  }, [feedbackType, isDark, hotColdEnabled])
}
