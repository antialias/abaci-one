import type { PropositionDef, ConstructionElement } from '../types'
import { BYRNE } from '../types'

/**
 * Proposition I.1: On a given finite straight line to construct
 * an equilateral triangle.
 */
export const PROP_1: PropositionDef = {
  id: 1,
  title: 'Construct an equilateral triangle on a given line',
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
}
