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

function getProp4Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'

  return [
    // ── Step 0: Draw segment EF (straightedge) ──
    [
      {
        instruction: `${tapHold} point E`,
        speech: isTouch
          ? "We're given two triangles with two sides and the included angle equal. Complete triangle DEF by pressing and holding on point E."
          : "We're given two triangles with two sides and the included angle equal. Complete triangle DEF by clicking and holding on point E.",
        hint: { type: 'point', pointId: 'pt-E' },
        advanceOn: null,
      },
    ],
  ]
}

/**
 * Derive I.4 conclusion: BC = EF via C.N.4 (superposition),
 * plus ∠ABC = ∠DEF and ∠ACB = ∠DFE via C.N.4
 */
function deriveProp4Conclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number
): ProofFact[] {
  const allNewFacts: ProofFact[] = []

  // Distance: BC = EF
  const dpBC = distancePair('pt-B', 'pt-C')
  const dpEF = distancePair('pt-E', 'pt-F')
  allNewFacts.push(
    ...addFact(
      store,
      dpBC,
      dpEF,
      { type: 'cn4' },
      'BC = EF',
      'C.N.4: Since AB = DE, AC = DF, and ∠BAC = ∠EDF, triangles coincide by superposition',
      atStep
    )
  )

  // Angle: ∠ABC = ∠DEF
  const angABC = angleMeasure('pt-B', 'pt-A', 'pt-C')
  const angDEF = angleMeasure('pt-E', 'pt-D', 'pt-F')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angABC,
      angDEF,
      { type: 'cn4' },
      '∠ABC = ∠DEF',
      'C.N.4: Remaining angles of congruent triangles coincide',
      atStep
    )
  )

  // Angle: ∠ACB = ∠DFE
  const angACB = angleMeasure('pt-C', 'pt-A', 'pt-B')
  const angDFE = angleMeasure('pt-F', 'pt-D', 'pt-E')
  allNewFacts.push(
    ...addAngleFact(
      store,
      angACB,
      angDFE,
      { type: 'cn4' },
      '∠ACB = ∠DFE',
      'C.N.4: Remaining angles of congruent triangles coincide',
      atStep
    )
  )

  return allNewFacts
}

/**
 * Proposition I.4 — SAS Congruence (Theorem)
 *
 * If two triangles have two sides equal to two sides respectively,
 * and have the angles contained by the equal straight lines equal,
 * then they also have the base equal to the base, the triangle equals
 * the triangle, and the remaining angles equal the remaining angles.
 *
 * Setup: Two triangles ABC (left) and DEF (right).
 *   Given: AB = DE, AC = DF, ∠BAC = ∠EDF
 *   Triangle DEF is missing segment EF.
 *   The user draws EF, and C.N.4 (superposition) derives BC = EF.
 *
 * Coordinates are constructed so that the equalities hold exactly:
 *   DEF is formed by rotating the vectors (B−A) and (C−A) by angle θ
 *   and translating to D.
 */

// ── Default positions ──
const DEFAULT_A = { x: -4, y: -0.5 }
const DEFAULT_B = { x: -6.2, y: -1.5 }
const DEFAULT_C = { x: -2.8, y: 1.8 }
const DEFAULT_D = { x: 2.5, y: -0.5 }
const THETA = 0.4 // rotation angle in radians

/**
 * Recompute all given elements from current draggable point positions.
 * E and F are derived from A, B, C, D to maintain SAS invariants:
 *   E = D + Rot(θ)·(B−A), F = D + Rot(θ)·(C−A)
 */
export function computeProp4GivenElements(
  positions: Map<string, { x: number; y: number }>
): ConstructionElement[] {
  const A = positions.get('pt-A') ?? DEFAULT_A
  const B = positions.get('pt-B') ?? DEFAULT_B
  const C = positions.get('pt-C') ?? DEFAULT_C
  const D = positions.get('pt-D') ?? DEFAULT_D

  const cosT = Math.cos(THETA)
  const sinT = Math.sin(THETA)

  const E = {
    x: D.x + cosT * (B.x - A.x) - sinT * (B.y - A.y),
    y: D.y + sinT * (B.x - A.x) + cosT * (B.y - A.y),
  }
  const F = {
    x: D.x + cosT * (C.x - A.x) - sinT * (C.y - A.y),
    y: D.y + sinT * (C.x - A.x) + cosT * (C.y - A.y),
  }

  return [
    // Triangle ABC — all 3 points + 3 segments
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
    // Triangle DEF — 3 points + 2 segments (EF missing — user draws it)
    { kind: 'point', id: 'pt-D', x: D.x, y: D.y, label: 'D', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-E', x: E.x, y: E.y, label: 'E', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-F', x: F.x, y: F.y, label: 'F', color: BYRNE.given, origin: 'given' },
    {
      kind: 'segment',
      id: 'seg-DE',
      fromId: 'pt-D',
      toId: 'pt-E',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-DF',
      fromId: 'pt-D',
      toId: 'pt-F',
      color: BYRNE.given,
      origin: 'given',
    },
  ] as ConstructionElement[]
}

// ── Compute initial positions ──
const cosT = Math.cos(THETA)
const sinT = Math.sin(THETA)
const baDx = DEFAULT_B.x - DEFAULT_A.x
const baDy = DEFAULT_B.y - DEFAULT_A.y
const E = {
  x: DEFAULT_D.x + cosT * baDx - sinT * baDy,
  y: DEFAULT_D.y + sinT * baDx + cosT * baDy,
}
const caDx = DEFAULT_C.x - DEFAULT_A.x
const caDy = DEFAULT_C.y - DEFAULT_A.y
const F = {
  x: DEFAULT_D.x + cosT * caDx - sinT * caDy,
  y: DEFAULT_D.y + sinT * caDx + cosT * caDy,
}

export const PROP_4: PropositionDef = {
  id: 4,
  title:
    'If two triangles have two sides and the included angle equal, the triangles are congruent',
  kind: 'theorem',
  resultSegments: [
    { fromId: 'pt-B', toId: 'pt-C' },
    { fromId: 'pt-E', toId: 'pt-F' },
  ],
  givenFacts: [
    {
      left: { a: 'pt-A', b: 'pt-B' },
      right: { a: 'pt-D', b: 'pt-E' },
      statement: 'AB = DE',
    },
    {
      left: { a: 'pt-A', b: 'pt-C' },
      right: { a: 'pt-D', b: 'pt-F' },
      statement: 'AC = DF',
    },
  ],
  givenAngles: [
    { spec: { vertex: 'pt-A', ray1End: 'pt-B', ray2End: 'pt-C' }, color: BYRNE.red },
    { spec: { vertex: 'pt-D', ray1End: 'pt-E', ray2End: 'pt-F' }, color: BYRNE.red },
  ],
  equalAngles: [
    [
      { vertex: 'pt-A', ray1End: 'pt-B', ray2End: 'pt-C' },
      { vertex: 'pt-D', ray1End: 'pt-E', ray2End: 'pt-F' },
    ],
  ],
  givenAngleFacts: [
    {
      left: { vertex: 'pt-A', ray1: 'pt-B', ray2: 'pt-C' },
      right: { vertex: 'pt-D', ray1: 'pt-E', ray2: 'pt-F' },
      statement: '∠BAC = ∠EDF',
    },
  ],
  theoremConclusion: '△ABC = △DEF\n∠ABC = ∠DEF, ∠ACB = ∠DFE',
  superpositionFlash: {
    pairs: [
      { src: 'pt-A', tgt: 'pt-D' },
      { src: 'pt-B', tgt: 'pt-E' },
      { src: 'pt-C', tgt: 'pt-F' },
    ],
    triA: ['pt-A', 'pt-B', 'pt-C'],
    triB: ['pt-D', 'pt-E', 'pt-F'],
  },
  draggablePointIds: ['pt-A', 'pt-B', 'pt-C', 'pt-D'],
  computeGivenElements: computeProp4GivenElements,
  givenElements: [
    // Triangle ABC — all 3 points + 3 segments
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
    // Triangle DEF — 3 points + 2 segments (EF missing — user draws it)
    {
      kind: 'point',
      id: 'pt-D',
      x: DEFAULT_D.x,
      y: DEFAULT_D.y,
      label: 'D',
      color: BYRNE.given,
      origin: 'given',
    },
    { kind: 'point', id: 'pt-E', x: E.x, y: E.y, label: 'E', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-F', x: F.x, y: F.y, label: 'F', color: BYRNE.given, origin: 'given' },
    {
      kind: 'segment',
      id: 'seg-DE',
      fromId: 'pt-D',
      toId: 'pt-E',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'segment',
      id: 'seg-DF',
      fromId: 'pt-D',
      toId: 'pt-F',
      color: BYRNE.given,
      origin: 'given',
    },
  ] as ConstructionElement[],
  steps: [
    {
      instruction: 'Join E to F',
      expected: { type: 'straightedge', fromId: 'pt-E', toId: 'pt-F' },
      highlightIds: ['pt-E', 'pt-F'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
  ],
  getTutorial: getProp4Tutorial,
  explorationNarration: {
    introSpeech:
      'You proved two triangles are congruent! Now drag the points to test it with different triangles.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how triangle DEF reshapes to keep matching? The congruence holds for any vertex position.',
      },
      {
        pointId: 'pt-B',
        speech: 'Watch the matching side of DEF change too. Both triangles stay congruent!',
      },
      {
        pointId: 'pt-C',
        speech: 'See how EF always equals BC? The third side always matches.',
      },
      {
        pointId: 'pt-D',
        speech:
          "Watch the congruence hold everywhere. It doesn't matter where the second triangle sits!",
      },
    ],
  },
  deriveConclusion: deriveProp4Conclusion,
}
