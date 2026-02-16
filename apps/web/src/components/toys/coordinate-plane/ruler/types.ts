/** A reduced fraction: numerator / denominator, always reduced, denominator > 0 */
export interface Fraction {
  num: number
  den: number
}

/** A mixed number: whole part + fractional part (both non-negative, sign stored separately) */
export interface MixedNumber {
  negative: boolean
  whole: number
  /** Numerator of fractional part (0 ≤ fracNum < fracDen) */
  fracNum: number
  fracDen: number
}

/** The computed linear equation from two points */
export type EquationForm =
  | { kind: 'point'; x: number; y: number }
  | { kind: 'vertical'; x: number }
  | { kind: 'horizontal'; y: number }
  | { kind: 'general'; slope: Fraction; intercept: Fraction }

/** Which part of the ruler was hit */
export type RulerHitZone = 'handleA' | 'handleB' | 'body' | 'miss'

/** Ruler endpoint positions in world (integer) coordinates */
export interface RulerState {
  ax: number
  ay: number
  bx: number
  by: number
}

/** Interpolated ruler state — floats that lerp toward the integer targets */
export interface VisualRulerState {
  ax: number
  ay: number
  bx: number
  by: number
}

/** A guide slope definition for visual feedback during handle drag */
export interface GuideSlope {
  num: number   // numerator (e.g. 1 for slope 1/2)
  den: number   // denominator (e.g. 2 for slope 1/2); 0 for vertical
  label: string // display: "1", "−2", "⅓", "∞"
}

/** A slope guide entry (all shown simultaneously during handle drag) */
export interface ActiveSlopeGuide {
  slope: GuideSlope
}

/** State of all visible slope guides during a handle drag */
export interface SlopeGuideState {
  anchorX: number  // stationary handle world coords
  anchorY: number
  handleX: number  // dragging handle world coords (snapped to grid)
  handleY: number
  guides: ActiveSlopeGuide[]
}

/** Standard-form coefficients: Ax + By = C (all integers, reduced, A > 0 or A=0 & B > 0) */
export interface StandardFormCoeffs {
  a: number
  b: number
  c: number
}

/** State of the equation label probe (dragged along ruler line) */
export interface EquationProbeState {
  active: boolean
  /** Slider position: 0 = handle A, 1 = handle B, 0.5 = midpoint (rest) */
  t: number
  worldX: number
  worldY: number
  /** Nearby integer x grid line (within 0.15 world units), or null */
  nearX: number | null
  /** Nearby integer y grid line (within 0.15 world units), or null */
  nearY: number | null
  solvedAtNearX: { x: number; yFrac: Fraction } | null
  solvedAtNearY: { y: number; xFrac: Fraction } | null
}
