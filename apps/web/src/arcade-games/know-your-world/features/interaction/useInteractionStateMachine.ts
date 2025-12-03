/**
 * Interaction State Machine for Know Your World
 *
 * Replaces 25+ scattered boolean state flags with an explicit state machine.
 * This makes impossible states impossible and centralizes transition logic.
 *
 * ## Desktop Mode State Diagram
 *
 * ```
 * ┌──────┐  mouseEnter  ┌─────────┐  mouseDown  ┌──────────┐
 * │ idle │─────────────▶│ hovering│────────────▶│ dragging │
 * └──────┘              └─────────┘              └──────────┘
 *     ▲                      ▲  │                     │
 *     │                      │  │ click               │ mouseUp
 *     │                      │  ▼                     │
 *     │                      │ ┌─────────┐            │
 *     └──────────────────────┼─│selecting│◀───────────┘
 *                            │ └─────────┘
 *                            │      │
 *                            │      │ shift+click (if precision capable)
 *                            │      ▼
 *                            │ ┌──────────────┐
 *                   ESC key  │ │ pointerLocked│
 *                            │ └──────────────┘
 *                            │      │
 *                            │      │ edge escape
 *                            │      ▼
 *                            │ ┌──────────────┐
 *                            └─│  releasing   │ (animation in progress)
 *                              └──────────────┘
 * ```
 *
 * ## Mobile Mode State Diagram
 *
 * ```
 * ┌──────┐  touch  ┌─────────┐  pan  ┌─────────────┐
 * │ idle │────────▶│ touched │──────▶│ mapPanning  │
 * └──────┘         └─────────┘       └─────────────┘
 *     ▲                 │                   │
 *     │                 │ tap               │ triggers magnifier
 *     │                 ▼                   ▼
 *     │           ┌──────────┐     ┌───────────────┐
 *     └───────────│ selected │     │magnifierActive│
 *                 └──────────┘     └───────────────┘
 *                                         │
 *                                         │ pinch
 *                                         ▼
 *                                  ┌─────────────┐
 *                                  │magnifierZoom│
 *                                  └─────────────┘
 * ```
 */

import { useCallback, useMemo, useReducer } from 'react'

// ============================================================================
// Types
// ============================================================================

/** 2D point in screen or SVG coordinates */
export interface Point {
  x: number
  y: number
}

// Desktop phases
export type DesktopPhase =
  | 'idle'
  | 'hovering'
  | 'dragging'
  | 'selecting'
  | 'pointerLocked'
  | 'releasing'

// Mobile phases
export type MobilePhase =
  | 'idle'
  | 'touched'
  | 'mapPanning'
  | 'selected'
  | 'magnifierActive'
  | 'magnifierPanning'
  | 'magnifierPinching'

// Discriminated union for interaction state
export type InteractionState =
  | {
      mode: 'desktop'
      phase: DesktopPhase
      /** Current cursor position (screen coordinates) */
      cursor: Point | null
      /** Region ID under cursor */
      hoveredRegion: string | null
      /** Mouse down position for drag detection */
      dragStart: Point | null
      /** Has moved beyond drag threshold since mouse down */
      hasDragged: boolean
    }
  | {
      mode: 'mobile'
      phase: MobilePhase
      /** Current touch position(s) */
      touchCenter: Point | null
      /** Number of active touches */
      touchCount: number
      /** Region ID under touch */
      touchedRegion: string | null
      /** Touch start position for gesture detection */
      touchStart: Point | null
      /** Has moved beyond drag threshold since touch start */
      hasPanned: boolean
    }

// Events that can trigger state transitions
export type InteractionEvent =
  // Desktop events
  | { type: 'MOUSE_ENTER' }
  | { type: 'MOUSE_LEAVE' }
  | { type: 'MOUSE_DOWN'; position: Point }
  | { type: 'MOUSE_MOVE'; position: Point; regionId: string | null }
  | { type: 'MOUSE_UP' }
  | { type: 'DRAG_THRESHOLD_EXCEEDED' }
  | { type: 'CLICK'; regionId: string | null; shiftKey: boolean }
  | { type: 'POINTER_LOCK_ACQUIRED' }
  | { type: 'POINTER_LOCK_RELEASED' }
  | { type: 'EDGE_ESCAPE' }
  | { type: 'RELEASE_ANIMATION_COMPLETE' }
  // Mobile events
  | { type: 'TOUCH_START'; position: Point; touchCount: number; regionId: string | null }
  | { type: 'TOUCH_MOVE'; position: Point; touchCount: number }
  | { type: 'TOUCH_END'; touchCount: number }
  | { type: 'TAP'; regionId: string | null }
  | { type: 'PAN_THRESHOLD_EXCEEDED' }
  | { type: 'PINCH_START' }
  | { type: 'PINCH_END' }
  | { type: 'MAGNIFIER_ACTIVATED' }
  | { type: 'MAGNIFIER_DEACTIVATED' }
  // Shared events
  | { type: 'RESET' }

// ============================================================================
// Initial States
// ============================================================================

const initialDesktopState: InteractionState = {
  mode: 'desktop',
  phase: 'idle',
  cursor: null,
  hoveredRegion: null,
  dragStart: null,
  hasDragged: false,
}

const initialMobileState: InteractionState = {
  mode: 'mobile',
  phase: 'idle',
  touchCenter: null,
  touchCount: 0,
  touchedRegion: null,
  touchStart: null,
  hasPanned: false,
}

// ============================================================================
// Reducer
// ============================================================================

function desktopReducer(
  state: InteractionState & { mode: 'desktop' },
  event: InteractionEvent
): InteractionState {
  switch (event.type) {
    case 'MOUSE_ENTER':
      if (state.phase === 'idle') {
        return { ...state, phase: 'hovering' }
      }
      return state

    case 'MOUSE_LEAVE':
      if (state.phase === 'hovering' || state.phase === 'dragging') {
        return { ...state, phase: 'idle', cursor: null, hoveredRegion: null }
      }
      return state

    case 'MOUSE_DOWN':
      if (state.phase === 'hovering') {
        return {
          ...state,
          phase: 'dragging',
          dragStart: event.position,
          hasDragged: false,
        }
      }
      return state

    case 'MOUSE_MOVE':
      // Update cursor position regardless of phase (except idle)
      if (state.phase !== 'idle') {
        return {
          ...state,
          cursor: event.position,
          hoveredRegion: event.regionId,
        }
      }
      return state

    case 'DRAG_THRESHOLD_EXCEEDED':
      if (state.phase === 'dragging' && !state.hasDragged) {
        return { ...state, hasDragged: true }
      }
      return state

    case 'MOUSE_UP':
      if (state.phase === 'dragging') {
        // If we dragged, go back to hovering
        // If we didn't drag, this was a click - handled by CLICK event
        return {
          ...state,
          phase: 'hovering',
          dragStart: null,
          // Keep hasDragged so CLICK handler can check it
        }
      }
      return state

    case 'CLICK':
      if (state.phase === 'hovering' || state.phase === 'dragging') {
        // Don't process click if we dragged
        if (state.hasDragged) {
          return { ...state, hasDragged: false }
        }
        // If shift+click on a region, potentially enter pointer lock
        // (actual pointer lock request happens in the component)
        return {
          ...state,
          phase: 'selecting',
          hasDragged: false,
        }
      }
      if (state.phase === 'selecting') {
        return { ...state, phase: 'hovering' }
      }
      return state

    case 'POINTER_LOCK_ACQUIRED':
      return { ...state, phase: 'pointerLocked' }

    case 'POINTER_LOCK_RELEASED':
      if (state.phase === 'pointerLocked') {
        // Direct release (e.g., ESC key) - go directly to hovering (no animation)
        return { ...state, phase: 'hovering' }
      }
      if (state.phase === 'releasing') {
        // Release after edge escape animation - go back to hovering
        return { ...state, phase: 'hovering' }
      }
      return state

    case 'EDGE_ESCAPE':
      if (state.phase === 'pointerLocked') {
        return { ...state, phase: 'releasing' }
      }
      return state

    case 'RELEASE_ANIMATION_COMPLETE':
      if (state.phase === 'releasing') {
        return { ...state, phase: 'hovering' }
      }
      return state

    case 'RESET':
      return initialDesktopState

    default:
      return state
  }
}

function mobileReducer(
  state: InteractionState & { mode: 'mobile' },
  event: InteractionEvent
): InteractionState {
  switch (event.type) {
    case 'TOUCH_START':
      if (state.phase === 'idle') {
        return {
          ...state,
          phase: 'touched',
          touchCenter: event.position,
          touchStart: event.position,
          touchCount: event.touchCount,
          touchedRegion: event.regionId,
          hasPanned: false,
        }
      }
      // Additional touch while magnifier is active = potential pinch
      if (state.phase === 'magnifierActive' && event.touchCount > 1) {
        return {
          ...state,
          phase: 'magnifierPinching',
          touchCount: event.touchCount,
        }
      }
      return { ...state, touchCount: event.touchCount }

    case 'TOUCH_MOVE':
      if (state.phase === 'touched' || state.phase === 'mapPanning') {
        return {
          ...state,
          phase: 'mapPanning',
          touchCenter: event.position,
        }
      }
      if (state.phase === 'magnifierActive' || state.phase === 'magnifierPanning') {
        return {
          ...state,
          phase: 'magnifierPanning',
          touchCenter: event.position,
        }
      }
      if (state.phase === 'magnifierPinching') {
        return { ...state, touchCenter: event.position }
      }
      return state

    case 'PAN_THRESHOLD_EXCEEDED':
      if (state.phase === 'mapPanning' && !state.hasPanned) {
        return { ...state, hasPanned: true }
      }
      return state

    case 'TOUCH_END':
      // All fingers lifted
      if (event.touchCount === 0) {
        if (state.phase === 'touched') {
          // Quick tap without movement - this is a selection
          return { ...state, phase: 'selected', touchCount: 0 }
        }
        if (state.phase === 'mapPanning' || state.phase === 'magnifierPanning') {
          // If panning triggered magnifier, stay in magnifier mode
          if (state.hasPanned) {
            return { ...state, phase: 'magnifierActive', touchCount: 0, hasPanned: false }
          }
          return { ...state, phase: 'idle', touchCount: 0, hasPanned: false }
        }
        if (state.phase === 'magnifierPinching') {
          return { ...state, phase: 'magnifierActive', touchCount: 0 }
        }
        if (state.phase === 'selected') {
          return { ...state, phase: 'idle', touchCount: 0 }
        }
      }
      return { ...state, touchCount: event.touchCount }

    case 'TAP':
      if (state.phase === 'touched') {
        return { ...state, phase: 'selected', touchedRegion: event.regionId }
      }
      return state

    case 'PINCH_START':
      if (state.phase === 'magnifierActive' || state.phase === 'magnifierPanning') {
        return { ...state, phase: 'magnifierPinching' }
      }
      return state

    case 'PINCH_END':
      if (state.phase === 'magnifierPinching') {
        return { ...state, phase: 'magnifierActive' }
      }
      return state

    case 'MAGNIFIER_ACTIVATED':
      if (state.phase === 'mapPanning' || state.phase === 'touched') {
        return { ...state, phase: 'magnifierActive' }
      }
      return state

    case 'MAGNIFIER_DEACTIVATED':
      return { ...state, phase: 'idle', touchCenter: null, touchStart: null }

    case 'RESET':
      return initialMobileState

    default:
      return state
  }
}

function interactionReducer(state: InteractionState, event: InteractionEvent): InteractionState {
  if (state.mode === 'desktop') {
    return desktopReducer(state, event)
  }
  return mobileReducer(state, event)
}

// ============================================================================
// Hook Options
// ============================================================================

export interface UseInteractionStateMachineOptions {
  /** Initial mode - 'desktop' or 'mobile' */
  initialMode?: 'desktop' | 'mobile'
}

// ============================================================================
// Return Type
// ============================================================================

export interface UseInteractionStateMachineReturn {
  /** Current interaction state */
  state: InteractionState

  /** Dispatch an event to trigger a state transition */
  dispatch: (event: InteractionEvent) => void

  // ---- Derived desktop state ----
  /** True if in desktop pointer lock mode */
  isPointerLocked: boolean
  /** True if releasing from pointer lock (animation in progress) */
  isReleasingPointerLock: boolean
  /** True if dragging on desktop */
  isDesktopDragging: boolean
  /** True if actively hovering over map content */
  isHovering: boolean

  // ---- Derived mobile state ----
  /** True if panning the map on mobile */
  isMobilePanning: boolean
  /** True if magnifier is active on mobile */
  isMagnifierActive: boolean
  /** True if pinch-zooming the magnifier */
  isPinching: boolean

  // ---- Shared derived state ----
  /** True if any drag/pan operation is in progress */
  isDragging: boolean
  /** Current cursor/touch position */
  cursorPosition: Point | null
  /** Currently hovered/touched region ID */
  hoveredRegionId: string | null

  // ---- Actions ----
  /** Reset to initial state */
  reset: () => void
  /** Switch between desktop and mobile mode */
  setMode: (mode: 'desktop' | 'mobile') => void
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useInteractionStateMachine(
  options: UseInteractionStateMachineOptions = {}
): UseInteractionStateMachineReturn {
  const { initialMode = 'desktop' } = options

  const [state, dispatch] = useReducer(
    interactionReducer,
    initialMode === 'desktop' ? initialDesktopState : initialMobileState
  )

  // Derived desktop state
  const isPointerLocked = state.mode === 'desktop' && state.phase === 'pointerLocked'
  const isReleasingPointerLock = state.mode === 'desktop' && state.phase === 'releasing'
  const isDesktopDragging =
    state.mode === 'desktop' && state.phase === 'dragging' && state.hasDragged
  const isHovering = state.mode === 'desktop' && state.phase === 'hovering'

  // Derived mobile state
  const isMobilePanning =
    state.mode === 'mobile' && (state.phase === 'mapPanning' || state.phase === 'magnifierPanning')
  const isMagnifierActive =
    state.mode === 'mobile' &&
    (state.phase === 'magnifierActive' ||
      state.phase === 'magnifierPanning' ||
      state.phase === 'magnifierPinching')
  const isPinching = state.mode === 'mobile' && state.phase === 'magnifierPinching'

  // Shared derived state
  const isDragging = isDesktopDragging || isMobilePanning
  const cursorPosition = state.mode === 'desktop' ? state.cursor : state.touchCenter
  const hoveredRegionId = state.mode === 'desktop' ? state.hoveredRegion : state.touchedRegion

  // Actions
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const setMode = useCallback((mode: 'desktop' | 'mobile') => {
    // This requires a custom event or we reinitialize
    // For now, just dispatch reset and the mode is determined by initial state
    // This is a simplification - full implementation would need mode switch event
    dispatch({ type: 'RESET' })
  }, [])

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      state,
      dispatch,
      // Desktop
      isPointerLocked,
      isReleasingPointerLock,
      isDesktopDragging,
      isHovering,
      // Mobile
      isMobilePanning,
      isMagnifierActive,
      isPinching,
      // Shared
      isDragging,
      cursorPosition,
      hoveredRegionId,
      // Actions
      reset,
      setMode,
    }),
    [
      state,
      isPointerLocked,
      isReleasingPointerLock,
      isDesktopDragging,
      isHovering,
      isMobilePanning,
      isMagnifierActive,
      isPinching,
      isDragging,
      cursorPosition,
      hoveredRegionId,
      reset,
      setMode,
    ]
  )
}
