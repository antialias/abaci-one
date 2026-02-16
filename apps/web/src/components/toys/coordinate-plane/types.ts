import type { TickMark, TickThresholds } from '../number-line/types'

export type { TickMark, TickThresholds }

export interface CoordinatePlaneState {
  center: { x: number; y: number }
  pixelsPerUnit: { x: number; y: number }
}

export type ZoomMode = 'uniform' | 'independent'

/** A 1D slice of the coordinate plane state, compatible with number line tick math */
export interface AxisSlice {
  center: number
  pixelsPerUnit: number
}

/** Extract the X-axis slice for tick computation */
export function xSlice(state: CoordinatePlaneState): AxisSlice {
  return { center: state.center.x, pixelsPerUnit: state.pixelsPerUnit.x }
}

/** Extract the Y-axis slice for tick computation */
export function ySlice(state: CoordinatePlaneState): AxisSlice {
  return { center: state.center.y, pixelsPerUnit: state.pixelsPerUnit.y }
}

/** Overlay interface for future-proofing (equation curves, shaded regions, etc.) */
export interface CoordinatePlaneOverlay {
  id: string
  layer: 'behind-grid' | 'on-grid' | 'above-grid'
  render(
    ctx: CanvasRenderingContext2D,
    state: CoordinatePlaneState,
    cssWidth: number,
    cssHeight: number,
    isDark: boolean
  ): void
}
