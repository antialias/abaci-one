import type {
  PropositionDef,
  ConstructionElement,
  ConstructionState,
  TutorialSubStep,
} from '../types'
import { BYRNE } from '../types'
import type { FactStore } from '../engine/factStore'
import type { ProofFact } from '../engine/facts'
import { distancePair, angleMeasure } from '../engine/facts'
import { addFact, addAngleFact } from '../engine/factStore'

function getProp5Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'

  return [
    // ── Step 0: Extend AB beyond B to F ──
    [
      {
        instruction: `${tap} point A`,
        speech:
          "We have an isosceles triangle — AB equals AC. Let's prove the base angles are equal. First, we produce line AB past B. Start by clicking point A.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'extend-phase' as const, phase: 'base-set' as const },
      },
      {
        instruction: `${tap} point B`,
        speech: 'Now click point B — the endpoint to extend beyond.',
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'extend-phase' as const, phase: 'extending' as const },
      },
      {
        instruction: `${tap} along the ray to place F`,
        speech: 'Click anywhere along the ray beyond B to place point F.',
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
    // ── Step 1: Extend AC beyond C to E ──
    [
      {
        instruction: `${tap} point A`,
        speech: 'Now produce the other equal side — line AC past C. Click point A.',
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'extend-phase' as const, phase: 'base-set' as const },
      },
      {
        instruction: `${tap} point C`,
        speech: 'Click point C — the endpoint to extend beyond.',
        hint: { type: 'point', pointId: 'pt-C' },
        advanceOn: { kind: 'extend-phase' as const, phase: 'extending' as const },
      },
      {
        instruction: `${tap} along the ray to place E`,
        speech: 'Click anywhere along the ray beyond C to place point E.',
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
    // ── Step 2: I.3 macro — cut AG from AE equal to AF ──
    [
      {
        instruction: `${tap} point A`,
        speech:
          "Now we use Proposition I.3 to cut off from AE a part equal to AF. This transfers the length AF onto line AE. Select point A — the start of the greater line.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select' as const, index: 0 },
      },
      {
        instruction: `${tap} point E`,
        speech: 'Select point E — the end of the greater line AE.',
        hint: { type: 'point', pointId: 'pt-E' },
        advanceOn: { kind: 'macro-select' as const, index: 1 },
      },
      {
        instruction: `${tap} point A`,
        speech: 'Now select the segment to copy. Click A — the start of AF.',
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select' as const, index: 2 },
      },
      {
        instruction: `${tap} point F`,
        speech:
          'Click F to finish. Proposition I.3 places point G on AE where AG equals AF — cutting off from the greater a part equal to the less.',
        hint: { type: 'point', pointId: 'pt-F' },
        advanceOn: null,
      },
    ],
    // ── Step 3: Join F to C (straightedge) ──
    [
      {
        instruction: `${tapHold} point F`,
        speech: isTouch
          ? 'Now join F to C. Press and hold on F and drag to C.'
          : 'Now join F to C. Click and hold on F and drag to C.',
        hint: { type: 'point', pointId: 'pt-F' },
        advanceOn: null,
      },
    ],
    // ── Step 4: Join G to B (straightedge) ──
    [
      {
        instruction: `${tapHold} point G`,
        speech: isTouch
          ? 'Almost done! Join G to B — this gives us two cross-triangles to compare. Press and hold on G.'
          : 'Almost done! Join G to B — this gives us two cross-triangles to compare. Click and hold on G.',
        hint: { type: 'point', pointId: 'pt-G' },
        advanceOn: null,
      },
    ],
  ]
}

/**
 * Derive I.5 conclusion: full 7-fact derivation chain
 *
 * Construction gives us:
 *   AF = AG  (I.3: cut off from AE a part equal to AF)
 *   AB = AC  (given)
 *
 * Derivation:
 *   1. BF = CG           [C.N.3: AF − AB = AG − AC]
 *   2. FC = GB           [I.4: △AFC ≅ △AGB]
 *   3. ∠ACF = ∠ABG       [I.4: △AFC ≅ △AGB — vertex angles]
 *   4. ∠AFC = ∠AGB       [I.4: △AFC ≅ △AGB — vertex angles]
 *   5. ∠FBC = ∠GCB       [I.4: △BFC ≅ △CGB — under-base angles]
 *   6. ∠BCF = ∠CBG       [I.4: △BFC ≅ △CGB — remaining angles]
 *   7. ∠ABC = ∠ACB       [C.N.3: ∠ABG − ∠CBG = ∠ACF − ∠BCF]
 */
function deriveProp5Conclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number
): ProofFact[] {
  const allNewFacts: ProofFact[] = []

  const dpBF = distancePair('pt-B', 'pt-F')
  const dpCG = distancePair('pt-C', 'pt-G')
  const dpAF = distancePair('pt-A', 'pt-F')
  const dpAB = distancePair('pt-A', 'pt-B')

  // 1. C.N.3 — BF = CG
  //    AF = AG (I.3), AB = AC (given)
  //    AF − AB = AG − AC → BF = CG
  allNewFacts.push(
    ...addFact(
      store,
      dpBF,
      dpCG,
      { type: 'cn3', whole: dpAF, part: dpAB },
      'BF = CG',
      'C.N.3: AF − AB = AG − AC (since AF = AG, AB = AC)',
      atStep
    )
  )

  // 2. I.4 (SAS) — FC = GB
  //    △AFC ≅ △AGB: AF = AG, AC = AB, ∠FAC = ∠GAB (common angle at A)
  const dpFC = distancePair('pt-F', 'pt-C')
  const dpGB = distancePair('pt-G', 'pt-B')

  allNewFacts.push(
    ...addFact(
      store,
      dpFC,
      dpGB,
      { type: 'prop', propId: 4 },
      'FC = GB',
      'I.4: △AFC ≅ △AGB (AF = AG, AC = AB, ∠FAC = ∠GAB)',
      atStep
    )
  )

  // 3. ∠ACF = ∠ABG (I.4: vertex angles at C and B in △AFC ≅ △AGB)
  const angACF = angleMeasure('pt-C', 'pt-A', 'pt-F')
  const angABG = angleMeasure('pt-B', 'pt-A', 'pt-G')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angACF,
      angABG,
      { type: 'prop', propId: 4 },
      '∠ACF = ∠ABG',
      'I.4: △AFC ≅ △AGB — remaining angles',
      atStep
    )
  )

  // 4. ∠AFC = ∠AGB (I.4: vertex angles at F and G in △AFC ≅ △AGB)
  const angAFC = angleMeasure('pt-F', 'pt-A', 'pt-C')
  const angAGB = angleMeasure('pt-G', 'pt-A', 'pt-B')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angAFC,
      angAGB,
      { type: 'prop', propId: 4 },
      '∠AFC = ∠AGB',
      'I.4: △AFC ≅ △AGB — remaining angles',
      atStep
    )
  )

  // 5. ∠FBC = ∠GCB (I.4: △BFC ≅ △CGB — under-base angles)
  //    BF = CG (fact 1), FC = GB (fact 2), ∠BFC = ∠CGB (supp. of equal ∠AFC, ∠AGB)
  const angFBC = angleMeasure('pt-B', 'pt-F', 'pt-C')
  const angGCB = angleMeasure('pt-C', 'pt-G', 'pt-B')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angFBC,
      angGCB,
      { type: 'prop', propId: 4 },
      '∠FBC = ∠GCB',
      'I.4: △BFC ≅ △CGB — angles under the base',
      atStep
    )
  )

  // 6. ∠BCF = ∠CBG (I.4: △BFC ≅ △CGB — remaining angles)
  const angBCF = angleMeasure('pt-C', 'pt-B', 'pt-F')
  const angCBG = angleMeasure('pt-B', 'pt-C', 'pt-G')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angBCF,
      angCBG,
      { type: 'prop', propId: 4 },
      '∠BCF = ∠CBG',
      'I.4: △BFC ≅ △CGB — remaining angles',
      atStep
    )
  )

  // 7. ∠ABC = ∠ACB (C.N.3: ∠ABG − ∠CBG = ∠ACF − ∠BCF)
  const angABC = angleMeasure('pt-B', 'pt-A', 'pt-C')
  const angACB = angleMeasure('pt-C', 'pt-A', 'pt-B')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angABC,
      angACB,
      { type: 'cn3-angle', whole: angABG, part: angCBG },
      '∠ABC = ∠ACB',
      'C.N.3: ∠ABG − ∠CBG = ∠ACF − ∠BCF',
      atStep
    )
  )

  return allNewFacts
}

/**
 * Proposition I.5 — Pons Asinorum (Isosceles Base Angles)
 *
 * In isosceles triangles the base angles are equal to one another,
 * and if the equal straight lines are produced further, then the
 * angles under the base will also be equal.
 *
 * Given: Isosceles triangle ABC with AB = AC (A at apex, B/C at base).
 *
 * Construction (following Euclid's original, using I.3):
 * 0. Extend AB beyond B to F                          (Post.2)
 * 1. Extend AC beyond C to E                          (Post.2)
 * 2. Cut off AG from AE equal to AF                   (I.3)
 * 3. Join F to C                                       (Post.1)
 * 4. Join G to B                                       (Post.1)
 *
 * Proof chain:
 *   BF = CG       [C.N.3: AF − AB = AG − AC]
 *   △AFC ≅ △AGB   [I.4: AF = AG, AC = AB, ∠FAC = ∠GAB]
 *   △BFC ≅ △CGB   [I.4: BF = CG, FC = GB, ∠BFC = ∠CGB]
 *   ∠FBC = ∠GCB   [under-base angles equal]
 *   ∠ABC = ∠ACB   [C.N.3: ∠ABG − ∠CBG = ∠ACF − ∠BCF]
 */

// ── Default positions ──
const DEFAULT_A = { x: 0, y: 2 }
const DEFAULT_B = { x: -2, y: -1 }
const DEFAULT_C = { x: 2, y: -1 }

// ── Extend distances ──
// F is placed beyond B on ray AB; E is placed beyond C on ray AC.
// I.3 cuts off AG from AE equal to AF.
// Constraint: AE > AF so I.3 can cut from the greater.
// BF = 1.5 (shorter), CE = 2.5 (longer) → AF = AB + 1.5 < AC + 2.5 = AE
const EXTEND_BF = 1.5
const EXTEND_CE = 2.5

// ── Rotation angle from vector AB to vector AC ──
// Rot(ROTATION_ANGLE) * (B − A) = (C − A), preserving |AC| = |AB|
const ROTATION_ANGLE = Math.atan2(
  (DEFAULT_B.x - DEFAULT_A.x) * (DEFAULT_C.y - DEFAULT_A.y) -
    (DEFAULT_B.y - DEFAULT_A.y) * (DEFAULT_C.x - DEFAULT_A.x),
  (DEFAULT_B.x - DEFAULT_A.x) * (DEFAULT_C.x - DEFAULT_A.x) +
    (DEFAULT_B.y - DEFAULT_A.y) * (DEFAULT_C.y - DEFAULT_A.y)
)

/**
 * Recompute all given elements from current draggable point positions.
 * C is derived from A and B to maintain AB = AC and the apex angle:
 *   C = A + Rot(ROTATION_ANGLE) · (B − A)
 */
export function computeProp5GivenElements(
  positions: Map<string, { x: number; y: number }>
): ConstructionElement[] {
  const A = positions.get('pt-A') ?? DEFAULT_A
  const B = positions.get('pt-B') ?? DEFAULT_B

  // Derive C by rotating vector (B − A) by ROTATION_ANGLE
  const vx = B.x - A.x
  const vy = B.y - A.y
  const cosR = Math.cos(ROTATION_ANGLE)
  const sinR = Math.sin(ROTATION_ANGLE)
  const C = {
    x: A.x + cosR * vx - sinR * vy,
    y: A.y + sinR * vx + cosR * vy,
  }

  return [
    { kind: 'point', id: 'pt-A', x: A.x, y: A.y, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: B.x, y: B.y, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: C.x, y: C.y, label: 'C', color: BYRNE.given, origin: 'given' },
    {
      kind: 'segment',
      id: 'seg-AB',
      fromId: 'pt-A',
      toId: 'pt-B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-AC',
      fromId: 'pt-A',
      toId: 'pt-C',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-BC',
      fromId: 'pt-B',
      toId: 'pt-C',
      color: BYRNE.given,
      origin: 'given',
    },
  ] as ConstructionElement[]
}

export const PROP_5: PropositionDef = {
  id: 5,
  title: 'In isosceles triangles the base angles are equal',
  kind: 'theorem',
  givenFacts: [
    {
      left: { a: 'pt-A', b: 'pt-B' },
      right: { a: 'pt-A', b: 'pt-C' },
      statement: 'AB = AC',
    },
  ],
  givenAngles: [
    // Base angles (blue) — visible from start
    { spec: { vertex: 'pt-B', ray1End: 'pt-A', ray2End: 'pt-C' }, color: BYRNE.blue },
    { spec: { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-B' }, color: BYRNE.blue },
    // Angles under the base (red) — appear when F and G exist
    { spec: { vertex: 'pt-B', ray1End: 'pt-F', ray2End: 'pt-C' }, color: BYRNE.red },
    { spec: { vertex: 'pt-C', ray1End: 'pt-G', ray2End: 'pt-B' }, color: BYRNE.red },
  ],
  equalAngles: [
    // Base angles: ∠ABC = ∠ACB (1 tick)
    [
      { vertex: 'pt-B', ray1End: 'pt-A', ray2End: 'pt-C' },
      { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-B' },
    ],
    // Under-base angles: ∠FBC = ∠GCB (2 ticks)
    [
      { vertex: 'pt-B', ray1End: 'pt-F', ray2End: 'pt-C' },
      { vertex: 'pt-C', ray1End: 'pt-G', ray2End: 'pt-B' },
    ],
  ],
  theoremConclusion: '∠ABC = ∠ACB\n∠FBC = ∠GCB',
  draggablePointIds: ['pt-A', 'pt-B'],
  computeGivenElements: computeProp5GivenElements,
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
      kind: 'segment',
      id: 'seg-AB',
      fromId: 'pt-A',
      toId: 'pt-B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-AC',
      fromId: 'pt-A',
      toId: 'pt-C',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-BC',
      fromId: 'pt-B',
      toId: 'pt-C',
      color: BYRNE.given,
      origin: 'given',
    },
  ] as ConstructionElement[],
  steps: [
    // 0. Extend AB beyond B to F
    {
      instruction: 'Produce AB beyond B to F',
      expected: {
        type: 'extend',
        baseId: 'pt-A',
        throughId: 'pt-B',
        distance: EXTEND_BF,
        label: 'F',
      },
      highlightIds: ['pt-A', 'pt-B'],
      tool: 'extend',
      citation: 'Post.2',
    },
    // 1. Extend AC beyond C to E
    {
      instruction: 'Produce AC beyond C to E',
      expected: {
        type: 'extend',
        baseId: 'pt-A',
        throughId: 'pt-C',
        distance: EXTEND_CE,
        label: 'E',
      },
      highlightIds: ['pt-A', 'pt-C'],
      tool: 'extend',
      citation: 'Post.2',
    },
    // 2. Cut off AG from AE equal to AF (I.3)
    {
      instruction: 'Cut off from AE a part equal to AF (I.3)',
      expected: {
        type: 'macro',
        propId: 3,
        inputPointIds: ['pt-A', 'pt-E', 'pt-A', 'pt-F'],
        outputLabels: { result: 'G' },
      },
      highlightIds: ['pt-A', 'pt-E', 'pt-F'],
      tool: 'macro',
      citation: 'I.3',
    },
    // 3. Join F to C
    {
      instruction: 'Join F to C',
      expected: { type: 'straightedge', fromId: 'pt-F', toId: 'pt-C' },
      highlightIds: ['pt-F', 'pt-C'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
    // 4. Join G to B
    {
      instruction: 'Join G to B',
      expected: { type: 'straightedge', fromId: 'pt-G', toId: 'pt-B' },
      highlightIds: ['pt-G', 'pt-B'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
  ],
  resultSegments: [
    { fromId: 'pt-F', toId: 'pt-C' },
    { fromId: 'pt-G', toId: 'pt-B' },
    // CG is not a construction segment (G sits on ray AE with no segment to C),
    // but the derivation proves BF = CG. Include it so tick marks render.
    { fromId: 'pt-C', toId: 'pt-G' },
  ],
  getTutorial: getProp5Tutorial,
  explorationNarration: {
    introSpeech:
      'The Bridge of Asses! You proved that base angles of an isosceles triangle are always equal — and the angles under the base too. Proposition I.3 transferred the distance for us. Try dragging the points to see this hold for every shape.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how the triangle changes shape but the base angles always stay equal? The I.3 construction adapts perfectly.',
      },
      {
        pointId: 'pt-B',
        speech: 'Watch how C follows to keep the triangle isosceles. The angles always match!',
      },
    ],
    breakdownTip:
      'The construction needs the extensions to satisfy I.3 — AE must exceed AF. Try moving the points closer together.',
  },
  deriveConclusion: deriveProp5Conclusion,
}
