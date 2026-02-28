import type {
  PropositionDef,
  ConstructionElement,
  ConstructionState,
  TutorialSubStep,
  EuclidNarrationOptions,
} from '../types'
import { BYRNE } from '../types'
import type { FactStore } from '../engine/factStore'
import type { EqualityFact } from '../engine/facts'
import { distancePair } from '../engine/facts'
import { addFact, queryEquality } from '../engine/factStore'
import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'

const DEFAULT_LANGUAGE_STYLE: KidLanguageStyle = 'standard'

const PROP_2_STEP_INSTRUCTIONS: Record<KidLanguageStyle, string[]> = {
  simple: [
    'Draw a line from A to B',
    'Build an equilateral triangle on AB (I.1)',
    'Draw a circle with center B through C',
    'Mark where the circle crosses line DB, past B',
    'Draw a circle with center D through E',
    'Mark where the circle crosses line DA, past A',
  ],
  standard: [
    'Join point A to point B',
    'Construct equilateral triangle on AB (I.1)',
    'Draw a circle centered at B through C',
    'Mark where the circle crosses line DB, past B',
    'Draw a circle centered at D through E',
    'Mark where the circle crosses line DA, past A',
  ],
  classical: [
    'Join A to B',
    'Construct the equilateral triangle on AB (I.1)',
    'Describe the circle with center B and radius BC',
    'Mark where the circle cuts DB produced beyond B',
    'Describe the circle with center D and radius DE',
    'Mark where the circle cuts DA produced beyond A',
  ],
}

function getProp2Tutorial(isTouch: boolean, options?: EuclidNarrationOptions): TutorialSubStep[][] {
  const style = options?.languageStyle ?? DEFAULT_LANGUAGE_STYLE
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const drag = isTouch ? 'Drag' : 'Drag'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'
  const byStyle = (copy: Record<KidLanguageStyle, string>) => copy[style] ?? copy.standard

  return [
    // ── Step 0: Join A to B ──
    [
      {
        instruction: `${drag} from A to B`,
        speech: byStyle({
          simple: 'Postulate 1 lets us draw a straight line from any point to any point. Draw AB.',
          standard:
            'Postulate 1 lets us draw a straight line from any point to any point. Draw AB.',
          classical: 'By Postulate 1, join A to B.',
        }),
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: null,
      },
    ],
    // ── Step 1: Construct equilateral triangle (I.1 macro) ──
    [
      {
        instruction: `${tap} point A`,
        speech: isTouch
          ? byStyle({
              simple:
                'Now use Proposition I.1 to build an equilateral triangle on AB. Tap A to start.',
              standard:
                'Now use Proposition I.1 to construct an equilateral triangle on AB. Tap A to start.',
              classical:
                'Use Proposition I.1 to construct the equilateral triangle on AB. Tap A to begin.',
            })
          : byStyle({
              simple:
                'Now use Proposition I.1 to build an equilateral triangle on AB. Click A to start.',
              standard:
                'Now use Proposition I.1 to construct an equilateral triangle on AB. Click A to start.',
              classical:
                'Use Proposition I.1 to construct the equilateral triangle on AB. Click A to begin.',
            }),
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select', index: 0 },
      },
      {
        instruction: `${tap} point B`,
        speech: isTouch
          ? byStyle({
              simple: 'Tap B to finish. In an equilateral triangle, DA equals DB.',
              standard: 'Tap B to finish. Because the triangle is equilateral, DA equals DB.',
              classical: 'Tap B to finish. Since the triangle is equilateral, DA equals DB.',
            })
          : byStyle({
              simple: 'Click B to finish. In an equilateral triangle, DA equals DB.',
              standard: 'Click B to finish. Because the triangle is equilateral, DA equals DB.',
              classical: 'Click B to finish. Since the triangle is equilateral, DA equals DB.',
            }),
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: null,
      },
    ],
    // ── Step 2: Circle at B through C ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? byStyle({
              simple:
                'Now draw a circle with center B and radius BC (Postulate 3). Press and hold on B.',
              standard:
                'Now describe a circle with center B and radius BC (Postulate 3). Press and hold on B.',
              classical: 'By Postulate 3, describe the circle with center B and radius BC.',
            })
          : byStyle({
              simple:
                'Now draw a circle with center B and radius BC (Postulate 3). Click and hold on B.',
              standard:
                'Now describe a circle with center B and radius BC (Postulate 3). Click and hold on B.',
              classical: 'By Postulate 3, describe the circle with center B and radius BC.',
            }),
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point C`,
        speech: byStyle({
          simple: 'Drag to C to set the radius. Every point on this circle is BC away from B.',
          standard: 'Drag to C to set the radius. Every point on this circle is BC away from B.',
          classical:
            'Drag to C to set the radius. Every point on this circle is at distance BC from B.',
        }),
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-C' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch
          ? byStyle({
              simple: 'Sweep around to draw the circle centered at B.',
              standard: 'Sweep around to draw the circle centered at B.',
              classical: 'Carry the circle around.',
            })
          : byStyle({
              simple: 'Move around to draw the circle centered at B.',
              standard: 'Move around to draw the circle centered at B.',
              classical: 'Carry the circle around.',
            }),
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-C' },
        advanceOn: null,
      },
    ],
    // ── Step 3: Mark intersection E (Euclid's G) ──
    [
      {
        instruction: `${tap} where the circle crosses line DB, past B`,
        speech: byStyle({
          simple:
            'Extend line DB past B (Postulate 2) and tap where it meets the circle. Call it E. Then BE equals BC.',
          standard:
            'Extend line DB past B (Postulate 2) and mark where it meets the circle. Call it E. Because E is on the circle centered at B, BE equals BC.',
          classical:
            'Produce DB beyond B (Postulate 2) and mark its meeting with the circle at E. Since E is on the circle with center B, BE equals BC.',
        }),
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
          ? byStyle({
              simple: 'Now draw a circle with center D and radius DE. Press and hold on D.',
              standard: 'Now describe a circle with center D and radius DE. Press and hold on D.',
              classical: 'Describe the circle with center D and radius DE.',
            })
          : byStyle({
              simple: 'Now draw a circle with center D and radius DE. Click and hold on D.',
              standard: 'Now describe a circle with center D and radius DE. Click and hold on D.',
              classical: 'Describe the circle with center D and radius DE.',
            }),
        hint: { type: 'point', pointId: 'pt-D' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point E`,
        speech: byStyle({
          simple: 'Drag to E to set the radius. Every point on this circle is DE away from D.',
          standard: 'Drag to E to set the radius. Every point on this circle is DE away from D.',
          classical:
            'Drag to E to set the radius. Every point on this circle is at distance DE from D.',
        }),
        hint: { type: 'arrow', fromId: 'pt-D', toId: 'pt-E' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch
          ? byStyle({
              simple: 'Sweep around to draw the circle centered at D.',
              standard: 'Sweep all the way around to draw the circle centered at D.',
              classical: 'Carry the circle around.',
            })
          : byStyle({
              simple: 'Move around to draw the circle centered at D.',
              standard: 'Move all the way around to draw the circle centered at D.',
              classical: 'Carry the circle around.',
            }),
        hint: { type: 'sweep', centerId: 'pt-D', radiusPointId: 'pt-E' },
        advanceOn: null,
      },
    ],
    // ── Step 5: Mark intersection F (Euclid's L) ──
    [
      {
        instruction: `${tap} where the big circle crosses line DA, past A`,
        speech: byStyle({
          simple:
            'Extend line DA past A (Postulate 2) and tap where it meets the circle. Call it F. Then DF equals DE. Subtract equals from equals to get AF = BE, and since BE = BC, AF = BC.',
          standard:
            'Extend line DA past A (Postulate 2) and mark where it meets the circle. Call it F. Then DF equals DE. Since DA equals DB, subtract equals from equals to get AF = BE, and because BE = BC, AF = BC.',
          classical:
            'Produce DA beyond A (Postulate 2) and mark its meeting with the circle at F. Then DF equals DE. Subtract equals from equals to get AF = BE, and since BE = BC, AF = BC.',
        }),
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
      'C.N.3: If equals are subtracted from equals, the remainders are equal. Since DF = DE and DA = DB, AF = BE.',
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
        'C.N.1: Things which equal the same thing also equal one another. Since AF = BE and BE = BC, AF = BC.',
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
  stepInstructionsByStyle: PROP_2_STEP_INSTRUCTIONS,
  getTutorial: getProp2Tutorial,
  explorationNarration: {
    introSpeech:
      'You copied a distance using only postulates, definitions, and common notions. Drag points A, B, or C to see the equalities still follow by logic.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'AF always equals BC because the circles and subtractions enforce it, not because of measurement.',
      },
      {
        pointId: 'pt-B',
        speech: 'The construction moves, but DA = DB and BE = BC still hold, so AF = BC.',
      },
      {
        pointId: 'pt-C',
        speech: 'BC sets the circle radius at B, so the copied length always matches BC.',
      },
    ],
  },
  explorationNarrationByStyle: {
    simple: {
      introSpeech:
        'You copied the length using circles and straight lines. Drag A, B, or C to see AF stay equal to BC.',
      pointTips: [
        {
          pointId: 'pt-A',
          speech: 'AF stays equal to BC because the construction forces it.',
        },
        {
          pointId: 'pt-B',
          speech: 'DA = DB and BE = BC still hold, so AF = BC.',
        },
        {
          pointId: 'pt-C',
          speech: 'BC sets the circle radius at B, so the copy always matches BC.',
        },
      ],
    },
    standard: {
      introSpeech:
        'You copied a distance using only postulates, definitions, and common notions. Drag points A, B, or C to see the equalities still follow by logic.',
      pointTips: [
        {
          pointId: 'pt-A',
          speech:
            'AF always equals BC because the circles and subtractions enforce it, not because of measurement.',
        },
        {
          pointId: 'pt-B',
          speech: 'The construction moves, but DA = DB and BE = BC still hold, so AF = BC.',
        },
        {
          pointId: 'pt-C',
          speech: 'BC sets the circle radius at B, so the copied length always matches BC.',
        },
      ],
    },
    classical: {
      introSpeech:
        'You placed a line equal to the given line by postulates and common notions. Drag A, B, or C to see the equalities persist.',
      pointTips: [
        {
          pointId: 'pt-A',
          speech: 'Because DF = DE and DA = DB, the subtraction gives AF = BE.',
        },
        {
          pointId: 'pt-B',
          speech: 'Since BE = BC, and AF = BE, we have AF = BC.',
        },
        {
          pointId: 'pt-C',
          speech: 'BC fixes the radius, so the copied length always equals BC.',
        },
      ],
    },
  },
  deriveConclusion: deriveProp2Conclusion,
}
