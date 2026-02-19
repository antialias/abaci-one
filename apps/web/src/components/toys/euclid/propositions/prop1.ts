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
          ? "Let's draw a circle! Press and hold on point A. That's where your compass goes."
          : "Let's draw a circle! Click and hold on point A. That's where your compass goes.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point B`,
        speech: isTouch
          ? 'Now drag your finger over to point B. This sets how big the circle will be.'
          : 'Now drag over to point B while holding the button. This sets the circle size.',
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} all the way around`,
        speech: isTouch
          ? 'Now sweep your finger all the way around to draw the circle. Just like a real compass!'
          : 'Now move your mouse all the way around in a big circle. Just like a real compass!',
        hint: { type: 'sweep', centerId: 'pt-A', radiusPointId: 'pt-B' },
        advanceOn: null,
      },
    ],
    // ── Step 1: Circle centered at B through A ──
    [
      {
        instruction: `${tapHold} point B`,
        speech: isTouch
          ? "Great! Now let's make another circle. This time, press and hold on point B."
          : "Great! Now let's make another circle. This time, click and hold on point B.",
        hint: { type: 'point', pointId: 'pt-B' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point A`,
        speech: isTouch
          ? 'Drag over to point A.'
          : 'Drag over to point A.',
        hint: { type: 'arrow', fromId: 'pt-B', toId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around again`,
        speech: isTouch
          ? 'Sweep all the way around again!'
          : 'Move all the way around again!',
        hint: { type: 'sweep', centerId: 'pt-B', radiusPointId: 'pt-A' },
        advanceOn: null,
      },
    ],
    // ── Step 2: Mark intersection ──
    [
      {
        instruction: `${tap} where the circles cross`,
        speech: 'See where the two circles cross each other? Tap on that point to mark it.',
        hint: { type: 'candidates' },
        advanceOn: null,
      },
    ],
    // ── Step 3: Segment C → A ──
    [
      {
        instruction: `${drag} from C to A`,
        speech: isTouch
          ? "Now we'll draw straight lines to finish the triangle. Put your finger on point C and drag it to point A."
          : "Now we'll draw straight lines to finish the triangle. Click point C and drag to point A.",
        hint: { type: 'arrow', fromId: 'pt-C', toId: 'pt-A' },
        advanceOn: null,
      },
    ],
    // ── Step 4: Segment C → B ──
    [
      {
        instruction: `${drag} from C to B`,
        speech: isTouch
          ? 'One more line! Drag from C to B to complete the triangle.'
          : 'One more line! Click C and drag to B to finish.',
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
      'You built an equilateral triangle! Now try dragging point A or B to see that the construction always makes a perfect equilateral triangle, no matter where the points are.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how all three sides stay equal? The triangle changes, but it always stays equilateral.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch the triangle get bigger and smaller. It always stays equilateral!',
      },
    ],
  },
}
