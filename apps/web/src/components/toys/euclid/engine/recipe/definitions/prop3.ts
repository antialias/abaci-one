import type { ConstructionRecipe, OpAnnotations } from '../types'

/**
 * Recipe for Proposition I.3: Cut off from the greater a line equal to the less.
 *
 * inputs: [A (cut-point), B (target-point), C (seg-from), D (seg-to)]
 * ops:
 *   apply-I2:   apply I.2 on [C,D,A], outputs {F:'E'}  (By I.2)
 *   circle-AE:  circle center A, radiusPoint E          (Post.3)
 *   produce-F:  produce from A through B until circle-AE (Post.2+Def.15)
 *
 * exports: F (point, key:'result')
 */
export const RECIPE_PROP_3: ConstructionRecipe = {
  propId: 3,
  label: 'Cut off equal (I.3)',
  inputSlots: [
    { ref: 'A', role: 'greater-from', label: 'Start of greater', givenId: 'pt-A' },
    { ref: 'B', role: 'greater-to', label: 'End of greater', givenId: 'pt-B' },
    { ref: 'C', role: 'less-from', label: 'Start of less', givenId: 'pt-C' },
    { ref: 'D', role: 'less-to', label: 'End of less', givenId: 'pt-D' },
  ],
  distinctInputPairs: [
    [0, 1],
    [2, 3],
  ],
  ops: [
    { kind: 'apply', id: 'apply-I2', recipeId: 2, inputs: ['C', 'D', 'A'], outputs: { F: 'E' } },
    { kind: 'circle', id: 'circle-AE', center: 'A', radiusPoint: 'E' },
    {
      kind: 'intersection',
      id: 'find-F',
      of: ['circle-AE', { segmentRefs: ['A', 'B'] }],
      prefer: 'upper',
      output: 'F',
    },
  ],
  exports: [{ ref: 'F', kind: 'point', outputLabelKey: 'result' }],
  facts: [
    {
      kind: 'distance',
      left: { a: 'A', b: 'E' },
      right: { a: 'C', b: 'D' },
      citation: { type: 'prop', propId: 2 },
      statementTemplate: '{A}{E} = {C}{D}',
      justificationTemplate: 'I.2: placed at {A} a line equal to {C}{D}',
    },
    {
      kind: 'distance',
      left: { a: 'A', b: 'F' },
      right: { a: 'A', b: 'E' },
      citation: { type: 'def15', circleOpId: 'circle-AE' },
      statementTemplate: '{A}{F} = {A}{E}',
      justificationTemplate: 'Def.15: {F} lies on circle centered at {A} through {E}',
    },
    {
      kind: 'distance',
      left: { a: 'A', b: 'F' },
      right: { a: 'C', b: 'D' },
      citation: { type: 'cn1', via: { a: 'A', b: 'E' } },
      statementTemplate: '{A}{F} = {C}{D}',
      justificationTemplate:
        'C.N.1: Things which equal the same thing also equal one another. Since {A}{F} = {A}{E} and {A}{E} = {C}{D}, {A}{F} = {C}{D}.',
    },
  ],
  ceremony: {
    revealGroups: [['apply-I2', 'circle-AE'], ['find-F']],
    narrationTemplate:
      'The circle marks the cut — {A}{F} equals {C}{D}. That is what Proposition three proves.',
  },
  degenerateCases: [
    {
      // When A ≡ C, swap C/D in I.2 application to avoid degenerate triangle
      condition: { coincident: ['A', 'C'] },
      ops: [
        {
          kind: 'apply',
          id: 'apply-I2',
          recipeId: 2,
          inputs: ['D', 'C', 'A'],
          outputs: { F: 'E' },
        },
        { kind: 'circle', id: 'circle-AE', center: 'A', radiusPoint: 'E' },
        {
          kind: 'intersection',
          id: 'find-F',
          of: ['circle-AE', { segmentRefs: ['A', 'B'] }],
          prefer: 'upper',
          output: 'F',
        },
      ],
    },
  ],
}

/**
 * Annotations for I.3 steps — keyed by op ID.
 */
export const PROP_3_ANNOTATIONS: OpAnnotations = {
  'apply-I2': {
    instruction: 'Place at {pt:A} a line equal to {seg:CD} ({prop:2|I.2})',
    tool: 'macro',
    citation: 'I.2',
    highlightIds: ['pt-A', 'pt-C', 'pt-D'],
  },
  'circle-AE': {
    instruction: 'Draw a circle centered at {pt:A} through {pt:E}',
    tool: 'compass',
    citation: 'Post.3',
    highlightIds: ['pt-A', 'pt-E'],
  },
  'find-F': {
    instruction: 'Mark where the circle crosses line {seg:AB}',
    tool: null,
    citation: 'Def.15',
  },
}
