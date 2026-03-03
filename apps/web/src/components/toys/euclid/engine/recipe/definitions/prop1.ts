import type { ConstructionRecipe, OpAnnotations } from '../types'

/**
 * Recipe for Proposition I.1: Construct an equilateral triangle on a given line.
 *
 * inputs: [A (endpoint-a), B (endpoint-b)]
 * ops:
 *   circle-A: circle center A, radiusPoint B         (Post.3)
 *   circle-B: circle center B, radiusPoint A         (Post.3)
 *   apex:     intersection of circle-A and circle-B   (Def.15)
 *   seg-CA:   segment C → A                          (Post.1)
 *   seg-CB:   segment C → B                          (Post.1)
 *
 * exports: C (point, key:'apex'), seg-CA, seg-CB
 */
export const RECIPE_PROP_1: ConstructionRecipe = {
  propId: 1,
  label: 'Equilateral triangle (I.1)',
  inputSlots: [
    { ref: 'A', role: 'endpoint-a', label: 'First endpoint', givenId: 'pt-A' },
    { ref: 'B', role: 'endpoint-b', label: 'Second endpoint', givenId: 'pt-B' },
  ],
  distinctInputPairs: [[0, 1]],
  ops: [
    { kind: 'circle', id: 'circle-A', center: 'A', radiusPoint: 'B' },
    { kind: 'circle', id: 'circle-B', center: 'B', radiusPoint: 'A' },
    {
      kind: 'intersection',
      id: 'apex',
      of: ['circle-A', 'circle-B'],
      prefer: 'upper',
      output: 'C',
    },
    { kind: 'segment', id: 'seg-CA', from: 'C', to: 'A' },
    { kind: 'segment', id: 'seg-CB', from: 'C', to: 'B' },
  ],
  exports: [
    { ref: 'C', kind: 'point', outputLabelKey: 'apex' },
    { ref: 'seg-CA', kind: 'segment' },
    { ref: 'seg-CB', kind: 'segment' },
  ],
  facts: [
    {
      kind: 'distance',
      left: { a: 'A', b: 'C' },
      right: { a: 'A', b: 'B' },
      citation: { type: 'def15', circleOpId: 'circle-A' },
      statementTemplate: '{A}{C} = {A}{B}',
      justificationTemplate: 'Def.15: {C} lies on circle centered at {A} through {B}',
    },
    {
      kind: 'distance',
      left: { a: 'B', b: 'C' },
      right: { a: 'B', b: 'A' },
      citation: { type: 'def15', circleOpId: 'circle-B' },
      statementTemplate: '{B}{C} = {B}{A}',
      justificationTemplate: 'Def.15: {C} lies on circle centered at {B} through {A}',
    },
  ],
  ceremony: {
    revealGroups: [['circle-A'], ['circle-B']],
    narrationTemplate:
      '{C}{A} equals {C}{B} — the triangle is equilateral. That is what Proposition one gives us.',
  },
}

/**
 * Annotations for I.1 steps — keyed by op ID.
 * Ops without annotations are skipped in step derivation.
 */
export const PROP_1_ANNOTATIONS: OpAnnotations = {
  'circle-A': {
    instruction: 'Draw a circle centered at {pt:A} through {pt:B}',
    tool: 'compass',
    citation: 'Post.3',
    highlightIds: ['pt-A', 'pt-B'],
  },
  'circle-B': {
    instruction: 'Draw a circle centered at {pt:B} through {pt:A}',
    tool: 'compass',
    citation: 'Post.3',
    highlightIds: ['pt-B', 'pt-A'],
  },
  apex: {
    instruction: 'Mark the point where the circles meet',
    tool: null,
    citation: 'Def.15',
    expectedOverride: { type: 'intersection', label: 'C' },
  },
  'seg-CA': {
    instruction: 'Draw a line from {pt:C} to {pt:A}',
    tool: 'straightedge',
    citation: 'Post.1',
    highlightIds: ['pt-C', 'pt-A'],
  },
  'seg-CB': {
    instruction: 'Draw a line from {pt:C} to {pt:B}',
    tool: 'straightedge',
    citation: 'Post.1',
    highlightIds: ['pt-C', 'pt-B'],
  },
}
