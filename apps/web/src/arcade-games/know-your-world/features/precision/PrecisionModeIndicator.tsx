/**
 * Precision Mode Indicator Component
 *
 * Visual overlays that indicate precision mode status:
 * - Gold scrim when at threshold (precision mode recommended)
 * - Filter effect for "disabled" appearance when zoom is capped
 *
 * These overlays help communicate to the user when they should
 * click to activate precision mode for fine-grained cursor control.
 */

'use client'

import type { CSSProperties } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface PrecisionModeScrimProps {
  /** Whether the scrim should be visible */
  show: boolean
  /** Border radius to match container */
  borderRadius?: string
}

export interface PrecisionModeFilterProps {
  /** Whether to apply the disabled filter effect */
  isAtThreshold: boolean
  /** Whether precision mode is active (filter should not apply) */
  pointerLocked: boolean
  /** Whether device supports precision mode */
  canUsePrecisionMode: boolean
}

// ============================================================================
// Scrim Component
// ============================================================================

/**
 * Gold scrim overlay that appears when precision mode is at threshold.
 *
 * This visual indicator shows that the magnifier is at a zoom level
 * where precision mode should be activated for accurate selection.
 *
 * @example
 * ```tsx
 * <PrecisionModeScrim
 *   show={isAtThreshold && !pointerLocked && canUsePrecisionMode}
 *   borderRadius="12px"
 * />
 * ```
 */
export function PrecisionModeScrim({ show, borderRadius = '12px' }: PrecisionModeScrimProps) {
  if (!show) return null

  return (
    <div
      data-element="precision-mode-scrim"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(251, 191, 36, 0.15)', // Gold scrim
        pointerEvents: 'none',
        borderRadius,
      }}
    />
  )
}

// ============================================================================
// Filter Style Utility
// ============================================================================

/**
 * Get the CSS filter style for precision mode threshold indication.
 *
 * When at threshold but not in precision mode, applies a "disabled"
 * visual effect (reduced brightness and saturation) to indicate
 * that the user should click to activate precision mode.
 *
 * @param props - Filter configuration
 * @returns CSS filter string ('none' or 'brightness(0.6) saturate(0.5)')
 *
 * @example
 * ```tsx
 * const filterStyle = getPrecisionModeFilter({
 *   isAtThreshold: true,
 *   pointerLocked: false,
 *   canUsePrecisionMode: true,
 * })
 * // Returns: 'brightness(0.6) saturate(0.5)'
 * ```
 */
export function getPrecisionModeFilter({
  isAtThreshold,
  pointerLocked,
  canUsePrecisionMode,
}: PrecisionModeFilterProps): CSSProperties['filter'] {
  // No filter when in precision mode (pointer locked)
  if (pointerLocked) return 'none'

  // No filter when precision mode isn't available
  if (!canUsePrecisionMode) return 'none'

  // No filter when below threshold
  if (!isAtThreshold) return 'none'

  // Apply "disabled" visual effect when at threshold but not in precision mode
  return 'brightness(0.6) saturate(0.5)'
}

// ============================================================================
// Status Label Utility
// ============================================================================

export interface PrecisionModeStatusLabelOptions {
  /** Current zoom level */
  currentZoom: number
  /** Current screen pixel ratio */
  screenPixelRatio: number
  /** Whether at threshold */
  isAtThreshold: boolean
  /** Whether pointer is locked (precision mode active) */
  pointerLocked: boolean
  /** Whether device supports precision mode */
  canUsePrecisionMode: boolean
  /** Whether to show debug info */
  showDebugInfo: boolean
}

/**
 * Get the status label text for the magnifier overlay.
 *
 * Returns different messages based on precision mode state:
 * - "Click to activate precision mode" when at threshold
 * - Debug info (zoom + ratio) when debug is enabled
 * - Simple zoom level otherwise
 *
 * @param options - Status label options
 * @returns Status label text
 *
 * @example
 * ```tsx
 * const label = getPrecisionModeStatusLabel({
 *   currentZoom: 25,
 *   screenPixelRatio: 22,
 *   isAtThreshold: true,
 *   pointerLocked: false,
 *   canUsePrecisionMode: true,
 *   showDebugInfo: false,
 * })
 * // Returns: 'Click to activate precision mode'
 * ```
 */
export function getPrecisionModeStatusLabel({
  currentZoom,
  screenPixelRatio,
  isAtThreshold,
  pointerLocked,
  canUsePrecisionMode,
  showDebugInfo,
}: PrecisionModeStatusLabelOptions): string {
  // When in precision mode, just show zoom
  if (pointerLocked) {
    return `${currentZoom.toFixed(1)}×`
  }

  // When at threshold and precision mode is available, show activation message
  if (canUsePrecisionMode && isAtThreshold) {
    return 'Click to activate precision mode'
  }

  // Below threshold - show debug info or simple zoom
  if (showDebugInfo) {
    return `${currentZoom.toFixed(1)}× | ${screenPixelRatio.toFixed(1)} px/px`
  }

  return `${currentZoom.toFixed(1)}×`
}
