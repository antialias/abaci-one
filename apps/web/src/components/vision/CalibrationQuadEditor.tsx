'use client'

import type { ReactNode } from 'react'
import { useCallback, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'
import type { Point, QuadCorners } from '@/types/vision'

// ============================================================================
// Types
// ============================================================================

export interface CalibrationQuadEditorProps {
  /** Number of columns to divide the quad into */
  columnCount: number
  /** Video dimensions (native resolution) */
  videoWidth: number
  videoHeight: number
  /** Container dimensions (displayed size) */
  containerWidth: number
  containerHeight: number
  /** Current corner positions (in video coordinates) */
  corners: QuadCorners
  /** Column divider positions (0-1 fractions) */
  columnDividers: number[]
  /** Called when corners change */
  onCornersChange: (corners: QuadCorners) => void
  /** Called when dividers change */
  onDividersChange: (dividers: number[]) => void
}

type CornerKey = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'
type DragTarget = CornerKey | 'quad' | `divider-${number}` | null

// ============================================================================
// Helpers
// ============================================================================

/**
 * Interpolate a point along the edge of the quadrilateral
 */
function getColumnLine(t: number, corners: QuadCorners): { top: Point; bottom: Point } {
  return {
    top: {
      x: corners.topLeft.x + t * (corners.topRight.x - corners.topLeft.x),
      y: corners.topLeft.y + t * (corners.topRight.y - corners.topLeft.y),
    },
    bottom: {
      x: corners.bottomLeft.x + t * (corners.bottomRight.x - corners.bottomLeft.x),
      y: corners.bottomLeft.y + t * (corners.bottomRight.y - corners.bottomLeft.y),
    },
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * CalibrationQuadEditor - Interactive quadrilateral editor overlay
 *
 * Renders an SVG overlay with:
 * - Semi-transparent mask outside the quad
 * - Draggable corner handles
 * - Draggable column divider lines
 * - Beam indicator line
 *
 * This component only handles the interactive overlay - control buttons
 * (Done, Cancel, Rotate) should be rendered separately via CalibrationControls.
 */
export function CalibrationQuadEditor({
  columnCount,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
  corners,
  columnDividers,
  onCornersChange,
  onDividersChange,
}: CalibrationQuadEditorProps): ReactNode {
  // Calculate actual visible video bounds (accounting for object-fit: contain)
  const videoAspect = videoWidth / videoHeight
  const containerAspect = containerWidth / containerHeight

  let displayedVideoWidth: number
  let displayedVideoHeight: number
  let videoOffsetX: number
  let videoOffsetY: number

  if (videoAspect > containerAspect) {
    // Video is wider than container - letterbox top/bottom
    displayedVideoWidth = containerWidth
    displayedVideoHeight = containerWidth / videoAspect
    videoOffsetX = 0
    videoOffsetY = (containerHeight - displayedVideoHeight) / 2
  } else {
    // Video is taller than container - letterbox left/right
    displayedVideoHeight = containerHeight
    displayedVideoWidth = containerHeight * videoAspect
    videoOffsetX = (containerWidth - displayedVideoWidth) / 2
    videoOffsetY = 0
  }

  // Uniform scale factor
  const scale = displayedVideoWidth / videoWidth

  // Drag state
  const [dragTarget, setDragTarget] = useState<DragTarget>(null)
  const dragStartRef = useRef<{
    x: number
    y: number
    corners: QuadCorners
    dividers: number[]
  } | null>(null)

  // Handle pointer down on corners or dividers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, target: DragTarget) => {
      e.preventDefault()
      e.stopPropagation()
      setDragTarget(target)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        corners: { ...corners },
        dividers: [...columnDividers],
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [corners, columnDividers]
  )

  // Handle pointer move during drag
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragTarget || !dragStartRef.current) return

      const dx = (e.clientX - dragStartRef.current.x) / scale
      const dy = (e.clientY - dragStartRef.current.y) / scale
      const startCorners = dragStartRef.current.corners

      if (dragTarget === 'quad') {
        // Move entire quadrilateral
        const minX = Math.min(startCorners.topLeft.x, startCorners.bottomLeft.x)
        const maxX = Math.max(startCorners.topRight.x, startCorners.bottomRight.x)
        const minY = Math.min(startCorners.topLeft.y, startCorners.topRight.y)
        const maxY = Math.max(startCorners.bottomLeft.y, startCorners.bottomRight.y)

        // Clamp movement to keep quad within video bounds
        const clampedDx = Math.max(-minX, Math.min(videoWidth - maxX, dx))
        const clampedDy = Math.max(-minY, Math.min(videoHeight - maxY, dy))

        onCornersChange({
          topLeft: {
            x: startCorners.topLeft.x + clampedDx,
            y: startCorners.topLeft.y + clampedDy,
          },
          topRight: {
            x: startCorners.topRight.x + clampedDx,
            y: startCorners.topRight.y + clampedDy,
          },
          bottomLeft: {
            x: startCorners.bottomLeft.x + clampedDx,
            y: startCorners.bottomLeft.y + clampedDy,
          },
          bottomRight: {
            x: startCorners.bottomRight.x + clampedDx,
            y: startCorners.bottomRight.y + clampedDy,
          },
        })
      } else if (
        dragTarget === 'topLeft' ||
        dragTarget === 'topRight' ||
        dragTarget === 'bottomLeft' ||
        dragTarget === 'bottomRight'
      ) {
        // Move single corner
        const startPoint = startCorners[dragTarget]
        const newPoint: Point = {
          x: Math.max(0, Math.min(videoWidth, startPoint.x + dx)),
          y: Math.max(0, Math.min(videoHeight, startPoint.y + dy)),
        }
        onCornersChange({
          ...corners,
          [dragTarget]: newPoint,
        })
      } else if (dragTarget.startsWith('divider-')) {
        // Move divider
        const index = Number.parseInt(dragTarget.split('-')[1], 10)
        const startDividers = dragStartRef.current.dividers

        // Calculate dx as fraction of quad width
        const topWidth = startCorners.topRight.x - startCorners.topLeft.x
        const bottomWidth = startCorners.bottomRight.x - startCorners.bottomLeft.x
        const avgWidth = (topWidth + bottomWidth) / 2
        const dxFraction = dx / avgWidth

        const newDividers = [...startDividers]
        const minPos = index === 0 ? 0.05 : startDividers[index - 1] + 0.05
        const maxPos = index === startDividers.length - 1 ? 0.95 : startDividers[index + 1] - 0.05
        newDividers[index] = Math.max(minPos, Math.min(maxPos, startDividers[index] + dxFraction))
        onDividersChange(newDividers)
      }
    },
    [dragTarget, scale, videoWidth, videoHeight, corners, onCornersChange, onDividersChange]
  )

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    setDragTarget(null)
    dragStartRef.current = null
  }, [])

  // Convert corners to display coordinates
  const displayCorners: QuadCorners = {
    topLeft: {
      x: corners.topLeft.x * scale + videoOffsetX,
      y: corners.topLeft.y * scale + videoOffsetY,
    },
    topRight: {
      x: corners.topRight.x * scale + videoOffsetX,
      y: corners.topRight.y * scale + videoOffsetY,
    },
    bottomLeft: {
      x: corners.bottomLeft.x * scale + videoOffsetX,
      y: corners.bottomLeft.y * scale + videoOffsetY,
    },
    bottomRight: {
      x: corners.bottomRight.x * scale + videoOffsetX,
      y: corners.bottomRight.y * scale + videoOffsetY,
    },
  }

  // SVG path for the quadrilateral
  const quadPath = `M ${displayCorners.topLeft.x} ${displayCorners.topLeft.y}
    L ${displayCorners.topRight.x} ${displayCorners.topRight.y}
    L ${displayCorners.bottomRight.x} ${displayCorners.bottomRight.y}
    L ${displayCorners.bottomLeft.x} ${displayCorners.bottomLeft.y} Z`

  const handleSize = 16

  // Corner positions for handles
  const cornerPositions: { key: CornerKey; point: Point }[] = [
    { key: 'topLeft', point: displayCorners.topLeft },
    { key: 'topRight', point: displayCorners.topRight },
    { key: 'bottomLeft', point: displayCorners.bottomLeft },
    { key: 'bottomRight', point: displayCorners.bottomRight },
  ]

  return (
    <div
      data-component="calibration-quad-editor"
      className={css({
        position: 'absolute',
        inset: 0,
        zIndex: 10,
      })}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* SVG overlay */}
      <svg
        width={containerWidth}
        height={containerHeight}
        className={css({ position: 'absolute', inset: 0 })}
      >
        {/* Darkened area outside quadrilateral */}
        <defs>
          <mask id="quad-mask">
            <rect width="100%" height="100%" fill="white" />
            <path d={quadPath} fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.5)"
          mask="url(#quad-mask)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Clickable fill area inside quadrilateral - for moving the entire quad */}
        <path
          d={quadPath}
          fill="transparent"
          style={{
            cursor: dragTarget === 'quad' ? 'grabbing' : 'grab',
            touchAction: 'none',
          }}
          onPointerDown={(e) => handlePointerDown(e, 'quad')}
        />

        {/* Quadrilateral border */}
        <path
          d={quadPath}
          fill="none"
          stroke="#4ade80"
          strokeWidth="2"
          strokeDasharray="8,4"
          style={{ pointerEvents: 'none' }}
        />

        {/* Column divider lines */}
        {columnDividers.map((divider, i) => {
          const line = getColumnLine(divider, displayCorners)
          return (
            <line
              key={i}
              x1={line.top.x}
              y1={line.top.y}
              x2={line.bottom.x}
              y2={line.bottom.y}
              stroke="#facc15"
              strokeWidth="3"
              style={{ cursor: 'ew-resize', touchAction: 'none' }}
              onPointerDown={(e) => handlePointerDown(e, `divider-${i}`)}
            />
          )
        })}

        {/* Beam indicator line (20% from top) */}
        {(() => {
          const beamT = 0.2
          const leftPoint: Point = {
            x:
              displayCorners.topLeft.x +
              beamT * (displayCorners.bottomLeft.x - displayCorners.topLeft.x),
            y:
              displayCorners.topLeft.y +
              beamT * (displayCorners.bottomLeft.y - displayCorners.topLeft.y),
          }
          const rightPoint: Point = {
            x:
              displayCorners.topRight.x +
              beamT * (displayCorners.bottomRight.x - displayCorners.topRight.x),
            y:
              displayCorners.topRight.y +
              beamT * (displayCorners.bottomRight.y - displayCorners.topRight.y),
          }
          return (
            <line
              x1={leftPoint.x}
              y1={leftPoint.y}
              x2={rightPoint.x}
              y2={rightPoint.y}
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="4,4"
              opacity="0.7"
              style={{ pointerEvents: 'none' }}
            />
          )
        })()}
      </svg>

      {/* Corner drag handles */}
      {cornerPositions.map(({ key, point }) => (
        <div
          key={key}
          data-element={`handle-${key}`}
          className={css({
            position: 'absolute',
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            bg: 'green.400',
            border: '2px solid white',
            borderRadius: 'full',
            cursor: 'move',
            transform: 'translate(-50%, -50%)',
            touchAction: 'none',
            _hover: {
              bg: 'green.300',
              transform: 'translate(-50%, -50%) scale(1.2)',
            },
          })}
          style={{
            left: point.x,
            top: point.y,
          }}
          onPointerDown={(e) => handlePointerDown(e, key)}
        />
      ))}
    </div>
  )
}

export default CalibrationQuadEditor
