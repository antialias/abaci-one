import type { PropositionDef, ConstructionElement } from '../types'
import { BYRNE } from '../types'

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
  extendSegments: true,
  completionMessage: 'Line segment placed! AF = BC',
  resultSegments: [
    { fromId: 'pt-A', toId: 'pt-F' },
  ],
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
      expected: { type: 'macro', propId: 1, inputPointIds: ['pt-A', 'pt-B'] },
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
    {
      instruction: 'Mark where the circle crosses line DB, past B',
      expected: { type: 'intersection', ofA: 'cir-1', ofB: 'seg-4', beyondId: 'pt-B' },
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
      expected: { type: 'intersection', ofA: 'cir-2', ofB: 'seg-3', beyondId: 'pt-A' },
      highlightIds: [],
      tool: null,
      citation: 'Def.15',
    },
  ],
}
