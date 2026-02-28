import type { FactStore } from './engine/factStore'
import type { ProofFact } from './engine/facts'
import type { KidLanguageStyle } from '@/db/schema/player-session-preferences'

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

export type ElementOrigin = 'given' | 'compass' | 'straightedge' | 'intersection' | 'free'

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
  | {
      tag: 'radius-set'
      centerId: string
      radiusPointId: string
      radius: number
      enterTime: number
    }
  | {
      tag: 'sweeping'
      centerId: string
      radiusPointId: string
      radius: number
      startAngle: number
      prevAngle: number
      cumulativeSweep: number
    }

export type StraightedgePhase = { tag: 'idle' } | { tag: 'from-set'; fromId: string }

export type ExtendPhase =
  | { tag: 'idle' }
  | { tag: 'base-set'; baseId: string }
  | { tag: 'extending'; baseId: string; throughId: string }

export type ActiveTool = 'compass' | 'straightedge' | 'macro' | 'move' | 'point' | 'extend'

export type MacroPhase =
  | { tag: 'idle' }
  /** Macro tool active, proposition not yet chosen — picker is open */
  | { tag: 'choosing' }
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
  | { kind: 'extend-phase'; phase: 'base-set' | 'extending' }

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
  | {
      type: 'intersection'
      ofA?: ElementSelector
      ofB?: ElementSelector
      beyondId?: string
      label?: string
    }
  | { type: 'straightedge'; fromId: string; toId: string }
  | { type: 'extend'; baseId: string; throughId: string; distance: number; label: string }
  | {
      type: 'macro'
      propId: number
      inputPointIds: string[]
      outputLabels?: Record<string, string>
    }

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
  /** Pairs of equal angles — matching tick marks on arcs (visual only) */
  equalAngles?: Array<[AngleSpec, AngleSpec]>
  /** Angle equality facts pre-loaded into the fact store before any construction.
   *  These appear as real [Given] facts in the proof panel. */
  givenAngleFacts?: Array<{
    left: { vertex: string; ray1: string; ray2: string }
    right: { vertex: string; ray1: string; ray2: string }
    statement: string
  }>
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
  /** Tutorial sub-step generator for guided interaction. Each inner array
   *  corresponds to one proposition step; sub-steps break the gesture into
   *  teachable micro-interactions. */
  getTutorial?: (isTouch: boolean, narration?: EuclidNarrationOptions) => TutorialSubStep[][]
  /** Post-completion exploration narration (intro speech + per-point tips) */
  explorationNarration?: ExplorationNarration
  /** Optional exploration narration variants keyed by language style */
  explorationNarrationByStyle?: Partial<Record<KidLanguageStyle, ExplorationNarration>>
  /** Optional step instruction overrides per language style */
  stepInstructionsByStyle?: Partial<Record<KidLanguageStyle, string[]>>
  /** Derive conclusion facts when the proposition completes. Mutates the
   *  fact store in place and returns newly derived facts. */
  deriveConclusion?: (store: FactStore, state: ConstructionState, atStep: number) => ProofFact[]
}

export interface EuclidNarrationOptions {
  languageStyle?: KidLanguageStyle
}

// ── Exploration narration (post-completion drag phase) ────────────

export interface PointExplorationTip {
  pointId: string
  speech: string
}

export interface ExplorationNarration {
  /** Speech played once when the proposition is first completed */
  introSpeech: string
  /** Per-point tips played on first drag of each given point */
  pointTips: PointExplorationTip[]
  /** Speech played once when the construction breaks down during drag
   *  (e.g. a precondition is violated and intersections disappear) */
  breakdownTip?: string
}

// ── Ghost geometry (dependency visualization) ────────────────────

/** Lightweight geometry for the ghost layer — not part of construction state */
export interface GhostCircle {
  kind: 'circle'
  cx: number
  cy: number
  r: number
  color: string
}
export interface GhostSegment {
  kind: 'segment'
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  isProduction?: boolean
}
export interface GhostPoint {
  kind: 'point'
  x: number
  y: number
  label: string
  color: string
}
export type GhostElement = GhostCircle | GhostSegment | GhostPoint

/** A collection of ghost elements from one macro invocation at a specific depth */
export interface GhostLayer {
  propId: number // which proposition's internals these represent
  depth: number // 1 = direct dependency, 2 = dependency's dependency, etc.
  elements: GhostElement[]
  atStep: number // construction step index that produced this layer
  /**
   * Ordered groups of element indices for the macro reveal ceremony.
   * Each inner array is revealed together; groups are shown sequentially.
   * If absent, all elements reveal at once.
   */
  revealGroups?: number[][]
  /**
   * TTS narration spoken when this layer finishes its reveal ceremony.
   * Only meaningful on depth-1 layers (the top-level macro result).
   */
  keyNarration?: string
}

/** State driving the macro reveal ceremony in the RAF loop */
export interface MacroCeremonyState {
  /** Ordered list of (layerKey, groupIndex) to reveal, deepest-depth first */
  sequence: Array<{ layerKey: string; groupIndex: number; msDelay: number }>
  /** How many sequence entries have been revealed so far */
  revealed: number
  /** Timestamp (performance.now()) when the last reveal fired */
  lastRevealMs: number
  /** Narration text to speak when all groups are shown */
  narrationText: string
  narrationFired: boolean
  /** Timestamp when all groups were shown (null = not yet complete) */
  allShownMs: number | null
  /** ms after allShownMs before advancing the step */
  postNarrationDelayMs: number
  /** The deferred step-advance closure */
  advanceStep: () => void
  /**
   * Per-element draw animation state.
   * Key = `${layerKey}:${elementIdx}`. Populated when each group is revealed.
   */
  elementAnims: Map<string, { startMs: number; durationMs: number }>
  /**
   * IDs of construction elements added by the macro that must stay hidden
   * until the ceremony completes. Cleared when `advanceStep` fires.
   */
  hiddenElementIds: Set<string>
}

/**
 * Whether a proposition needs Post.2 segment extension for intersection computation.
 * Derived from step definitions: any step with `beyondId` implies the construction
 * "produces" (extends) a finite line, requiring circle-line intersection on the extension.
 */
export function needsExtendedSegments(prop: PropositionDef): boolean {
  return prop.steps.some((s) => s.expected.type === 'intersection' && s.expected.beyondId != null)
}

// ── Proof Editor JSON types ────────────────────────────────────────

export interface ProofJSON {
  id: number
  title: string
  kind: 'construction' | 'theorem'
  givenElements: SerializedElement[]
  steps: SerializedStep[]
  givenFacts?: SerializedEqualityFact[]
  givenAngleFacts?: SerializedAngleEqualityFact[]
  resultSegments?: { fromId: string; toId: string }[]
  authorNotes?: string
}

export interface SerializedElement {
  kind: 'point' | 'circle' | 'segment'
  id: string
  label?: string
  x?: number
  y?: number
  centerId?: string
  radiusPointId?: string
  fromId?: string
  toId?: string
  color: string
  origin: ElementOrigin | 'compass' | 'given'
}

export interface SerializedStep {
  citation: string
  instruction: string
  action: SerializedAction
  intersections?: SerializedIntersection[]
  notes?: string
}

export type SerializedAction =
  | { type: 'compass'; centerId: string; radiusPointId: string }
  | { type: 'straightedge'; fromId: string; toId: string }
  | { type: 'intersection'; ofA: string; ofB: string; label: string; beyondId?: string }
  | {
      type: 'macro'
      propId: number
      inputPointIds: string[]
      outputLabels?: Record<string, string>
    }
  | { type: 'fact-only' }
  | { type: 'extend'; baseId: string; throughId: string; distance: number; label: string }

export interface SerializedIntersection {
  x: number
  y: number
  ofA: string
  ofB: string
  label: string
}

export interface SerializedEqualityFact {
  left: { a: string; b: string }
  right: { a: string; b: string }
  statement: string
}

export interface SerializedAngleEqualityFact {
  left: { vertex: string; ray1: string; ray2: string }
  right: { vertex: string; ray1: string; ray2: string }
  statement: string
}

// ── Proposition reference data ────────────────────────────────────

export interface PropositionRef {
  id: number
  type: 'C' | 'T'
  title: string
  statement: string
  method: string
  deps: string[]
  note: string
  block: string
}
