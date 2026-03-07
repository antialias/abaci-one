/**
 * Render a MomentSnapshot onto a canvas context.
 *
 * Shared between the server-side postcard generator (via @napi-rs/canvas)
 * and the client-side debug panel (via browser <canvas>).
 */

import type { MomentSnapshot } from '@/db/schema/number-line-postcards'
import { renderNumberLine } from './renderNumberLine'
import { MATH_CONSTANTS } from './constants/constantsData'
import { computeAllConstantVisibilities } from './constants/computeConstantVisibility'
import { DEMO_OVERLAY_RENDERERS } from './constants/demos/demoOverlayRegistry'
import { renderGoldenRatioOverlay } from './constants/demos/goldenRatioDemo'

export function renderMomentScene(
  ctx: CanvasRenderingContext2D,
  snapshot: MomentSnapshot,
  width: number,
  height: number
) {
  const state = {
    center: snapshot.viewport.center,
    pixelsPerUnit: snapshot.viewport.pixelsPerUnit,
  }

  const target = snapshot.gameTarget
    ? { value: snapshot.gameTarget.value, emoji: snapshot.gameTarget.emoji, opacity: 1 }
    : undefined

  const indicator =
    snapshot.highlights?.length || snapshot.indicatorRange
      ? {
          numbers: snapshot.highlights ?? [],
          range: snapshot.indicatorRange,
          alpha: 1,
        }
      : undefined

  const constants = computeAllConstantVisibilities(MATH_CONSTANTS, state, width, new Set())

  renderNumberLine(
    ctx,
    state,
    width,
    height,
    false, // isDark
    undefined, // thresholds
    0,
    0,
    0.5, // zoomVelocity, zoomHue, zoomFocalX
    target,
    undefined, // collisionFadeMap
    constants,
    undefined,
    undefined,
    undefined,
    undefined, // prime stuff
    undefined,
    undefined, // highlight primes/arcs
    undefined,
    0, // sieve
    indicator
  )

  // Demo overlay
  if (snapshot.activeExplorationId && snapshot.demoProgress != null) {
    const constantId = snapshot.activeExplorationId
    if (constantId === 'phi') {
      renderGoldenRatioOverlay(ctx, state, width, height, false, snapshot.demoProgress, 1.0)
    }
    const renderer = DEMO_OVERLAY_RENDERERS[constantId]
    if (renderer) {
      renderer(ctx, state, width, height, false, snapshot.demoProgress, 1.0)
    }
  }
}
