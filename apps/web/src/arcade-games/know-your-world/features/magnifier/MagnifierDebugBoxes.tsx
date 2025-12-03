/**
 * MagnifierDebugBoxes Component
 *
 * Renders debug visualization of bounding boxes for detected regions
 * inside the magnified SVG view. Color-coded by importance level.
 */

'use client'

import { memo } from 'react'
import type { DebugBoundingBox } from './types'

// ============================================================================
// Types
// ============================================================================

export interface MagnifierDebugBoxesProps {
  /** Bounding boxes to render */
  debugBoundingBoxes: DebugBoundingBox[]
  /** Whether to show the debug boxes */
  visible: boolean
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get stroke color for a bounding box based on its importance and acceptance status.
 */
function getBoundingBoxStrokeColor(bbox: DebugBoundingBox): string {
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
 * Renders debug bounding boxes inside the magnifier's SVG.
 *
 * Color coding:
 * - Green (#00ff00): Accepted/detected region
 * - Orange (#ff6600): High importance (>1.5)
 * - Yellow (#ffcc00): Medium importance (>0.5)
 * - Gray (#888888): Low importance
 */
export const MagnifierDebugBoxes = memo(function MagnifierDebugBoxes({
  debugBoundingBoxes,
  visible,
}: MagnifierDebugBoxesProps) {
  if (!visible) {
    return null
  }

  return (
    <>
      {debugBoundingBoxes.map((bbox) => (
        <rect
          key={`mag-bbox-${bbox.regionId}`}
          x={bbox.x}
          y={bbox.y}
          width={bbox.width}
          height={bbox.height}
          fill="none"
          stroke={getBoundingBoxStrokeColor(bbox)}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ))}
    </>
  )
})
