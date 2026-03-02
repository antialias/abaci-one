import type { PropositionDef, TutorialSubStep } from '../types'
import { BYRNE } from '../types'
import { computeProp5GivenElements } from './prop5'
import type { FactStore } from '../engine/factStore'
import { addAngleFact } from '../engine/factStore'
import type { ConstructionState } from '../types'
import type { ProofFact } from '../engine/facts'
import { angleMeasure } from '../engine/facts'

// ── Default positions (same as canonical proof) ──
const DEFAULT_A = { x: 0, y: 2 }
const DEFAULT_B = { x: -2, y: -1 }
const DEFAULT_C = { x: 2, y: -1 }

function getPappusTutorial(): TutorialSubStep[][] {
  return [
    // Step 0: observation — consider the correspondence
    [
      {
        instruction: 'Consider: {pt:A} maps to {pt:A}, {pt:B} maps to {pt:C}, {pt:C} maps to {pt:B}',
        speech:
          "Pappus has a beautiful idea. Instead of building auxiliary lines, he applies the triangle to itself. Consider the correspondence where A stays fixed, but B and C swap places.",
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
    // Step 1: observation — first pair of equal sides
    [
      {
        instruction: '{seg:AB} = {seg:AC} — the first pair of equal sides',
        speech:
          'Under this correspondence, side AB maps to side AC. But we know AB equals AC — that\'s given. So the first pair of sides match.',
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
    // Step 2: observation — included angle is the same
    [
      {
        instruction: '{ang:BAC} = {ang:CAB} — the same angle',
        speech:
          'The included angle at A — angle BAC — maps to angle CAB. But that\'s the same angle, just written backwards! An angle always equals itself.',
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
    // Step 3: observation — SAS conclusion
    [
      {
        instruction: 'By {prop:4|I.4} (SAS): {tri:ABC} ≅ {tri:ACB}, so {ang:ABC} = {ang:ACB}',
        speech:
          'Two sides and the included angle match, so by Proposition I.4, triangle ABC is congruent to triangle ACB. The remaining angles must be equal: angle ABC equals angle ACB. The base angles are equal — with no construction at all!',
        hint: { type: 'none' as const },
        advanceOn: null,
      },
    ],
  ]
}

function derivePappusConclusion(
  store: FactStore,
  _state: ConstructionState,
  atStep: number
): ProofFact[] {
  // Pappus's proof: △ABC ≅ △ACB by I.4 (SAS)
  // Therefore ∠ABC = ∠ACB
  const angABC = angleMeasure('pt-B', 'pt-A', 'pt-C')
  const angACB = angleMeasure('pt-C', 'pt-A', 'pt-B')
  return addAngleFact(
    store,
    angABC,
    angACB,
    { type: 'prop', propId: 4 },
    '∠ABC = ∠ACB',
    'I.4: △ABC ≅ △ACB (AB = AC, ∠BAC = ∠CAB, AC = AB)',
    atStep
  )
}

/**
 * Proposition I.5 — Pappus's Proof (alternate)
 *
 * Pappus of Alexandria (~320 AD) proved Pons Asinorum with zero
 * auxiliary constructions by applying the triangle to itself with
 * a swapped B↔C correspondence, then citing I.4 (SAS).
 *
 * This proves only the base angles are equal (∠ABC = ∠ACB),
 * not the under-base angles (which require Euclid's construction).
 */
export const PROP_5_PAPPUS: PropositionDef = {
  id: 5,
  proofVariant: 'pappus',
  proofLabel: "Pappus's proof",
  proofDescription: 'Zero constructions — the triangle is congruent to itself',
  title: 'In isosceles triangles the base angles are equal',
  kind: 'theorem',
  givenFacts: [
    {
      left: { a: 'pt-A', b: 'pt-B' },
      right: { a: 'pt-A', b: 'pt-C' },
      statement: 'AB = AC',
    },
  ],
  givenAngles: [
    // Base angles only (blue) — Pappus doesn't prove under-base angles
    { spec: { vertex: 'pt-B', ray1End: 'pt-A', ray2End: 'pt-C' }, color: BYRNE.blue },
    { spec: { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-B' }, color: BYRNE.blue },
  ],
  equalAngles: [
    // Base angles: ∠ABC = ∠ACB (1 tick)
    [
      { vertex: 'pt-B', ray1End: 'pt-A', ray2End: 'pt-C' },
      { vertex: 'pt-C', ray1End: 'pt-A', ray2End: 'pt-B' },
    ],
  ],
  theoremConclusion: '∠ABC = ∠ACB',
  draggablePointIds: ['pt-A', 'pt-B'],
  computeGivenElements: computeProp5GivenElements,
  givenElements: [
    {
      kind: 'point',
      id: 'pt-A',
      x: DEFAULT_A.x,
      y: DEFAULT_A.y,
      label: 'A',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-B',
      x: DEFAULT_B.x,
      y: DEFAULT_B.y,
      label: 'B',
      color: BYRNE.given,
      origin: 'given',
    },
    {
      kind: 'point',
      id: 'pt-C',
      x: DEFAULT_C.x,
      y: DEFAULT_C.y,
      label: 'C',
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
      id: 'seg-AC',
      fromId: 'pt-A',
      toId: 'pt-C',
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
  ],
  steps: [
    {
      instruction: 'Consider the correspondence: {pt:A}\u2009\u2192\u2009{pt:A}, {pt:B}\u2009\u2192\u2009{pt:C}, {pt:C}\u2009\u2192\u2009{pt:B}',
      expected: { type: 'observation', id: 'obs-correspondence' },
      highlightIds: ['pt-A', 'pt-B', 'pt-C'],
      tool: null,
      observationSpeech:
        "Pappus applies the triangle to itself. Consider the correspondence where A stays fixed, but B and C swap places.",
    },
    {
      instruction: '{seg:AB} = {seg:AC} — first pair of equal sides',
      expected: { type: 'observation', id: 'obs-sides' },
      highlightIds: ['seg-AB', 'seg-AC'],
      tool: null,
      citation: 'Given',
      observationSpeech:
        'Under this correspondence, side AB maps to side AC. We know AB equals AC — that\'s given.',
    },
    {
      instruction: '{ang:BAC} = {ang:CAB} — the included angle is the same angle',
      expected: { type: 'observation', id: 'obs-angle' },
      highlightIds: ['pt-A'],
      tool: null,
      citation: 'C.N.4',
      observationSpeech:
        'The included angle at A — angle BAC — maps to angle CAB. An angle always equals itself.',
    },
    {
      instruction: 'By {prop:4|I.4}: {tri:ABC} ≅ {tri:ACB}, therefore {ang:ABC} = {ang:ACB}',
      expected: { type: 'observation', id: 'obs-conclusion' },
      highlightIds: ['pt-B', 'pt-C'],
      tool: null,
      citation: 'I.4',
      observationSpeech:
        'Two sides and the included angle match, so by Proposition I.4, triangle ABC is congruent to triangle ACB. The base angles are equal — with no construction at all!',
    },
  ],
  superpositionFlash: {
    pairs: [
      { src: 'pt-B', tgt: 'pt-C' },
      { src: 'pt-C', tgt: 'pt-B' },
    ],
    triA: ['pt-A', 'pt-B', 'pt-C'],
    triB: ['pt-A', 'pt-C', 'pt-B'],
  },
  getTutorial: getPappusTutorial,
  explorationNarration: {
    introSpeech:
      "Pappus's proof is wonderfully elegant — zero auxiliary constructions! By seeing the triangle as congruent to its own mirror image, the base angles must be equal. Try dragging the points to see this hold for every isosceles triangle.",
    pointTips: [
      {
        pointId: 'pt-A',
        speech:
          'However you move the apex, the triangle stays isosceles and the base angles stay equal. The symmetry is built in.',
      },
      {
        pointId: 'pt-B',
        speech:
          'Watch how C follows to maintain the isosceles property. The self-congruence always holds.',
      },
    ],
  },
  deriveConclusion: derivePappusConclusion,
}
