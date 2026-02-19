import type { PropositionDef, ConstructionElement, TutorialSubStep } from '../types'
import { BYRNE } from '../types'

function getProp3Tutorial(isTouch: boolean): TutorialSubStep[][] {
  const tap = isTouch ? 'Tap' : 'Click'
  const tapHold = isTouch ? 'Tap and hold' : 'Click and hold'
  const drag = isTouch ? 'Drag' : 'Drag'
  const sweep = isTouch ? 'Sweep your finger' : 'Move your mouse'

  return [
    // ── Step 0: Place at A a line equal to CD (I.2 macro) ──
    [
      {
        instruction: `${tap} point A`,
        speech: isTouch
          ? "We need to copy the length of line CD to point A. We'll use Proposition Two to do this. Tap point A first — that's where the copy goes."
          : "We need to copy the length of line CD to point A. We'll use Proposition Two to do this. Click point A first — that's where the copy goes.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'macro-select', index: 0 },
      },
      {
        instruction: `${tap} point C`,
        speech: isTouch
          ? 'Now tap point C — the start of the shorter line.'
          : 'Now click point C — the start of the shorter line.',
        hint: { type: 'point', pointId: 'pt-C' },
        advanceOn: { kind: 'macro-select', index: 1 },
      },
      {
        instruction: `${tap} point D`,
        speech: isTouch
          ? 'Now tap point D to finish. This tells Proposition Two which line to copy.'
          : 'Now click point D to finish. This tells Proposition Two which line to copy.',
        hint: { type: 'point', pointId: 'pt-D' },
        advanceOn: null,
      },
    ],
    // ── Step 1: Draw circle centered at A through E ──
    [
      {
        instruction: `${tapHold} point A`,
        speech: isTouch
          ? "Now we'll use the compass. The new point E is exactly as far from A as CD is long. Press and hold on A."
          : "Now we'll use the compass. Point E is exactly as far from A as CD is long. Click and hold on A.",
        hint: { type: 'point', pointId: 'pt-A' },
        advanceOn: { kind: 'compass-phase', phase: 'center-set' },
      },
      {
        instruction: `${drag} to point E`,
        speech: isTouch
          ? 'Drag to point E — this sets the compass to the length we copied.'
          : 'Drag to point E — this sets the compass to the copied length.',
        hint: { type: 'arrow', fromId: 'pt-A', toId: 'pt-E' },
        advanceOn: { kind: 'compass-phase', phase: 'radius-set' },
      },
      {
        instruction: `${sweep} around`,
        speech: isTouch
          ? 'Sweep around to draw the circle!'
          : 'Move around to draw the circle!',
        hint: { type: 'sweep', centerId: 'pt-A', radiusPointId: 'pt-E' },
        advanceOn: null,
      },
    ],
    // ── Step 2: Mark where circle crosses AB → pt-F ──
    [
      {
        instruction: `${tap} where the circle crosses line AB`,
        speech:
          "See where the circle crosses line AB? Tap that intersection point. The line from A to that point is exactly the same length as CD — that's what we wanted to cut off!",
        hint: {
          type: 'candidates',
          ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-E' },
          ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-B' },
        },
        advanceOn: null,
      },
    ],
  ]
}

/**
 * Proposition I.3: Given two unequal straight lines, to cut off from
 * the greater a straight line equal to the less.
 *
 * Given: Segment AB (longer, horizontal), segment CD (shorter, below-right)
 *
 * Construction:
 * 0. Place at A a line equal to CD           (I.2 macro)  → pt-E, seg-AE
 * 1. Draw circle centered at A through E     (Post.3)
 * 2. Mark where circle crosses AB            (Def.15)     → pt-F
 *
 * Result: AF = CD
 *
 * The proof chain:
 *   AE = CD  (I.2, from macro)
 *   AF = AE  (Def.15, F on circle(A,E))
 *   AF = CD  (C.N.1, transitive via union-find)
 */
export const PROP_3: PropositionDef = {
  id: 3,
  title: 'Cut off from the greater a line equal to the less',
  draggablePointIds: ['pt-A', 'pt-B', 'pt-C', 'pt-D'],
  resultSegments: [
    { fromId: 'pt-A', toId: 'pt-F' },
  ],
  givenElements: [
    {
      kind: 'point',
      id: 'pt-A',
      x: -2.5,
      y: 0.5,
      label: 'A',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-B',
      x: 1.5,
      y: 0.5,
      label: 'B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-C',
      x: 0.5,
      y: -1.5,
      label: 'C',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-D',
      x: 2.0,
      y: -1.5,
      label: 'D',
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
      id: 'seg-CD',
      fromId: 'pt-C',
      toId: 'pt-D',
      color: BYRNE.given,
      origin: 'given',
    },
  ] as ConstructionElement[],
  steps: [
    // 0. Place at A a line equal to CD (I.2 macro)
    {
      instruction: 'Place at A a line equal to CD (I.2)',
      expected: {
        type: 'macro',
        propId: 2,
        inputPointIds: ['pt-A', 'pt-C', 'pt-D'],
        outputLabels: { result: 'E' },
      },
      highlightIds: ['pt-A', 'pt-C', 'pt-D'],
      tool: 'macro',
      citation: 'I.2',
    },
    // 1. Draw circle centered at A through E
    {
      instruction: 'Draw a circle centered at A through E',
      expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-E' },
      highlightIds: ['pt-A', 'pt-E'],
      tool: 'compass',
      citation: 'Post.3',
    },
    // 2. Mark where circle crosses AB → pt-F
    {
      instruction: 'Mark where the circle crosses line AB',
      expected: {
        type: 'intersection',
        ofA: { kind: 'circle', centerId: 'pt-A', radiusPointId: 'pt-E' },
        ofB: { kind: 'segment', fromId: 'pt-A', toId: 'pt-B' },
        label: 'F',
      },
      highlightIds: [],
      tool: null,
      citation: 'Def.15',
    },
  ],
  getTutorial: getProp3Tutorial,
  explorationNarration: {
    introSpeech:
      'You cut off an equal piece! Try dragging all four points to see how the construction adapts.',
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'See how the cut-off piece still matches the shorter segment? It works wherever A goes.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch what happens as AB changes length. What if it gets really short?',
      },
      {
        pointId: 'pt-C',
        speech:
          'See the cut adjusting? It always matches the shorter line exactly.',
      },
      {
        pointId: 'pt-D',
        speech:
          'Watch the circle adjust. The cut-off piece stays equal no matter what.',
      },
    ],
    breakdownTip:
      'Oh! The shorter line became longer than the other one. Euclid said we need to cut from the greater — when that rule breaks, the construction falls apart!',
  },
}
