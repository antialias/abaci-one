import type { PropositionDef, ConstructionElement } from '../types'
import { BYRNE } from '../types'

/**
 * Proposition I.4 — SAS Congruence (Theorem)
 *
 * If two triangles have two sides equal to two sides respectively,
 * and have the angles contained by the equal straight lines equal,
 * then they also have the base equal to the base, the triangle equals
 * the triangle, and the remaining angles equal the remaining angles.
 *
 * Setup: Two triangles ABC (left) and DEF (right).
 *   Given: AB = DE, AC = DF, ∠BAC = ∠EDF
 *   Triangle DEF is missing segment EF.
 *   The user draws EF, and C.N.4 (superposition) derives BC = EF.
 *
 * Coordinates are constructed so that the equalities hold exactly:
 *   DEF is formed by rotating the vectors (B−A) and (C−A) by angle θ
 *   and translating to D.
 */

// Triangle ABC (left side)
const A = { x: -4, y: -0.5 }
const B = { x: -6.2, y: -1.5 }
const C = { x: -2.8, y: 1.8 }

// Triangle DEF (right side) — constructed to guarantee SAS equality
// Rotate vectors (B-A) and (C-A) by θ and translate to D
const D = { x: 2.5, y: -0.5 }
const theta = 0.4 // rotation angle in radians
const cosT = Math.cos(theta)
const sinT = Math.sin(theta)

// Rotate (B-A) by θ
const baDx = B.x - A.x
const baDy = B.y - A.y
const E = {
  x: D.x + cosT * baDx - sinT * baDy,
  y: D.y + sinT * baDx + cosT * baDy,
}

// Rotate (C-A) by θ
const caDx = C.x - A.x
const caDy = C.y - A.y
const F = {
  x: D.x + cosT * caDx - sinT * caDy,
  y: D.y + sinT * caDx + cosT * caDy,
}

export const PROP_4: PropositionDef = {
  id: 4,
  title: 'If two triangles have two sides and the included angle equal, the triangles are congruent',
  kind: 'theorem',
  resultSegments: [
    { fromId: 'pt-B', toId: 'pt-C' },
    { fromId: 'pt-E', toId: 'pt-F' },
  ],
  givenFacts: [
    {
      left: { a: 'pt-A', b: 'pt-B' },
      right: { a: 'pt-D', b: 'pt-E' },
      statement: 'AB = DE',
    },
    {
      left: { a: 'pt-A', b: 'pt-C' },
      right: { a: 'pt-D', b: 'pt-F' },
      statement: 'AC = DF',
    },
  ],
  givenAngles: [
    { spec: { vertex: 'pt-A', ray1End: 'pt-B', ray2End: 'pt-C' }, color: BYRNE.red },
    { spec: { vertex: 'pt-D', ray1End: 'pt-E', ray2End: 'pt-F' }, color: BYRNE.red },
  ],
  equalAngles: [
    [
      { vertex: 'pt-A', ray1End: 'pt-B', ray2End: 'pt-C' },
      { vertex: 'pt-D', ray1End: 'pt-E', ray2End: 'pt-F' },
    ],
  ],
  theoremConclusion: '△ABC = △DEF\n∠ABC = ∠DEF, ∠ACB = ∠DFE',
  superpositionFlash: {
    pairs: [
      { src: 'pt-A', tgt: 'pt-D' },
      { src: 'pt-B', tgt: 'pt-E' },
      { src: 'pt-C', tgt: 'pt-F' },
    ],
    triA: ['pt-A', 'pt-B', 'pt-C'],
    triB: ['pt-D', 'pt-E', 'pt-F'],
  },
  givenElements: [
    // Triangle ABC — all 3 points + 3 segments
    { kind: 'point', id: 'pt-A', x: A.x, y: A.y, label: 'A', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-B', x: B.x, y: B.y, label: 'B', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-C', x: C.x, y: C.y, label: 'C', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-AB', fromId: 'pt-A', toId: 'pt-B', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-AC', fromId: 'pt-A', toId: 'pt-C', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-BC', fromId: 'pt-B', toId: 'pt-C', color: BYRNE.given, origin: 'given' },
    // Triangle DEF — 3 points + 2 segments (EF missing — user draws it)
    { kind: 'point', id: 'pt-D', x: D.x, y: D.y, label: 'D', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-E', x: E.x, y: E.y, label: 'E', color: BYRNE.given, origin: 'given' },
    { kind: 'point', id: 'pt-F', x: F.x, y: F.y, label: 'F', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-DE', fromId: 'pt-D', toId: 'pt-E', color: BYRNE.given, origin: 'given' },
    { kind: 'segment', id: 'seg-DF', fromId: 'pt-D', toId: 'pt-F', color: BYRNE.given, origin: 'given' },
  ] as ConstructionElement[],
  steps: [
    {
      instruction: 'Join E to F',
      expected: { type: 'straightedge', fromId: 'pt-E', toId: 'pt-F' },
      highlightIds: ['pt-E', 'pt-F'],
      tool: 'straightedge',
      citation: 'Post.1',
    },
  ],
}
