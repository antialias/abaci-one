import type {
  PropositionDef,
  ConstructionElement,
  ConstructionState,
  TutorialSubStep,
} from '../types'
import { BYRNE } from '../types'
import type { FactStore } from '../engine/factStore'
import type { ProofFact } from '../engine/facts'
import { angleMeasure } from '../engine/facts'
import { addAngleFact } from '../engine/factStore'
import { getPoint } from '../engine/constructionState'

function getProp7Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'

  return [
    // ── Step 0: Join C to D (straightedge) ──
    [
      {
        instruction: `${tapHold} point {pt:C}, drag to {pt:D}`,
        speech: isTouch
          ? 'Join C to D — this single line creates the two isosceles triangles we need. Press and hold on C and drag to D.'
          : 'Join C to D — this single line creates the two isosceles triangles we need. Click and hold on C and drag to D.',
        hint: { type: 'point', pointId: 'pt-C' },
        advanceOn: null,
      },
    ],
  ]
}

/**
 * Derive I.7 conclusion: two angle equalities from I.5 applied to
 * the two isosceles triangles ACD and BCD.
 *
 * Given facts:
 *   AC = AD  →  triangle ACD is isosceles  →  ∠ACD = ∠ADC  (I.5)
 *   BC = BD  →  triangle BCD is isosceles  →  ∠BCD = ∠BDC  (I.5)
 *
 * The contradiction (∠BDC > ∠BDC) is stated narratively in theoremConclusion.
 */
function deriveProp7Conclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number
): ProofFact[] {
  const allNewFacts: ProofFact[] = []

  // 1. ∠ACD = ∠ADC (I.5: triangle ACD is isosceles, AC = AD)
  const angACD = angleMeasure('pt-C', 'pt-A', 'pt-D')
  const angADC = angleMeasure('pt-D', 'pt-A', 'pt-C')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angACD,
      angADC,
      { type: 'prop', propId: 5 },
      '∠ACD = ∠ADC',
      'I.5: Triangle ACD is isosceles (AC = AD)',
      atStep
    )
  )

  // 2. ∠BCD = ∠BDC (I.5: triangle BCD is isosceles, BC = BD)
  const angBCD = angleMeasure('pt-C', 'pt-B', 'pt-D')
  const angBDC = angleMeasure('pt-D', 'pt-B', 'pt-C')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angBCD,
      angBDC,
      { type: 'prop', propId: 5 },
      '∠BCD = ∠BDC',
      'I.5: Triangle BCD is isosceles (BC = BD)',
      atStep
    )
  )

  return allNewFacts
}

/**
 * Compute the unsigned angle at a vertex between two rays.
 * Returns a value in [0, π].
 */
function computeAngle(
  vertex: { x: number; y: number },
  ray1: { x: number; y: number },
  ray2: { x: number; y: number }
): number {
  const a1 = Math.atan2(ray1.y - vertex.y, ray1.x - vertex.x)
  const a2 = Math.atan2(ray2.y - vertex.y, ray2.x - vertex.x)
  let diff = a2 - a1
  if (diff < 0) diff += 2 * Math.PI
  if (diff > Math.PI) diff = 2 * Math.PI - diff
  return diff
}

/**
 * Position-aware theorem conclusion for I.7.
 *
 * The contradiction chain direction depends on whether D is inside or outside
 * triangle ACB. We detect this by comparing angles at vertex C:
 *   - If ∠ACD > ∠BCD → D is inside (Case 1, default)
 *   - Otherwise → D is outside (Case 2)
 */
function computeProp7TheoremConclusion(state: ConstructionState): string {
  const ptC = getPoint(state, 'pt-C')
  const ptD = getPoint(state, 'pt-D')
  const ptA = getPoint(state, 'pt-A')
  const ptB = getPoint(state, 'pt-B')

  if (!ptC || !ptD || !ptA || !ptB) {
    return 'C and D cannot be distinct\n(C.N.5 contradiction: ∠BDC > ∠ADC = ∠ACD > ∠BCD = ∠BDC)'
  }

  const angACD = computeAngle(ptC, ptA, ptD)
  const angBCD = computeAngle(ptC, ptB, ptD)

  if (angACD > angBCD) {
    // Case 1: D inside triangle ACB
    return 'C and D cannot be distinct\n(C.N.5: ∠BDC > ∠ADC = ∠ACD > ∠BCD = ∠BDC)'
  } else {
    // Case 2: D outside triangle ACB
    return 'C and D cannot be distinct\n(C.N.5: ∠ADC > ∠BDC = ∠BCD > ∠ACD = ∠ADC)'
  }
}

// ── Default positions ──
const DEFAULT_A = { x: -1.5, y: 0 }
const DEFAULT_B = { x: 1.5, y: 0 }
const DEFAULT_C = { x: 0, y: 2.5 }
const DEFAULT_D = { x: 1.0, y: 2.3 }

/**
 * Recompute all given elements from current draggable point positions.
 * All four points are independently draggable — the distance equalities
 * (AC = AD, BC = BD) are stipulated as given facts, not enforced geometrically.
 */
export function computeProp7GivenElements(
  positions: Map<string, { x: number; y: number }>
): ConstructionElement[] {
  const A = positions.get('pt-A') ?? DEFAULT_A
  const B = positions.get('pt-B') ?? DEFAULT_B
  const C = positions.get('pt-C') ?? DEFAULT_C
  const D = positions.get('pt-D') ?? DEFAULT_D

  return [
    { kind: 'point', id: 'pt-A', x: A.x, y: A.y, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: B.x, y: B.y, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: C.x, y: C.y, label: 'C', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-D', x: D.x, y: D.y, label: 'D', color: BYRNE.given, origin: 'given' },
    // AB: shared base (dark)
    {
      kind: 'segment',
      id: 'seg-AB',
      fromId: 'pt-A',
      toId: 'pt-B',
      color: BYRNE.given,
      origin: 'given',
    },
    // AC and AD: blue pair (first isosceles triangle ACD, AC = AD)
    {
      kind: 'segment',
      id: 'seg-AC',
      fromId: 'pt-A',
      toId: 'pt-C',
      color: BYRNE.blue,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-AD',
      fromId: 'pt-A',
      toId: 'pt-D',
      color: BYRNE.blue,
      origin: 'given',
    },
    // BC and BD: red pair (second isosceles triangle BCD, BC = BD)
    {
      kind: 'segment',
      id: 'seg-BC',
      fromId: 'pt-B',
      toId: 'pt-C',
      color: BYRNE.red,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-BD',
      fromId: 'pt-B',
      toId: 'pt-D',
      color: BYRNE.red,
      origin: 'given',
    },
  ] as ConstructionElement[]
}

/**
 * Proposition I.7 — Uniqueness of Triangle Construction
 *
 * Given two straight lines constructed from the ends of a straight line
 * and meeting in a point, there cannot be constructed from the ends of
 * the same straight line, on the same side of it, two other straight
 * lines equal to the former two respectively.
 *
 * Given: Points A, B on a line; C and D on the same side of AB,
 *        with AC = AD and BC = BD.
 * To prove: C and D cannot be distinct (proof by contradiction).
 *
 * Proof:
 *   0. Join C to D                                         (Post.1)
 *
 *   Triangle ACD is isosceles (AC = AD) → ∠ACD = ∠ADC     (I.5)
 *   Triangle BCD is isosceles (BC = BD) → ∠BCD = ∠BDC     (I.5)
 *
 *   By C.N.5 (the whole is greater than the part):
 *     ∠ACD > ∠BCD  (at vertex C)
 *     ∠BDC > ∠ADC  (at vertex D)
 *
 *   Chain: ∠BDC > ∠ADC = ∠ACD > ∠BCD = ∠BDC
 *   → ∠BDC > ∠BDC, contradiction.  Q.E.D.
 */
export const PROP_7: PropositionDef = {
  id: 7,
  title:
    'Given two lines from the ends of a line meeting at a point, no two other equal lines can be constructed on the same side',
  kind: 'theorem',
  givenFacts: [
    {
      left: { a: 'pt-A', b: 'pt-C' },
      right: { a: 'pt-A', b: 'pt-D' },
      statement: 'AC = AD',
    },
    {
      left: { a: 'pt-B', b: 'pt-C' },
      right: { a: 'pt-B', b: 'pt-D' },
      statement: 'BC = BD',
    },
  ],
  givenAngles: [
    // Blue pair: ∠ACD and ∠ADC (I.5: AC = AD)
    { spec: { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-D' }, color: BYRNE.blue, radiusPx: 18 },
    { spec: { vertex: 'pt-D', ray1End: 'pt-A', ray2End: 'pt-C' }, color: BYRNE.blue, radiusPx: 18 },
    // Red pair: ∠BCD and ∠BDC (I.5: BC = BD)
    { spec: { vertex: 'pt-C', ray1End: 'pt-B', ray2End: 'pt-D' }, color: BYRNE.red, radiusPx: 28 },
    { spec: { vertex: 'pt-D', ray1End: 'pt-B', ray2End: 'pt-C' }, color: BYRNE.red, radiusPx: 28 },
  ],
  equalAngles: [
    // 1 tick: ∠ACD = ∠ADC
    [
      { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-D' },
      { vertex: 'pt-D', ray1End: 'pt-A', ray2End: 'pt-C' },
    ],
    // 2 ticks: ∠BCD = ∠BDC
    [
      { vertex: 'pt-C', ray1End: 'pt-B', ray2End: 'pt-D' },
      { vertex: 'pt-D', ray1End: 'pt-B', ray2End: 'pt-C' },
    ],
  ],
  computeTheoremConclusion: computeProp7TheoremConclusion,
  draggablePointIds: ['pt-A', 'pt-B', 'pt-C', 'pt-D'],
  computeGivenElements: computeProp7GivenElements,
  givenElements: [
    {
      kind: 'point',
      id: 'pt-A',
      x: DEFAULT_A.x,
      y: DEFAULT_A.y,
      label: 'A',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-B',
      x: DEFAULT_B.x,
      y: DEFAULT_B.y,
      label: 'B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-C',
      x: DEFAULT_C.x,
      y: DEFAULT_C.y,
      label: 'C',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-D',
      x: DEFAULT_D.x,
      y: DEFAULT_D.y,
      label: 'D',
      color: BYRNE.given,
      origin: 'given',
    },
    // AB: shared base (dark)
    {
      kind: 'segment',
      id: 'seg-AB',
      fromId: 'pt-A',
      toId: 'pt-B',
      color: BYRNE.given,
      origin: 'given',
    },
    // AC and AD: blue pair (AC = AD)
    {
      kind: 'segment',
      id: 'seg-AC',
      fromId: 'pt-A',
      toId: 'pt-C',
      color: BYRNE.blue,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-AD',
      fromId: 'pt-A',
      toId: 'pt-D',
      color: BYRNE.blue,
      origin: 'given',
    },
    // BC and BD: red pair (BC = BD)
    {
      kind: 'segment',
      id: 'seg-BC',
      fromId: 'pt-B',
      toId: 'pt-C',
      color: BYRNE.red,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-BD',
      fromId: 'pt-B',
      toId: 'pt-D',
      color: BYRNE.red,
      origin: 'given',
    },
  ] as ConstructionElement[],
  steps: [
    // 0. Join C to D
    {
      instruction: 'Join {pt:C} to {pt:D}',
      expected: { type: 'straightedge', fromId: 'pt-C', toId: 'pt-D' },
      highlightIds: ['pt-C', 'pt-D'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
  ],
  // No resultSegments — this is a contradiction proof, not a distance equality.
  // The theoremConclusion text states the contradiction narratively.
  getTutorial: getProp7Tutorial,
  explorationNarration: {
    introSpeech:
      "This is Euclid's uniqueness lemma — a stepping stone to SSS congruence (Proposition I.8). The blue sides from A are assumed equal, and the red sides from B are assumed equal. Joining CD reveals two isosceles triangles whose angle equalities contradict each other. Try dragging the points to explore.",
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'The configuration reshapes but the contradiction persists — the two isosceles triangles ACD and BCD always produce conflicting angle equalities.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Notice how AD and CB always cross. The two isosceles pairs always produce the contradictory angle chain.',
      },
    ],
    breakdownTip:
      'The key angle comparisons are ∠ACD > ∠BCD at vertex C and ∠BDC > ∠ADC at vertex D — combining these with the I.5 equalities gives ∠BDC > ∠BDC.',
  },
  deriveConclusion: deriveProp7Conclusion,
}
