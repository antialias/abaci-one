export interface NumberLineState {
  /** Number at center of viewport */
  center: number
  /** CSS pixels per 1 unit (larger = more zoomed in) */
  pixelsPerUnit: number
}

export interface TickMark {
  /** The numeric value on the number line */
  value: number
  /** The power of 10 this tick belongs to (0 = ones, 1 = tens, etc.) */
  power: number
  /** Continuous visual prominence (0-1). 1 = anchor, 0.5 = medium, 0 = fine/invisible */
  prominence: number
  /** Overall visibility envelope derived from prominence (0-1) */
  opacity: number
}

export interface TickThresholds {
  /** Max ticks to be classified as "anchor" (default: 3) */
  anchorMax: number
  /** Max ticks to be classified as "medium" (default: 13) */
  mediumMax: number
}

export const DEFAULT_TICK_THRESHOLDS: TickThresholds = {
  anchorMax: 9,
  mediumMax: 23,
}

// Re-export collision types from shared module for backward compatibility
export type { CollisionFadeEntry, CollisionFadeMap } from '../shared/collisionDetection'

/** Prime classification info for a tick value */
export interface PrimeTickInfo {
  value: number
  smallestPrimeFactor: number
  isPrime: boolean
  classification: 'prime' | 'composite' | 'one' | 'not-applicable'
}

/** Pre-computed constant ready for canvas rendering */
export interface RenderConstant {
  symbol: string
  screenX: number
  /** 0-1 opacity from zoom adequacy */
  opacity: number
  /** Whether user has previously tapped this constant */
  discovered: boolean
  /** Constant ID for hit-testing */
  id: string
}
