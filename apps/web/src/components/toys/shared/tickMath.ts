/**
 * Shared tick math utilities used by both the number line and coordinate plane.
 *
 * Extracted from numberLineTicks.ts and renderNumberLine.ts to avoid duplication.
 */

// ── Prominence computation ──────────────────────────────────────────

/** Hermite smoothstep: 3t^2 - 2t^3, clamped to [0,1] */
export function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

/**
 * Compute continuous prominence (0-1) for a tick power based on how many
 * ticks of that spacing fit on screen.
 *
 * Piecewise Hermite smoothstep across three segments:
 *   [0, anchorMax]          -> prominence [1.0, 0.5]   (anchor -> medium)
 *   [anchorMax, mediumMax]  -> prominence [0.5, 0.15]  (medium -> fine)
 *   [mediumMax, fadeEnd]    -> prominence [0.15, 0.0]  (fine -> invisible)
 *
 * Each segment uses smoothstep(t) = 3t^2 - 2t^3 which has zero derivative
 * at both endpoints -> C1 continuous at all joints.
 */
export function computeProminence(numTicks: number, anchorMax: number, mediumMax: number): number {
  const fadeEnd = mediumMax * 1.5

  if (numTicks <= 0) return 1.0
  if (numTicks >= fadeEnd) return 0.0

  if (numTicks <= anchorMax) {
    const t = smoothstep(numTicks / anchorMax)
    return 1.0 - t * 0.5
  } else if (numTicks <= mediumMax) {
    const t = smoothstep((numTicks - anchorMax) / (mediumMax - anchorMax))
    return 0.5 - t * 0.35
  } else {
    const t = smoothstep((numTicks - mediumMax) / (fadeEnd - mediumMax))
    return 0.15 - t * 0.15
  }
}

// ── Visual landmark interpolation ───────────────────────────────────

/** Piecewise linear interpolation between three landmarks at p=1, p=0.5, p=0 */
export function lerpLandmarks(
  prominence: number,
  anchor: number,
  medium: number,
  fine: number
): number {
  if (prominence >= 0.5) {
    const t = (prominence - 0.5) / 0.5
    return medium + t * (anchor - medium)
  } else {
    const t = prominence / 0.5
    return fine + t * (medium - fine)
  }
}

// Visual landmarks for prominence-based interpolation
// p=1.0 (anchor), p=0.5 (medium), p=0.0 (fine)
export const HEIGHTS = { anchor: 40, medium: 24, fine: 12 } as const
export const LINE_WIDTHS = { anchor: 2, medium: 1.5, fine: 1 } as const
export const FONT_SIZES = { anchor: 13, medium: 11, fine: 11 } as const
export const FONT_WEIGHTS = { anchor: 600, medium: 400, fine: 400 } as const
export const TICK_ALPHAS = { anchor: 1.0, medium: 0.5, fine: 0.15 } as const

export function getTickHeight(prominence: number, canvasHeight: number): number {
  const maxHeight = canvasHeight / 2
  const raw = lerpLandmarks(prominence, HEIGHTS.anchor, HEIGHTS.medium, HEIGHTS.fine)
  const maxForLevel = lerpLandmarks(prominence, maxHeight * 0.6, maxHeight * 0.4, maxHeight * 0.2)
  return Math.min(raw, maxForLevel)
}

export function getTickLineWidth(prominence: number): number {
  return lerpLandmarks(prominence, LINE_WIDTHS.anchor, LINE_WIDTHS.medium, LINE_WIDTHS.fine)
}

export function getTickAlpha(prominence: number): number {
  return lerpLandmarks(prominence, TICK_ALPHAS.anchor, TICK_ALPHAS.medium, TICK_ALPHAS.fine)
}

export function getTickFontSize(prominence: number): number {
  return lerpLandmarks(prominence, FONT_SIZES.anchor, FONT_SIZES.medium, FONT_SIZES.fine)
}

export function getTickFontWeight(prominence: number): number {
  return Math.round(
    lerpLandmarks(prominence, FONT_WEIGHTS.anchor, FONT_WEIGHTS.medium, FONT_WEIGHTS.fine)
  )
}

/** Format a number for display as a tick label, using the tick's power for precision */
export function formatTickLabel(value: number, power: number): string {
  // Normalize -0 to 0
  if (value === 0) value = 0
  // Use scientific notation for very large or very small numbers
  if (value !== 0 && (Math.abs(value) >= 1e7 || Math.abs(value) < 1e-4)) {
    const sigFigs = Math.max(1, Math.min(15, -power + 1))
    return value.toExponential(Math.min(sigFigs, 6))
  }
  // For normal numbers, show enough fraction digits for the tick's power
  const fractionDigits = Math.max(0, -power)
  return value.toLocaleString(undefined, { maximumFractionDigits: Math.min(fractionDigits, 20) })
}

// ── Colors ──────────────────────────────────────────────────────────

/** Base RGB components for dynamic alpha composition */
export interface RenderColors {
  axisLine: string
  /** RGB for tick marks -- alpha computed from prominence */
  tickRgb: string
  /** RGB for labels -- alpha computed from prominence */
  labelRgb: string
}

export const LIGHT_COLORS: RenderColors = {
  axisLine: 'rgba(55, 65, 81, 0.8)',
  tickRgb: '55, 65, 81',
  labelRgb: '17, 24, 39',
}

export const DARK_COLORS: RenderColors = {
  axisLine: 'rgba(209, 213, 219, 0.8)',
  tickRgb: '209, 213, 219',
  labelRgb: '243, 244, 246',
}

export const COLLISION_FADE_MS = 500

/** System font stack used for tick labels */
export const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
