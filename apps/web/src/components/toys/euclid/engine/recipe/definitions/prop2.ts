import type { ConstructionRecipe, OpAnnotations } from '../types'

/**
 * Recipe for Proposition I.2: Place at a given point a line equal to a given line.
 *
 * inputs: [B (seg-from), C (seg-to), A (target)]
 * ops:
 *   join-AB:    segment A → B                          (Post.1)
 *   apply-I1:   apply I.1 on [A,B], outputs {C:'D'}    (By I.1)
 *   circle-BC:  circle center B, radiusPoint C          (Post.3)
 *   produce-E:  produce from D through B until circle-BC (Post.2+Def.15)
 *   circle-DE:  circle center D, radiusPoint E          (Post.3)
 *   produce-F:  produce from D through A until circle-DE (Post.2+Def.15)
 *   seg-AF:     segment A → F                           (Post.1, export-only)
 *
 * exports: F (point, key:'result'), seg-AF
 *
 * degenerate: when A ≡ B → simplified ops
 */
export const RECIPE_PROP_2: ConstructionRecipe = {
  propId: 2,
  label: 'Transfer distance (I.2)',
  inputSlots: [
    { ref: 'B', role: 'seg-from', label: 'Segment start', givenId: 'pt-B' },
    { ref: 'C', role: 'seg-to', label: 'Segment end', givenId: 'pt-C' },
    { ref: 'A', role: 'target', label: 'Target point', givenId: 'pt-A' },
  ],
  distinctInputPairs: [
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  ops: [
    { kind: 'segment', id: 'join-AB', from: 'A', to: 'B' },
    { kind: 'apply', id: 'apply-I1', recipeId: 1, inputs: ['A', 'B'], outputs: { C: 'D' } },
    { kind: 'circle', id: 'circle-BC', center: 'B', radiusPoint: 'C' },
    { kind: 'produce', id: 'produce-E', from: 'D', through: 'B', until: 'circle-BC', output: 'E' },
    { kind: 'circle', id: 'circle-DE', center: 'D', radiusPoint: 'E' },
    { kind: 'produce', id: 'produce-F', from: 'D', through: 'A', until: 'circle-DE', output: 'F' },
    { kind: 'segment', id: 'seg-AF', from: 'A', to: 'F' },
  ],
  exports: [
    { ref: 'F', kind: 'point', outputLabelKey: 'result' },
    { ref: 'seg-AF', kind: 'segment' },
  ],
  facts: [
    {
      kind: 'distance',
      left: { a: 'B', b: 'E' },
      right: { a: 'B', b: 'C' },
      citation: { type: 'def15', circleOpId: 'circle-BC' },
      statementTemplate: '{B}{E} = {B}{C}',
      justificationTemplate: 'Def.15: {E} lies on circle centered at {B} through {C}',
    },
    {
      kind: 'distance',
      left: { a: 'D', b: 'F' },
      right: { a: 'D', b: 'E' },
      citation: { type: 'def15', circleOpId: 'circle-DE' },
      statementTemplate: '{D}{F} = {D}{E}',
      justificationTemplate: 'Def.15: {F} lies on circle centered at {D} through {E}',
    },
    {
      kind: 'distance',
      left: { a: 'D', b: 'A' },
      right: { a: 'D', b: 'B' },
      citation: { type: 'prop', propId: 1 },
      statementTemplate: '{D}{A} = {D}{B}',
      justificationTemplate: 'I.1: equilateral triangle on {A}{B}',
    },
    {
      kind: 'distance',
      left: { a: 'A', b: 'F' },
      right: { a: 'B', b: 'E' },
      citation: { type: 'cn3', whole: { a: 'D', b: 'F' }, part: { a: 'D', b: 'A' } },
      statementTemplate: '{A}{F} = {B}{E}',
      justificationTemplate:
        'C.N.3: If equals are subtracted from equals, the remainders are equal. Since {D}{F} = {D}{E} and {D}{A} = {D}{B}, {A}{F} = {B}{E}.',
    },
    {
      kind: 'distance',
      left: { a: 'A', b: 'F' },
      right: { a: 'B', b: 'C' },
      citation: { type: 'cn1', via: { a: 'B', b: 'E' } },
      statementTemplate: '{A}{F} = {B}{C}',
      justificationTemplate:
        'C.N.1: Things which equal the same thing also equal one another. Since {A}{F} = {B}{E} and {B}{E} = {B}{C}, {A}{F} = {B}{C}.',
    },
  ],
  ceremony: {
    revealGroups: [
      ['join-AB'],
      ['apply-I1', 'circle-BC', 'produce-E'],
      ['circle-DE'],
      ['produce-F', 'seg-AF'],
    ],
    narrationTemplate:
      'The segment at {A} now equals {B}{C} — that is what Proposition two proves.',
  },
  degenerateCases: [
    {
      condition: { coincident: ['A', 'B'] },
      ops: [
        // When target = segFrom, circle at B through C, then produce F using fallback direction
        // (A=B so computeDirectionVector falls back to (0,1), matching old behavior)
        { kind: 'circle', id: 'circle-BC', center: 'B', radiusPoint: 'C' },
        {
          kind: 'produce',
          id: 'produce-F-degen',
          from: 'A',
          through: 'B',
          until: 'circle-BC',
          output: 'F',
        },
        { kind: 'segment', id: 'seg-AF', from: 'A', to: 'F' },
      ],
    },
  ],
}

/**
 * Annotations for I.2 steps — keyed by op ID.
 * 'seg-AF' is export-only (no student action), so no annotation.
 */
export const PROP_2_ANNOTATIONS: OpAnnotations = {
  'join-AB': {
    instruction: 'Join point {pt:A} to point {pt:B}',
    tool: 'straightedge',
    citation: 'Post.1',
    highlightIds: ['pt-A', 'pt-B'],
  },
  'apply-I1': {
    instruction: 'Construct equilateral triangle on {seg:AB} ({prop:1|I.1})',
    tool: 'macro',
    citation: 'I.1',
    highlightIds: ['pt-A', 'pt-B'],
  },
  'circle-BC': {
    instruction: 'Draw a circle centered at {pt:B} through {pt:C}',
    tool: 'compass',
    citation: 'Post.3',
    highlightIds: ['pt-B', 'pt-C'],
  },
  'produce-E': {
    instruction: 'From {pt:D}, extend through {pt:B} to meet the circle at {pt:E}',
    tool: 'straightedge',
    citation: 'Post.2',
    highlightIds: ['pt-D', 'pt-B'],
    expectedOverride: {
      type: 'extend',
      baseId: 'pt-D',
      throughId: 'pt-B',
      label: 'E',
    },
  },
  'circle-DE': {
    instruction: 'Draw a circle centered at {pt:D} through {pt:E}',
    tool: 'compass',
    citation: 'Post.3',
    highlightIds: ['pt-D', 'pt-E'],
  },
  'produce-F': {
    instruction: 'From {pt:D}, extend through {pt:A} to meet the circle at {pt:F}',
    tool: 'straightedge',
    citation: 'Post.2',
    highlightIds: ['pt-D', 'pt-A'],
    expectedOverride: {
      type: 'extend',
      baseId: 'pt-D',
      throughId: 'pt-A',
      label: 'F',
    },
  },
  // 'seg-AF' intentionally has NO annotation — it's an export-only op
}
