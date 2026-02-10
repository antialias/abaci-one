export interface NumberLineState {
  /** Number at center of viewport */
  center: number
  /** CSS pixels per 1 unit (larger = more zoomed in) */
  pixelsPerUnit: number
}

export type TickClass = 'anchor' | 'medium' | 'fine'

export interface TickMark {
  /** The numeric value on the number line */
  value: number
  /** The power of 10 this tick belongs to (0 = ones, 1 = tens, etc.) */
  power: number
  /** Visual class determining opacity, height, and label style */
  tickClass: TickClass
  /** Smooth opacity for fading labels/ticks (0-1) */
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
