/**
 * Shared viewport animation utilities for guided experiences
 * (constant demos, prime tour, etc.)
 *
 * Pure functions — no React, no side effects.
 */

import type { NumberLineState } from './types'

// ── Viewport type ───────────────────────────────────────────────────

export interface Viewport {
  center: number
  pixelsPerUnit: number
}

// ── Shared timing constants ─────────────────────────────────────────

/** Duration of initial fade-in (ms) */
export const FADE_IN_MS = 400

/** Duration of fade-out when the user deviates or the experience ends (ms) */
export const FADE_OUT_MS = 600

// ── Subtitle positioning constants ──────────────────────────────────

/** Offset from top edge when subtitles are anchored to the top (during narration). */
export const SUBTITLE_TOP_OFFSET = 16

/** Offset from bottom edge when subtitles are in default position. */
export const SUBTITLE_BOTTOM_OFFSET = 64

// ── Easing ──────────────────────────────────────────────────────────

/** Ease-out cubic: fast start, gentle stop. Clamps t to [0, 1]. */
export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - c, 3)
}

// ── Viewport interpolation ─────────────────────────────────────────

/**
 * Smoothly interpolate the number-line viewport from `src` toward `tgt`.
 *
 * Center is interpolated linearly; pixelsPerUnit is interpolated
 * logarithmically (so zooming feels uniform across scales).
 * Both use ease-out cubic easing.
 *
 * Mutates `state` in place.
 *
 * @returns Raw progress `t` (0→1, **before** easing) — use `>= 1`
 *          to detect when the animation is complete.
 */
export function lerpViewport(
  src: Viewport,
  tgt: Viewport,
  elapsed: number,
  durationMs: number,
  state: NumberLineState
): number {
  const t = Math.min(1, elapsed / durationMs)
  const eased = easeOutCubic(t)

  state.center = src.center + (tgt.center - src.center) * eased

  const logSrc = Math.log(src.pixelsPerUnit)
  const logTgt = Math.log(tgt.pixelsPerUnit)
  state.pixelsPerUnit = Math.exp(logSrc + (logTgt - logSrc) * eased)

  return t
}

/**
 * Snap viewport exactly to target (no interpolation).
 */
export function snapViewport(tgt: Viewport, state: NumberLineState): void {
  state.center = tgt.center
  state.pixelsPerUnit = tgt.pixelsPerUnit
}

// ── Deviation detection ─────────────────────────────────────────────

/**
 * Compute how far the current viewport has drifted from a target.
 *
 * Returns a combined metric where center displacement and zoom
 * displacement are weighted so that a small pan and a moderate zoom
 * both produce comparable values.
 *
 * Typical thresholds: 0.4 (constant demos) – 0.5 (prime tour).
 */
export function computeViewportDeviation(
  current: Viewport,
  target: Viewport
): number {
  const centerDev =
    Math.abs(current.center - target.center) / (Math.abs(target.center) || 1)
  const zoomDev = Math.abs(
    Math.log(current.pixelsPerUnit / target.pixelsPerUnit)
  )
  return centerDev + zoomDev * 0.5
}
