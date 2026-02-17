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

export type RulerPhase =
  | { tag: 'idle' }
  | { tag: 'from-set'; fromId: string }

export interface Measurement {
  fromId: string
  toId: string
  distance: number  // world-coordinate Euclidean distance
}

export type ActiveTool = 'compass' | 'straightedge' | 'ruler' | 'macro'

export type MacroPhase =
  | { tag: 'idle' }
  | { tag: 'selecting'; propId: number; inputLabels: string[]; selectedPointIds: string[] }

// ── Tutorial hints ─────────────────────────────────────────────────

export type TutorialHint =
  | { type: 'point'; pointId: string }
  | { type: 'arrow'; fromId: string; toId: string }
  | { type: 'sweep'; centerId: string; radiusPointId: string }
  | { type: 'candidates'; ofA?: string; ofB?: string; beyondId?: string }
  | { type: 'none' }

export interface TutorialSubStep {
  /** Short display text */
  instruction: string
  /** Longer conversational text for TTS */
  speech: string
  /** Visual hint rendered on canvas */
  hint: TutorialHint
  /**
   * Compass/straightedge phase tag that triggers advancement to next sub-step.
   * null = terminal sub-step (advanced when the proposition step completes).
   */
  advanceOn: string | null
}

// ── Proposition stepper ────────────────────────────────────────────

export type ExpectedAction =
  | { type: 'compass'; centerId: string; radiusPointId: string }
  | { type: 'intersection'; ofA: string; ofB: string; beyondId?: string }
  | { type: 'straightedge'; fromId: string; toId: string }
  | { type: 'macro'; propId: number; inputPointIds: string[] }

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
  /** When true, circle-segment intersections use the infinite line through the segment.
   *  Needed for propositions that "produce" (extend) lines, like I.2. */
  extendSegments?: boolean
  completionMessage?: string
  /** Segments to highlight as the construction result on completion */
  resultSegments?: Array<{ fromId: string; toId: string }>
}
