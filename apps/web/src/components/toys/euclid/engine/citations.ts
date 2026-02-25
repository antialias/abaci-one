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
    text: 'To draw a straight line from any point to any point.',
  },
  'Post.2': {
    key: 'Post.2',
    label: 'Postulate 2',
    text: 'To produce a finite straight line continuously in a straight line.',
  },
  'Post.3': {
    key: 'Post.3',
    label: 'Postulate 3',
    text: 'To describe a circle with any center and radius.',
  },
  'Def.15': {
    key: 'Def.15',
    label: 'Definition 15',
    text: 'A circle is a plane figure contained by one line such that all the straight lines falling upon it from one point among those lying within the figure equal one another.',
  },
  'C.N.1': {
    key: 'C.N.1',
    label: 'Common Notion 1',
    text: 'Things which equal the same thing also equal one another.',
  },
  'C.N.2': {
    key: 'C.N.2',
    label: 'Common Notion 2',
    text: 'If equals are added to equals, then the wholes are equal.',
  },
  'C.N.3': {
    key: 'C.N.3',
    label: 'Common Notion 3',
    text: 'If equals are subtracted from equals, then the remainders are equal.',
  },
  'I.1': {
    key: 'I.1',
    label: 'Proposition I.1',
    text: 'To construct an equilateral triangle on a given finite straight line.',
  },
  'I.2': {
    key: 'I.2',
    label: 'Proposition I.2',
    text: 'To place a straight line equal to a given straight line with one end at a given point.',
  },
  'C.N.4': {
    key: 'C.N.4',
    label: 'Common Notion 4',
    text: 'Things which coincide with one another equal one another.',
  },
  Given: {
    key: 'Given',
    label: 'Given',
    text: 'Stated as a hypothesis.',
  },
  'I.3': {
    key: 'I.3',
    label: 'Proposition I.3',
    text: 'From the greater of two given lines, cut off a part equal to the less.',
  },
  'I.4': {
    key: 'I.4',
    label: 'Proposition I.4',
    text: 'If two triangles have two sides and the included angle equal, the triangles are congruent.',
  },
  'I.5': {
    key: 'I.5',
    label: 'Proposition I.5',
    text: 'In isosceles triangles the base angles are equal.',
  },
  'Def.20': {
    key: 'Def.20',
    label: 'Definition 20',
    text: 'An isosceles triangle has two sides equal.',
  },
}

/** Get the citation def for a structured Citation from the fact engine. */
export function citationDefFromFact(citation: Citation): CitationDef | null {
  switch (citation.type) {
    case 'def15':
      return CITATIONS['Def.15']
    case 'cn1':
      return CITATIONS['C.N.1']
    case 'cn2':
      return CITATIONS['C.N.2']
    case 'cn3':
      return CITATIONS['C.N.3']
    case 'cn3-angle':
      return CITATIONS['C.N.3']
    case 'cn4':
      return CITATIONS['C.N.4']
    case 'given':
      return CITATIONS['Given']
    case 'prop':
      return CITATIONS[`I.${citation.propId}`] ?? null
  }
}
