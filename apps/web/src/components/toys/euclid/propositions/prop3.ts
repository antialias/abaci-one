import type { PropositionDef, ConstructionElement } from '../types'
import { BYRNE } from '../types'

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
}
