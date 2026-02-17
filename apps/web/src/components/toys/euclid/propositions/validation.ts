import type {
  ConstructionElement,
  ConstructionState,
  ExpectedAction,
  IntersectionCandidate,
} from '../types'
import { isCandidateBeyondPoint } from '../engine/intersections'
import { resolveSelector } from '../engine/selectors'

/**
 * Validate whether the last committed element matches the expected action for a step.
 * Returns true if the step is satisfied.
 *
 * For intersection steps, optionally validates that the candidate came from the
 * expected pair of elements (ofA/ofB). These use ElementSelectors resolved at
 * runtime to decouple propositions from element creation order.
 *
 * For macro steps, validation is handled externally (the macro commit handler
 * validates input points and calls checkStep with a synthetic element).
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
    // If ofA/ofB are specified, resolve selectors and check that the candidate matches
    if (expected.ofA != null && expected.ofB != null) {
      if (!candidate) return false
      const resolvedA = resolveSelector(expected.ofA, state)
      const resolvedB = resolveSelector(expected.ofB, state)
      if (!resolvedA || !resolvedB) return false
      const matchesElements =
        (candidate.ofA === resolvedA && candidate.ofB === resolvedB) ||
        (candidate.ofA === resolvedB && candidate.ofB === resolvedA)
      if (!matchesElements) return false
      // If beyondId is specified, candidate must be on the extension past that point
      if (expected.beyondId) {
        return isCandidateBeyondPoint(candidate, expected.beyondId, candidate.ofA, candidate.ofB, state)
      }
      return true
    }
    // Accept any intersection point when ofA/ofB are omitted
    return true
  }

  if (expected.type === 'straightedge' && lastElement.kind === 'segment') {
    // Flexible on order: (from, to) or (to, from)
    return (
      (lastElement.fromId === expected.fromId && lastElement.toId === expected.toId) ||
      (lastElement.fromId === expected.toId && lastElement.toId === expected.fromId)
    )
  }

  // Macro steps are validated and advanced directly by handleCommitMacro
  // in EuclidCanvas.tsx, not through this function.

  return false
}
