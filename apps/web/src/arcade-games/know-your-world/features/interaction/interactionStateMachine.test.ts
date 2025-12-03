/**
 * Unit tests for Interaction State Machine
 *
 * Tests state transitions, context updates, and edge cases
 * to verify the state machine behaves correctly before migration.
 */

import { describe, expect, it } from 'vitest'
import type { InteractionEvent, MachineState } from './useInteractionStateMachine'
import { initialMachineState, interactionReducer } from './useInteractionStateMachine'

// Helper to apply multiple events in sequence
function applyEvents(events: InteractionEvent[]): MachineState {
  return events.reduce((state, event) => interactionReducer(state, event), initialMachineState)
}

describe('interactionReducer', () => {
  // ===========================================================================
  // Initial State
  // ===========================================================================
  describe('initial state', () => {
    it('starts in IDLE state', () => {
      expect(initialMachineState.state).toBe('IDLE')
    })

    it('has null cursor position', () => {
      expect(initialMachineState.context.cursorPosition).toBeNull()
    })

    it('has default zoom of 1', () => {
      expect(initialMachineState.context.currentZoom).toBe(1)
      expect(initialMachineState.context.targetZoom).toBe(1)
    })

    it('has no previous state', () => {
      expect(initialMachineState.previousState).toBeNull()
    })
  })

  // ===========================================================================
  // IDLE State Transitions
  // ===========================================================================
  describe('IDLE state', () => {
    it('transitions to HOVERING on MOUSE_ENTER', () => {
      const result = interactionReducer(initialMachineState, { type: 'MOUSE_ENTER' })
      expect(result.state).toBe('HOVERING')
      expect(result.previousState).toBe('IDLE')
    })

    it('transitions to MAGNIFIER_VISIBLE on SHOW_MAGNIFIER', () => {
      const result = interactionReducer(initialMachineState, { type: 'SHOW_MAGNIFIER' })
      expect(result.state).toBe('MAGNIFIER_VISIBLE')
      expect(result.context.targetOpacity).toBe(1)
    })

    it('stores touch start position on map TOUCH_START', () => {
      const result = interactionReducer(initialMachineState, {
        type: 'TOUCH_START',
        target: 'map',
        touches: [{ x: 100, y: 200, identifier: 1 }],
      })
      // Stays IDLE until drag threshold met
      expect(result.state).toBe('IDLE')
      expect(result.context.touchStart).toEqual({ x: 100, y: 200, identifier: 1 })
    })

    it('ignores MOUSE_LEAVE', () => {
      const result = interactionReducer(initialMachineState, { type: 'MOUSE_LEAVE' })
      expect(result).toBe(initialMachineState) // Same reference = no change
    })

    it('ignores DISMISS_MAGNIFIER', () => {
      const result = interactionReducer(initialMachineState, { type: 'DISMISS_MAGNIFIER' })
      expect(result).toBe(initialMachineState)
    })
  })

  // ===========================================================================
  // HOVERING State Transitions
  // ===========================================================================
  describe('HOVERING state', () => {
    const hoveringState = applyEvents([{ type: 'MOUSE_ENTER' }])

    it('transitions to IDLE on MOUSE_LEAVE', () => {
      const result = interactionReducer(hoveringState, { type: 'MOUSE_LEAVE' })
      expect(result.state).toBe('IDLE')
      expect(result.context.cursorPosition).toBeNull()
    })

    it('updates cursor position on MOUSE_MOVE', () => {
      const result = interactionReducer(hoveringState, {
        type: 'MOUSE_MOVE',
        position: { x: 150, y: 250 },
        movement: { dx: 5, dy: 5 },
      })
      expect(result.state).toBe('HOVERING')
      expect(result.context.cursorPosition).toEqual({ x: 150, y: 250 })
    })

    it('transitions to MAP_PANNING_DESKTOP on middle MOUSE_DOWN', () => {
      const result = interactionReducer(hoveringState, {
        type: 'MOUSE_DOWN',
        button: 'middle',
      })
      expect(result.state).toBe('MAP_PANNING_DESKTOP')
    })

    it('ignores left MOUSE_DOWN', () => {
      const result = interactionReducer(hoveringState, {
        type: 'MOUSE_DOWN',
        button: 'left',
      })
      expect(result.state).toBe('HOVERING')
    })

    it('transitions to MAGNIFIER_VISIBLE on SHOW_MAGNIFIER', () => {
      const result = interactionReducer(hoveringState, { type: 'SHOW_MAGNIFIER' })
      expect(result.state).toBe('MAGNIFIER_VISIBLE')
      expect(result.context.targetOpacity).toBe(1)
    })
  })

  // ===========================================================================
  // MAGNIFIER_VISIBLE State Transitions
  // ===========================================================================
  describe('MAGNIFIER_VISIBLE state', () => {
    const magnifierState = applyEvents([{ type: 'MOUSE_ENTER' }, { type: 'SHOW_MAGNIFIER' }])

    it('updates cursor position on MOUSE_MOVE', () => {
      const result = interactionReducer(magnifierState, {
        type: 'MOUSE_MOVE',
        position: { x: 200, y: 300 },
        movement: { dx: 10, dy: 10 },
      })
      expect(result.state).toBe('MAGNIFIER_VISIBLE')
      expect(result.context.cursorPosition).toEqual({ x: 200, y: 300 })
    })

    it('transitions to IDLE on DISMISS_MAGNIFIER', () => {
      const result = interactionReducer(magnifierState, { type: 'DISMISS_MAGNIFIER' })
      expect(result.state).toBe('IDLE')
      expect(result.context.targetOpacity).toBe(0)
    })

    it('transitions to PRECISION_MODE on REQUEST_PRECISION', () => {
      const result = interactionReducer(magnifierState, { type: 'REQUEST_PRECISION' })
      expect(result.state).toBe('PRECISION_MODE')
    })

    it('transitions to MAGNIFIER_EXPANDED on EXPAND_MAGNIFIER', () => {
      const result = interactionReducer(magnifierState, { type: 'EXPAND_MAGNIFIER' })
      expect(result.state).toBe('MAGNIFIER_EXPANDED')
    })

    it('transitions to MAGNIFIER_PANNING on single-finger magnifier TOUCH_START', () => {
      const result = interactionReducer(magnifierState, {
        type: 'TOUCH_START',
        target: 'magnifier',
        touches: [{ x: 50, y: 50, identifier: 1 }],
      })
      expect(result.state).toBe('MAGNIFIER_PANNING')
      expect(result.context.touchStart).toEqual({ x: 50, y: 50, identifier: 1 })
    })

    it('transitions to MAGNIFIER_PINCHING on two-finger magnifier TOUCH_START', () => {
      const result = interactionReducer(magnifierState, {
        type: 'TOUCH_START',
        target: 'magnifier',
        touches: [
          { x: 50, y: 50, identifier: 1 },
          { x: 100, y: 50, identifier: 2 },
        ],
      })
      expect(result.state).toBe('MAGNIFIER_PINCHING')
      // Pinch start distance should be calculated
      expect(result.context.pinchStartDistance).toBe(50) // sqrt((100-50)^2 + (50-50)^2)
    })
  })

  // ===========================================================================
  // MAGNIFIER_PANNING State Transitions
  // ===========================================================================
  describe('MAGNIFIER_PANNING state', () => {
    const panningState = applyEvents([
      { type: 'MOUSE_ENTER' },
      { type: 'SHOW_MAGNIFIER' },
      {
        type: 'TOUCH_START',
        target: 'magnifier',
        touches: [{ x: 50, y: 50, identifier: 1 }],
      },
    ])

    it('updates cursor position on TOUCH_MOVE', () => {
      const result = interactionReducer(panningState, {
        type: 'TOUCH_MOVE',
        target: 'magnifier',
        touches: [{ x: 75, y: 100, identifier: 1 }],
      })
      expect(result.state).toBe('MAGNIFIER_PANNING')
      expect(result.context.cursorPosition).toEqual({ x: 75, y: 100, identifier: 1 })
    })

    it('transitions to MAGNIFIER_VISIBLE on TOUCH_END', () => {
      const result = interactionReducer(panningState, {
        type: 'TOUCH_END',
        target: 'magnifier',
        remainingTouches: 0,
      })
      expect(result.state).toBe('MAGNIFIER_VISIBLE')
    })

    it('transitions to IDLE on DISMISS_MAGNIFIER', () => {
      const result = interactionReducer(panningState, { type: 'DISMISS_MAGNIFIER' })
      expect(result.state).toBe('IDLE')
    })
  })

  // ===========================================================================
  // MAGNIFIER_PINCHING State Transitions
  // ===========================================================================
  describe('MAGNIFIER_PINCHING state', () => {
    const pinchingState = applyEvents([
      { type: 'MOUSE_ENTER' },
      { type: 'SHOW_MAGNIFIER' },
      {
        type: 'TOUCH_START',
        target: 'magnifier',
        touches: [
          { x: 50, y: 50, identifier: 1 },
          { x: 100, y: 50, identifier: 2 },
        ],
      },
    ])

    it('stays in MAGNIFIER_PINCHING on TOUCH_MOVE with two fingers', () => {
      const result = interactionReducer(pinchingState, {
        type: 'TOUCH_MOVE',
        target: 'magnifier',
        touches: [
          { x: 40, y: 50, identifier: 1 },
          { x: 110, y: 50, identifier: 2 },
        ],
      })
      expect(result.state).toBe('MAGNIFIER_PINCHING')
    })

    it('transitions to MAGNIFIER_VISIBLE on TOUCH_END', () => {
      const result = interactionReducer(pinchingState, {
        type: 'TOUCH_END',
        target: 'magnifier',
        remainingTouches: 0,
      })
      expect(result.state).toBe('MAGNIFIER_VISIBLE')
    })

    it('transitions to MAGNIFIER_EXPANDED on ZOOM_THRESHOLD_REACHED', () => {
      const result = interactionReducer(pinchingState, { type: 'ZOOM_THRESHOLD_REACHED' })
      expect(result.state).toBe('MAGNIFIER_EXPANDED')
    })

    it('transitions to IDLE on DISMISS_MAGNIFIER', () => {
      const result = interactionReducer(pinchingState, { type: 'DISMISS_MAGNIFIER' })
      expect(result.state).toBe('IDLE')
      expect(result.context.pinchStartDistance).toBeNull()
      expect(result.context.pinchStartZoom).toBeNull()
    })
  })

  // ===========================================================================
  // MAGNIFIER_EXPANDED State Transitions
  // ===========================================================================
  describe('MAGNIFIER_EXPANDED state', () => {
    const expandedState = applyEvents([
      { type: 'MOUSE_ENTER' },
      { type: 'SHOW_MAGNIFIER' },
      { type: 'EXPAND_MAGNIFIER' },
    ])

    it('transitions to MAGNIFIER_VISIBLE on COLLAPSE_MAGNIFIER', () => {
      const result = interactionReducer(expandedState, { type: 'COLLAPSE_MAGNIFIER' })
      expect(result.state).toBe('MAGNIFIER_VISIBLE')
    })

    it('transitions to IDLE on DISMISS_MAGNIFIER', () => {
      const result = interactionReducer(expandedState, { type: 'DISMISS_MAGNIFIER' })
      expect(result.state).toBe('IDLE')
      expect(result.context.targetOpacity).toBe(0)
    })
  })

  // ===========================================================================
  // MAP_PANNING_MOBILE State Transitions
  // ===========================================================================
  describe('MAP_PANNING_MOBILE state', () => {
    // This state requires SHOW_MAGNIFIER from IDLE with drag context
    const mobilePanningState: MachineState = {
      state: 'MAP_PANNING_MOBILE',
      context: {
        ...initialMachineState.context,
        touchStart: { x: 100, y: 100 },
        cursorPosition: { x: 150, y: 150 },
      },
      previousState: 'IDLE',
    }

    it('updates cursor position on TOUCH_MOVE', () => {
      const result = interactionReducer(mobilePanningState, {
        type: 'TOUCH_MOVE',
        target: 'map',
        touches: [{ x: 200, y: 250, identifier: 1 }],
      })
      expect(result.state).toBe('MAP_PANNING_MOBILE')
      expect(result.context.cursorPosition).toEqual({ x: 200, y: 250, identifier: 1 })
    })

    it('transitions to MAGNIFIER_VISIBLE on TOUCH_END with dragTriggeredMagnifier', () => {
      const result = interactionReducer(mobilePanningState, {
        type: 'TOUCH_END',
        target: 'map',
        remainingTouches: 0,
      })
      expect(result.state).toBe('MAGNIFIER_VISIBLE')
      expect(result.context.dragTriggeredMagnifier).toBe(true)
    })

    it('transitions to IDLE on DISMISS_MAGNIFIER', () => {
      const result = interactionReducer(mobilePanningState, { type: 'DISMISS_MAGNIFIER' })
      expect(result.state).toBe('IDLE')
      expect(result.context.dragTriggeredMagnifier).toBe(false)
    })
  })

  // ===========================================================================
  // MAP_PANNING_DESKTOP State Transitions
  // ===========================================================================
  describe('MAP_PANNING_DESKTOP state', () => {
    const desktopPanningState = applyEvents([
      { type: 'MOUSE_ENTER' },
      { type: 'MOUSE_DOWN', button: 'middle' },
    ])

    it('transitions to HOVERING on MOUSE_UP', () => {
      const result = interactionReducer(desktopPanningState, { type: 'MOUSE_UP' })
      expect(result.state).toBe('HOVERING')
    })

    it('transitions to IDLE on MOUSE_LEAVE', () => {
      const result = interactionReducer(desktopPanningState, { type: 'MOUSE_LEAVE' })
      expect(result.state).toBe('IDLE')
    })
  })

  // ===========================================================================
  // PRECISION_MODE State Transitions
  // ===========================================================================
  describe('PRECISION_MODE state', () => {
    const precisionState = applyEvents([
      { type: 'MOUSE_ENTER' },
      { type: 'SHOW_MAGNIFIER' },
      { type: 'REQUEST_PRECISION' },
    ])

    it('updates cursor position on MOUSE_MOVE', () => {
      const result = interactionReducer(precisionState, {
        type: 'MOUSE_MOVE',
        position: { x: 300, y: 400 },
        movement: { dx: 2, dy: 3 },
      })
      expect(result.state).toBe('PRECISION_MODE')
      expect(result.context.cursorPosition).toEqual({ x: 300, y: 400 })
    })

    it('transitions to RELEASING_PRECISION on PRECISION_ESCAPE_BOUNDARY', () => {
      const result = interactionReducer(precisionState, { type: 'PRECISION_ESCAPE_BOUNDARY' })
      expect(result.state).toBe('RELEASING_PRECISION')
    })

    it('transitions to RELEASING_PRECISION on EXIT_PRECISION', () => {
      const result = interactionReducer(precisionState, { type: 'EXIT_PRECISION' })
      expect(result.state).toBe('RELEASING_PRECISION')
    })
  })

  // ===========================================================================
  // RELEASING_PRECISION State Transitions
  // ===========================================================================
  describe('RELEASING_PRECISION state', () => {
    const releasingState = applyEvents([
      { type: 'MOUSE_ENTER' },
      { type: 'SHOW_MAGNIFIER' },
      { type: 'REQUEST_PRECISION' },
      { type: 'PRECISION_ESCAPE_BOUNDARY' },
    ])

    it('transitions to MAGNIFIER_VISIBLE on RELEASE_ANIMATION_DONE', () => {
      const result = interactionReducer(releasingState, { type: 'RELEASE_ANIMATION_DONE' })
      expect(result.state).toBe('MAGNIFIER_VISIBLE')
      expect(result.context.initialCapturePosition).toBeNull()
      expect(result.context.cursorSquish).toEqual({ x: 1, y: 1 })
    })

    it('ignores other events during release animation', () => {
      const result = interactionReducer(releasingState, { type: 'MOUSE_LEAVE' })
      expect(result.state).toBe('RELEASING_PRECISION')
    })
  })

  // ===========================================================================
  // Context Preservation
  // ===========================================================================
  describe('context preservation', () => {
    it('preserves unrelated context fields during state transitions', () => {
      const stateWithContext: MachineState = {
        ...initialMachineState,
        context: {
          ...initialMachineState.context,
          currentZoom: 5,
          targetZoom: 10,
          magnifierTop: 100,
          magnifierLeft: 200,
        },
      }

      const result = interactionReducer(stateWithContext, { type: 'MOUSE_ENTER' })

      expect(result.context.currentZoom).toBe(5)
      expect(result.context.targetZoom).toBe(10)
      expect(result.context.magnifierTop).toBe(100)
      expect(result.context.magnifierLeft).toBe(200)
    })
  })

  // ===========================================================================
  // Previous State Tracking
  // ===========================================================================
  describe('previous state tracking', () => {
    it('tracks previous state through transitions', () => {
      let state = initialMachineState
      expect(state.previousState).toBeNull()

      state = interactionReducer(state, { type: 'MOUSE_ENTER' })
      expect(state.state).toBe('HOVERING')
      expect(state.previousState).toBe('IDLE')

      state = interactionReducer(state, { type: 'SHOW_MAGNIFIER' })
      expect(state.state).toBe('MAGNIFIER_VISIBLE')
      expect(state.previousState).toBe('HOVERING')

      state = interactionReducer(state, { type: 'REQUEST_PRECISION' })
      expect(state.state).toBe('PRECISION_MODE')
      expect(state.previousState).toBe('MAGNIFIER_VISIBLE')
    })
  })

  // ===========================================================================
  // Invalid Transitions (Should Not Change State)
  // ===========================================================================
  describe('invalid transitions', () => {
    it('ignores EXPAND_MAGNIFIER from IDLE', () => {
      const result = interactionReducer(initialMachineState, { type: 'EXPAND_MAGNIFIER' })
      expect(result).toBe(initialMachineState)
    })

    it('ignores REQUEST_PRECISION from IDLE', () => {
      const result = interactionReducer(initialMachineState, { type: 'REQUEST_PRECISION' })
      expect(result).toBe(initialMachineState)
    })

    it('ignores COLLAPSE_MAGNIFIER from HOVERING', () => {
      const hoveringState = applyEvents([{ type: 'MOUSE_ENTER' }])
      const result = interactionReducer(hoveringState, { type: 'COLLAPSE_MAGNIFIER' })
      expect(result).toBe(hoveringState)
    })

    it('ignores RELEASE_ANIMATION_DONE from PRECISION_MODE', () => {
      const precisionState = applyEvents([
        { type: 'MOUSE_ENTER' },
        { type: 'SHOW_MAGNIFIER' },
        { type: 'REQUEST_PRECISION' },
      ])
      const result = interactionReducer(precisionState, { type: 'RELEASE_ANIMATION_DONE' })
      expect(result).toBe(precisionState)
    })
  })
})
