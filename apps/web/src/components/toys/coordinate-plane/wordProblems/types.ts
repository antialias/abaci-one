import type { Fraction } from '../ruler/types'

/** Annotation tags — each maps to a geometric element on the coordinate plane */
export type AnnotationTag =
  | 'slope'
  | 'intercept'
  | 'target'
  | 'x_unit'
  | 'y_unit'
  | 'answer'
  | 'point1'
  | 'point2'
  | 'context'
  | 'question'

/** A span of text with an optional annotation linking it to a geometric element */
export interface AnnotatedSpan {
  text: string
  tag?: AnnotationTag
  value?: number
}

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5

/** Noun with singular/plural forms */
export interface NounEntry {
  singular: string
  plural: string
}

/** Verb with conjugation forms */
export interface VerbEntry {
  base: string
  thirdPerson: string
  pastTense: string
  gerund: string
}

/** A subject phrase with conjugation metadata for subject-verb agreement */
export interface SubjectEntry {
  phrase: string
  conjugation: 'thirdPerson' | 'base'
}

/** A semantic frame defines a real-world context for a linear equation problem */
export interface SemanticFrame {
  id: string
  category: 'money' | 'distance' | 'growth' | 'cooking' | 'crafts'
  xNoun: NounEntry
  yNoun: NounEntry
  rateVerb: VerbEntry
  yUnit: string
  xUnit: string
  /** "$3" (prefix) vs "3 inches" (suffix) */
  yUnitPosition: 'prefix' | 'suffix'
  xUnitPosition: 'prefix' | 'suffix'
  /** Whether x is something you acquire (slices, bracelets) or time that elapses (hours, weeks) */
  xRole: 'acquired' | 'elapsed'
  /** Contextually plausible slope range */
  slopeRange: { min: number; max: number }
  /** Contextually plausible intercept range */
  interceptRange: { min: number; max: number }
  xRange: { min: number; max: number }
  yRange: { min: number; max: number }
  /** Setup phrases: "At the pizza shop, ..." */
  setupPhrases: string[]
  /** Subject phrases with conjugation metadata: "Sonia" (3rd person), "They" (base) */
  subjects: SubjectEntry[]
  /** Emoji representing one unit of x (shown in slope staircase) */
  emoji: string
  /** Which difficulty levels this frame supports */
  supportedLevels: DifficultyLevel[]
}

/** Numbers generated for a specific problem instance */
export interface GeneratedNumbers {
  m: number
  b: number
  xAnswer: number
  yTarget: number
  point1?: { x: number; y: number }
  point2?: { x: number; y: number }
}

/** A fully generated word problem */
export interface WordProblem {
  id: string
  spans: AnnotatedSpan[]
  /** Plain text version (spans joined) */
  text: string
  equation: { slope: Fraction; intercept: Fraction }
  answer: { x: number; y: number; solveFor: 'x' | 'y' | 'equation' }
  difficulty: DifficultyLevel
  frameId: string
  seed: number
  axisLabels: { x: string; y: string }
  /** Unit formatting for canvas annotations — allows rendering values like "$3" or "5 inches" */
  unitFormat: {
    x: { unit: string; position: 'prefix' | 'suffix'; singular: string }
    y: { unit: string; position: 'prefix' | 'suffix' }
  }
  /** Emoji representing one unit of x (shown in slope staircase) */
  emoji: string
}
