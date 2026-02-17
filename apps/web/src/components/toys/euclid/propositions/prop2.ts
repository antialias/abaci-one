import type { PropositionDef, ConstructionElement } from '../types'
import { BYRNE } from '../types'

/**
 * Proposition I.2: To place at a given point a straight line equal
 * to a given straight line.
 *
 * Given: Point A (the point), segment BC (the line to copy)
 *
 * Construction (following Byrne/Heath):
 * 1. Join A to B                         (Post.1)
 * 2–4. Construct equilateral △ ABD on AB  (I.1)
 * 5–6. Draw segments DA and DB            (completing triangle / lines to produce)
 * 7. Circle at B through C               (Post.3) — meets extension of DB at E
 * 8. Mark E (what Euclid calls G)
 * 9. Circle at D through E               (Post.3) — meets extension of DA at F
 * 10. Mark F (what Euclid calls L)
 *
 * Result: AF = BC
 *
 * Element IDs at each step (given: pt-A, pt-B, pt-C, seg-BC):
 *   Step 1 → seg-2 (AB)        [seg-BC is seg count 1]
 *   Step 2 → cir-1 (circle A,B)
 *   Step 3 → cir-2 (circle B,A)
 *   Step 4 → pt-D  (intersection)
 *   Step 5 → seg-3 (DA)
 *   Step 6 → seg-4 (DB)
 *   Step 7 → cir-3 (circle B,C)
 *   Step 8 → pt-E  (G in Euclid — on extension of DB beyond B)
 *   Step 9 → cir-4 (circle D,E)
 *   Step 10→ pt-F  (L in Euclid — on extension of DA beyond A)
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
    },
    // 2. Circle at A through B (I.1 step 1)
    {
      instruction: 'Draw a circle centered at A through B',
      expected: { type: 'compass', centerId: 'pt-A', radiusPointId: 'pt-B' },
      highlightIds: ['pt-A', 'pt-B'],
      tool: 'compass',
    },
    // 3. Circle at B through A (I.1 step 2)
    {
      instruction: 'Draw a circle centered at B through A',
      expected: { type: 'compass', centerId: 'pt-B', radiusPointId: 'pt-A' },
      highlightIds: ['pt-B', 'pt-A'],
      tool: 'compass',
    },
    // 4. Mark intersection D (I.1 step 3)
    {
      instruction: 'Mark the point where the circles meet',
      expected: { type: 'intersection', ofA: 'cir-1', ofB: 'cir-2' },
      highlightIds: [],
      tool: null,
    },
    // 5. Segment D → A
    {
      instruction: 'Draw a line from D to A',
      expected: { type: 'straightedge', fromId: 'pt-D', toId: 'pt-A' },
      highlightIds: ['pt-D', 'pt-A'],
      tool: 'straightedge',
    },
    // 6. Segment D → B
    {
      instruction: 'Draw a line from D to B',
      expected: { type: 'straightedge', fromId: 'pt-D', toId: 'pt-B' },
      highlightIds: ['pt-D', 'pt-B'],
      tool: 'straightedge',
    },
    // 7. Circle at B through C
    {
      instruction: 'Draw a circle centered at B through C',
      expected: { type: 'compass', centerId: 'pt-B', radiusPointId: 'pt-C' },
      highlightIds: ['pt-B', 'pt-C'],
      tool: 'compass',
    },
    // 8. Mark intersection E (Euclid's G — on extension of DB beyond B)
    {
      instruction: 'Mark where the circle crosses line DB, past B',
      expected: { type: 'intersection', ofA: 'cir-3', ofB: 'seg-4', beyondId: 'pt-B' },
      highlightIds: [],
      tool: null,
    },
    // 9. Circle at D through E
    {
      instruction: 'Draw a circle centered at D through E',
      expected: { type: 'compass', centerId: 'pt-D', radiusPointId: 'pt-E' },
      highlightIds: ['pt-D', 'pt-E'],
      tool: 'compass',
    },
    // 10. Mark intersection F (Euclid's L — on extension of DA beyond A)
    {
      instruction: 'Mark where the circle crosses line DA, past A',
      expected: { type: 'intersection', ofA: 'cir-4', ofB: 'seg-3', beyondId: 'pt-A' },
      highlightIds: [],
      tool: null,
    },
  ],
}
