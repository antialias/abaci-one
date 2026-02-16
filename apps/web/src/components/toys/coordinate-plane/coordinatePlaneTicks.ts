import type { CoordinatePlaneState, TickMark, TickThresholds } from './types'
import { xSlice, ySlice } from './types'
import { DEFAULT_TICK_THRESHOLDS } from '../number-line/types'
import { computeTickMarks } from '../number-line/numberLineTicks'

/**
 * Compute visible tick marks for one axis of the coordinate plane.
 * Thin wrapper around the number line's computeTickMarks, using the
 * appropriate 1D slice of the 2D state.
 */
export function computeAxisTicks(
  state: CoordinatePlaneState,
  axis: 'x' | 'y',
  canvasExtent: number,
  thresholds: TickThresholds = DEFAULT_TICK_THRESHOLDS
): TickMark[] {
  const slice = axis === 'x' ? xSlice(state) : ySlice(state)
  return computeTickMarks(slice, canvasExtent, thresholds)
}
