/**
 * Convert playground PostCompletionAction[] to ProofJSON format.
 *
 * Used by the admin export pipeline to generate PropositionDef code
 * from playground constructions.
 */

import type { PostCompletionAction } from '../engine/replayConstruction'
import type {
  ProofJSON,
  SerializedElement,
  SerializedStep,
  SerializedAction,
  SerializedEqualityFact,
  SerializedAngleEqualityFact,
} from '../types'
import { BYRNE } from '../types'
import type { ConstructionState } from '../types'
import { getPoint } from '../engine/constructionState'

/** Resolve a point ID to its label, falling back to stripping the pt- prefix. */
function pointLabel(state: ConstructionState, id: string): string {
  return getPoint(state, id)?.label ?? id.replace(/^pt-/, '')
}

/**
 * Map PostCompletionAction to SerializedAction (ProofJSON format).
 * Returns null for action types with no ProofJSON equivalent (e.g. free-point).
 */
function convertAction(
  action: PostCompletionAction,
  state: ConstructionState
): SerializedAction | null {
  switch (action.type) {
    case 'circle':
      return { type: 'compass', centerId: action.centerId, radiusPointId: action.radiusPointId }
    case 'segment':
      return { type: 'straightedge', fromId: action.fromId, toId: action.toId }
    case 'intersection':
      // Derive label from the last intersection point in state at this stage
      // We'll provide a fallback label
      return { type: 'intersection', ofA: action.ofA, ofB: action.ofB, label: '?' }
    case 'macro':
      return { type: 'macro', propId: action.propId, inputPointIds: action.inputPointIds }
    case 'extend':
      return {
        type: 'extend',
        baseId: action.baseId,
        throughId: action.throughId,
        distance: action.distance,
        label: pointLabel(state, action.pointId),
      }
    case 'free-point':
      // No ProofJSON equivalent for user-placed free points
      return null
  }
}

/** Derive a citation string from a PostCompletionAction. */
function citationFor(action: PostCompletionAction): string {
  switch (action.type) {
    case 'segment':
      return 'Post.1'
    case 'extend':
      return 'Post.2'
    case 'circle':
      return 'Post.3'
    case 'macro':
      return `I.${action.propId}`
    case 'intersection':
    case 'free-point':
      return ''
  }
}

/** Derive an instruction string from a PostCompletionAction. */
function instructionFor(action: PostCompletionAction, state: ConstructionState): string {
  switch (action.type) {
    case 'segment': {
      const from = pointLabel(state, action.fromId)
      const to = pointLabel(state, action.toId)
      return `Join ${from} to ${to}`
    }
    case 'extend': {
      const base = pointLabel(state, action.baseId)
      const through = pointLabel(state, action.throughId)
      const pt = pointLabel(state, action.pointId)
      return `Produce ${base}${through} beyond ${through} to ${pt}`
    }
    case 'circle': {
      const center = pointLabel(state, action.centerId)
      const radius = pointLabel(state, action.radiusPointId)
      return `Describe circle with center ${center} through ${radius}`
    }
    case 'intersection':
      return `Mark intersection point`
    case 'macro': {
      const inputs = action.inputPointIds.map((id) => pointLabel(state, id))
      return `Apply I.${action.propId} to ${inputs.join(', ')}`
    }
    case 'free-point':
      return `Place point ${action.label}`
  }
}

export interface PlaygroundToProofOptions {
  /** Proposition ID to use in the output (default: 0) */
  id?: number
  /** Title for the ProofJSON (default: 'Playground Construction') */
  title?: string
  /** Kind of construction (default: 'construction') */
  kind?: 'construction' | 'theorem'
  /** Equality constraints from given-setup mode */
  givenFacts?: SerializedEqualityFact[]
  /** Angle equality constraints from given-setup mode */
  givenAngleFacts?: SerializedAngleEqualityFact[]
}

/**
 * Convert playground data to ProofJSON format.
 *
 * @param givenElements - The given elements from the construction state
 * @param actions - PostCompletionAction array from the playground
 * @param state - The final construction state (for resolving point labels)
 * @param options - Optional configuration for the output
 */
export function playgroundToProofJSON(
  givenElements: ConstructionState['elements'],
  actions: PostCompletionAction[],
  state: ConstructionState,
  options: PlaygroundToProofOptions = {}
): ProofJSON {
  const { id = 0, title = 'Playground Construction', kind = 'construction', givenFacts, givenAngleFacts } = options

  // Convert given elements to serialized format
  const serializedGiven: SerializedElement[] = givenElements
    .filter((el) => el.origin === 'given')
    .map((el) => {
      if (el.kind === 'point') {
        return {
          kind: 'point' as const,
          id: el.id,
          label: el.label,
          x: el.x,
          y: el.y,
          color: BYRNE.given,
          origin: 'given' as const,
        }
      }
      if (el.kind === 'segment') {
        return {
          kind: 'segment' as const,
          id: el.id,
          fromId: el.fromId,
          toId: el.toId,
          color: BYRNE.given,
          origin: 'given' as const,
        }
      }
      // circle
      return {
        kind: 'circle' as const,
        id: el.id,
        centerId: el.centerId,
        radiusPointId: el.radiusPointId,
        color: BYRNE.given,
        origin: 'compass' as const,
      }
    })

  // Convert actions to steps (skip free-points)
  const steps: SerializedStep[] = []
  for (const action of actions) {
    const serialized = convertAction(action, state)
    if (!serialized) continue

    steps.push({
      citation: citationFor(action),
      instruction: instructionFor(action, state),
      action: serialized,
    })
  }

  const result: ProofJSON = {
    id,
    title,
    kind,
    givenElements: serializedGiven,
    steps,
  }
  if (givenFacts && givenFacts.length > 0) result.givenFacts = givenFacts
  if (givenAngleFacts && givenAngleFacts.length > 0) result.givenAngleFacts = givenAngleFacts
  return result
}
