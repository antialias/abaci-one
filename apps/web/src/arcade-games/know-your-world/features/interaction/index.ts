/**
 * Interaction Feature Module
 *
 * State machine for managing map interaction state.
 * Replaces scattered boolean flags with explicit states.
 */

export type {
  InteractionContext,
  InteractionEvent,
  InteractionState,
  MachineState,
  TouchPoint,
  UseInteractionStateMachineReturn,
} from './useInteractionStateMachine'

export { useInteractionStateMachine } from './useInteractionStateMachine'
