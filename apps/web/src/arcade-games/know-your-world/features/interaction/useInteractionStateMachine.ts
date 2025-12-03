/**
 * Interaction State Machine
 *
 * Manages map interaction state via an explicit state machine instead of
 * scattered boolean flags. This makes valid states explicit and transitions
 * predictable.
 *
 * See docs/INTERACTION_STATE_MACHINE.md for full design documentation.
 */

'use client'

import { useReducer, useCallback, useRef, useMemo } from 'react'

// ============================================================================
// State Types
// ============================================================================

/**
 * All possible interaction states.
 * Only ~10 valid states instead of 512 boolean combinations.
 */
export type InteractionState =
  | 'IDLE'
  | 'HOVERING' // Desktop: mouse over map, cursor visible
  | 'MAGNIFIER_VISIBLE' // Magnifier shown, normal interaction
  | 'MAGNIFIER_PANNING' // Mobile: single-finger drag in magnifier
  | 'MAGNIFIER_PINCHING' // Mobile: two-finger pinch on magnifier
  | 'MAGNIFIER_EXPANDED' // Mobile: magnifier fills available space
  | 'MAP_PANNING_MOBILE' // Mobile: touch drag on main map
  | 'MAP_PANNING_DESKTOP' // Desktop: middle mouse drag
  | 'PRECISION_MODE' // Desktop: pointer locked for fine movement
  | 'RELEASING_PRECISION' // Desktop: animating out of precision mode

// ============================================================================
// Event Types
// ============================================================================

export type TouchPoint = {
  x: number
  y: number
  identifier: number
}

export type InteractionEvent =
  // Mouse events (desktop)
  | { type: 'MOUSE_ENTER' }
  | { type: 'MOUSE_LEAVE' }
  | {
      type: 'MOUSE_MOVE'
      position: { x: number; y: number }
      movement: { dx: number; dy: number }
    }
  | { type: 'MOUSE_DOWN'; button: 'left' | 'middle' | 'right' }
  | { type: 'MOUSE_UP' }
  | { type: 'CLICK'; position: { x: number; y: number } }

  // Touch events (mobile)
  | { type: 'TOUCH_START'; touches: TouchPoint[]; target: 'map' | 'magnifier' }
  | { type: 'TOUCH_MOVE'; touches: TouchPoint[]; target: 'map' | 'magnifier' }
  | { type: 'TOUCH_END'; target: 'map' | 'magnifier'; remainingTouches: number }

  // Precision mode
  | { type: 'REQUEST_PRECISION' }
  | { type: 'EXIT_PRECISION' }
  | { type: 'PRECISION_ESCAPE_BOUNDARY' }
  | { type: 'RELEASE_ANIMATION_DONE' }

  // Magnifier
  | { type: 'SHOW_MAGNIFIER' }
  | { type: 'DISMISS_MAGNIFIER' }
  | { type: 'EXPAND_MAGNIFIER' }
  | { type: 'COLLAPSE_MAGNIFIER' }

  // Zoom threshold
  | { type: 'ZOOM_THRESHOLD_REACHED' }
  | { type: 'ZOOM_BELOW_THRESHOLD' }

// ============================================================================
// Context Types
// ============================================================================

/**
 * Shared data that persists across state transitions.
 */
export interface InteractionContext {
  // Cursor position (container coordinates)
  cursorPosition: { x: number; y: number } | null

  // Zoom state
  currentZoom: number
  targetZoom: number

  // Magnifier position (for animations)
  magnifierTop: number
  magnifierLeft: number
  targetOpacity: number

  // Touch tracking
  touchStart: { x: number; y: number } | null
  pinchStartDistance: number | null
  pinchStartZoom: number | null

  // Precision mode tracking
  initialCapturePosition: { x: number; y: number } | null
  movementMultiplier: number

  // Cursor visual state
  cursorSquish: { x: number; y: number }

  // Mobile-specific
  dragTriggeredMagnifier: boolean // For showing Select button
}

// ============================================================================
// Machine State
// ============================================================================

export interface MachineState {
  state: InteractionState
  context: InteractionContext
  // Track previous state for transition effects
  previousState: InteractionState | null
}

// ============================================================================
// Initial State
// ============================================================================

const initialContext: InteractionContext = {
  cursorPosition: null,
  currentZoom: 1,
  targetZoom: 1,
  magnifierTop: 0,
  magnifierLeft: 0,
  targetOpacity: 0,
  touchStart: null,
  pinchStartDistance: null,
  pinchStartZoom: null,
  initialCapturePosition: null,
  movementMultiplier: 1,
  cursorSquish: { x: 1, y: 1 },
  dragTriggeredMagnifier: false,
}

const initialState: MachineState = {
  state: 'IDLE',
  context: initialContext,
  previousState: null,
}

// ============================================================================
// State Transition Logic
// ============================================================================

/**
 * Pure reducer function that handles state transitions.
 * All state changes go through here, making the logic centralized and testable.
 */
function interactionReducer(machine: MachineState, event: InteractionEvent): MachineState {
  const { state, context } = machine

  switch (state) {
    // -------------------------------------------------------------------------
    // IDLE State
    // -------------------------------------------------------------------------
    case 'IDLE': {
      switch (event.type) {
        case 'MOUSE_ENTER':
          return { ...machine, state: 'HOVERING', previousState: state }

        case 'TOUCH_START':
          if (event.target === 'map' && event.touches.length === 1) {
            return {
              ...machine,
              state: 'IDLE', // Stay idle until drag threshold met
              context: {
                ...context,
                touchStart: event.touches[0],
              },
              previousState: state,
            }
          }
          return machine

        case 'SHOW_MAGNIFIER':
          return {
            ...machine,
            state: 'MAGNIFIER_VISIBLE',
            context: { ...context, targetOpacity: 1 },
            previousState: state,
          }

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // HOVERING State (Desktop)
    // -------------------------------------------------------------------------
    case 'HOVERING': {
      switch (event.type) {
        case 'MOUSE_LEAVE':
          return {
            ...machine,
            state: 'IDLE',
            context: { ...context, cursorPosition: null },
            previousState: state,
          }

        case 'MOUSE_MOVE':
          return {
            ...machine,
            context: { ...context, cursorPosition: event.position },
          }

        case 'MOUSE_DOWN':
          if (event.button === 'middle') {
            return { ...machine, state: 'MAP_PANNING_DESKTOP', previousState: state }
          }
          return machine

        case 'SHOW_MAGNIFIER':
          return {
            ...machine,
            state: 'MAGNIFIER_VISIBLE',
            context: { ...context, targetOpacity: 1 },
            previousState: state,
          }

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // MAGNIFIER_VISIBLE State
    // -------------------------------------------------------------------------
    case 'MAGNIFIER_VISIBLE': {
      switch (event.type) {
        case 'MOUSE_MOVE':
          return {
            ...machine,
            context: { ...context, cursorPosition: event.position },
          }

        case 'MOUSE_LEAVE':
          return {
            ...machine,
            state: 'IDLE',
            context: {
              ...context,
              cursorPosition: null,
              targetOpacity: 0,
            },
            previousState: state,
          }

        case 'DISMISS_MAGNIFIER':
          return {
            ...machine,
            state: 'IDLE',
            context: {
              ...context,
              targetOpacity: 0,
              dragTriggeredMagnifier: false,
            },
            previousState: state,
          }

        case 'REQUEST_PRECISION':
          return {
            ...machine,
            state: 'PRECISION_MODE',
            context: {
              ...context,
              initialCapturePosition: context.cursorPosition,
            },
            previousState: state,
          }

        case 'TOUCH_START':
          if (event.target === 'magnifier') {
            if (event.touches.length === 1) {
              return {
                ...machine,
                state: 'MAGNIFIER_PANNING',
                context: { ...context, touchStart: event.touches[0] },
                previousState: state,
              }
            }
            if (event.touches.length === 2) {
              const dx = event.touches[1].x - event.touches[0].x
              const dy = event.touches[1].y - event.touches[0].y
              const distance = Math.sqrt(dx * dx + dy * dy)
              return {
                ...machine,
                state: 'MAGNIFIER_PINCHING',
                context: {
                  ...context,
                  pinchStartDistance: distance,
                  pinchStartZoom: context.currentZoom,
                },
                previousState: state,
              }
            }
          }
          return machine

        case 'EXPAND_MAGNIFIER':
          return { ...machine, state: 'MAGNIFIER_EXPANDED', previousState: state }

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // MAGNIFIER_PANNING State (Mobile)
    // -------------------------------------------------------------------------
    case 'MAGNIFIER_PANNING': {
      switch (event.type) {
        case 'TOUCH_MOVE':
          if (event.touches.length === 1) {
            return {
              ...machine,
              context: {
                ...context,
                cursorPosition: event.touches[0],
              },
            }
          }
          if (event.touches.length === 2) {
            // Transition to pinching
            const dx = event.touches[1].x - event.touches[0].x
            const dy = event.touches[1].y - event.touches[0].y
            const distance = Math.sqrt(dx * dx + dy * dy)
            return {
              ...machine,
              state: 'MAGNIFIER_PINCHING',
              context: {
                ...context,
                pinchStartDistance: distance,
                pinchStartZoom: context.currentZoom,
              },
              previousState: state,
            }
          }
          return machine

        case 'TOUCH_END':
          return {
            ...machine,
            state: 'MAGNIFIER_VISIBLE',
            context: { ...context, touchStart: null },
            previousState: state,
          }

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // MAGNIFIER_PINCHING State (Mobile)
    // -------------------------------------------------------------------------
    case 'MAGNIFIER_PINCHING': {
      switch (event.type) {
        case 'TOUCH_MOVE':
          if (event.touches.length === 2) {
            const dx = event.touches[1].x - event.touches[0].x
            const dy = event.touches[1].y - event.touches[0].y
            const currentDistance = Math.sqrt(dx * dx + dy * dy)
            // Zoom calculation would happen here via callback
            return machine
          }
          return machine

        case 'TOUCH_END':
          if (event.remainingTouches === 1) {
            return {
              ...machine,
              state: 'MAGNIFIER_PANNING',
              context: {
                ...context,
                pinchStartDistance: null,
                pinchStartZoom: null,
              },
              previousState: state,
            }
          }
          if (event.remainingTouches === 0) {
            return {
              ...machine,
              state: 'MAGNIFIER_VISIBLE',
              context: {
                ...context,
                pinchStartDistance: null,
                pinchStartZoom: null,
              },
              previousState: state,
            }
          }
          return machine

        case 'ZOOM_THRESHOLD_REACHED':
          return {
            ...machine,
            state: 'MAGNIFIER_EXPANDED',
            previousState: state,
          }

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // MAGNIFIER_EXPANDED State (Mobile)
    // -------------------------------------------------------------------------
    case 'MAGNIFIER_EXPANDED': {
      switch (event.type) {
        case 'COLLAPSE_MAGNIFIER':
        case 'ZOOM_BELOW_THRESHOLD':
          return {
            ...machine,
            state: 'MAGNIFIER_VISIBLE',
            previousState: state,
          }

        case 'DISMISS_MAGNIFIER':
          return {
            ...machine,
            state: 'IDLE',
            context: {
              ...context,
              targetOpacity: 0,
              dragTriggeredMagnifier: false,
            },
            previousState: state,
          }

        case 'TOUCH_START':
          // Handle same as MAGNIFIER_VISIBLE
          if (event.target === 'magnifier') {
            if (event.touches.length === 1) {
              return {
                ...machine,
                state: 'MAGNIFIER_PANNING',
                context: { ...context, touchStart: event.touches[0] },
                previousState: state,
              }
            }
            if (event.touches.length === 2) {
              const dx = event.touches[1].x - event.touches[0].x
              const dy = event.touches[1].y - event.touches[0].y
              const distance = Math.sqrt(dx * dx + dy * dy)
              return {
                ...machine,
                state: 'MAGNIFIER_PINCHING',
                context: {
                  ...context,
                  pinchStartDistance: distance,
                  pinchStartZoom: context.currentZoom,
                },
                previousState: state,
              }
            }
          }
          return machine

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // MAP_PANNING_MOBILE State
    // -------------------------------------------------------------------------
    case 'MAP_PANNING_MOBILE': {
      switch (event.type) {
        case 'TOUCH_MOVE':
          if (event.touches.length === 1) {
            return {
              ...machine,
              context: {
                ...context,
                cursorPosition: event.touches[0],
              },
            }
          }
          return machine

        case 'TOUCH_END':
          // Keep magnifier visible after drag ends (for Select button)
          return {
            ...machine,
            state: 'MAGNIFIER_VISIBLE',
            context: {
              ...context,
              touchStart: null,
              dragTriggeredMagnifier: true, // Enable Select button
            },
            previousState: state,
          }

        case 'DISMISS_MAGNIFIER':
          return {
            ...machine,
            state: 'IDLE',
            context: {
              ...context,
              targetOpacity: 0,
              dragTriggeredMagnifier: false,
              touchStart: null,
            },
            previousState: state,
          }

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // MAP_PANNING_DESKTOP State
    // -------------------------------------------------------------------------
    case 'MAP_PANNING_DESKTOP': {
      switch (event.type) {
        case 'MOUSE_UP':
          return { ...machine, state: 'HOVERING', previousState: state }

        case 'MOUSE_LEAVE':
          return { ...machine, state: 'IDLE', previousState: state }

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // PRECISION_MODE State (Desktop)
    // -------------------------------------------------------------------------
    case 'PRECISION_MODE': {
      switch (event.type) {
        case 'MOUSE_MOVE':
          // Update cursor position with dampening applied by caller
          return {
            ...machine,
            context: { ...context, cursorPosition: event.position },
          }

        case 'PRECISION_ESCAPE_BOUNDARY':
          return { ...machine, state: 'RELEASING_PRECISION', previousState: state }

        case 'EXIT_PRECISION':
          return { ...machine, state: 'RELEASING_PRECISION', previousState: state }

        default:
          return machine
      }
    }

    // -------------------------------------------------------------------------
    // RELEASING_PRECISION State (Desktop)
    // -------------------------------------------------------------------------
    case 'RELEASING_PRECISION': {
      switch (event.type) {
        case 'RELEASE_ANIMATION_DONE':
          return {
            ...machine,
            state: 'MAGNIFIER_VISIBLE',
            context: {
              ...context,
              initialCapturePosition: null,
              cursorSquish: { x: 1, y: 1 },
            },
            previousState: state,
          }

        default:
          return machine
      }
    }

    default:
      return machine
  }
}

// ============================================================================
// Hook
// ============================================================================

export interface UseInteractionStateMachineReturn {
  // Current state
  state: InteractionState
  context: InteractionContext
  previousState: InteractionState | null

  // State checks (convenience methods)
  isIdle: boolean
  isHovering: boolean
  isMagnifierVisible: boolean
  isMagnifierPanning: boolean
  isMagnifierPinching: boolean
  isMagnifierExpanded: boolean
  isMapPanningMobile: boolean
  isMapPanningDesktop: boolean
  isPrecisionMode: boolean
  isReleasingPrecision: boolean

  // Compound checks
  showMagnifier: boolean
  showCursor: boolean
  isAnyPanning: boolean
  isMobileInteraction: boolean

  // Dispatch
  send: (event: InteractionEvent) => void

  // Context updates (for values that change without state transitions)
  updateContext: (updates: Partial<InteractionContext>) => void
}

/**
 * Hook that provides the interaction state machine.
 */
export function useInteractionStateMachine(): UseInteractionStateMachineReturn {
  const [machine, dispatch] = useReducer(interactionReducer, initialState)

  // Create stable send function
  const send = useCallback((event: InteractionEvent) => {
    dispatch(event)
  }, [])

  // Context update ref for values that change without state transitions
  // (This is a workaround since useReducer doesn't support partial updates nicely)
  const contextRef = useRef(machine.context)
  contextRef.current = machine.context

  const updateContext = useCallback((updates: Partial<InteractionContext>) => {
    // For context-only updates, we dispatch a special "internal" event
    // This is handled by having the reducer accept context updates
    // For now, this is a no-op - full implementation would need reducer changes
  }, [])

  // Compute convenience booleans
  const state = machine.state
  const isIdle = state === 'IDLE'
  const isHovering = state === 'HOVERING'
  const isMagnifierVisible = state === 'MAGNIFIER_VISIBLE'
  const isMagnifierPanning = state === 'MAGNIFIER_PANNING'
  const isMagnifierPinching = state === 'MAGNIFIER_PINCHING'
  const isMagnifierExpanded = state === 'MAGNIFIER_EXPANDED'
  const isMapPanningMobile = state === 'MAP_PANNING_MOBILE'
  const isMapPanningDesktop = state === 'MAP_PANNING_DESKTOP'
  const isPrecisionMode = state === 'PRECISION_MODE'
  const isReleasingPrecision = state === 'RELEASING_PRECISION'

  // Compound checks
  const showMagnifier = useMemo(
    () =>
      isMagnifierVisible ||
      isMagnifierPanning ||
      isMagnifierPinching ||
      isMagnifierExpanded ||
      isMapPanningMobile ||
      isPrecisionMode ||
      isReleasingPrecision,
    [
      isMagnifierVisible,
      isMagnifierPanning,
      isMagnifierPinching,
      isMagnifierExpanded,
      isMapPanningMobile,
      isPrecisionMode,
      isReleasingPrecision,
    ]
  )

  const showCursor = useMemo(
    () => isHovering || showMagnifier,
    [isHovering, showMagnifier]
  )

  const isAnyPanning = useMemo(
    () => isMagnifierPanning || isMapPanningMobile || isMapPanningDesktop,
    [isMagnifierPanning, isMapPanningMobile, isMapPanningDesktop]
  )

  const isMobileInteraction = useMemo(
    () => isMagnifierPanning || isMagnifierPinching || isMapPanningMobile,
    [isMagnifierPanning, isMagnifierPinching, isMapPanningMobile]
  )

  return {
    state: machine.state,
    context: machine.context,
    previousState: machine.previousState,

    // State checks
    isIdle,
    isHovering,
    isMagnifierVisible,
    isMagnifierPanning,
    isMagnifierPinching,
    isMagnifierExpanded,
    isMapPanningMobile,
    isMapPanningDesktop,
    isPrecisionMode,
    isReleasingPrecision,

    // Compound checks
    showMagnifier,
    showCursor,
    isAnyPanning,
    isMobileInteraction,

    // Actions
    send,
    updateContext,
  }
}
