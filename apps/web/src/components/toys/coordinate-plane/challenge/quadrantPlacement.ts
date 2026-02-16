import type { CoordinatePlaneState } from '../types'
import type { CardPlacement } from './types'
import { worldToScreen2D } from '../../shared/coordinateConversions'

const CARD_MARGIN = 16

/**
 * Place the card in the opposite quadrant from the solution point,
 * so it doesn't cover the area the student needs to work in.
 */
export function computeCardPlacement(
  solutionX: number,
  solutionY: number,
  state: CoordinatePlaneState,
  canvasWidth: number,
  canvasHeight: number
): CardPlacement {
  const screen = worldToScreen2D(
    solutionX,
    solutionY,
    state.center.x,
    state.center.y,
    state.pixelsPerUnit.x,
    state.pixelsPerUnit.y,
    canvasWidth,
    canvasHeight
  )

  // Determine which half of the screen the solution is in
  const solutionOnRight = screen.x > canvasWidth / 2
  const solutionOnBottom = screen.y > canvasHeight / 2

  // Place card in opposite quadrant
  if (solutionOnRight && solutionOnBottom) {
    return {
      position: 'top-left',
      style: { top: CARD_MARGIN, left: CARD_MARGIN },
    }
  } else if (solutionOnRight && !solutionOnBottom) {
    return {
      position: 'bottom-left',
      style: { bottom: CARD_MARGIN, left: CARD_MARGIN },
    }
  } else if (!solutionOnRight && solutionOnBottom) {
    return {
      position: 'top-right',
      style: { top: CARD_MARGIN, right: CARD_MARGIN },
    }
  } else {
    return {
      position: 'bottom-right',
      style: { bottom: CARD_MARGIN, right: CARD_MARGIN },
    }
  }
}
