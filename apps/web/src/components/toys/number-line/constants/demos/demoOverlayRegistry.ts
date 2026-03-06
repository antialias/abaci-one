/**
 * Registry mapping constant IDs to their canvas overlay render functions.
 *
 * All demo overlays share the same signature:
 *   (ctx, state, cssWidth, cssHeight, isDark, revealProgress, opacity) => void
 *
 * Extracted from NumberLine.tsx to collapse 9 identical if-blocks into a lookup.
 */

import type { NumberLineState } from '../../types'
import { renderPiOverlay } from './piDemo'
import { renderTauOverlay } from './tauDemo'
import { renderEOverlay } from './eDemo'
import { renderGammaOverlay } from './gammaDemo'
import { renderSqrt2Overlay } from './sqrt2Demo'
import { renderSqrt3Overlay } from './sqrt3Demo'
import { renderLn2Overlay } from './ln2Demo'
import { renderRamanujanOverlay } from './ramanujanDemo'
import { renderFeigenbaumOverlay } from './feigenbaumDemo'

export type DemoOverlayRenderer = (
  ctx: CanvasRenderingContext2D,
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number,
  isDark: boolean,
  revealProgress: number,
  opacity: number
) => void

/**
 * Map from constant ID to its overlay render function.
 * Golden ratio (phi) is handled separately due to special centering/image logic.
 */
export const DEMO_OVERLAY_RENDERERS: Record<string, DemoOverlayRenderer> = {
  pi: renderPiOverlay,
  tau: renderTauOverlay,
  e: renderEOverlay,
  gamma: renderGammaOverlay,
  sqrt2: renderSqrt2Overlay,
  sqrt3: renderSqrt3Overlay,
  ln2: renderLn2Overlay,
  ramanujan: renderRamanujanOverlay,
  feigenbaum: renderFeigenbaumOverlay,
}
