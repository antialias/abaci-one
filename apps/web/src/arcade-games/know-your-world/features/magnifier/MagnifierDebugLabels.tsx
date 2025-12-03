/**
 * MagnifierDebugLabels Component
 *
 * Renders debug labels for bounding boxes as HTML overlays inside the magnifier.
 * Labels are positioned using react-spring animated values that sync with the
 * magnifier's viewBox, showing region IDs and importance scores.
 */

'use client'

import { animated, type SpringValue } from '@react-spring/web'
import type { RefObject } from 'react'
import { memo } from 'react'
import { getMagnifierDimensions } from '../../utils/magnifierDimensions'
import { getRenderedViewport } from '../labels'
import type { DebugBoundingBox } from './types'

// ============================================================================
// Types
// ============================================================================

export interface MagnifierDebugLabelsProps {
  /** Bounding boxes to render labels for */
  debugBoundingBoxes: DebugBoundingBox[]
  /** Whether to show the debug labels */
  visible: boolean
  /** Zoom spring value for animated positioning */
  zoomSpring: SpringValue<number>
  /** Reference to container element */
  containerRef: RefObject<HTMLDivElement | null>
  /** Reference to SVG element */
  svgRef: RefObject<SVGSVGElement | null>
  /** Current cursor position in screen coordinates */
  cursorPosition: { x: number; y: number } | null
  /** Parsed viewBox dimensions */
  parsedViewBox: { x: number; y: number; width: number; height: number }
  /** Safe zone margins around the UI */
  safeZoneMargins: { top: number; left: number; right: number; bottom: number }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get label color based on importance and acceptance status.
 */
function getLabelColor(bbox: DebugBoundingBox): string {
  const importance = bbox.importance ?? 0

  if (bbox.wasAccepted) {
    return '#00ff00' // Green for accepted region
  }
  if (importance > 1.5) {
    return '#ff6600' // Orange for high importance
  }
  if (importance > 0.5) {
    return '#ffcc00' // Yellow for medium importance
  }
  return '#888888' // Gray for low importance
}

// ============================================================================
// Component
// ============================================================================

/**
 * Renders debug labels inside the magnifier that show region IDs and importance.
 *
 * Labels are positioned using spring interpolation to stay in sync with the
 * animated magnifier viewBox. Each label shows:
 * - Region ID (main text)
 * - Importance score (smaller text below)
 *
 * Color coding matches MagnifierDebugBoxes:
 * - Green: Accepted/detected region
 * - Orange: High importance (>1.5)
 * - Yellow: Medium importance (>0.5)
 * - Gray: Low importance
 */
export const MagnifierDebugLabels = memo(function MagnifierDebugLabels({
  debugBoundingBoxes,
  visible,
  zoomSpring,
  containerRef,
  svgRef,
  cursorPosition,
  parsedViewBox,
  safeZoneMargins,
}: MagnifierDebugLabelsProps) {
  if (!visible) {
    return null
  }

  return (
    <>
      {debugBoundingBoxes.map((bbox) => {
        const labelColor = getLabelColor(bbox)
        const importance = bbox.importance ?? 0

        // Calculate bbox center in SVG coordinates
        const bboxCenterSvgX = bbox.x + bbox.width / 2
        const bboxCenterSvgY = bbox.y + bbox.height / 2

        return (
          <animated.div
            key={`mag-bbox-label-${bbox.regionId}`}
            style={{
              position: 'absolute',
              // Calculate position using the same spring that controls the magnifier viewBox
              left: zoomSpring.to((zoom: number) => {
                const containerRect = containerRef.current?.getBoundingClientRect()
                const svgRect = svgRef.current?.getBoundingClientRect()
                if (!containerRect || !svgRect || !cursorPosition) return '-9999px'

                // Calculate leftover rectangle dimensions
                const leftoverWidth =
                  containerRect.width - safeZoneMargins.left - safeZoneMargins.right
                const leftoverHeight =
                  containerRect.height - safeZoneMargins.top - safeZoneMargins.bottom

                // Magnifier dimensions based on leftover rectangle
                const { width: magnifierWidth } = getMagnifierDimensions(
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
                const cursorSvgX =
                  (cursorPosition.x - svgOffsetX) / viewport.scale + parsedViewBox.x

                // Magnified viewport in SVG coordinates
                const magnifiedWidth = parsedViewBox.width / zoom
                const magnifiedViewBoxX = cursorSvgX - magnifiedWidth / 2

                // Position of bbox center relative to magnified viewport (0-1)
                const relativeX = (bboxCenterSvgX - magnifiedViewBoxX) / magnifiedWidth
                if (relativeX < 0 || relativeX > 1) return '-9999px'

                return `${relativeX * magnifierWidth}px`
              }),
              top: zoomSpring.to((zoom: number) => {
                const containerRect = containerRef.current?.getBoundingClientRect()
                const svgRect = svgRef.current?.getBoundingClientRect()
                if (!containerRect || !svgRect || !cursorPosition) return '-9999px'

                // Calculate leftover rectangle dimensions
                const leftoverWidth =
                  containerRect.width - safeZoneMargins.left - safeZoneMargins.right
                const leftoverHeight =
                  containerRect.height - safeZoneMargins.top - safeZoneMargins.bottom

                // Magnifier dimensions based on leftover rectangle
                const { height: magnifierHeight } = getMagnifierDimensions(
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
                const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY
                const cursorSvgY =
                  (cursorPosition.y - svgOffsetY) / viewport.scale + parsedViewBox.y

                // Magnified viewport in SVG coordinates
                const magnifiedHeight = parsedViewBox.height / zoom
                const magnifiedViewBoxY = cursorSvgY - magnifiedHeight / 2

                // Position of bbox center relative to magnified viewport (0-1)
                const relativeY = (bboxCenterSvgY - magnifiedViewBoxY) / magnifiedHeight
                if (relativeY < 0 || relativeY > 1) return '-9999px'

                return `${relativeY * magnifierHeight}px`
              }),
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 15,
              fontSize: '10px',
              fontWeight: 'bold',
              color: labelColor,
              textAlign: 'center',
              textShadow: '0 0 2px black, 0 0 2px black, 0 0 2px black',
              whiteSpace: 'nowrap',
            }}
          >
            <div>{bbox.regionId}</div>
            <div style={{ fontSize: '8px', fontWeight: 'normal' }}>{importance.toFixed(2)}</div>
          </animated.div>
        )
      })}
    </>
  )
})
