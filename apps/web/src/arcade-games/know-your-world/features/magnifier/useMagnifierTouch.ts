/**
 * Magnifier Touch Hook
 *
 * Manages touch interactions for the magnifier overlay:
 * - Single-finger panning (1:1 movement mapping)
 * - Two-finger pinch-to-zoom
 * - Tap vs drag detection
 *
 * This hook handles the touch state machine and delegates complex
 * calculations (panning math, region detection) to callbacks.
 */

'use client'

import React, {
  useCallback,
  useRef,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from 'react'

import type { UseMagnifierStateReturn } from './useMagnifierState'

// ============================================================================
// Types
// ============================================================================

export interface TouchPosition {
  x: number
  y: number
}

export interface PinchInfo {
  startDistance: number
  startZoom: number
  currentDistance: number
  scale: number
}

export interface PanInfo {
  deltaX: number
  deltaY: number
  totalDeltaX: number
  totalDeltaY: number
}

export interface TapInfo {
  position: TouchPosition
  magnifierRelativePosition: TouchPosition
}

export interface UseMagnifierTouchOptions {
  /** Magnifier state from useMagnifierState */
  magnifierState: UseMagnifierStateReturn
  /** Magnifier element ref for position calculations */
  magnifierRef: RefObject<HTMLDivElement>
  /** Get current zoom level */
  getCurrentZoom: () => number
  /** Set zoom level (for pinch-to-zoom) */
  setZoom: (zoom: number) => void
  /** Maximum zoom level */
  maxZoom: number
  /** Minimum zoom level */
  minZoom?: number
  /** Threshold in pixels to distinguish tap from drag */
  moveThreshold?: number
  /** Called during panning with delta info */
  onPan?: (info: PanInfo) => void
  /** Called when pinch zoom changes */
  onPinchZoom?: (info: PinchInfo) => void
  /** Called when tap is detected (no movement) */
  onTap?: (info: TapInfo) => void
  /** Called when pinch starts (to expand magnifier, etc.) */
  onPinchStart?: () => void
  /** Called when pinch ends */
  onPinchEnd?: () => void
}

export interface UseMagnifierTouchReturn {
  /** Touch event handlers to spread on magnifier element */
  handlers: {
    onTouchStart: (e: ReactTouchEvent<HTMLDivElement>) => void
    onTouchMove: (e: ReactTouchEvent<HTMLDivElement>) => void
    onTouchEnd: (e: ReactTouchEvent<HTMLDivElement>) => void
    onTouchCancel: (e: ReactTouchEvent<HTMLDivElement>) => void
  }
  /** Whether currently in a touch interaction */
  isActive: boolean
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate distance between two touch points
 */
function getTouchDistance(touches: React.TouchList): number {
  if (touches.length < 2) return 0
  const dx = touches[1].clientX - touches[0].clientX
  const dy = touches[1].clientY - touches[0].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing magnifier touch interactions.
 *
 * Handles the touch state machine for:
 * - Single-finger panning
 * - Two-finger pinch-to-zoom
 * - Tap detection
 *
 * @param options - Configuration options
 * @returns Touch handlers and state
 */
export function useMagnifierTouch(options: UseMagnifierTouchOptions): UseMagnifierTouchReturn {
  const {
    magnifierState,
    magnifierRef,
    getCurrentZoom,
    setZoom,
    maxZoom,
    minZoom = 1,
    moveThreshold = 5,
    onPan,
    onPinchZoom,
    onTap,
    onPinchStart,
    onPinchEnd,
  } = options

  // -------------------------------------------------------------------------
  // Touch Tracking Refs
  // -------------------------------------------------------------------------
  const touchStartPositionRef = useRef<TouchPosition | null>(null)
  const totalDeltaRef = useRef<TouchPosition>({ x: 0, y: 0 })
  const tapPositionRef = useRef<TouchPosition | null>(null)

  // -------------------------------------------------------------------------
  // Touch Start Handler
  // -------------------------------------------------------------------------
  const handleTouchStart = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      // Stop propagation to prevent map container from receiving this touch
      e.stopPropagation()

      // Handle two-finger touch (pinch start)
      if (e.touches.length === 2) {
        const distance = getTouchDistance(e.touches)
        magnifierState.pinchStartDistanceRef.current = distance
        magnifierState.pinchStartZoomRef.current = getCurrentZoom()
        magnifierState.setPinching(true)
        magnifierState.setDragging(false)
        touchStartPositionRef.current = null
        totalDeltaRef.current = { x: 0, y: 0 }
        onPinchStart?.()
        e.preventDefault()
        return
      }

      // Handle single-finger touch (pan/tap)
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        touchStartPositionRef.current = { x: touch.clientX, y: touch.clientY }
        totalDeltaRef.current = { x: 0, y: 0 }
        magnifierState.didMoveRef.current = false

        // Record tap position relative to magnifier for tap-to-select
        if (magnifierRef.current) {
          const magnifierRect = magnifierRef.current.getBoundingClientRect()
          tapPositionRef.current = {
            x: touch.clientX - magnifierRect.left,
            y: touch.clientY - magnifierRect.top,
          }
        }

        magnifierState.setDragging(true)
        e.preventDefault()
      }
    },
    [magnifierState, magnifierRef, getCurrentZoom, onPinchStart]
  )

  // -------------------------------------------------------------------------
  // Touch Move Handler
  // -------------------------------------------------------------------------
  const handleTouchMove = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      e.stopPropagation()

      // Handle two-finger pinch gesture
      if (e.touches.length === 2 && magnifierState.isPinching) {
        const currentDistance = getTouchDistance(e.touches)
        const startDistance = magnifierState.pinchStartDistanceRef.current
        const startZoom = magnifierState.pinchStartZoomRef.current

        if (startDistance && startZoom && currentDistance > 0) {
          const scale = currentDistance / startDistance
          const newZoom = Math.max(minZoom, Math.min(maxZoom, startZoom * scale))
          setZoom(newZoom)

          onPinchZoom?.({
            startDistance,
            startZoom,
            currentDistance,
            scale,
          })
        }

        e.preventDefault()
        return
      }

      // Handle single-finger panning
      if (!magnifierState.isDragging || e.touches.length !== 1) return
      if (!touchStartPositionRef.current) return

      const touch = e.touches[0]
      const deltaX = touch.clientX - touchStartPositionRef.current.x
      const deltaY = touch.clientY - touchStartPositionRef.current.y

      // Update total delta
      totalDeltaRef.current.x += deltaX
      totalDeltaRef.current.y += deltaY

      // Track if user has moved significantly
      if (
        Math.abs(totalDeltaRef.current.x) > moveThreshold ||
        Math.abs(totalDeltaRef.current.y) > moveThreshold
      ) {
        magnifierState.didMoveRef.current = true
      }

      // Update start position for next move
      touchStartPositionRef.current = { x: touch.clientX, y: touch.clientY }

      // Call pan callback with delta info
      onPan?.({
        deltaX,
        deltaY,
        totalDeltaX: totalDeltaRef.current.x,
        totalDeltaY: totalDeltaRef.current.y,
      })

      e.preventDefault()
    },
    [magnifierState, minZoom, maxZoom, setZoom, moveThreshold, onPan, onPinchZoom]
  )

  // -------------------------------------------------------------------------
  // Touch End Handler
  // -------------------------------------------------------------------------
  const handleTouchEnd = useCallback(
    (e: ReactTouchEvent<HTMLDivElement>) => {
      e.stopPropagation()

      // Reset pinch state
      if (magnifierState.isPinching) {
        magnifierState.setPinching(false)
        magnifierState.pinchStartDistanceRef.current = null
        magnifierState.pinchStartZoomRef.current = null
        onPinchEnd?.()

        // If still have one finger down, start panning
        if (e.touches.length === 1) {
          const touch = e.touches[0]
          touchStartPositionRef.current = { x: touch.clientX, y: touch.clientY }
          totalDeltaRef.current = { x: 0, y: 0 }
          magnifierState.setDragging(true)
        }
        return
      }

      // Check if this was a tap (no significant movement) vs a drag
      const didMove = magnifierState.didMoveRef.current
      const tapPosition = tapPositionRef.current

      magnifierState.setDragging(false)
      touchStartPositionRef.current = null
      magnifierState.didMoveRef.current = false
      tapPositionRef.current = null
      totalDeltaRef.current = { x: 0, y: 0 }

      // If there was a tap (no movement), call tap handler
      if (e.changedTouches.length === 1 && !didMove && tapPosition && magnifierRef.current) {
        const magnifierRect = magnifierRef.current.getBoundingClientRect()
        const touch = e.changedTouches[0]
        onTap?.({
          position: { x: touch.clientX, y: touch.clientY },
          magnifierRelativePosition: tapPosition,
        })
      }
    },
    [magnifierState, magnifierRef, onTap, onPinchEnd]
  )

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
    isActive: magnifierState.isDragging || magnifierState.isPinching,
  }
}
