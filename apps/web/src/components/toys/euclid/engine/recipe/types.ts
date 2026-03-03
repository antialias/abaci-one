/**
 * ConstructionRecipe: Single source of geometric truth for Euclid propositions.
 *
 * Each construction proposition (I.1, I.2, I.3) is defined ONCE as a recipe.
 * All contexts — guided walkthrough, macro engine, cursor preview, ghost ceremony,
 * replay, thumbnails — derive from this single definition.
 */

// ── Ref: a named position ──────────────────────────────────────────

/** Single-letter name for a point in the construction (e.g. 'A', 'D', 'E') */
export type Ref = string

/** Convert a recipe ref to a construction state point ID */
export function refToPointId(ref: Ref): string {
  return `pt-${ref}`
}

// ── RecipeOp: one construction step ────────────────────────────────

export type RecipeOp =
  | RecipeSegmentOp
  | RecipeCircleOp
  | RecipeIntersectionOp
  | RecipeProduceOp
  | RecipeApplyOp

/** Post.1 — join two points */
export interface RecipeSegmentOp {
  kind: 'segment'
  id: string
  from: Ref
  to: Ref
}

/** Post.3 — describe a circle */
export interface RecipeCircleOp {
  kind: 'circle'
  id: string
  center: Ref
  radiusPoint: Ref
}

/**
 * Reference to an element for intersection computation.
 * Either a string (op ID) or an inline segment defined by two point refs.
 */
export type IntersectionSource = string | { segmentRefs: [Ref, Ref] }

/** Def.15 — where two loci meet */
export interface RecipeIntersectionOp {
  kind: 'intersection'
  id: string
  of: [IntersectionSource, IntersectionSource]
  prefer: 'upper' | 'lower'
  output: Ref
}

/** Post.2 — extend line to meet circle */
export interface RecipeProduceOp {
  kind: 'produce'
  id: string
  from: Ref
  through: Ref
  until: string // op ID of the circle to intersect
  output: Ref
}

/** "By I.n" — invoke a proven proposition */
export interface RecipeApplyOp {
  kind: 'apply'
  id: string
  recipeId: number
  inputs: Ref[]
  outputs: Record<Ref, Ref> // sub-recipe ref → local ref
}

// ── RecipeFact: proof chain declarations ───────────────────────────

export type RecipeFact = RecipeDistanceFact | RecipeAngleFact

export interface RecipeDistanceFact {
  kind: 'distance'
  left: { a: Ref; b: Ref }
  right: { a: Ref; b: Ref }
  citation: RecipeCitation
  statementTemplate: string
  justificationTemplate: string
}

export interface RecipeAngleFact {
  kind: 'angle'
  left: { vertex: Ref; ray1: Ref; ray2: Ref }
  right: { vertex: Ref; ray1: Ref; ray2: Ref }
  citation: RecipeCitation
  statementTemplate: string
  justificationTemplate: string
}

export type RecipeCitation =
  | { type: 'def15'; circleOpId: string }
  | { type: 'cn1'; via: { a: Ref; b: Ref } }
  | { type: 'cn3'; whole: { a: Ref; b: Ref }; part: { a: Ref; b: Ref } }
  | { type: 'prop'; propId: number }

// ── CeremonySpec: ghost reveal structure ───────────────────────────

export interface CeremonySpec {
  /** Groups of op IDs revealed together. Groups are shown sequentially. */
  revealGroups: string[][]
  narrationTemplate: string
}

// ── InputSlot ──────────────────────────────────────────────────────

export interface RecipeInputSlot {
  ref: Ref
  role: string
  label: string
  givenId: string
}

// ── ConstructionRecipe ─────────────────────────────────────────────

export interface ConstructionRecipe {
  propId: number
  label: string
  inputSlots: RecipeInputSlot[]
  distinctInputPairs: [number, number][]
  ops: RecipeOp[]
  exports: Array<{ ref: Ref; kind: 'point' | 'segment'; outputLabelKey?: string }>
  facts: RecipeFact[]
  ceremony: CeremonySpec
  degenerateCases?: Array<{
    condition: { coincident: [Ref, Ref] }
    ops: RecipeOp[]
    ceremony?: CeremonySpec
  }>
}

// ── OpAnnotation: per-op metadata for step derivation ──────────────

export interface OpAnnotation {
  instruction: string
  tool: 'compass' | 'straightedge' | 'macro' | 'move' | 'point' | 'extend' | null
  citation?: string
  highlightIds?: string[]
  /** Override the automatically derived ExpectedAction (for special cases like wildcard intersections) */
  expectedOverride?: import('../../types').ExpectedAction
}

export type OpAnnotations = Record<string, OpAnnotation>

// ── ConstructionTrace: evaluation result ───────────────────────────

export type Pt = { x: number; y: number }

export interface ResolvedCircle {
  opId: string
  center: Pt
  radius: number
}

export interface ResolvedSegment {
  opId: string
  from: Pt
  to: Pt
}

export type OpTrace =
  | { kind: 'segment'; opId: string; from: Pt; to: Pt; fromRef: Ref; toRef: Ref }
  | {
      kind: 'circle'
      opId: string
      center: Pt
      radius: number
      centerRef: Ref
      radiusPointRef: Ref
    }
  | { kind: 'intersection'; opId: string; point: Pt; outputRef: Ref }
  | { kind: 'produce'; opId: string; point: Pt; outputRef: Ref; fromRef: Ref; throughRef: Ref }
  | { kind: 'apply'; opId: string; subTrace: ConstructionTrace; outputMappings: Record<Ref, Ref> }

export interface ConstructionTrace {
  recipe: ConstructionRecipe
  inputPositions: Pt[]
  pointMap: Map<Ref, Pt>
  circleMap: Map<string, ResolvedCircle>
  segmentMap: Map<string, ResolvedSegment>
  opTraces: OpTrace[]
  degenerate: boolean
}

// ── Recipe registry type ───────────────────────────────────────────

export type RecipeRegistry = Record<number, ConstructionRecipe>
