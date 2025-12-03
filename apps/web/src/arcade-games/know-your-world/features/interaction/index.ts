/**
 * Interaction Feature Module
 *
 * State machine for managing map interaction state.
 * Replaces scattered boolean flags with explicit states.
 */

export type {
  InteractionState,
  InteractionEvent,
  InteractionContext,
  TouchPoint,
  MachineState,
  UseInteractionStateMachineReturn,
} from './useInteractionStateMachine'

export { useInteractionStateMachine } from './useInteractionStateMachine'
