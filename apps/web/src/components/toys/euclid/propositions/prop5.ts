import type { PropositionDef, ConstructionElement, ConstructionState, TutorialSubStep } from '../types'
import { BYRNE } from '../types'
import type { FactStore } from '../engine/factStore'
import type { EqualityFact } from '../engine/facts'
import { distancePair } from '../engine/facts'
import { addFact } from '../engine/factStore'

function getProp5Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'

  return [
    // ── Step 0: Circle centered at B through C (compass) ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? "We have an isosceles triangle — AB equals AC. Let's prove the base angles are equal. Press and hold on B to start a circle."
          : "We have an isosceles triangle — AB equals AC. Let's prove the base angles are equal. Click and hold on B to start a circle.",
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `Drag to point C`,
        speech: isTouch
          ? 'Drag to C — this makes the compass match the base length BC.'
          : 'Drag to C — this sets the compass to the base length BC.',
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-C' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch
          ? 'Sweep around to draw the circle!'
          : 'Move around to draw the circle!',
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-C' },
        advanceOn: null,
      },
    ],
    // ── Step 1: Intersection beyond B → F ──
    [
      {
        instruction: `${tap} where the circle crosses line AB past B`,
        speech:
          "See where the circle crosses the line from A through B, on the far side of B? Tap that point — that's F, and BF equals BC.",
        hint: {
          type: 'candidates',
          ofA: { kind: 'circle', centerId: 'pt-B', radiusPointId: 'pt-C' },
          ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-B' },
          beyondId: 'pt-B',
        },
        advanceOn: null,
      },
    ],
    // ── Step 2: I.3 macro — cut AG = AF ──
    [
      {
        instruction: `${tap} point A`,
        speech: isTouch
          ? "Now we'll cut off AG equal to AF using Proposition Three. Tap A — the point to cut from."
          : "Now we'll cut off AG equal to AF using Proposition Three. Click A — the point to cut from.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select', index: 0 },
      },
      {
        instruction: `${tap} point C`,
        speech: isTouch
          ? 'Tap C — the direction to cut along.'
          : 'Click C — the direction to cut along.',
        hint: { type: 'point', pointId: 'pt-C' },
        advanceOn: { kind: 'macro-select', index: 1 },
      },
      {
        instruction: `${tap} point A`,
        speech: isTouch
          ? 'Tap A — the start of the length to match.'
          : 'Click A — the start of the length to match.',
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select', index: 2 },
      },
      {
        instruction: `${tap} point F`,
        speech: isTouch
          ? "Tap F — the end of the length. Proposition Three will find G!"
          : "Click F — the end of the length. Proposition Three will find G!",
        hint: { type: 'point', pointId: 'pt-F' },
        advanceOn: null,
      },
    ],
    // ── Step 3: Join F to C (straightedge) ──
    [
      {
        instruction: `${tapHold} point F`,
        speech: isTouch
          ? 'Now join F to C. Press and hold on F.'
          : 'Now join F to C. Click and hold on F.',
        hint: { type: 'point', pointId: 'pt-F' },
        advanceOn: null,
      },
    ],
    // ── Step 4: Join G to B (straightedge) ──
    [
      {
        instruction: `${tapHold} point G`,
        speech: isTouch
          ? "Almost done! Join G to B. Press and hold on G."
          : "Almost done! Join G to B. Click and hold on G.",
        hint: { type: 'point', pointId: 'pt-G' },
        advanceOn: null,
      },
    ],
  ]
}

/**
 * Derive I.5 conclusion: CG = BF via C.N.3, FC = GB via I.4
 */
function deriveProp5Conclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number,
): EqualityFact[] {
  const allNewFacts: EqualityFact[] = []

  const dpCG = distancePair('pt-C', 'pt-G')
  const dpBF = distancePair('pt-B', 'pt-F')
  const dpAG = distancePair('pt-A', 'pt-G')
  const dpAC = distancePair('pt-A', 'pt-C')

  // Step 1: C.N.3 — CG = BF
  allNewFacts.push(...addFact(
    store,
    dpCG,
    dpBF,
    { type: 'cn3', whole: dpAG, part: dpAC },
    'CG = BF',
    'C.N.3: AG − AC = AF − AB (since AG = AF, AB = AC)',
    atStep,
  ))

  // Step 2: I.4 (SAS) — FC = GB
  const dpFC = distancePair('pt-F', 'pt-C')
  const dpGB = distancePair('pt-G', 'pt-B')

  allNewFacts.push(...addFact(
    store,
    dpFC,
    dpGB,
    { type: 'prop', propId: 4 },
    'FC = GB',
    'I.4: △AFC ≅ △AGB (AF = AG, AC = AB, ∠FAC = ∠GAB)',
    atStep,
  ))

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
 * Construction:
 * 0. Circle centered at B through C               (Post.3)
 * 1. Intersection: circle(B,C) × extension of AB beyond B  → F (BF = BC)
 * 2. I.3 macro: cut from A toward C, length AF    (I.3)      → G (AG = AF)
 * 3. Join F to C                                   (Post.1)
 * 4. Join G to B                                   (Post.1)
 *
 * Conclusion:
 *   CG = BF  via C.N.3: AG − AC = AF − AB (since AG = AF, AB = AC)
 *   FC = GB  via I.4: △AFC ≅ △AGB (AF = AG, AC = AB, ∠FAC = ∠GAB)
 *   ∠ABC = ∠ACB, ∠FBC = ∠GCB
 */

// ── Default positions ──
const DEFAULT_A = { x: 0, y: 2 }
const DEFAULT_B = { x: -2, y: -1 }
const DEFAULT_C = { x: 2, y: -1 }

// ── Rotation angle from vector AB to vector AC ──
// vAB = B − A = (−2, −3), vAC = C − A = (2, −3)
// cross = vAB.x * vAC.y − vAB.y * vAC.x = 12
// dot   = vAB.x * vAC.x + vAB.y * vAC.y = 5
// Rot(ROTATION_ANGLE) * (B − A) = (C − A), preserving |AC| = |AB|
const ROTATION_ANGLE = Math.atan2(
  (DEFAULT_B.x - DEFAULT_A.x) * (DEFAULT_C.y - DEFAULT_A.y) -
    (DEFAULT_B.y - DEFAULT_A.y) * (DEFAULT_C.x - DEFAULT_A.x),
  (DEFAULT_B.x - DEFAULT_A.x) * (DEFAULT_C.x - DEFAULT_A.x) +
    (DEFAULT_B.y - DEFAULT_A.y) * (DEFAULT_C.y - DEFAULT_A.y),
)

/**
 * Recompute all given elements from current draggable point positions.
 * C is derived from A and B to maintain AB = AC and the apex angle:
 *   C = A + Rot(ROTATION_ANGLE) · (B − A)
 */
export function computeProp5GivenElements(
  positions: Map<string, { x: number; y: number }>,
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
    { kind: 'segment', id: 'seg-AB', fromId: 'pt-A', toId: 'pt-B', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-AC', fromId: 'pt-A', toId: 'pt-C', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-BC', fromId: 'pt-B', toId: 'pt-C', color: BYRNE.given, origin: 'given' },
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
    { kind: 'point', id: 'pt-A', x: DEFAULT_A.x, y: DEFAULT_A.y, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: DEFAULT_B.x, y: DEFAULT_B.y, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: DEFAULT_C.x, y: DEFAULT_C.y, label: 'C', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-AB', fromId: 'pt-A', toId: 'pt-B', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-AC', fromId: 'pt-A', toId: 'pt-C', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-BC', fromId: 'pt-B', toId: 'pt-C', color: BYRNE.given, origin: 'given' },
  ] as ConstructionElement[],
  steps: [
    // 0. Circle centered at B through C
    {
      instruction: 'Draw a circle centered at B through C',
      expected: { type: 'compass', centerId: 'pt-B', radiusPointId: 'pt-C' },
      highlightIds: ['pt-B', 'pt-C'],
      tool: 'compass',
      citation: 'Post.3',
    },
    // 1. Mark intersection of circle(B,C) with extension of AB beyond B → F
    {
      instruction: 'Mark where the circle crosses line AB past B',
      expected: {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-B', radiusPointId: 'pt-C' },
        ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-B' },
        beyondId: 'pt-B',
        label: 'F',
      },
      highlightIds: [],
      tool: null,
      citation: 'Def.15',
    },
    // 2. I.3 macro: cut from A toward C, length = AF → G
    {
      instruction: 'From AC, cut off a length equal to AF (I.3)',
      expected: {
        type: 'macro',
        propId: 3,
        inputPointIds: ['pt-A', 'pt-C', 'pt-A', 'pt-F'],
        outputLabels: { result: 'G' },
      },
      highlightIds: ['pt-A', 'pt-C', 'pt-F'],
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
  getTutorial: getProp5Tutorial,
  explorationNarration: {
    introSpeech:
      'The Bridge of Asses! You proved that base angles of an isosceles triangle are always equal. Try dragging the points to see this hold for every shape.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how the triangle changes shape but the base angles always stay equal? The construction adapts perfectly.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch how C follows to keep the triangle isosceles. The angles always match!',
      },
    ],
  },
  deriveConclusion: deriveProp5Conclusion,
}
