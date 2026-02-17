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
    atStep: number,
    extendSegments?: boolean,
    outputLabels?: Record<string, string>,
  ) => MacroResult
}

export interface MacroResult {
  state: ConstructionState
  candidates: IntersectionCandidate[]
  addedElements: ConstructionElement[]
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
    atStep: number,
    extendSegments: boolean = false,
    outputLabels?: Record<string, string>,
  ): MacroResult {
    const [ptA, ptB] = inputPointIds
    const addedElements: ConstructionElement[] = []
    let currentState = state
    let currentCandidates = [...candidates]
    // factStore is mutated in place by addFact
    const allNewFacts: EqualityFact[] = []

    // 1. Compute apex as intersection of two circles:
    //    circle(centerA, radiusAB) ∩ circle(centerB, radiusBA)
    //    No circles are added to state — I.1 is a proven tool.
    const pA = getPoint(currentState, ptA)
    const pB = getPoint(currentState, ptB)
    if (!pA || !pB) {
      return { state: currentState, candidates: currentCandidates, addedElements, newFacts: allNewFacts }
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
      return { state: currentState, candidates: currentCandidates, addedElements, newFacts: allNewFacts }
    }

    // 2. Add the apex point (use explicit label if provided)
    const ptResult = addPoint(currentState, apex.x, apex.y, 'intersection', outputLabels?.apex)
    currentState = ptResult.state
    addedElements.push(ptResult.point)

    // 3. Derive Def.15 facts directly — no circles needed in state.
    //    DA = AB (D on circle centered at A through B)
    //    DB = BA (D on circle centered at B through A)
    const apexId = ptResult.point.id
    const apexLabel = ptResult.point.label
    const aLabel = pA.label
    const bLabel = pB.label

    {
      const left = distancePair(ptA, apexId)
      const right = distancePair(ptA, ptB)
      allNewFacts.push(...addFact(
        factStore, left, right,
        { type: 'def15', circleId: `internal-cir-${ptA}` },
        `${aLabel}${apexLabel} = ${aLabel}${bLabel}`,
        `Def.15: ${apexLabel} lies on circle centered at ${aLabel} through ${bLabel}`,
        atStep,
      ))
    }
    {
      const left = distancePair(ptB, apexId)
      const right = distancePair(ptB, ptA)
      allNewFacts.push(...addFact(
        factStore, left, right,
        { type: 'def15', circleId: `internal-cir-${ptB}` },
        `${bLabel}${apexLabel} = ${bLabel}${aLabel}`,
        `Def.15: ${apexLabel} lies on circle centered at ${bLabel} through ${aLabel}`,
        atStep,
      ))
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
      newFacts: allNewFacts,
    }
  },
}

/**
 * Macro for Proposition I.2: Place at a given point a line equal to a given line.
 *
 * Inputs: [targetPointId, segFromId, segToId]
 *   - targetPointId: where to place the equal segment
 *   - segFromId, segToId: endpoints of the segment to copy
 *
 * Output: 1 point + 1 segment + 1 fact
 *   - Point at distance |segFrom-segTo| from target, in direction target→segFrom
 *   - Segment from target to output point
 *   - Fact: dist(target, output) = dist(segFrom, segTo) with citation { type: 'prop', propId: 2 }
 */
const MACRO_PROP_2: MacroDef = {
  propId: 2,
  label: 'Transfer distance (I.2)',
  inputCount: 3,
  inputLabels: ['Target point', 'Segment start', 'Segment end'],
  execute(
    state: ConstructionState,
    inputPointIds: string[],
    candidates: IntersectionCandidate[],
    factStore: FactStore,
    atStep: number,
    extendSegments: boolean = false,
    outputLabels?: Record<string, string>,
  ): MacroResult {
    const [targetId, segFromId, segToId] = inputPointIds
    const addedElements: ConstructionElement[] = []
    let currentState = state
    let currentCandidates = [...candidates]
    const allNewFacts: EqualityFact[] = []

    const target = getPoint(currentState, targetId)
    const segFrom = getPoint(currentState, segFromId)
    const segTo = getPoint(currentState, segToId)
    if (!target || !segFrom || !segTo) {
      return { state: currentState, candidates: currentCandidates, addedElements, newFacts: allNewFacts }
    }

    // 1. Compute distance to copy
    const dist = Math.sqrt((segFrom.x - segTo.x) ** 2 + (segFrom.y - segTo.y) ** 2)

    // 2. Compute direction: target → segFrom (fallback to (0, 1) if coincident)
    let dx = segFrom.x - target.x
    let dy = segFrom.y - target.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1e-9) {
      dx = 0
      dy = 1
    } else {
      dx /= len
      dy /= len
    }

    // 3. Place output point at target + dist * direction
    const outX = target.x + dist * dx
    const outY = target.y + dist * dy

    const ptResult = addPoint(currentState, outX, outY, 'intersection', outputLabels?.result)
    currentState = ptResult.state
    addedElements.push(ptResult.point)

    // 4. Add segment from target to output + find intersections
    const seg = addSegment(currentState, targetId, ptResult.point.id)
    currentState = seg.state
    addedElements.push(seg.segment)
    const newCands = findNewIntersections(currentState, seg.segment, currentCandidates, extendSegments)
    currentCandidates = [...currentCandidates, ...newCands]

    // 5. Add fact: dist(target, output) = dist(segFrom, segTo)
    const outputId = ptResult.point.id
    const outputLabel = ptResult.point.label
    const targetLabel = target.label
    const segFromLabel = segFrom.label
    const segToLabel = segTo.label

    const left = distancePair(targetId, outputId)
    const right = distancePair(segFromId, segToId)
    allNewFacts.push(...addFact(
      factStore, left, right,
      { type: 'prop', propId: 2 },
      `${targetLabel}${outputLabel} = ${segFromLabel}${segToLabel}`,
      `I.2: placed at ${targetLabel} a line equal to ${segFromLabel}${segToLabel}`,
      atStep,
    ))

    return {
      state: currentState,
      candidates: currentCandidates,
      addedElements,
      newFacts: allNewFacts,
    }
  },
}

export const MACRO_REGISTRY: Record<number, MacroDef> = {
  1: MACRO_PROP_1,
  2: MACRO_PROP_2,
}
