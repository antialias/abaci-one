/**
 * ZoomLines Component
 *
 * Renders bezier connection lines between the indicator box on the map
 * and the magnifier overlay, creating a "pop out" zoom effect.
 *
 * Features:
 * - Elegant curved bezier paths connecting corners
 * - Smart line visibility (hides lines that pass through rectangles)
 * - Animated dashed stroke effect
 * - Glow effect for premium appearance
 * - Color changes based on zoom level (blue → gold at high zoom)
 */

'use client'

import { memo, useMemo } from 'react'
import { getRenderedViewport } from '../labels'
import { getAdjustedMagnifiedDimensions, getMagnifierDimensions } from '../../utils/magnifierDimensions'

// ============================================================================
// Types
// ============================================================================

export interface ZoomLinesProps {
  /** Whether to show the zoom lines */
  show: boolean
  /** Opacity of the lines (0-1) */
  opacity: number
  /** Cursor position in screen coordinates */
  cursorPosition: { x: number; y: number }
  /** Magnifier target position in screen coordinates */
  magnifierPosition: { top: number; left: number }
  /** Parsed viewBox for coordinate calculations */
  parsedViewBox: { x: number; y: number; width: number; height: number }
  /** Container element bounding rect */
  containerRect: DOMRect
  /** SVG element bounding rect */
  svgRect: DOMRect
  /** Safe zone margins around the UI */
  safeZoneMargins: { top: number; left: number; right: number; bottom: number }
  /** Zoom threshold for color change */
  highZoomThreshold: number
  /** Current zoom level */
  currentZoom: number
  /** Whether dark mode is active */
  isDark: boolean
}

interface Point {
  x: number
  y: number
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a line segment passes through a rectangle (excluding endpoints).
 * Samples points along the line to detect intersection.
 */
function linePassesThroughRect(
  from: Point,
  to: Point,
  rectLeft: number,
  rectTop: number,
  rectRight: number,
  rectBottom: number
): boolean {
  // Sample points along the line (excluding endpoints)
  for (let t = 0.1; t <= 0.9; t += 0.1) {
    const px = from.x + (to.x - from.x) * t
    const py = from.y + (to.y - from.y) * t
    if (px > rectLeft && px < rectRight && py > rectTop && py < rectBottom) {
      return true
    }
  }
  return false
}

/**
 * Create a bezier path with a gentle outward bow between two points.
 */
function createBezierPath(from: Point, to: Point): string {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // Perpendicular offset creates gentle outward bow
  const bowAmount = dist * 0.06
  const perpX = (-dy / dist) * bowAmount
  const perpY = (dx / dist) * bowAmount

  const midX = (from.x + to.x) / 2 + perpX
  const midY = (from.y + to.y) / 2 + perpY

  // Quadratic bezier for smooth curve
  return `M ${from.x} ${from.y} Q ${midX} ${midY}, ${to.x} ${to.y}`
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders connection lines between the indicator box and magnifier.
 *
 * The lines create a visual "pop out" effect showing what area of the map
 * is being magnified. Lines that would pass through either rectangle are
 * hidden to maintain a clean appearance.
 */
export const ZoomLines = memo(function ZoomLines({
  show,
  opacity,
  cursorPosition,
  magnifierPosition,
  parsedViewBox,
  containerRect,
  svgRect,
  safeZoneMargins,
  highZoomThreshold,
  currentZoom,
  isDark,
}: ZoomLinesProps) {
  // Memoize all the calculated values
  const {
    paths,
    visibleCorners,
    lineColor,
    glowColor,
  } = useMemo(() => {
    // Calculate leftover rectangle dimensions (area not covered by UI elements)
    const leftoverWidth = containerRect.width - safeZoneMargins.left - safeZoneMargins.right
    const leftoverHeight = containerRect.height - safeZoneMargins.top - safeZoneMargins.bottom

    // Get magnifier dimensions based on leftover rectangle
    const { width: magnifierWidth, height: magnifierHeight } = getMagnifierDimensions(
      leftoverWidth,
      leftoverHeight
    )

    // Magnifier position
    const magTop = magnifierPosition.top
    const magLeft = magnifierPosition.left

    // Use adjusted dimensions to match magnifier aspect ratio
    const { width: indicatorWidth, height: indicatorHeight } = getAdjustedMagnifiedDimensions(
      parsedViewBox.width,
      parsedViewBox.height,
      currentZoom,
      leftoverWidth,
      leftoverHeight
    )

    // Convert cursor to SVG coordinates (accounting for preserveAspectRatio)
    const viewport = getRenderedViewport(
      svgRect,
      parsedViewBox.x,
      parsedViewBox.y,
      parsedViewBox.width,
      parsedViewBox.height
    )
    const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX
    const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY

    const cursorSvgX = (cursorPosition.x - svgOffsetX) / viewport.scale + parsedViewBox.x
    const cursorSvgY = (cursorPosition.y - svgOffsetY) / viewport.scale + parsedViewBox.y

    // Indicator box in SVG coordinates
    const indSvgLeft = cursorSvgX - indicatorWidth / 2
    const indSvgTop = cursorSvgY - indicatorHeight / 2
    const indSvgRight = indSvgLeft + indicatorWidth
    const indSvgBottom = indSvgTop + indicatorHeight

    // Convert indicator corners to screen coordinates
    const svgToScreen = (svgX: number, svgY: number): Point => ({
      x: (svgX - parsedViewBox.x) * viewport.scale + svgOffsetX,
      y: (svgY - parsedViewBox.y) * viewport.scale + svgOffsetY,
    })

    const indTL = svgToScreen(indSvgLeft, indSvgTop)
    const indTR = svgToScreen(indSvgRight, indSvgTop)
    const indBL = svgToScreen(indSvgLeft, indSvgBottom)
    const indBR = svgToScreen(indSvgRight, indSvgBottom)

    // Magnifier corners in screen coordinates
    const magTL: Point = { x: magLeft, y: magTop }
    const magTR: Point = { x: magLeft + magnifierWidth, y: magTop }
    const magBL: Point = { x: magLeft, y: magTop + magnifierHeight }
    const magBR: Point = { x: magLeft + magnifierWidth, y: magTop + magnifierHeight }

    // Define the corner pairs with identifiers
    const cornerPairs = [
      { from: indTL, to: magTL, corner: indTL },
      { from: indTR, to: magTR, corner: indTR },
      { from: indBL, to: magBL, corner: indBL },
      { from: indBR, to: magBR, corner: indBR },
    ]

    // Filter out lines that pass through either rectangle
    const visibleCornerPairs = cornerPairs.filter(({ from, to }) => {
      // Check if line passes through magnifier
      const passesThroughMag = linePassesThroughRect(
        from,
        to,
        magLeft,
        magTop,
        magLeft + magnifierWidth,
        magTop + magnifierHeight
      )
      // Check if line passes through indicator
      const passesThroughInd = linePassesThroughRect(
        from,
        to,
        indTL.x,
        indTL.y,
        indBR.x,
        indBR.y
      )
      return !passesThroughMag && !passesThroughInd
    })

    const calculatedPaths = visibleCornerPairs.map(({ from, to }) => createBezierPath(from, to))
    const calculatedCorners = visibleCornerPairs.map(({ corner }) => corner)

    // Color based on zoom level (matches magnifier border)
    const isHighZoom = currentZoom > highZoomThreshold
    const calculatedLineColor = isHighZoom
      ? isDark
        ? '#fbbf24'
        : '#f59e0b' // gold
      : isDark
        ? '#60a5fa'
        : '#3b82f6' // blue
    const calculatedGlowColor = isHighZoom
      ? 'rgba(251, 191, 36, 0.6)'
      : 'rgba(96, 165, 250, 0.6)'

    return {
      paths: calculatedPaths,
      visibleCorners: calculatedCorners,
      lineColor: calculatedLineColor,
      glowColor: calculatedGlowColor,
    }
  }, [
    containerRect,
    svgRect,
    cursorPosition,
    magnifierPosition,
    parsedViewBox,
    safeZoneMargins,
    currentZoom,
    highZoomThreshold,
    isDark,
  ])

  if (!show) {
    return null
  }

  return (
    <svg
      data-element="zoom-lines"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 99, // Just below magnifier (100)
        overflow: 'visible',
      }}
    >
      <defs>
        {/* Gradient for lines - fades toward magnifier */}
        <linearGradient id="zoom-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.8" />
          <stop offset="40%" stopColor={lineColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.2" />
        </linearGradient>

        {/* Glow filter for premium effect */}
        <filter id="zoom-line-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Animated dash pattern */}
        <pattern id="dash-pattern" patternUnits="userSpaceOnUse" width="12" height="1">
          <rect width="8" height="1" fill={lineColor} opacity="0.6" />
        </pattern>
      </defs>

      {/* Glow layer (underneath) */}
      <g filter="url(#zoom-line-glow)" opacity={0.4}>
        {paths.map((d, i) => (
          <path
            key={`glow-${i}`}
            d={d}
            fill="none"
            stroke={glowColor}
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* Main lines with gradient */}
      <g opacity={opacity}>
        {paths.map((d, i) => (
          <path
            key={`line-${i}`}
            d={d}
            fill="none"
            stroke="url(#zoom-line-gradient)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              // Subtle animation for the lines
              strokeDasharray: '8 4',
              strokeDashoffset: '0',
              animation: 'zoom-line-flow 1s linear infinite',
            }}
          />
        ))}
      </g>

      {/* Corner dots on indicator for visible lines only */}
      <g opacity={opacity * 0.8}>
        {visibleCorners.map((corner, i) => (
          <circle
            key={`corner-${i}`}
            cx={corner.x}
            cy={corner.y}
            r="3"
            fill={lineColor}
            opacity="0.7"
          />
        ))}
      </g>

      <style>
        {`
          @keyframes zoom-line-flow {
            from { stroke-dashoffset: 12; }
            to { stroke-dashoffset: 0; }
          }
        `}
      </style>
    </svg>
  )
})
