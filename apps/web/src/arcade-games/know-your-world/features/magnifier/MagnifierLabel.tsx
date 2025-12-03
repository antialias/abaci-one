/**
 * MagnifierLabel Component
 *
 * Renders the zoom level label and precision mode indicator inside the magnifier.
 * Shows dynamic content based on zoom level, precision mode availability, and
 * pointer lock state.
 */

'use client'

import { animated, type SpringValue } from '@react-spring/web'
import type { RefObject } from 'react'
import { memo } from 'react'
import { getMagnifierDimensions } from '../../utils/magnifierDimensions'
import { calculateScreenPixelRatio, isAboveThreshold } from '../../utils/screenPixelRatio'

// ============================================================================
// Types
// ============================================================================

export interface MagnifierLabelProps {
  /** Zoom spring value for animated content */
  zoomSpring: SpringValue<number>
  /** Movement multiplier spring for precision mode display */
  movementMultiplierSpring: SpringValue<number>
  /** Whether pointer lock is active */
  pointerLocked: boolean
  /** Reference to container element for pointer lock and measurements */
  containerRef: RefObject<HTMLDivElement | null>
  /** Reference to SVG element for measurements */
  svgRef: RefObject<SVGSVGElement | null>
  /** Parsed viewBox dimensions */
  parsedViewBox: { x: number; y: number; width: number; height: number }
  /** Safe zone margins around the UI */
  safeZoneMargins: { top: number; left: number; right: number; bottom: number }
  /** Whether precision mode can be used on this device */
  canUsePrecisionMode: boolean
  /** Whether to show debug info (pixel ratio) */
  showDebugInfo: boolean
  /** Whether dark mode is active */
  isDark: boolean
  /** Precision mode threshold for screen pixel ratio */
  precisionModeThreshold: number
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders the magnifier label showing zoom level and precision mode status.
 *
 * Display modes:
 * - "Precision mode active" when pointer lock is engaged
 * - "Click to activate precision mode" when at threshold and precision available
 * - "{zoom}× | {pixelRatio} px/px" in debug mode
 * - "{zoom}×" in normal mode
 */
export const MagnifierLabel = memo(function MagnifierLabel({
  zoomSpring,
  movementMultiplierSpring,
  pointerLocked,
  containerRef,
  svgRef,
  parsedViewBox,
  safeZoneMargins,
  canUsePrecisionMode,
  showDebugInfo,
  isDark,
  precisionModeThreshold,
}: MagnifierLabelProps) {
  return (
    <animated.div
      style={{
        position: 'absolute',
        top: '8px',
        left: '8px',
        padding: '4px 8px',
        background: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: isDark ? '#60a5fa' : '#3b82f6',
        pointerEvents: pointerLocked ? 'none' : 'auto',
        cursor: pointerLocked ? 'default' : 'pointer',
      }}
      onClick={(e) => {
        // Request pointer lock when user clicks on notice
        if (!pointerLocked && containerRef.current) {
          e.stopPropagation() // Prevent click from bubbling to map
          containerRef.current.requestPointerLock()
        }
      }}
      data-element="magnifier-label"
    >
      {zoomSpring.to((z: number) => {
        // Access movement multiplier for potential future use
        const _multiplier = movementMultiplierSpring.get()

        // When in pointer lock mode, show "Precision mode active" notice
        if (pointerLocked) {
          return 'Precision mode active'
        }

        // When NOT in pointer lock, calculate screen pixel ratio
        const containerRect = containerRef.current?.getBoundingClientRect()
        const svgRect = svgRef.current?.getBoundingClientRect()
        if (!containerRect || !svgRect) {
          return `${z.toFixed(1)}×`
        }

        // Calculate leftover rectangle dimensions
        const leftoverWidth = containerRect.width - safeZoneMargins.left - safeZoneMargins.right
        const leftoverHeight = containerRect.height - safeZoneMargins.top - safeZoneMargins.bottom

        const { width: magnifierWidth } = getMagnifierDimensions(leftoverWidth, leftoverHeight)

        const screenPixelRatio = calculateScreenPixelRatio({
          magnifierWidth,
          viewBoxWidth: parsedViewBox.width,
          svgWidth: svgRect.width,
          zoom: z,
        })

        // If at or above threshold, show notice about activating precision controls
        // Only show precision mode message when precision mode is available
        if (canUsePrecisionMode && isAboveThreshold(screenPixelRatio, precisionModeThreshold)) {
          return 'Click to activate precision mode'
        }

        // Below threshold - show debug info in dev, simple zoom in prod
        if (showDebugInfo) {
          return `${z.toFixed(1)}× | ${screenPixelRatio.toFixed(1)} px/px`
        }

        return `${z.toFixed(1)}×`
      })}
    </animated.div>
  )
})
