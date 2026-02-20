import type {
  PropositionDef,
  ConstructionElement,
  ConstructionState,
  TutorialSubStep,
} from '../types'
import { BYRNE } from '../types'
import type { FactStore } from '../engine/factStore'
import type { EqualityFact } from '../engine/facts'
import { distancePair } from '../engine/facts'
import { addFact, queryEquality } from '../engine/factStore'

function getProp2Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const drag = isTouch ? 'Drag' : 'Drag'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'

  return [
    // ── Step 0: Join A to B ──
    [
      {
        instruction: `${drag} from A to B`,
        speech: isTouch
          ? 'First, we need to connect point A to one end of the given line. Put your finger on A and drag it to B.'
          : 'First, we need to connect point A to one end of the given line. Click A and drag to B.',
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: null,
      },
    ],
    // ── Step 1: Construct equilateral triangle (I.1 macro) ──
    [
      {
        instruction: `${tap} point A`,
        speech: isTouch
          ? "Now we'll build an equilateral triangle on line AB — just like Proposition One! Tap point A first."
          : "Now we'll build an equilateral triangle on line AB — just like Proposition One! Click point A first.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select', index: 0 },
      },
      {
        instruction: `${tap} point B`,
        speech: isTouch
          ? 'Now tap point B to complete the triangle construction.'
          : 'Now click point B to complete the triangle construction.',
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: null,
      },
    ],
    // ── Step 2: Circle at B through C ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? "Here's the clever part. We need to copy the length of line BC. Press and hold on B."
          : "Here's the clever part. We need to copy the length of line BC. Click and hold on B.",
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point C`,
        speech: isTouch
          ? 'Drag to C — this makes the circle the same size as the given line.'
          : 'Drag to C — this makes the circle match the given line.',
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-C' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch ? 'Sweep around to draw the circle!' : 'Move around to draw the circle!',
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-C' },
        advanceOn: null,
      },
    ],
    // ── Step 3: Mark intersection E (Euclid's G) ──
    [
      {
        instruction: `${tap} where the circle crosses line DB, past B`,
        speech:
          'See where the new circle crosses the line from D through B? Tap the point on the far side of B — past B, away from D. That intersection captures the length we want to transfer.',
        hint: {
          type: 'candidates',
          ofA: { kind: 'circle', centerId: 'pt-B', radiusPointId: 'pt-C' },
          ofB: { kind: 'segment', fromId: 'pt-D', toId: 'pt-B' },
          beyondId: 'pt-B',
        },
        advanceOn: null,
      },
    ],
    // ── Step 4: Circle at D through E ──
    [
      {
        instruction: `${tapHold} point D`,
        speech: isTouch
          ? 'Almost there! Now we use point D as a compass center. Press and hold on D.'
          : 'Almost there! Now we use point D as a compass center. Click and hold on D.',
        hint: { type: 'point', pointId: 'pt-D' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point E`,
        speech: isTouch ? 'Drag to the point E we just marked.' : 'Drag to point E.',
        hint: { type: 'arrow', fromId: 'pt-D', toId: 'pt-E' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch
          ? 'Sweep all the way around. This is the big circle that transfers the distance!'
          : 'Move all the way around. This big circle transfers the distance!',
        hint: { type: 'sweep', centerId: 'pt-D', radiusPointId: 'pt-E' },
        advanceOn: null,
      },
    ],
    // ── Step 5: Mark intersection F (Euclid's L) ──
    [
      {
        instruction: `${tap} where the big circle crosses line DA, past A`,
        speech:
          'See where the big circle crosses the line from D through A? Tap the point past A — on the far side from D. The line from A to that new point is exactly the same length as BC!',
        hint: {
          type: 'candidates',
          ofA: { kind: 'circle', centerId: 'pt-D', radiusPointId: 'pt-E' },
          ofB: { kind: 'segment', fromId: 'pt-D', toId: 'pt-A' },
          beyondId: 'pt-A',
        },
        advanceOn: null,
      },
    ],
  ]
}

/**
 * Derive I.2 conclusion: AF = BC via C.N.3 + C.N.1
 */
function deriveProp2Conclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number
): EqualityFact[] {
  const allNewFacts: EqualityFact[] = []

  const dpAF = distancePair('pt-A', 'pt-F')
  const dpBE = distancePair('pt-B', 'pt-E')
  const dpBC = distancePair('pt-B', 'pt-C')
  const dpDF = distancePair('pt-D', 'pt-F')
  const dpDA = distancePair('pt-D', 'pt-A')

  // Step 1: C.N.3 — AF = BE
  allNewFacts.push(
    ...addFact(
      store,
      dpAF,
      dpBE,
      { type: 'cn3', whole: dpDF, part: dpDA },
      'AF = BE',
      'C.N.3: DF − DA = DE − DB (since DA = DB)',
      atStep
    )
  )

  // Step 2: C.N.1 transitivity — AF = BC
  if (!queryEquality(store, dpAF, dpBC)) {
    allNewFacts.push(
      ...addFact(
        store,
        dpAF,
        dpBC,
        { type: 'cn1', via: dpBE },
        'AF = BC',
        'C.N.1: AF = BE and BE = BC',
        atStep
      )
    )
  }

  return allNewFacts
}

/**
 * Proposition I.2: To place at a given point a straight line equal
 * to a given straight line.
 *
 * Given: Point A (the point), segment BC (the line to copy)
 *
 * Construction (using I.1 as a macro):
 * 1. Join A to B                         (Post.1)
 * 2. Construct equilateral △ ABD on AB   (I.1 macro)
 * 3. Circle at B through C               (Post.3) — meets extension of DB at E
 * 4. Mark E (Euclid's G)
 * 5. Circle at D through E               (Post.3) — meets extension of DA at F
 * 6. Mark F (Euclid's L)
 *
 * Result: AF = BC
 *
 * Element IDs at each step (given: pt-A, pt-B, pt-C, seg-BC):
 *   Step 1 → seg-2 (AB)         [seg-BC is seg count 1]
 *   Step 2 (macro I.1):
 *            pt-D  (apex — circles are internal to the proven tool)
 *            seg-3 (DA)
 *            seg-4 (DB)
 *   Step 3 → cir-1 (circle B,C)
 *   Step 4 → pt-E  (on extension of DB beyond B)
 *   Step 5 → cir-2 (circle D,E)
 *   Step 6 → pt-F  (on extension of DA beyond A)
 */
export const PROP_2: PropositionDef = {
  id: 2,
  title: 'Place a line equal to a given line at a given point',
  draggablePointIds: ['pt-A', 'pt-B', 'pt-C'],
  // completionMessage derived from proof engine at runtime
  resultSegments: [{ fromId: 'pt-A', toId: 'pt-F' }],
  givenElements: [
    {
      kind: 'point',
      id: 'pt-A',
      x: -1.5,
      y: 1.5,
      label: 'A',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-B',
      x: 0,
      y: 0,
      label: 'B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-C',
      x: 1.5,
      y: 0,
      label: 'C',
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
    // 1. Join A and B
    {
      instruction: 'Join point A to point B',
      expected: { type: 'straightedge', fromId: 'pt-A', toId: 'pt-B' },
      highlightIds: ['pt-A', 'pt-B'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
    // 2. Construct equilateral triangle on AB (I.1 macro)
    {
      instruction: 'Construct equilateral triangle on AB (I.1)',
      expected: {
        type: 'macro',
        propId: 1,
        inputPointIds: ['pt-A', 'pt-B'],
        outputLabels: { apex: 'D' },
      },
      highlightIds: ['pt-A', 'pt-B'],
      tool: 'macro',
      citation: 'I.1',
    },
    // 3. Circle at B through C
    {
      instruction: 'Draw a circle centered at B through C',
      expected: { type: 'compass', centerId: 'pt-B', radiusPointId: 'pt-C' },
      highlightIds: ['pt-B', 'pt-C'],
      tool: 'compass',
      citation: 'Post.3',
    },
    // 4. Mark intersection E (Euclid's G — on extension of DB beyond B)
    // Uses ElementSelectors: circle(B,C) and segment(D,B) instead of creation-order IDs
    {
      instruction: 'Mark where the circle crosses line DB, past B',
      expected: {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-B', radiusPointId: 'pt-C' },
        ofB: { kind: 'segment', fromId: 'pt-D', toId: 'pt-B' },
        beyondId: 'pt-B',
        label: 'E',
      },
      highlightIds: [],
      tool: null,
      citation: 'Def.15',
    },
    // 5. Circle at D through E
    {
      instruction: 'Draw a circle centered at D through E',
      expected: { type: 'compass', centerId: 'pt-D', radiusPointId: 'pt-E' },
      highlightIds: ['pt-D', 'pt-E'],
      tool: 'compass',
      citation: 'Post.3',
    },
    // 6. Mark intersection F (Euclid's L — on extension of DA beyond A)
    {
      instruction: 'Mark where the circle crosses line DA, past A',
      expected: {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-D', radiusPointId: 'pt-E' },
        ofB: { kind: 'segment', fromId: 'pt-D', toId: 'pt-A' },
        beyondId: 'pt-A',
        label: 'F',
      },
      highlightIds: [],
      tool: null,
      citation: 'Def.15',
    },
  ],
  getTutorial: getProp2Tutorial,
  explorationNarration: {
    introSpeech:
      'You copied a distance! Now drag the points around to prove this construction always works, no matter where the points are.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech: 'See how AF always equals BC? The copy works wherever A ends up.',
      },
      {
        pointId: 'pt-B',
        speech: 'Watch the equilateral triangle and circles all shift. The copy still works!',
      },
      {
        pointId: 'pt-C',
        speech: 'See AF changing to match? It always copies the exact length of BC.',
      },
    ],
  },
  deriveConclusion: deriveProp2Conclusion,
}
