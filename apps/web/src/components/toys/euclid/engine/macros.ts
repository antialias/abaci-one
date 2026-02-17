import type {
  ConstructionState,
  ConstructionElement,
  IntersectionCandidate,
} from '../types'
import type { FactStore } from './factStore'
import type { EqualityFact } from './facts'
import { distancePair } from './facts'
import { addSegment, addPoint, getPoint } from './constructionState'
import { findNewIntersections, circleCircleIntersections } from './intersections'
import { addFact } from './factStore'

export interface MacroDef {
  propId: number
  label: string
  inputCount: number
  inputLabels: string[]
  execute: (
    state: ConstructionState,
    inputPointIds: string[],
    candidates: IntersectionCandidate[],
    factStore: FactStore,
    extendSegments?: boolean,
    outputLabels?: Record<string, string>,
  ) => MacroResult
}

export interface MacroResult {
  state: ConstructionState
  candidates: IntersectionCandidate[]
  addedElements: ConstructionElement[]
  factStore: FactStore
  newFacts: EqualityFact[]
}

/**
 * Macro for Proposition I.1: Construct equilateral triangle on two points.
 *
 * The construction circles are internal to the proof of I.1 and are NOT
 * rendered — this is a proven tool, so only the result (apex point + two
 * segments) is shown.
 *
 * Steps:
 * 1. Compute circle-circle intersection directly (no circles in state)
 * 2. addPoint for apex
 * 3. Derive Def.15 facts directly (DA = AB, DB = BA)
 * 4. addSegment(apex, ptA) + findNewIntersections
 * 5. addSegment(apex, ptB) + findNewIntersections
 */
const MACRO_PROP_1: MacroDef = {
  propId: 1,
  label: 'Equilateral triangle (I.1)',
  inputCount: 2,
  inputLabels: ['First endpoint', 'Second endpoint'],
  execute(
    state: ConstructionState,
    inputPointIds: string[],
    candidates: IntersectionCandidate[],
    factStore: FactStore,
    extendSegments: boolean = false,
    outputLabels?: Record<string, string>,
  ): MacroResult {
    const [ptA, ptB] = inputPointIds
    const addedElements: ConstructionElement[] = []
    let currentState = state
    let currentCandidates = [...candidates]
    let currentFactStore = factStore
    const allNewFacts: EqualityFact[] = []

    // 1. Compute apex as intersection of two circles:
    //    circle(centerA, radiusAB) ∩ circle(centerB, radiusBA)
    //    No circles are added to state — I.1 is a proven tool.
    const pA = getPoint(currentState, ptA)
    const pB = getPoint(currentState, ptB)
    if (!pA || !pB) {
      return { state: currentState, candidates: currentCandidates, addedElements, factStore: currentFactStore, newFacts: allNewFacts }
    }
    const radius = Math.sqrt((pA.x - pB.x) ** 2 + (pA.y - pB.y) ** 2)
    const intersections = circleCircleIntersections(
      pA.x, pA.y, radius,
      pB.x, pB.y, radius,
    )
    // Pick highest-Y intersection (above the line AB)
    const apex = intersections.reduce(
      (best, p) => (p.y > best.y ? p : best),
      intersections[0],
    )
    if (!apex) {
      return { state: currentState, candidates: currentCandidates, addedElements, factStore: currentFactStore, newFacts: allNewFacts }
    }

    // 2. Add the apex point (use explicit label if provided)
    const ptResult = addPoint(currentState, apex.x, apex.y, 'intersection', outputLabels?.apex)
    currentState = ptResult.state
    addedElements.push(ptResult.point)

    // 3. Derive Def.15 facts directly — no circles needed in state.
    //    DA = AB (D on circle centered at A through B)
    //    DB = BA (D on circle centered at B through A)
    //    atStep = -1 as placeholder; caller adjusts step numbering.
    const apexId = ptResult.point.id
    const apexLabel = ptResult.point.label
    const aLabel = pA.label
    const bLabel = pB.label

    {
      const left = distancePair(ptA, apexId)
      const right = distancePair(ptA, ptB)
      const result = addFact(
        currentFactStore, left, right,
        { type: 'def15', circleId: `internal-cir-${ptA}` },
        `${aLabel}${apexLabel} = ${aLabel}${bLabel}`,
        `Def.15: ${apexLabel} lies on circle centered at ${aLabel} through ${bLabel}`,
        -1,
      )
      currentFactStore = result.store
      allNewFacts.push(...result.newFacts)
    }
    {
      const left = distancePair(ptB, apexId)
      const right = distancePair(ptB, ptA)
      const result = addFact(
        currentFactStore, left, right,
        { type: 'def15', circleId: `internal-cir-${ptB}` },
        `${bLabel}${apexLabel} = ${bLabel}${aLabel}`,
        `Def.15: ${apexLabel} lies on circle centered at ${bLabel} through ${aLabel}`,
        -1,
      )
      currentFactStore = result.store
      allNewFacts.push(...result.newFacts)
    }

    // 4. Segment apex → A
    const seg1 = addSegment(currentState, apexId, ptA)
    currentState = seg1.state
    addedElements.push(seg1.segment)
    const newCands1 = findNewIntersections(currentState, seg1.segment, currentCandidates, extendSegments)
    currentCandidates = [...currentCandidates, ...newCands1]

    // 5. Segment apex → B
    const seg2 = addSegment(currentState, apexId, ptB)
    currentState = seg2.state
    addedElements.push(seg2.segment)
    const newCands2 = findNewIntersections(currentState, seg2.segment, currentCandidates, extendSegments)
    currentCandidates = [...currentCandidates, ...newCands2]

    return {
      state: currentState,
      candidates: currentCandidates,
      addedElements,
      factStore: currentFactStore,
      newFacts: allNewFacts,
    }
  },
}

export const MACRO_REGISTRY: Record<number, MacroDef> = {
  1: MACRO_PROP_1,
}
