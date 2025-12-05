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

/** Magnifier display state (shared by both desktop and mobile modes) */
export interface MagnifierDisplayState {
  /** Whether magnifier is visible (unified source of truth) */
  isVisible: boolean
  /** Target zoom level for magnifier */
  targetZoom: number
  /** Target opacity for fade animations */
  targetOpacity: number
  /** Magnifier position in screen coordinates */
  position: { top: number; left: number }
  /** Whether magnifier is expanded (mobile) */
  isExpanded: boolean
}

/** Precision mode state (desktop only - mobile never uses this) */
export interface PrecisionModeState {
  /** Whether zoom is at or above the precision threshold */
  atThreshold: boolean
  /** Current screen pixel ratio (for UI display) */
  screenPixelRatio: number
}

/** Default magnifier state */
const defaultMagnifierState: MagnifierDisplayState = {
  isVisible: false,
  targetZoom: 10,
  targetOpacity: 0,
  position: { top: 290, left: 20 }, // Safe zone defaults
  isExpanded: false,
}

/** Default precision mode state */
const defaultPrecisionState: PrecisionModeState = {
  atThreshold: false,
  screenPixelRatio: 0,
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
      /** Whether shift key is currently pressed (for magnifier manual override) */
      shiftKey: boolean
      /** Magnifier display state */
      magnifier: MagnifierDisplayState
      /** Precision mode state (desktop only) */
      precision: PrecisionModeState
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
      /** True if magnifier was activated by map drag (shows Select button) */
      magnifierTriggeredByDrag: boolean
      /** Magnifier display state */
      magnifier: MagnifierDisplayState
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
  | { type: 'SHIFT_KEY_DOWN' }
  | { type: 'SHIFT_KEY_UP' }
  // Mobile events
  | { type: 'TOUCH_START'; position: Point; touchCount: number; regionId: string | null }
  | { type: 'TOUCH_MOVE'; position: Point; touchCount: number; regionId?: string | null }
  | { type: 'TOUCH_END'; touchCount: number }
  | { type: 'TAP'; regionId: string | null }
  | { type: 'PAN_THRESHOLD_EXCEEDED' }
  | { type: 'PINCH_START' }
  | { type: 'PINCH_END' }
  | { type: 'MAGNIFIER_ACTIVATED' }
  | { type: 'MAGNIFIER_DEACTIVATED' }
  // Magnifier display events (shared by both modes)
  | { type: 'MAGNIFIER_SHOW'; position?: { top: number; left: number }; zoom?: number }
  | { type: 'MAGNIFIER_HIDE' }
  | { type: 'MAGNIFIER_SET_ZOOM'; zoom: number }
  | { type: 'MAGNIFIER_SET_POSITION'; top: number; left: number }
  | { type: 'MAGNIFIER_SET_OPACITY'; opacity: number }
  | { type: 'MAGNIFIER_SET_EXPANDED'; expanded: boolean }
  | { type: 'MAGNIFIER_TOGGLE_EXPANDED' }
  // Precision mode events (desktop only)
  | { type: 'PRECISION_THRESHOLD_UPDATE'; atThreshold: boolean; screenPixelRatio: number }
  // Shared events
  | { type: 'RESET' }
  | { type: 'SET_MODE'; mode: 'desktop' | 'mobile' }

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
  shiftKey: false,
  magnifier: { ...defaultMagnifierState },
  precision: { ...defaultPrecisionState },
}

const initialMobileState: InteractionState = {
  mode: 'mobile',
  phase: 'idle',
  touchCenter: null,
  touchCount: 0,
  touchedRegion: null,
  touchStart: null,
  hasPanned: false,
  magnifierTriggeredByDrag: false,
  magnifier: { ...defaultMagnifierState },
}

// ============================================================================
// Shared Magnifier Event Handler
// ============================================================================

/**
 * Handle magnifier display events (shared by both desktop and mobile modes).
 * Returns updated state if the event was handled, or null if not a magnifier event.
 */
function handleMagnifierEvent(
  state: InteractionState,
  event: InteractionEvent
): InteractionState | null {
  switch (event.type) {
    case 'MAGNIFIER_SHOW':
      return {
        ...state,
        magnifier: {
          ...state.magnifier,
          isVisible: true,
          targetOpacity: 1,
          ...(event.position && { position: event.position }),
          ...(event.zoom !== undefined && { targetZoom: event.zoom }),
        },
      }

    case 'MAGNIFIER_HIDE':
      return {
        ...state,
        magnifier: {
          ...state.magnifier,
          isVisible: false,
          targetOpacity: 0,
          isExpanded: false,
        },
      }

    case 'MAGNIFIER_SET_ZOOM':
      return {
        ...state,
        magnifier: { ...state.magnifier, targetZoom: event.zoom },
      }

    case 'MAGNIFIER_SET_POSITION':
      return {
        ...state,
        magnifier: {
          ...state.magnifier,
          position: { top: event.top, left: event.left },
        },
      }

    case 'MAGNIFIER_SET_OPACITY':
      return {
        ...state,
        magnifier: { ...state.magnifier, targetOpacity: event.opacity },
      }

    case 'MAGNIFIER_SET_EXPANDED':
      return {
        ...state,
        magnifier: { ...state.magnifier, isExpanded: event.expanded },
      }

    case 'MAGNIFIER_TOGGLE_EXPANDED':
      return {
        ...state,
        magnifier: { ...state.magnifier, isExpanded: !state.magnifier.isExpanded },
      }

    default:
      return null // Event not handled
  }
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
      // Allow MOUSE_DOWN from both idle and hovering phases
      // User may click before moving (rare but possible)
      if (state.phase === 'idle' || state.phase === 'hovering') {
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

    case 'SHIFT_KEY_DOWN':
      return { ...state, shiftKey: true }

    case 'SHIFT_KEY_UP':
      return { ...state, shiftKey: false }

    case 'PRECISION_THRESHOLD_UPDATE':
      return {
        ...state,
        precision: {
          atThreshold: event.atThreshold,
          screenPixelRatio: event.screenPixelRatio,
        },
      }

    case 'RESET':
      return initialDesktopState

    default: {
      // Try shared magnifier event handler
      const magnifierResult = handleMagnifierEvent(state, event)
      if (magnifierResult) return magnifierResult
      return state
    }
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
        // When transitioning to mapPanning, show the magnifier
        const enteringMapPanning = state.phase === 'touched'
        return {
          ...state,
          phase: 'mapPanning',
          touchCenter: event.position,
          // Update touchedRegion if provided (for hover highlighting)
          touchedRegion: event.regionId !== undefined ? event.regionId : state.touchedRegion,
          // Show magnifier when entering mapPanning phase
          ...(enteringMapPanning && {
            magnifier: { ...state.magnifier, isVisible: true, targetOpacity: 1 },
          }),
        }
      }
      if (state.phase === 'magnifierActive' || state.phase === 'magnifierPanning') {
        return {
          ...state,
          phase: 'magnifierPanning',
          touchCenter: event.position,
          // Update touchedRegion if provided (for hover highlighting)
          touchedRegion: event.regionId !== undefined ? event.regionId : state.touchedRegion,
        }
      }
      if (state.phase === 'magnifierPinching') {
        return {
          ...state,
          touchCenter: event.position,
          // Update touchedRegion if provided (for hover highlighting)
          touchedRegion: event.regionId !== undefined ? event.regionId : state.touchedRegion,
        }
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
        if (state.phase === 'mapPanning') {
          // Map panning ended - if we panned, activate magnifier and mark as drag-triggered
          if (state.hasPanned) {
            return {
              ...state,
              phase: 'magnifierActive',
              touchCount: 0,
              hasPanned: false,
              magnifierTriggeredByDrag: true, // Magnifier was triggered by map drag
            }
          }
          return { ...state, phase: 'idle', touchCount: 0, hasPanned: false }
        }
        if (state.phase === 'magnifierPanning') {
          // Magnifier panning ended - stay in magnifier mode, preserve drag-triggered state
          return { ...state, phase: 'magnifierActive', touchCount: 0, hasPanned: false }
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
      return {
        ...state,
        phase: 'idle',
        touchCenter: null,
        touchStart: null,
        magnifierTriggeredByDrag: false, // Reset when magnifier is dismissed
        // Hide magnifier when deactivated
        magnifier: {
          ...state.magnifier,
          isVisible: false,
          targetOpacity: 0,
          isExpanded: false,
        },
      }

    case 'RESET':
      return initialMobileState

    default: {
      // Try shared magnifier event handler
      const magnifierResult = handleMagnifierEvent(state, event)
      if (magnifierResult) return magnifierResult
      return state
    }
  }
}

function interactionReducer(state: InteractionState, event: InteractionEvent): InteractionState {
  // Handle SET_MODE event at the top level (before mode-specific reducers)
  if (event.type === 'SET_MODE') {
    // Switch to the requested mode's initial state
    if (event.mode === 'desktop' && state.mode !== 'desktop') {
      return initialDesktopState
    }
    if (event.mode === 'mobile' && state.mode !== 'mobile') {
      return initialMobileState
    }
    return state // Already in requested mode
  }

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
  /** True if shift key is currently pressed (desktop only, for magnifier override) */
  isShiftPressed: boolean

  // ---- Derived mobile state ----
  /** True if panning the map on mobile (either map or magnifier) */
  isMobilePanning: boolean
  /** True if panning the main map specifically (not magnifier) */
  isMapPanning: boolean
  /** True if magnifier is active on mobile */
  isMagnifierActive: boolean
  /** True if panning within the magnifier */
  isMagnifierDragging: boolean
  /** True if pinch-zooming the magnifier */
  isPinching: boolean
  /** True if magnifier was activated by map drag (shows Select button) */
  magnifierTriggeredByDrag: boolean

  // ---- Shared derived state ----
  /** True if any drag/pan operation is in progress */
  isDragging: boolean
  /** Current cursor/touch position */
  cursorPosition: Point | null
  /** Currently hovered/touched region ID */
  hoveredRegionId: string | null

  // ---- Magnifier display state (unified for desktop/mobile) ----
  /** Whether magnifier is visible (unified source of truth) */
  showMagnifier: boolean
  /** Target zoom level for magnifier */
  magnifierZoom: number
  /** Target opacity for magnifier fade animations */
  magnifierOpacity: number
  /** Magnifier screen position */
  magnifierPosition: { top: number; left: number }
  /** Whether magnifier is expanded (mobile) */
  isMagnifierExpanded: boolean

  // ---- Precision mode state (desktop only) ----
  /**
   * Whether precision mode UI should be shown (scrim, grid, etc.)
   * True only on desktop when at threshold and not in pointer lock.
   * Always false on mobile - mobile doesn't have precision mode.
   */
  precisionModeRecommended: boolean
  /** Current screen pixel ratio (for display purposes, 0 on mobile) */
  screenPixelRatio: number

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
  const isShiftPressed = state.mode === 'desktop' && state.shiftKey

  // Derived mobile state
  const isMobilePanning =
    state.mode === 'mobile' && (state.phase === 'mapPanning' || state.phase === 'magnifierPanning')
  /** True if panning the main map (not magnifier) */
  const isMapPanning = state.mode === 'mobile' && state.phase === 'mapPanning'
  /** True if magnifier is visible and active (any magnifier phase OR map panning) */
  // Magnifier shows during mapPanning (user dragging to position it) and all magnifier phases
  const isMagnifierActive =
    state.mode === 'mobile' &&
    (state.phase === 'mapPanning' ||
      state.phase === 'magnifierActive' ||
      state.phase === 'magnifierPanning' ||
      state.phase === 'magnifierPinching')
  /** True if specifically dragging/panning within magnifier */
  const isMagnifierDragging = state.mode === 'mobile' && state.phase === 'magnifierPanning'
  const isPinching = state.mode === 'mobile' && state.phase === 'magnifierPinching'
  /** True if magnifier was activated by map drag (shows Select button) */
  const magnifierTriggeredByDrag = state.mode === 'mobile' && state.magnifierTriggeredByDrag

  // Shared derived state
  const isDragging = isDesktopDragging || isMobilePanning
  const cursorPosition = state.mode === 'desktop' ? state.cursor : state.touchCenter
  const hoveredRegionId = state.mode === 'desktop' ? state.hoveredRegion : state.touchedRegion

  // Magnifier display state (unified for desktop/mobile)
  const showMagnifier = state.magnifier.isVisible
  const magnifierZoom = state.magnifier.targetZoom
  const magnifierOpacity = state.magnifier.targetOpacity
  const magnifierPosition = state.magnifier.position
  const isMagnifierExpanded = state.magnifier.isExpanded

  // Precision mode state (desktop only)
  // On desktop: show precision UI when at threshold and not in pointer lock
  // On mobile: always false - mobile doesn't have precision mode concept
  const precisionModeRecommended =
    state.mode === 'desktop' && state.precision.atThreshold && !isPointerLocked
  const screenPixelRatio = state.mode === 'desktop' ? state.precision.screenPixelRatio : 0

  // Actions
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  const setMode = useCallback((mode: 'desktop' | 'mobile') => {
    dispatch({ type: 'SET_MODE', mode })
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
      isShiftPressed,
      // Mobile
      isMobilePanning,
      isMapPanning,
      isMagnifierActive,
      isMagnifierDragging,
      isPinching,
      magnifierTriggeredByDrag,
      // Shared
      isDragging,
      cursorPosition,
      hoveredRegionId,
      // Magnifier display
      showMagnifier,
      magnifierZoom,
      magnifierOpacity,
      magnifierPosition,
      isMagnifierExpanded,
      // Precision mode
      precisionModeRecommended,
      screenPixelRatio,
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
      isShiftPressed,
      isMobilePanning,
      isMapPanning,
      isMagnifierActive,
      isMagnifierDragging,
      isPinching,
      magnifierTriggeredByDrag,
      isDragging,
      cursorPosition,
      hoveredRegionId,
      showMagnifier,
      magnifierZoom,
      magnifierOpacity,
      magnifierPosition,
      isMagnifierExpanded,
      precisionModeRecommended,
      screenPixelRatio,
      reset,
      setMode,
    ]
  )
}
