import type {
  PropositionDef,
  ConstructionElement,
  TutorialSubStep,
  EuclidNarrationOptions,
} from '../types'
import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'
import { BYRNE } from '../types'

const DEFAULT_LANGUAGE_STYLE: KidLanguageStyle = 'standard'

const PROP_1_STEP_INSTRUCTIONS: Record<KidLanguageStyle, string[]> = {
  simple: [
    'Draw a circle with center A through B',
    'Draw a circle with center B through A',
    'Mark where the circles cross',
    'Draw a line from C to A',
    'Draw a line from C to B',
  ],
  standard: [
    'Draw a circle centered at A through B',
    'Draw a circle centered at B through A',
    'Mark the point where the circles meet',
    'Draw a line from C to A',
    'Draw a line from C to B',
  ],
  classical: [
    'Describe a circle with center A and radius AB',
    'Describe a circle with center B and radius BA',
    'Mark where the circles cut one another',
    'Join C to A',
    'Join C to B',
  ],
}

function getProp1Tutorial(isTouch: boolean, options?: EuclidNarrationOptions): TutorialSubStep[][] {
  const style = options?.languageStyle ?? DEFAULT_LANGUAGE_STYLE
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const drag = isTouch ? 'Drag' : 'Drag'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'
  const tap = isTouch ? 'Tap' : 'Click'
  const byStyle = (copy: Record<KidLanguageStyle, string>) => copy[style] ?? copy.standard

  return [
    // ── Step 0: Circle centered at A through B ──
    [
      {
        instruction: `${tapHold} point A`,
        speech: isTouch
          ? byStyle({
              simple:
                'Postulate 3 lets us draw a circle from any center with any radius. Press and hold on A to choose the center.',
              standard:
                'Postulate 3 says we may describe a circle with any center and radius. Press and hold on A to set the center.',
              classical:
                'By Postulate 3, describe a circle with any center and radius. Take A as the center.',
            })
          : byStyle({
              simple:
                'Postulate 3 lets us draw a circle from any center with any radius. Click and hold on A to choose the center.',
              standard:
                'Postulate 3 says we may describe a circle with any center and radius. Click and hold on A to set the center.',
              classical:
                'By Postulate 3, describe a circle with any center and radius. Take A as the center.',
            }),
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point B`,
        speech: byStyle({
          simple: 'Drag to B to set the radius. Every point on this circle is AB away from A.',
          standard:
            'Drag to B to set the radius. Every point on this circle will be exactly AB away from A.',
          classical:
            'Drag to B to set the radius AB. Every point on the circle is at a distance AB from A.',
        }),
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} all the way around`,
        speech: isTouch
          ? byStyle({
              simple: 'Sweep around to draw the circle centered at A.',
              standard: 'Sweep all the way around to draw the circle centered at A with radius AB.',
              classical: 'Carry the circle around until it is complete.',
            })
          : byStyle({
              simple: 'Move around to draw the circle centered at A.',
              standard: 'Move all the way around to draw the circle centered at A with radius AB.',
              classical: 'Carry the circle around until it is complete.',
            }),
        hint: { type: 'sweep', centerId: 'pt-A', radiusPointId: 'pt-B' },
        advanceOn: null,
      },
    ],
    // ── Step 1: Circle centered at B through A ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? byStyle({
              simple: 'Now do the same with center B. Press and hold on B.',
              standard: 'Now do the same with center B. Press and hold on B.',
              classical: 'Again, take B as the center.',
            })
          : byStyle({
              simple: 'Now do the same with center B. Click and hold on B.',
              standard: 'Now do the same with center B. Click and hold on B.',
              classical: 'Again, take B as the center.',
            }),
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point A`,
        speech: byStyle({
          simple: 'Drag to A to set the radius BA. Every point on this circle is BA away from B.',
          standard:
            'Drag to A to make the radius BA. Every point on this circle is BA away from B.',
          classical:
            'Drag to A so the radius is BA. Every point on this circle is at distance BA from B.',
        }),
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around again`,
        speech: isTouch
          ? byStyle({
              simple: 'Sweep around to draw the second circle.',
              standard: 'Sweep all the way around to draw the second circle.',
              classical: 'Carry the circle around again.',
            })
          : byStyle({
              simple: 'Move around to draw the second circle.',
              standard: 'Move all the way around to draw the second circle.',
              classical: 'Carry the circle around again.',
            }),
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-A' },
        advanceOn: null,
      },
    ],
    // ── Step 2: Mark intersection ──
    [
      {
        instruction: `${tap} where the circles cross`,
        speech: byStyle({
          simple: 'Tap where the circles cross. That point is the same distance from A and from B.',
          standard:
            'Mark a point where the circles meet. That point is on both circles, so it is the same distance from A as from B.',
          classical:
            'Mark one of the points where the circles cut one another; it lies on both circles and is equidistant from A and B.',
        }),
        hint: { type: 'candidates' },
        advanceOn: null,
      },
    ],
    // ── Step 3: Segment C → A ──
    [
      {
        instruction: `${drag} from C to A`,
        speech: byStyle({
          simple:
            'Postulate 1 lets us draw a straight line from any point to any point. Draw the line from C to A.',
          standard:
            'Postulate 1 lets us draw a straight line from any point to any point. Draw the line from C to A.',
          classical: 'By Postulate 1, join C to A.',
        }),
        hint: { type: 'arrow', fromId: 'pt-C', toId: 'pt-A' },
        advanceOn: null,
      },
    ],
    // ── Step 4: Segment C → B ──
    [
      {
        instruction: `${drag} from C to B`,
        speech: byStyle({
          simple:
            'Draw the line from C to B. Now CA = AB and CB = AB, so all three sides are equal.',
          standard:
            'Draw the line from C to B. Now CA = AB and CB = AB, so the triangle is equilateral.',
          classical:
            'Join C to B. Since CA equals AB and CB equals AB, the triangle is equilateral.',
        }),
        hint: { type: 'arrow', fromId: 'pt-C', toId: 'pt-B' },
        advanceOn: null,
      },
    ],
  ]
}

/**
 * Proposition I.1: On a given finite straight line to construct
 * an equilateral triangle.
 */
export const PROP_1: PropositionDef = {
  id: 1,
  title: 'Construct an equilateral triangle on a given line',
  draggablePointIds: ['pt-A', 'pt-B'],
  givenElements: [
    {
      kind: 'point',
      id: 'pt-A',
      x: -2,
      y: 0,
      label: 'A',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-B',
      x: 2,
      y: 0,
      label: 'B',
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
  ] as ConstructionElement[],
  steps: [
    {
      instruction: 'Draw a circle centered at A through B',
      expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-B' },
      highlightIds: ['pt-A', 'pt-B'],
      tool: 'compass',
      citation: 'Post.3',
    },
    {
      instruction: 'Draw a circle centered at B through A',
      expected: { type: 'compass', centerId: 'pt-B', radiusPointId: 'pt-A' },
      highlightIds: ['pt-B', 'pt-A'],
      tool: 'compass',
      citation: 'Post.3',
    },
    {
      instruction: 'Mark the point where the circles meet',
      expected: { type: 'intersection', label: 'C' }, // accepts any intersection
      highlightIds: [],
      tool: null, // tap — no tool needed
      citation: 'Def.15',
    },
    {
      instruction: 'Draw a line from C to A',
      expected: { type: 'straightedge', fromId: 'pt-C', toId: 'pt-A' },
      highlightIds: ['pt-C', 'pt-A'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
    {
      instruction: 'Draw a line from C to B',
      expected: { type: 'straightedge', fromId: 'pt-C', toId: 'pt-B' },
      highlightIds: ['pt-C', 'pt-B'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
  ],
  stepInstructionsByStyle: PROP_1_STEP_INSTRUCTIONS,
  // completionMessage derived from proof engine at runtime
  resultSegments: [
    { fromId: 'pt-A', toId: 'pt-C' },
    { fromId: 'pt-C', toId: 'pt-B' },
    { fromId: 'pt-A', toId: 'pt-B' },
  ],
  getTutorial: getProp1Tutorial,
  explorationNarration: {
    introSpeech:
      'You built an equilateral triangle by definition: C lies on both circles, so CA = AB and CB = AB. Drag A or B to see the logic still forces those equalities.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech: 'No matter where A moves, C stays on both circles, so CA and AB remain equal.',
      },
      {
        pointId: 'pt-B',
        speech:
          'C stays the same distance from B as A is from B, so the triangle stays equilateral.',
      },
    ],
  },
  explorationNarrationByStyle: {
    simple: {
      introSpeech:
        'C is on both circles, so CA = AB and CB = AB. Drag A or B and watch the equal sides stay equal.',
      pointTips: [
        {
          pointId: 'pt-A',
          speech: 'C stays on both circles, so CA always matches AB.',
        },
        {
          pointId: 'pt-B',
          speech: 'C stays the same distance from B as A does, so the triangle stays equal.',
        },
      ],
    },
    standard: {
      introSpeech:
        'You built an equilateral triangle by definition: C lies on both circles, so CA = AB and CB = AB. Drag A or B to see the logic still forces those equalities.',
      pointTips: [
        {
          pointId: 'pt-A',
          speech: 'No matter where A moves, C stays on both circles, so CA and AB remain equal.',
        },
        {
          pointId: 'pt-B',
          speech:
            'C stays the same distance from B as A is from B, so the triangle stays equilateral.',
        },
      ],
    },
    classical: {
      introSpeech:
        'C lies on both circles, so CA = AB and CB = AB. Hence the triangle is equilateral. Drag A or B to see the equalities persist.',
      pointTips: [
        {
          pointId: 'pt-A',
          speech: 'Because C remains on the circle with center A, CA is always equal to AB.',
        },
        {
          pointId: 'pt-B',
          speech: 'Because C remains on the circle with center B, CB is always equal to AB.',
        },
      ],
    },
  },
}
