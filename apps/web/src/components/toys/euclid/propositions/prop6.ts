import type {
  PropositionDef,
  ConstructionElement,
  ConstructionState,
  TutorialSubStep,
} from '../types'
import { BYRNE } from '../types'
import type { FactStore } from '../engine/factStore'
import type { ProofFact } from '../engine/facts'
import { distancePair } from '../engine/facts'
import { addFact } from '../engine/factStore'

function getProp6Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'

  return [
    // ── Step 0: I.3 macro — cut DB from BA equal to AC ──
    [
      {
        instruction: `${tap} point B`,
        speech:
          "We'll prove this by contradiction. Assume AB is not equal to AC — specifically, AB is greater. We use Proposition I.3 to cut off from BA a part equal to AC. Start by clicking point B — the cut point on the greater line.",
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'macro-select' as const, index: 0 },
      },
      {
        instruction: `${tap} point A`,
        speech: 'Click point A — the other end of line BA.',
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select' as const, index: 1 },
      },
      {
        instruction: `${tap} point A`,
        speech: 'Now select the segment to copy. Click A — the start of AC.',
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select' as const, index: 2 },
      },
      {
        instruction: `${tap} point C`,
        speech:
          'Click C to finish. Proposition I.3 places point D on BA where BD equals AC.',
        hint: { type: 'point', pointId: 'pt-C' },
        advanceOn: null,
      },
    ],
    // ── Step 1: Join D to C (straightedge) ──
    [
      {
        instruction: `${tapHold} point D, drag to C`,
        speech: isTouch
          ? 'Now join D to C to form triangle DBC. Press and hold on D and drag to C.'
          : 'Now join D to C to form triangle DBC. Click and hold on D and drag to C.',
        hint: { type: 'point', pointId: 'pt-D' },
        advanceOn: null,
      },
    ],
  ]
}

/**
 * Derive I.6 conclusion: proof by contradiction
 *
 * Construction gives us:
 *   BD = AC  (I.3: cut off from BA a part equal to AC)
 *   ∠DBC = ∠ACB  (given — same as ∠ABC = ∠ACB since D is on BA)
 *   BC = BC  (common)
 *
 * Reductio:
 *   If AB ≠ AC, then by I.3 we can cut BD = AC with D between A and B.
 *   By I.4 (SAS): BD = AC, BC = BC, ∠DBC = ∠ACB → △DBC ≅ △ACB.
 *   But △DBC is contained in △ACB, so the lesser equals the greater,
 *   contradicting Common Notion 5. Therefore AB = AC.
 */
function deriveProp6Conclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number
): ProofFact[] {
  const dpAB = distancePair('pt-A', 'pt-B')
  const dpAC = distancePair('pt-A', 'pt-C')

  // Single fact: AB = AC by reductio via I.4
  return addFact(
    store,
    dpAB,
    dpAC,
    { type: 'prop', propId: 4 },
    'AB = AC',
    'Reductio: BD = AC (I.3), BC = BC, ∠DBC = ∠ACB (given) → △DBC ≅ △ACB (I.4). But D is between A and B, so △DBC ⊂ △ACB — contradicting C.N.5. Therefore AB = AC.',
    atStep
  )
}

// ── Default positions ──
// A at apex, B and C at base. AB > AC for non-degenerate D.
const DEFAULT_A = { x: 0, y: 2.5 }
const DEFAULT_B = { x: -2, y: 0 }
const DEFAULT_C = { x: 1, y: 0 }

// ── Rotation angle and scale from vector AB to vector AC ──
// C = A + AC_RATIO * Rot(ROTATION_ANGLE) * (B − A)
// This preserves the triangle shape (apex angle + side ratio) during drag.
const vxDefault = DEFAULT_B.x - DEFAULT_A.x
const vyDefault = DEFAULT_B.y - DEFAULT_A.y
const wxDefault = DEFAULT_C.x - DEFAULT_A.x
const wyDefault = DEFAULT_C.y - DEFAULT_A.y

const abLen = Math.sqrt(vxDefault * vxDefault + vyDefault * vyDefault)
const acLen = Math.sqrt(wxDefault * wxDefault + wyDefault * wyDefault)

// Ratio |AC| / |AB| — always < 1, guaranteeing AB > AC
const AC_RATIO = acLen / abLen

const ROTATION_ANGLE = Math.atan2(
  vxDefault * wyDefault - vyDefault * wxDefault,
  vxDefault * wxDefault + vyDefault * wyDefault
)

/**
 * Recompute all given elements from current draggable point positions.
 * C is derived from A and B to maintain the apex angle and side ratio:
 *   C = A + AC_RATIO * Rot(ROTATION_ANGLE) · (B − A)
 * This guarantees AB > AC always holds (needed for non-degenerate D).
 */
export function computeProp6GivenElements(
  positions: Map<string, { x: number; y: number }>
): ConstructionElement[] {
  const A = positions.get('pt-A') ?? DEFAULT_A
  const B = positions.get('pt-B') ?? DEFAULT_B

  // Derive C by rotating and scaling vector (B − A)
  const vx = B.x - A.x
  const vy = B.y - A.y
  const cosR = Math.cos(ROTATION_ANGLE)
  const sinR = Math.sin(ROTATION_ANGLE)
  const C = {
    x: A.x + AC_RATIO * (cosR * vx - sinR * vy),
    y: A.y + AC_RATIO * (sinR * vx + cosR * vy),
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

/**
 * Proposition I.6 — Converse of Pons Asinorum
 *
 * If in a triangle two angles equal one another, then the sides
 * opposite the equal angles also equal one another.
 *
 * Given: Triangle ABC with ∠ABC = ∠ACB.
 * To prove: AB = AC.
 *
 * Proof (by contradiction / reductio ad absurdum):
 *   Suppose AB ≠ AC. Then one is greater — let AB > AC.
 *   0. Cut off DB from BA equal to AC           (I.3)
 *   1. Join D to C                               (Post.1)
 *
 *   Now BD = AC, BC = BC, ∠DBC = ∠ACB (given).
 *   So △DBC ≅ △ACB by I.4 (SAS).
 *   But △DBC is part of △ACB, so the lesser equals the greater,
 *   which is absurd (C.N.5). Therefore AB = AC.  Q.E.D.
 */
export const PROP_6: PropositionDef = {
  id: 6,
  title: 'If two angles of a triangle are equal, the sides opposite them are equal',
  kind: 'theorem',
  givenAngleFacts: [
    {
      left: { vertex: 'pt-B', ray1: 'pt-A', ray2: 'pt-C' },
      right: { vertex: 'pt-C', ray1: 'pt-A', ray2: 'pt-B' },
      statement: '∠ABC = ∠ACB',
    },
  ],
  givenAngles: [
    { spec: { vertex: 'pt-B', ray1End: 'pt-A', ray2End: 'pt-C' }, color: BYRNE.blue },
    { spec: { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-B' }, color: BYRNE.blue },
  ],
  equalAngles: [
    [
      { vertex: 'pt-B', ray1End: 'pt-A', ray2End: 'pt-C' },
      { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-B' },
    ],
  ],
  theoremConclusion: 'AB = AC',
  draggablePointIds: ['pt-A', 'pt-B'],
  computeGivenElements: computeProp6GivenElements,
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
    // 0. Cut off DB from BA equal to AC (I.3)
    {
      instruction: 'Cut off from BA a part equal to AC (I.3)',
      expected: {
        type: 'macro',
        propId: 3,
        inputPointIds: ['pt-B', 'pt-A', 'pt-A', 'pt-C'],
        outputLabels: { result: 'D' },
      },
      highlightIds: ['pt-B', 'pt-A', 'pt-C'],
      tool: 'macro',
      citation: 'I.3',
    },
    // 1. Join D to C
    {
      instruction: 'Join D to C',
      expected: { type: 'straightedge', fromId: 'pt-D', toId: 'pt-C' },
      highlightIds: ['pt-D', 'pt-C'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
  ],
  resultSegments: [
    { fromId: 'pt-A', toId: 'pt-B' },
    { fromId: 'pt-A', toId: 'pt-C' },
  ],
  getTutorial: getProp6Tutorial,
  explorationNarration: {
    introSpeech:
      "Euclid's first proof by contradiction! If the base angles are equal, the triangle must be isosceles. Together with Proposition I.5, this gives us a biconditional: a triangle is isosceles if and only if its base angles are equal. Try dragging the points to see the contradiction construction adapt.",
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'As you move the apex, the triangle changes shape — but the base angles stay equal, and the contradiction always works.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch how D adjusts along BA. It always lands between A and B because AB is always greater than AC.',
      },
    ],
    breakdownTip:
      'AB must exceed AC for the contradiction to work — D needs to fall between A and B so that △DBC is properly contained in △ACB.',
  },
  deriveConclusion: deriveProp6Conclusion,
}
