import type {
  PropositionDef,
  ConstructionElement,
  ConstructionState,
  TutorialSubStep,
  EuclidNarrationOptions,
  ExpectedAction,
} from '../types'
import { BYRNE } from '../types'
import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'
import { deriveSteps } from '../engine/recipe/deriveSteps'
import { RECIPE_PROP_2, PROP_2_ANNOTATIONS } from '../engine/recipe/definitions/prop2'
import { RECIPE_REGISTRY } from '../engine/recipe/definitions/registry'
import { recipeToConclusion } from '../engine/recipe/adapters'
import { evaluateRecipe } from '../engine/recipe/evaluate'
import { getPoint } from '../engine/constructionState'

const DEFAULT_LANGUAGE_STYLE: KidLanguageStyle = 'standard'

const PROP_2_STEP_INSTRUCTIONS: Record<KidLanguageStyle, string[]> = {
  simple: [
    'Draw a line from {pt:A} to {pt:B}',
    'Build an equilateral triangle on {seg:AB} ({prop:1|I.1})',
    'Draw a circle with center {pt:B} through {pt:C}',
    'From {pt:D}, extend past {pt:B} to meet the circle',
    'Draw a circle with center {pt:D} through {pt:E}',
    'From {pt:D}, extend past {pt:A} to meet the circle',
  ],
  standard: [
    'Join point {pt:A} to point {pt:B}',
    'Construct equilateral triangle on {seg:AB} ({prop:1|I.1})',
    'Draw a circle centered at {pt:B} through {pt:C}',
    'From {pt:D}, extend through {pt:B} to meet the circle at {pt:E}',
    'Draw a circle centered at {pt:D} through {pt:E}',
    'From {pt:D}, extend through {pt:A} to meet the circle at {pt:F}',
  ],
  classical: [
    'Join {pt:A} to {pt:B}',
    'Construct the equilateral triangle on {seg:AB} ({prop:1|I.1})',
    'Describe the circle with center {pt:B} and radius {seg:BC}',
    'From {pt:D}, produce past {pt:B} to meet the circle at {pt:E}',
    'Describe the circle with center {pt:D} and radius {seg:DE}',
    'From {pt:D}, produce past {pt:A} to meet the circle at {pt:F}',
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
        instruction: `${drag} from {pt:A} to {pt:B}`,
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
        instruction: `${tap} point {pt:A}`,
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
        instruction: `${tap} point {pt:B}`,
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
        instruction: `${tapHold} point {pt:B}`,
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
        instruction: `${drag} to point {pt:C}`,
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
    // ── Step 3: Extend DB past B to E (Postulate 2) ──
    [
      {
        instruction: `${drag} from {pt:D} toward {pt:B}`,
        speech: byStyle({
          simple:
            'Now extend line DB past B using Postulate 2. Drag from D toward B.',
          standard:
            'Now extend line DB past B using Postulate 2. Drag from point D toward B.',
          classical:
            'By Postulate 2, produce DB beyond B. Drag from D toward B.',
        }),
        hint: { type: 'point', pointId: 'pt-D' },
        advanceOn: { kind: 'extend-phase' as const, phase: 'extending' as const },
      },
      {
        instruction: `Continue past {pt:B} and release to place {pt:E}`,
        speech: byStyle({
          simple:
            'Keep going past B and release to place point E where the line meets the circle. Then BE equals BC.',
          standard:
            'Continue past B and release to place E where the line meets the circle. Because E is on the circle centered at B, BE equals BC.',
          classical:
            'Continue past B and release at E, where it meets the circle. Since E is on the circle with center B, BE equals BC.',
        }),
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
    // ── Step 4: Circle at D through E ──
    [
      {
        instruction: `${tapHold} point {pt:D}`,
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
        instruction: `${drag} to point {pt:E}`,
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
    // ── Step 5: Extend DA past A to F (Postulate 2) ──
    [
      {
        instruction: `${drag} from {pt:D} toward {pt:A}`,
        speech: byStyle({
          simple:
            'Now extend line DA past A. Drag from D toward A.',
          standard:
            'Now extend line DA past A using Postulate 2. Drag from point D toward A.',
          classical:
            'By Postulate 2, produce DA beyond A. Drag from D toward A.',
        }),
        hint: { type: 'point', pointId: 'pt-D' },
        advanceOn: { kind: 'extend-phase' as const, phase: 'extending' as const },
      },
      {
        instruction: `Continue past {pt:A} and release to place {pt:F}`,
        speech: byStyle({
          simple:
            'Keep going past A and release to place point F. Then DF equals DE. Subtract equals from equals to get AF = BE, and since BE = BC, AF = BC.',
          standard:
            'Continue past A and release to place F where the line meets the circle. DF equals DE, and since DA equals DB, subtract equals from equals to get AF = BE. Because BE = BC, AF = BC.',
          classical:
            'Continue past A and release at F. Then DF equals DE. Subtract equals from equals: AF = BE. And since BE = BC, AF = BC.',
        }),
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
  ]
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
  steps: deriveSteps(RECIPE_PROP_2, PROP_2_ANNOTATIONS),
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
  deriveConclusion: recipeToConclusion(RECIPE_PROP_2),
  resolveStep(
    stepIndex: number,
    state: ConstructionState,
    _stepData: Map<number, Record<string, unknown>>
  ): { expected?: ExpectedAction; instruction?: string; highlightIds?: string[] } | null {
    if (stepIndex !== 3 && stepIndex !== 5) return null

    // Evaluate the full recipe using the geometry engine to get authoritative positions
    const ptB = getPoint(state, 'pt-B')
    const ptC = getPoint(state, 'pt-C')
    const ptA = getPoint(state, 'pt-A')
    if (!ptB || !ptC || !ptA) return null

    const trace = evaluateRecipe(RECIPE_PROP_2, [ptB, ptC, ptA], RECIPE_REGISTRY)
    if (!trace) return null

    // Step 3: extend DB past B → E at circle(B, BC) intersection
    if (stepIndex === 3) {
      const ptE = trace.pointMap.get('E')
      const through = getPoint(state, 'pt-B')
      if (!ptE || !through) return null
      const dist = Math.sqrt((ptE.x - through.x) ** 2 + (ptE.y - through.y) ** 2)
      return {
        expected: { type: 'extend', baseId: 'pt-D', throughId: 'pt-B', distance: dist, label: 'E' },
      }
    }

    // Step 5: extend DA past A → F at circle(D, DE) intersection
    if (stepIndex === 5) {
      const ptF = trace.pointMap.get('F')
      const through = getPoint(state, 'pt-A')
      if (!ptF || !through) return null
      const dist = Math.sqrt((ptF.x - through.x) ** 2 + (ptF.y - through.y) ** 2)
      return {
        expected: { type: 'extend', baseId: 'pt-D', throughId: 'pt-A', distance: dist, label: 'F' },
      }
    }

    return null
  },
}
