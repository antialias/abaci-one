/**
 * Pure computation helpers extracted from NumberLine.tsx draw().
 *
 * These functions compute derived render state from refs/inputs
 * without side effects. Called once per draw frame.
 */

import type { NumberLineState } from './types'
import type { RenderIndicator } from './renderNumberLine'
import type { SieveTickTransform } from './primes/renderSieveOverlay'
import { computeSieveTickTransforms, SWEEP_MAX_N } from './primes/renderSieveOverlay'
import { PRIME_TOUR_STOPS } from './primes/primeTourStops'

// ── Tour highlight computation ──────────────────────────────────────

export interface TourHighlightResult {
  highlightSet: Set<number> | undefined
  highlightedArcSet: Set<string> | undefined
  dimAmount: number
}

export function computeTourHighlights(tourState: {
  phase: string
  stopIndex: number | null
  dwellStartMs: number
  virtualDwellMs: number
  opacity: number
}): TourHighlightResult {
  const tourStop = tourState.stopIndex !== null ? PRIME_TOUR_STOPS[tourState.stopIndex] : null
  const dimAmount = tourStop?.dimOthers ?? 0

  let highlightSet: Set<number> | undefined
  let highlightedArcSet: Set<string> | undefined

  if (tourStop?.highlightPhases && tourStop.highlightPhases.length > 0) {
    const dwellElapsed =
      tourState.phase === 'dwelling'
        ? performance.now() - tourState.dwellStartMs
        : tourState.phase === 'fading'
          ? Infinity
          : -1

    const values: number[] = []
    const arcPairs: [number, number][] = []
    for (const phase of tourStop.highlightPhases) {
      if (phase.delayMs <= dwellElapsed) {
        values.push(...phase.values)
        if (phase.arcs) arcPairs.push(...phase.arcs)
      }
    }
    highlightSet = values.length > 0 ? new Set(values) : undefined
    if (arcPairs.length > 0) {
      highlightedArcSet = new Set(arcPairs.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`)))
    }
  } else if (tourStop?.highlightValues?.length) {
    highlightSet = new Set(tourStop.highlightValues)
  }

  return { highlightSet, highlightedArcSet, dimAmount }
}

// ── Sieve tick transforms ───────────────────────────────────────────

export interface SieveComputeResult {
  sieveTransforms: Map<number, SieveTickTransform> | undefined
  sieveUniformity: number
  sieveDwellElapsed: number
}

export function computeSieveState(
  tourState: { phase: string; stopIndex: number | null; virtualDwellMs: number },
  state: NumberLineState,
  cssWidth: number,
  cssHeight: number
): SieveComputeResult {
  const tourStop = tourState.stopIndex !== null ? PRIME_TOUR_STOPS[tourState.stopIndex] : null

  if (tourState.phase === 'idle' || tourStop?.id !== 'ancient-trick') {
    return { sieveTransforms: undefined, sieveUniformity: 0, sieveDwellElapsed: 0 }
  }

  const sieveDwellElapsed =
    tourState.phase === 'dwelling'
      ? tourState.virtualDwellMs
      : tourState.phase === 'fading'
        ? Infinity
        : 0

  const viewportRight = state.center + cssWidth / (2 * state.pixelsPerUnit)
  const sieveMaxN = Math.max(SWEEP_MAX_N, Math.ceil(viewportRight) + 5)
  const sieveTransforms = computeSieveTickTransforms(
    sieveMaxN,
    sieveDwellElapsed,
    cssHeight,
    viewportRight
  )
  const rawT = Math.min(1, sieveDwellElapsed / 2000)
  const sieveUniformity = rawT * (2 - rawT)

  return { sieveTransforms, sieveUniformity, sieveDwellElapsed }
}

// ── Indicator fade lifecycle ────────────────────────────────────────

export function computeIndicatorFade(
  indicator: {
    numbers: number[]
    range?: { from: number; to: number }
    startMs: number
    holdMs: number
  } | null
): { renderIndicator: RenderIndicator | undefined; expired: boolean } {
  if (!indicator) return { renderIndicator: undefined, expired: false }

  const elapsed = performance.now() - indicator.startMs
  const FADE_IN = 200
  const HOLD = indicator.holdMs
  const FADE_OUT = 1000
  const total = FADE_IN + HOLD + FADE_OUT
  let alpha: number
  if (elapsed < FADE_IN) {
    alpha = elapsed / FADE_IN
  } else if (elapsed < FADE_IN + HOLD) {
    alpha = 1
  } else if (elapsed < total) {
    alpha = 1 - (elapsed - FADE_IN - HOLD) / FADE_OUT
  } else {
    return { renderIndicator: undefined, expired: true }
  }

  if (alpha > 0) {
    return {
      renderIndicator: {
        numbers: indicator.numbers,
        range: indicator.range,
        alpha,
      },
      expired: false,
    }
  }
  return { renderIndicator: undefined, expired: true }
}

// ── Effective hovered value ─────────────────────────────────────────

export function computeEffectiveHovered(
  tourState: { phase: string; stopIndex: number | null },
  hoveredValue: number | null
): number | null {
  if (tourState.phase !== 'idle' && tourState.phase !== 'fading' && tourState.stopIndex !== null) {
    return PRIME_TOUR_STOPS[tourState.stopIndex]?.hoverValue ?? hoveredValue
  }
  return hoveredValue
}
