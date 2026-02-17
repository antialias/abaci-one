import type { ConstructionState, IntersectionCandidate } from '../types'
import type { FactStore } from './factStore'
import type { EqualityFact } from './facts'
import { distancePair } from './facts'
import { addFact } from './factStore'
import { getCircle, getPoint } from './constructionState'

/**
 * When a point is marked as an intersection involving circles,
 * auto-derive Def.15 facts: dist(center, newPoint) = dist(center, radiusPoint)
 *
 * For each element in [candidate.ofA, candidate.ofB] that is a circle:
 * - Look up circle.centerId, circle.radiusPointId
 * - Add fact: dist(centerId, newPointId) = dist(centerId, radiusPointId)
 */
export function deriveDef15Facts(
  candidate: IntersectionCandidate,
  newPointId: string,
  state: ConstructionState,
  store: FactStore,
  atStep: number,
): EqualityFact[] {
  const allNewFacts: EqualityFact[] = []

  for (const elementId of [candidate.ofA, candidate.ofB]) {
    if (!elementId.startsWith('cir-')) continue

    const circle = getCircle(state, elementId)
    if (!circle) continue

    const center = getPoint(state, circle.centerId)
    const radiusPt = getPoint(state, circle.radiusPointId)
    const newPt = getPoint(state, newPointId)
    if (!center || !radiusPt || !newPt) continue

    const left = distancePair(circle.centerId, newPointId)
    const right = distancePair(circle.centerId, circle.radiusPointId)

    const centerLabel = center.label
    const newLabel = newPt.label
    const radiusLabel = radiusPt.label

    const statement = `${centerLabel}${newLabel} = ${centerLabel}${radiusLabel}`
    const justification = `Def.15: ${newLabel} lies on circle centered at ${centerLabel} through ${radiusLabel}`

    const newFacts = addFact(
      store,
      left,
      right,
      { type: 'def15', circleId: elementId },
      statement,
      justification,
      atStep,
    )
    allNewFacts.push(...newFacts)
  }

  return allNewFacts
}
