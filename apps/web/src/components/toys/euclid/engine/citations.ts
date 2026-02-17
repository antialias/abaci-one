import type { Citation } from './facts'

export interface CitationDef {
  /** Short key: "Post.1" */
  key: string
  /** Full label: "Postulate 1" */
  label: string
  /** The axiom/definition text in plain language */
  text: string
}

/**
 * Lookup from short citation keys used in step definitions
 * to full human-readable labels and axiom text.
 */
export const CITATIONS: Record<string, CitationDef> = {
  'Post.1': {
    key: 'Post.1',
    label: 'Postulate 1',
    text: 'A straight line can be drawn from any point to any point.',
  },
  'Post.2': {
    key: 'Post.2',
    label: 'Postulate 2',
    text: 'A finite straight line can be extended continuously in a straight line.',
  },
  'Post.3': {
    key: 'Post.3',
    label: 'Postulate 3',
    text: 'A circle can be drawn with any center and any radius.',
  },
  'Def.15': {
    key: 'Def.15',
    label: 'Definition 15',
    text: 'All radii of a circle are equal.',
  },
  'C.N.1': {
    key: 'C.N.1',
    label: 'Common Notion 1',
    text: 'Things equal to the same thing are also equal to one another.',
  },
  'C.N.3': {
    key: 'C.N.3',
    label: 'Common Notion 3',
    text: 'If equals are subtracted from equals, the remainders are equal.',
  },
  'I.1': {
    key: 'I.1',
    label: 'Proposition I.1',
    text: 'An equilateral triangle can be constructed on any line segment.',
  },
  'I.2': {
    key: 'I.2',
    label: 'Proposition I.2',
    text: 'A line equal to a given line can be placed at any given point.',
  },
}

/** Get the citation def for a structured Citation from the fact engine. */
export function citationDefFromFact(citation: Citation): CitationDef | null {
  switch (citation.type) {
    case 'def15': return CITATIONS['Def.15']
    case 'cn1': return CITATIONS['C.N.1']
    case 'cn3': return CITATIONS['C.N.3']
    case 'prop': return CITATIONS[`I.${citation.propId}`] ?? null
  }
}
