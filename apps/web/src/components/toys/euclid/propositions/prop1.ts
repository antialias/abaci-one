import type { PropositionDef, ConstructionElement, TutorialSubStep } from '../types'
import { BYRNE } from '../types'

function getProp1Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const drag = isTouch ? 'Drag' : 'Drag'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'
  const tap = isTouch ? 'Tap' : 'Click'

  return [
    // ── Step 0: Circle centered at A through B ──
    [
      {
        instruction: `${tapHold} point A`,
        speech: isTouch
          ? 'Postulate 3 says we may describe a circle with any center and radius. Press and hold on A to set the center.'
          : 'Postulate 3 says we may describe a circle with any center and radius. Click and hold on A to set the center.',
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point B`,
        speech: isTouch
          ? 'Drag to B to set the radius. Every point on this circle will be exactly AB away from A.'
          : 'Drag to B to set the radius. Every point on this circle will be exactly AB away from A.',
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} all the way around`,
        speech: isTouch
          ? 'Sweep all the way around to draw the circle centered at A with radius AB.'
          : 'Move all the way around to draw the circle centered at A with radius AB.',
        hint: { type: 'sweep', centerId: 'pt-A', radiusPointId: 'pt-B' },
        advanceOn: null,
      },
    ],
    // ── Step 1: Circle centered at B through A ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? 'Now do the same with center B. Press and hold on B.'
          : 'Now do the same with center B. Click and hold on B.',
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point A`,
        speech: isTouch
          ? 'Drag to A to make the radius BA. Every point on this circle is BA away from B.'
          : 'Drag to A to make the radius BA. Every point on this circle is BA away from B.',
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around again`,
        speech: isTouch
          ? 'Sweep all the way around to draw the second circle.'
          : 'Move all the way around to draw the second circle.',
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-A' },
        advanceOn: null,
      },
    ],
    // ── Step 2: Mark intersection ──
    [
      {
        instruction: `${tap} where the circles cross`,
        speech:
          'Mark a point where the circles meet. That point is on both circles, so it is the same distance from A as from B.',
        hint: { type: 'candidates' },
        advanceOn: null,
      },
    ],
    // ── Step 3: Segment C → A ──
    [
      {
        instruction: `${drag} from C to A`,
        speech: isTouch
          ? 'Postulate 1 lets us draw a straight line from any point to any point. Draw the line from C to A.'
          : 'Postulate 1 lets us draw a straight line from any point to any point. Draw the line from C to A.',
        hint: { type: 'arrow', fromId: 'pt-C', toId: 'pt-A' },
        advanceOn: null,
      },
    ],
    // ── Step 4: Segment C → B ──
    [
      {
        instruction: `${drag} from C to B`,
        speech: isTouch
          ? 'Draw the line from C to B. Now CA = AB and CB = AB, so the triangle is equilateral.'
          : 'Draw the line from C to B. Now CA = AB and CB = AB, so the triangle is equilateral.',
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
        speech:
          'No matter where A moves, C stays on both circles, so CA and AB remain equal.',
      },
      {
        pointId: 'pt-B',
        speech: 'C stays the same distance from B as A is from B, so the triangle stays equilateral.',
      },
    ],
  },
}
