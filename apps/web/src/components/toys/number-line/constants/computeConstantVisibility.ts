import type { NumberLineState, RenderConstant } from '../types'
import { numberToScreenX } from '../numberLineTicks'
import type { MathConstant } from './constantsData'

export interface ConstantVisibility {
  constant: MathConstant
  screenX: number
  isOnScreen: boolean
  opacity: number
}

/**
 * Compute visibility for a single constant.
 *
 * A constant is visible when:
 * 1. It's on screen (within canvas bounds + margin)
 * 2. The zoom level is adequate to distinguish it (pxPerPrecisionUnit >= 20)
 *
 * Unlike FindTheNumber, there's no position proximity factor —
 * constants appear whenever on screen AND zoomed enough.
 */
export function computeConstantVisibility(
  constant: MathConstant,
  state: NumberLineState,
  canvasWidth: number
): ConstantVisibility {
  const screenX = numberToScreenX(constant.value, state.center, state.pixelsPerUnit, canvasWidth)

  // Margin so constants don't pop in right at the edge
  const margin = 40
  const isOnScreen = screenX >= -margin && screenX <= canvasWidth + margin

  if (!isOnScreen) {
    return { constant, screenX, isOnScreen, opacity: 0 }
  }

  // Zoom adequacy: one unit at the constant's precision should be >= 20px
  const unitAtPrecision = 10 ** -constant.revealPrecision
  const pxPerPrecisionUnit = unitAtPrecision * state.pixelsPerUnit
  const opacity = Math.min(1, pxPerPrecisionUnit / 20)

  return { constant, screenX, isOnScreen, opacity }
}

/**
 * Compute visibility for all constants at once.
 * Returns only those with opacity > 0.
 */
export function computeAllConstantVisibilities(
  constants: MathConstant[],
  state: NumberLineState,
  canvasWidth: number,
  discoveredSet: Set<string>
): RenderConstant[] {
  const result: RenderConstant[] = []

  for (const constant of constants) {
    const vis = computeConstantVisibility(constant, state, canvasWidth)
    if (vis.opacity > 0) {
      result.push({
        id: constant.id,
        symbol: constant.symbol,
        screenX: vis.screenX,
        opacity: vis.opacity,
        discovered: discoveredSet.has(constant.id),
      })
    }
  }

  return result
}
