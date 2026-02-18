// ── Byrne-inspired palette ─────────────────────────────────────────
export const BYRNE = {
  given: '#1A1A2E',
  red: '#E15759',
  blue: '#4E79A7',
  yellow: '#F0C75E',
} as const

/** Cycle through Byrne accent colors for new constructions */
export const BYRNE_CYCLE = [BYRNE.red, BYRNE.blue, BYRNE.yellow] as const

// ── Viewport ───────────────────────────────────────────────────────

export interface EuclidViewportState {
  center: { x: number; y: number }
  /** Uniform zoom — same scale on both axes */
  pixelsPerUnit: number
}

// ── Geometric elements ─────────────────────────────────────────────

export type ElementOrigin = 'given' | 'compass' | 'straightedge' | 'intersection'

export interface ConstructionPoint {
  kind: 'point'
  id: string
  x: number
  y: number
  label: string
  color: string
  origin: ElementOrigin
}

export interface ConstructionCircle {
  kind: 'circle'
  id: string
  centerId: string
  radiusPointId: string
  color: string
  origin: 'compass'
}

export interface ConstructionSegment {
  kind: 'segment'
  id: string
  fromId: string
  toId: string
  color: string
  origin: 'straightedge' | 'given'
}

export type ConstructionElement = ConstructionPoint | ConstructionCircle | ConstructionSegment

// ── Construction state ─────────────────────────────────────────────

export interface ConstructionState {
  elements: ConstructionElement[]
  nextLabelIndex: number
  nextColorIndex: number
}

// ── Intersection candidates ────────────────────────────────────────

export interface IntersectionCandidate {
  x: number
  y: number
  /** First element involved */
  ofA: string
  /** Second element involved */
  ofB: string
  /** Distinguisher when two elements have multiple intersections */
  which: number
}

// ── Tool state machines ────────────────────────────────────────────

export type CompassPhase =
  | { tag: 'idle' }
  | { tag: 'center-set'; centerId: string }
  | { tag: 'radius-set'; centerId: string; radiusPointId: string; radius: number; enterTime: number }
  | {
      tag: 'sweeping'
      centerId: string
      radiusPointId: string
      radius: number
      startAngle: number
      prevAngle: number
      cumulativeSweep: number
    }

export type StraightedgePhase =
  | { tag: 'idle' }
  | { tag: 'from-set'; fromId: string }

export type ActiveTool = 'compass' | 'straightedge' | 'macro' | 'move'

export type MacroPhase =
  | { tag: 'idle' }
  | { tag: 'selecting'; propId: number; inputLabels: string[]; selectedPointIds: string[] }

// ── Element selectors ─────────────────────────────────────────────
// Reference circles/segments by their defining points, not creation-order IDs.
// Point IDs (e.g. "pt-A") pass through as plain strings.

export type ElementSelector =
  | string
  | { kind: 'circle'; centerId: string; radiusPointId: string }
  | { kind: 'segment'; fromId: string; toId: string }

// ── Tutorial hints ─────────────────────────────────────────────────

export type TutorialHint =
  | { type: 'point'; pointId: string }
  | { type: 'arrow'; fromId: string; toId: string }
  | { type: 'sweep'; centerId: string; radiusPointId: string }
  | { type: 'candidates'; ofA?: ElementSelector; ofB?: ElementSelector; beyondId?: string }
  | { type: 'none' }

/** Trigger that advances the tutorial to the next sub-step. */
export type AdvanceOn =
  | { kind: 'compass-phase'; phase: 'center-set' | 'radius-set' }
  | { kind: 'macro-select'; index: number }

export interface TutorialSubStep {
  /** Short display text */
  instruction: string
  /** Longer conversational text for TTS */
  speech: string
  /** Visual hint rendered on canvas */
  hint: TutorialHint
  /**
   * Tool phase event that triggers advancement to next sub-step.
   * null = terminal sub-step (advanced when the proposition step completes).
   */
  advanceOn: AdvanceOn | null
}

// ── Angle specification ──────────────────────────────────────────

/** An angle defined by a vertex and two ray endpoints */
export interface AngleSpec {
  vertex: string
  ray1End: string
  ray2End: string
}

// ── Proposition stepper ────────────────────────────────────────────

export type ExpectedAction =
  | { type: 'compass'; centerId: string; radiusPointId: string }
  | { type: 'intersection'; ofA?: ElementSelector; ofB?: ElementSelector; beyondId?: string; label?: string }
  | { type: 'straightedge'; fromId: string; toId: string }
  | { type: 'macro'; propId: number; inputPointIds: string[]; outputLabels?: Record<string, string> }

export interface PropositionStep {
  instruction: string
  expected: ExpectedAction
  /** Element IDs to highlight as hints */
  highlightIds: string[]
  /** Tool to auto-select for this step (null = no tool needed, e.g. tap intersection) */
  tool: ActiveTool | null
  /** Citation reference for this step, e.g. "Post.1", "I.1", "Def.15" */
  citation?: string
}

export interface PropositionDef {
  id: number
  title: string
  givenElements: ConstructionElement[]
  steps: PropositionStep[]
  completionMessage?: string
  /** Segments to highlight as the construction result on completion */
  resultSegments?: Array<{ fromId: string; toId: string }>
  /** 'construction' (default) shows Q.E.F.; 'theorem' shows Q.E.D. */
  kind?: 'construction' | 'theorem'
  /** Equality facts pre-loaded into the fact store before any construction */
  givenFacts?: Array<{
    left: { a: string; b: string }
    right: { a: string; b: string }
    statement: string
  }>
  /** Angle arcs to render (visual indicators at vertices) */
  givenAngles?: Array<{
    spec: AngleSpec
    color: string
  }>
  /** Pairs of equal angles — matching tick marks on arcs */
  equalAngles?: Array<[AngleSpec, AngleSpec]>
  /** Text conclusion for theorems (bypasses fact-store derivation display) */
  theoremConclusion?: string
  /** Superposition flash configuration for C.N.4 visual */
  superpositionFlash?: {
    pairs: Array<{ src: string; tgt: string }>
    triA: [string, string, string]
    triB: [string, string, string]
  }
  /** IDs of given points the user can drag post-completion */
  draggablePointIds?: string[]
  /** Factory that recomputes all given elements from current point positions.
   *  Called on each drag frame. Receives a map of draggable point ID → current {x,y}.
   *  Returns a fresh givenElements array with updated coordinates. */
  computeGivenElements?: (positions: Map<string, { x: number; y: number }>) => ConstructionElement[]
}

/**
 * Whether a proposition needs Post.2 segment extension for intersection computation.
 * Derived from step definitions: any step with `beyondId` implies the construction
 * "produces" (extends) a finite line, requiring circle-line intersection on the extension.
 */
export function needsExtendedSegments(prop: PropositionDef): boolean {
  return prop.steps.some(
    s => s.expected.type === 'intersection' && s.expected.beyondId != null,
  )
}
