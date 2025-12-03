/**
 * Magnifier State Hook
 *
 * Consolidates all magnifier-related state into a single hook.
 * This includes visibility, expansion, dragging, and pinching state.
 *
 * Usage:
 * ```tsx
 * const magnifier = useMagnifierState()
 *
 * // Show/hide magnifier
 * magnifier.show()
 * magnifier.dismiss()
 *
 * // Check state
 * if (magnifier.isVisible && !magnifier.isDragging) { ... }
 * ```
 */

'use client'

import { useState, useCallback, useRef } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface UseMagnifierStateOptions {
  /** Initial visibility state */
  initiallyVisible?: boolean
  /** Initial expansion state (for mobile) */
  initiallyExpanded?: boolean
  /** Callback when magnifier is dismissed */
  onDismiss?: () => void
  /** Callback when magnifier is shown */
  onShow?: () => void
}

export interface UseMagnifierStateReturn {
  // -------------------------------------------------------------------------
  // Visibility State
  // -------------------------------------------------------------------------
  /** Whether magnifier is currently visible */
  isVisible: boolean
  /** Show the magnifier */
  show: () => void
  /** Hide the magnifier */
  hide: () => void
  /** Dismiss magnifier (hide + reset state) */
  dismiss: () => void

  // -------------------------------------------------------------------------
  // Expansion State (Mobile)
  // -------------------------------------------------------------------------
  /** Whether magnifier is expanded to fill available space */
  isExpanded: boolean
  /** Set expansion state */
  setExpanded: (expanded: boolean) => void
  /** Toggle expansion state */
  toggleExpanded: () => void

  // -------------------------------------------------------------------------
  // Touch Interaction State
  // -------------------------------------------------------------------------
  /** Whether user is currently dragging the magnifier */
  isDragging: boolean
  /** Set dragging state */
  setDragging: (dragging: boolean) => void
  /** Whether user is currently pinching to zoom */
  isPinching: boolean
  /** Set pinching state */
  setPinching: (pinching: boolean) => void
  /** Whether any touch interaction is active */
  isTouchActive: boolean

  // -------------------------------------------------------------------------
  // Touch Tracking Refs
  // -------------------------------------------------------------------------
  /** Reference to touch start position for drag calculations */
  touchStartRef: React.MutableRefObject<{ x: number; y: number } | null>
  /** Reference to track if user actually moved (vs just tapped) */
  didMoveRef: React.MutableRefObject<boolean>
  /** Reference to pinch start distance */
  pinchStartDistanceRef: React.MutableRefObject<number | null>
  /** Reference to zoom level when pinch started */
  pinchStartZoomRef: React.MutableRefObject<number | null>

  // -------------------------------------------------------------------------
  // Opacity State (for animations)
  // -------------------------------------------------------------------------
  /** Target opacity for fade animations */
  targetOpacity: number
  /** Set target opacity */
  setTargetOpacity: (opacity: number) => void
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing magnifier state.
 *
 * Consolidates visibility, expansion, and touch interaction state
 * into a single cohesive interface.
 *
 * @param options - Configuration options
 * @returns Magnifier state and control methods
 */
export function useMagnifierState(options: UseMagnifierStateOptions = {}): UseMagnifierStateReturn {
  const { initiallyVisible = false, initiallyExpanded = false, onDismiss, onShow } = options

  // -------------------------------------------------------------------------
  // Visibility State
  // -------------------------------------------------------------------------
  const [isVisible, setIsVisible] = useState(initiallyVisible)
  const [targetOpacity, setTargetOpacity] = useState(0)

  // -------------------------------------------------------------------------
  // Expansion State (Mobile)
  // -------------------------------------------------------------------------
  const [isExpanded, setIsExpanded] = useState(initiallyExpanded)

  // -------------------------------------------------------------------------
  // Touch Interaction State
  // -------------------------------------------------------------------------
  const [isDragging, setIsDragging] = useState(false)
  const [isPinching, setIsPinching] = useState(false)

  // -------------------------------------------------------------------------
  // Touch Tracking Refs
  // -------------------------------------------------------------------------
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const didMoveRef = useRef(false)
  const pinchStartDistanceRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef<number | null>(null)

  // -------------------------------------------------------------------------
  // Visibility Actions
  // -------------------------------------------------------------------------
  const show = useCallback(() => {
    setIsVisible(true)
    setTargetOpacity(1)
    onShow?.()
  }, [onShow])

  const hide = useCallback(() => {
    setIsVisible(false)
    setTargetOpacity(0)
  }, [])

  const dismiss = useCallback(() => {
    setIsVisible(false)
    setTargetOpacity(0)
    setIsExpanded(false)
    setIsDragging(false)
    setIsPinching(false)
    touchStartRef.current = null
    didMoveRef.current = false
    pinchStartDistanceRef.current = null
    pinchStartZoomRef.current = null
    onDismiss?.()
  }, [onDismiss])

  // -------------------------------------------------------------------------
  // Expansion Actions
  // -------------------------------------------------------------------------
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

  // -------------------------------------------------------------------------
  // Computed State
  // -------------------------------------------------------------------------
  const isTouchActive = isDragging || isPinching

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return {
    // Visibility
    isVisible,
    show,
    hide,
    dismiss,

    // Expansion
    isExpanded,
    setExpanded: setIsExpanded,
    toggleExpanded,

    // Touch Interaction
    isDragging,
    setDragging: setIsDragging,
    isPinching,
    setPinching: setIsPinching,
    isTouchActive,

    // Touch Tracking Refs
    touchStartRef,
    didMoveRef,
    pinchStartDistanceRef,
    pinchStartZoomRef,

    // Opacity
    targetOpacity,
    setTargetOpacity,
  }
}
