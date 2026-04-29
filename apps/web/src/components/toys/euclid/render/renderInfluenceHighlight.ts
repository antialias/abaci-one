/**
 * Influence highlight: shows which given (input) point most affects a
 * derived point currently under the pointer. Used by the move tool to
 * make the construction's dependency structure visible on hover.
 *
 * This module owns the state shape. The renderer (renderInfluenceHighlight)
 * and target-update helper (updateInfluenceTarget) are added alongside the
 * render-frame integration; this stub exists so that consumer files can
 * type-check before the visual layer lands.
 */

/** Persistent state for smooth highlight transitions across frames. */
export interface InfluenceHighlightState {
  opacity: number
  targetOpacity: number
  derivedPointId: string | null
  givenPointId: string | null
  fadeStartTime: number
  fadeStartOpacity: number
  /** Sub-Jacobian for the most influential given point: [∂tx/∂gx, ∂tx/∂gy, ∂ty/∂gx, ∂ty/∂gy] */
  subJacobian: [number, number, number, number] | null
}

export function createInfluenceHighlightState(): InfluenceHighlightState {
  return {
    opacity: 0,
    targetOpacity: 0,
    derivedPointId: null,
    givenPointId: null,
    fadeStartTime: 0,
    fadeStartOpacity: 0,
    subJacobian: null,
  }
}
