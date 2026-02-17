import type {
  ConstructionElement,
  ConstructionState,
  ExpectedAction,
  IntersectionCandidate,
} from '../types'

/**
 * Validate whether the last committed element matches the expected action for a step.
 * Returns true if the step is satisfied.
 *
 * For intersection steps, optionally validates that the candidate came from the
 * expected pair of elements (ofA/ofB).
 */
export function validateStep(
  expected: ExpectedAction,
  state: ConstructionState,
  lastElement: ConstructionElement,
  candidate?: IntersectionCandidate,
): boolean {
  if (expected.type === 'compass' && lastElement.kind === 'circle') {
    return (
      lastElement.centerId === expected.centerId &&
      lastElement.radiusPointId === expected.radiusPointId
    )
  }

  if (expected.type === 'intersection' && lastElement.kind === 'point' && lastElement.origin === 'intersection') {
    // If ofA/ofB are specified, check that the candidate matches
    if (expected.ofA && expected.ofB) {
      if (!candidate) return false
      return (
        (candidate.ofA === expected.ofA && candidate.ofB === expected.ofB) ||
        (candidate.ofA === expected.ofB && candidate.ofB === expected.ofA)
      )
    }
    // Accept any intersection point when ofA/ofB are empty
    return true
  }

  if (expected.type === 'straightedge' && lastElement.kind === 'segment') {
    // Flexible on order: (from, to) or (to, from)
    return (
      (lastElement.fromId === expected.fromId && lastElement.toId === expected.toId) ||
      (lastElement.fromId === expected.toId && lastElement.toId === expected.fromId)
    )
  }

  return false
}
