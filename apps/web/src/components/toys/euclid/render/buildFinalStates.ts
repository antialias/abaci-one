import {
  initializeGiven,
  addCircle,
  addSegment,
  addPoint,
  getPoint,
} from '../engine/constructionState'
import { findNewIntersections, isCandidateBeyondPoint } from '../engine/intersections'
import { resolveSelector } from '../engine/selectors'
import { MACRO_REGISTRY } from '../engine/macros'
import { createFactStore } from '../engine/factStore'
import { deriveDef15Facts } from '../engine/factDerivation'
import { replayConstruction } from '../engine/replayConstruction'
import { PROP_1 } from '../propositions/prop1'
import { PROP_2 } from '../propositions/prop2'
import { PROP_3 } from '../propositions/prop3'
import { PROP_4 } from '../propositions/prop4'
import { PROP_5 } from '../propositions/prop5'
import { needsExtendedSegments } from '../types'
import type { ConstructionState, IntersectionCandidate } from '../types'

/**
 * Replay Proposition I.1: equilateral triangle on a given line.
 * Steps: circle(A,B) → circle(B,A) → mark apex C → segment(C,A) → segment(C,B)
 */
export function buildProp1FinalState(): ConstructionState {
  let state = initializeGiven(PROP_1.givenElements)
  let candidates: IntersectionCandidate[] = []

  // Step 0: Circle centered at A through B
  const cir1 = addCircle(state, 'pt-A', 'pt-B')
  state = cir1.state
  candidates = [...candidates, ...findNewIntersections(state, cir1.circle, candidates, false)]

  // Step 1: Circle centered at B through A
  const cir2 = addCircle(state, 'pt-B', 'pt-A')
  state = cir2.state
  candidates = [...candidates, ...findNewIntersections(state, cir2.circle, candidates, false)]

  // Step 2: Mark intersection C — use chirality (left of AB) for consistency with macros/replay
  const pA = getPoint(state, 'pt-A')!
  const pB = getPoint(state, 'pt-B')!
  const abx = pB.x - pA.x
  const aby = pB.y - pA.y
  const preferUpper = candidates.filter((c) => abx * (c.y - pA.y) - aby * (c.x - pA.x) > 0)
  const apexPool = preferUpper.length > 0 ? preferUpper : candidates
  const topCandidate =
    apexPool.length > 1
      ? apexPool.reduce((best, c) => (c.y > best.y ? c : best), apexPool[0])
      : apexPool[0]
  const ptC = addPoint(state, topCandidate.x, topCandidate.y, 'intersection', 'C')
  state = ptC.state

  // Step 3: Segment C-A
  const segCA = addSegment(state, 'pt-C', 'pt-A')
  state = segCA.state

  // Step 4: Segment C-B
  const segCB = addSegment(state, 'pt-C', 'pt-B')
  state = segCB.state

  return state
}

/**
 * Replay Proposition I.2: place at a given point a line equal to a given line.
 * Follows the same replay pattern as prop2Integration.test.ts.
 */
export function buildProp2FinalState(): ConstructionState {
  let state = initializeGiven(PROP_2.givenElements)
  let candidates: IntersectionCandidate[] = []
  const factStore = createFactStore()
  const steps = PROP_2.steps
  const ext = needsExtendedSegments(PROP_2)

  // Step 0: Join A to B
  const segAB = addSegment(state, 'pt-A', 'pt-B')
  state = segAB.state
  candidates = [...candidates, ...findNewIntersections(state, segAB.segment, candidates, ext)]

  // Step 1: I.1 macro on A,B → apex D
  const macro1 = MACRO_REGISTRY[1]
  const outputLabels1 =
    steps[1].expected.type === 'macro' ? steps[1].expected.outputLabels : undefined
  const macroResult1 = macro1.execute(
    state,
    ['pt-A', 'pt-B'],
    candidates,
    factStore,
    1,
    ext,
    outputLabels1
  )
  state = macroResult1.state
  candidates = macroResult1.candidates

  // Step 2: Circle at B through C
  const cirBC = addCircle(state, 'pt-B', 'pt-C')
  state = cirBC.state
  candidates = [...candidates, ...findNewIntersections(state, cirBC.circle, candidates, ext)]

  // Step 3: Mark intersection E (circle BC ∩ segment DB, beyond B)
  const step3 = steps[3].expected
  if (step3.type !== 'intersection') throw new Error('Expected intersection step')
  const resolved3A = step3.ofA != null ? resolveSelector(step3.ofA, state) : null
  const resolved3B = step3.ofB != null ? resolveSelector(step3.ofB, state) : null
  const step3Cands = candidates.filter((c) => {
    const matches =
      (c.ofA === resolved3A && c.ofB === resolved3B) ||
      (c.ofA === resolved3B && c.ofB === resolved3A)
    if (!matches) return false
    if (step3.beyondId) return isCandidateBeyondPoint(c, step3.beyondId, c.ofA, c.ofB, state)
    return true
  })
  const candE = step3Cands[0]
  const ptE = addPoint(state, candE.x, candE.y, 'intersection', step3.label)
  state = ptE.state
  deriveDef15Facts(candE, ptE.point.id, state, factStore, 3)
  candidates = candidates.filter(
    (c) => !(Math.abs(c.x - candE.x) < 0.001 && Math.abs(c.y - candE.y) < 0.001)
  )

  // Step 4: Circle at D through E
  const cirDE = addCircle(state, 'pt-D', 'pt-E')
  state = cirDE.state
  candidates = [...candidates, ...findNewIntersections(state, cirDE.circle, candidates, ext)]

  // Step 5: Mark intersection F (circle DE ∩ segment DA, beyond A)
  const step5 = steps[5].expected
  if (step5.type !== 'intersection') throw new Error('Expected intersection step')
  const resolved5A = step5.ofA != null ? resolveSelector(step5.ofA, state) : null
  const resolved5B = step5.ofB != null ? resolveSelector(step5.ofB, state) : null
  const step5Cands = candidates.filter((c) => {
    const matches =
      (c.ofA === resolved5A && c.ofB === resolved5B) ||
      (c.ofA === resolved5B && c.ofB === resolved5A)
    if (!matches) return false
    if (step5.beyondId) return isCandidateBeyondPoint(c, step5.beyondId, c.ofA, c.ofB, state)
    return true
  })
  const candF = step5Cands[0]
  const ptF = addPoint(state, candF.x, candF.y, 'intersection', step5.label)
  state = ptF.state
  deriveDef15Facts(candF, ptF.point.id, state, factStore, 5)

  return state
}

/**
 * Replay Proposition I.3: cut off from the greater a line equal to the less.
 * Follows the same replay pattern as prop3Integration.test.ts.
 */
export function buildProp3FinalState(): ConstructionState {
  let state = initializeGiven(PROP_3.givenElements)
  let candidates: IntersectionCandidate[] = []
  const factStore = createFactStore()
  const steps = PROP_3.steps

  // Step 0: I.2 macro on [A, C, D] → result E
  const macro2 = MACRO_REGISTRY[2]
  const outputLabels0 =
    steps[0].expected.type === 'macro' ? steps[0].expected.outputLabels : undefined
  const macroResult = macro2.execute(
    state,
    ['pt-A', 'pt-C', 'pt-D'],
    candidates,
    factStore,
    0,
    false,
    outputLabels0
  )
  state = macroResult.state
  candidates = macroResult.candidates

  // Step 1: Circle at A through E
  const cirAE = addCircle(state, 'pt-A', 'pt-E')
  state = cirAE.state
  candidates = [...candidates, ...findNewIntersections(state, cirAE.circle, candidates, false)]

  // Step 2: Mark intersection F (circle AE ∩ segment AB)
  const step2 = steps[2].expected
  if (step2.type !== 'intersection') throw new Error('Expected intersection step')
  const resolved2A = step2.ofA != null ? resolveSelector(step2.ofA, state) : null
  const resolved2B = step2.ofB != null ? resolveSelector(step2.ofB, state) : null
  const step2Cands = candidates.filter(
    (c) =>
      (c.ofA === resolved2A && c.ofB === resolved2B) ||
      (c.ofA === resolved2B && c.ofB === resolved2A)
  )
  const candF = step2Cands[0]
  const ptFResult = addPoint(state, candF.x, candF.y, 'intersection', step2.label)
  state = ptFResult.state
  deriveDef15Facts(candF, ptFResult.point.id, state, factStore, 2)

  return state
}

/**
 * Replay Proposition I.4: SAS congruence theorem.
 * Given: triangles ABC (complete) and DEF (missing EF). Draw EF.
 */
export function buildProp4FinalState(): ConstructionState {
  let state = initializeGiven(PROP_4.givenElements)

  // Step 0: Join E to F
  const segEF = addSegment(state, 'pt-E', 'pt-F')
  state = segEF.state

  return state
}

/**
 * Replay Proposition I.5: Pons Asinorum (isosceles base angles).
 * Uses replayConstruction since the steps include extend + macro types.
 */
export function buildProp5FinalState(): ConstructionState {
  const result = replayConstruction(PROP_5.givenElements, PROP_5.steps, PROP_5)
  return result.state
}

const PROP_BUILDERS: Record<number, () => ConstructionState> = {
  1: buildProp1FinalState,
  2: buildProp2FinalState,
  3: buildProp3FinalState,
  4: buildProp4FinalState,
  5: buildProp5FinalState,
}

export function buildFinalState(propId: number): ConstructionState | null {
  const builder = PROP_BUILDERS[propId]
  return builder ? builder() : null
}
