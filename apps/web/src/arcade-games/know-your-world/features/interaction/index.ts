/**
 * Interaction Feature Module
 *
 * This module handles user interaction state management for the Know Your World game:
 * - Desktop mouse interactions (hover, drag, click, pointer lock)
 * - Mobile touch interactions (tap, pan, pinch-to-zoom)
 * - Explicit state machine to replace scattered boolean flags
 *
 * ## Usage
 *
 * ```tsx
 * import { useInteractionStateMachine } from '../features/interaction'
 *
 * function MapRenderer() {
 *   const interaction = useInteractionStateMachine({
 *     initialMode: isTouchDevice ? 'mobile' : 'desktop'
 *   })
 *
 *   // Use derived state instead of boolean flags
 *   if (interaction.isPointerLocked) { ... }
 *   if (interaction.isDragging) { ... }
 *
 *   // Dispatch events from handlers
 *   const handleMouseDown = (e: MouseEvent) => {
 *     interaction.dispatch({
 *       type: 'MOUSE_DOWN',
 *       position: { x: e.clientX, y: e.clientY }
 *     })
 *   }
 * }
 * ```
 */

// ============================================================================
// State Machine Hook
// ============================================================================

export type {
  DesktopPhase,
  InteractionEvent,
  InteractionState,
  MobilePhase,
  Point,
  UseInteractionStateMachineOptions,
  UseInteractionStateMachineReturn,
} from './useInteractionStateMachine'

export { useInteractionStateMachine } from './useInteractionStateMachine'
