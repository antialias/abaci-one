/**
 * Magnifier State Hook
 *
 * Consolidates magnifier-related state into a single hook.
 * This includes visibility and expansion state.
 *
 * Note: Dragging state (isMagnifierDragging) and pinching state (isPinching)
 * are now managed by the interaction state machine - see useInteractionStateMachine.
 *
 * Usage:
 * ```tsx
 * const magnifier = useMagnifierState()
 *
 * // Show/hide magnifier
 * magnifier.show()
 * magnifier.dismiss()
 *
 * // Check state (use interaction.isPinching from state machine)
 * if (magnifier.isVisible && !interaction.isPinching) { ... }
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
  // Touch Tracking Refs
  // -------------------------------------------------------------------------
  // Note: isDragging/setDragging and isPinching/setPinching removed - state machine is authoritative
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
  // Touch Tracking Refs
  // Note: isDragging and isPinching removed - state machine is authoritative
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
    touchStartRef.current = null
    didMoveRef.current = false
    pinchStartDistanceRef.current = null
    pinchStartZoomRef.current = null
    onDismiss?.()
    // Note: isDragging and isPinching reset is now handled by state machine
  }, [onDismiss])

  // -------------------------------------------------------------------------
  // Expansion Actions
  // -------------------------------------------------------------------------
  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev)
  }, [])

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

    // Touch Tracking Refs
    // Note: isDragging/setDragging and isPinching/setPinching removed - state machine is authoritative
    touchStartRef,
    didMoveRef,
    pinchStartDistanceRef,
    pinchStartZoomRef,

    // Opacity
    targetOpacity,
    setTargetOpacity,
  }
}
