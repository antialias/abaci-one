import { useRef, useCallback } from 'react'
import type { NumberLineState } from '../../types'
import { goldenRatioDemoViewport } from './goldenRatioDemo'
import { piDemoViewport } from './piDemo'
import { tauDemoViewport } from './tauDemo'
import { eDemoViewport } from './eDemo'
import { gammaDemoViewport } from './gammaDemo'
import { sqrt2DemoViewport } from './sqrt2Demo'
import { ramanujanDemoViewport } from './ramanujanDemo'
import {
  lerpViewport, snapViewport, computeViewportDeviation,
  FADE_IN_MS, FADE_OUT_MS,
} from '../../viewportAnimation'

export type DemoPhase = 'idle' | 'animating' | 'presenting' | 'fading'

export interface DemoState {
  phase: DemoPhase
  constantId: string | null
  /** 0-1 progress for subdivision reveal */
  revealProgress: number
  /** 0-1 overall overlay opacity */
  opacity: number
}

const INITIAL_STATE: DemoState = {
  phase: 'idle',
  constantId: null,
  revealProgress: 0,
  opacity: 0,
}

// --- Animation timing ---

/** Duration of viewport fly-in animation (ms) */
const VIEWPORT_ANIM_MS = 1200
/** Duration of subdivision reveal after viewport arrives (ms) */
const REVEAL_ANIM_MS = 15000
/** How far the user can deviate before the demo fades out (fraction of viewport) */
const DEVIATION_THRESHOLD = 0.4

/** Constants that have demos available */
export const DEMO_AVAILABLE = new Set(['phi', 'pi', 'tau', 'e', 'gamma', 'sqrt2', 'ramanujan'])

// ── Viewport zoom keyframes ────────────────────────────────────────
//
// Demos that zoom into their constant's decimal expansion define
// keyframes here. The tick function interpolates through them,
// driving the ACTUAL number-line viewport (center + pixelsPerUnit).

interface ViewportKeyframe {
  /** revealProgress at which this viewport should be reached */
  progress: number
  center: number
  pixelsPerUnit: number
}

/** Compute PPU needed to fit a [lo, hi] range across 75% of the screen width. */
function ppuForRange(cssWidth: number, lo: number, hi: number): number {
  return cssWidth * 0.75 / (hi - lo)
}

/**
 * Build zoom keyframes for a given demo.
 * Returns null if the demo has no zoom phase.
 */
function getZoomKeyframes(
  constantId: string,
  cssWidth: number,
  cssHeight: number
): ViewportKeyframe[] | null {
  if (constantId === 'sqrt2') {
    const base = sqrt2DemoViewport(cssWidth, cssHeight)
    return [
      // Start at base viewport (matches the demo's initial fly-in target)
      { progress: 0.80, ...base },
      // Progressive zoom into √2 ≈ 1.4142135623730951...
      { progress: 0.82,  center: 1.5,       pixelsPerUnit: ppuForRange(cssWidth, 1, 2) },
      { progress: 0.835, center: 1.45,      pixelsPerUnit: ppuForRange(cssWidth, 1.4, 1.5) },
      { progress: 0.85,  center: 1.415,     pixelsPerUnit: ppuForRange(cssWidth, 1.41, 1.42) },
      { progress: 0.865, center: 1.4145,    pixelsPerUnit: ppuForRange(cssWidth, 1.414, 1.415) },
      { progress: 0.88,  center: 1.41425,   pixelsPerUnit: ppuForRange(cssWidth, 1.4142, 1.4143) },
      { progress: 0.895, center: 1.414215,  pixelsPerUnit: ppuForRange(cssWidth, 1.41421, 1.41422) },
      { progress: 0.91,  center: 1.4142135, pixelsPerUnit: ppuForRange(cssWidth, 1.414213, 1.414214) },
      // Zoom back out for the reveal phase (√2 label, star, formula)
      { progress: 0.935, ...base },
    ]
  }

  if (constantId === 'pi') {
    const base = piDemoViewport(cssWidth, cssHeight)
    return [
      { progress: 0.90, ...base },
      // Progressive zoom into π ≈ 3.14159265358979...
      { progress: 0.915, center: 3.5,        pixelsPerUnit: ppuForRange(cssWidth, 3, 4) },
      { progress: 0.93,  center: 3.15,       pixelsPerUnit: ppuForRange(cssWidth, 3.1, 3.2) },
      { progress: 0.945, center: 3.145,      pixelsPerUnit: ppuForRange(cssWidth, 3.14, 3.15) },
      { progress: 0.96,  center: 3.1415,     pixelsPerUnit: ppuForRange(cssWidth, 3.141, 3.142) },
      { progress: 0.975, center: 3.14155,    pixelsPerUnit: ppuForRange(cssWidth, 3.1415, 3.1416) },
      { progress: 0.99,  center: 3.141595,   pixelsPerUnit: ppuForRange(cssWidth, 3.14159, 3.14160) },
      { progress: 1.0,   center: 3.1415925,  pixelsPerUnit: ppuForRange(cssWidth, 3.141592, 3.141593) },
    ]
  }

  if (constantId === 'ramanujan') {
    const base = ramanujanDemoViewport(cssWidth, cssHeight)
    return [
      // Phase 0: divergence view [0,15]
      { progress: 0.00, ...base },
      // Phase 1-3: shift to derivation work area [−3,5]
      { progress: 0.10, center: 1,     pixelsPerUnit: ppuForRange(cssWidth, -3, 5) },
      // Hold derivation view through phases 1-3
      { progress: 0.70, center: 1,     pixelsPerUnit: ppuForRange(cssWidth, -3, 5) },
      // Phase 4: zoom into reveal at [−0.5,0.5]
      { progress: 0.85, center: -0.04, pixelsPerUnit: ppuForRange(cssWidth, -0.5, 0.5) },
      // Hold reveal view
      { progress: 1.00, center: -0.04, pixelsPerUnit: ppuForRange(cssWidth, -0.5, 0.5) },
    ]
  }

  return null
}

/**
 * Interpolate between viewport keyframes at the given progress.
 * Returns null if progress is before the first keyframe.
 * Uses smoothstep easing and log-space PPU interpolation for smooth zoom.
 */
function interpolateViewportKeyframes(
  keyframes: ViewportKeyframe[],
  progress: number
): { center: number; pixelsPerUnit: number } | null {
  if (keyframes.length === 0 || progress < keyframes[0].progress) return null

  // Past the last keyframe — hold at last value
  if (progress >= keyframes[keyframes.length - 1].progress) {
    const last = keyframes[keyframes.length - 1]
    return { center: last.center, pixelsPerUnit: last.pixelsPerUnit }
  }

  // Find the two keyframes we're between
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]
    const b = keyframes[i + 1]
    if (progress >= a.progress && progress < b.progress) {
      const t = (progress - a.progress) / (b.progress - a.progress)
      // Smoothstep easing
      const st = t * t * (3 - 2 * t)
      // Linear center interpolation
      const center = a.center + (b.center - a.center) * st
      // Log-space PPU interpolation for perceptually smooth zoom
      const logA = Math.log(a.pixelsPerUnit)
      const logB = Math.log(b.pixelsPerUnit)
      const pixelsPerUnit = Math.exp(logA + (logB - logA) * st)
      return { center, pixelsPerUnit }
    }
  }

  return null
}

/**
 * Hook managing the constant demonstration lifecycle.
 *
 * State machine: idle → animating → presenting → fading → idle
 *
 * During 'animating', the viewport is smoothly interpolated to the target
 * and subdivisions are revealed progressively. During 'presenting', the
 * user observes the end result. If they pan/zoom beyond a threshold, the
 * overlay fades out ('fading') and then returns to 'idle'.
 */
export function useConstantDemo(
  stateRef: React.MutableRefObject<NumberLineState>,
  cssWidthRef: React.MutableRefObject<number>,
  cssHeightRef: React.MutableRefObject<number>,
  onRedraw: () => void
): {
  demoState: React.MutableRefObject<DemoState>
  startDemo: (constantId: string) => void
  /** Called every frame from draw() to update animation and detect deviation */
  tickDemo: () => void
  cancelDemo: () => void
  /** Pauses auto-play and sets revealProgress to the given value (0-1) */
  setRevealProgress: (value: number) => void
} {
  const demoStateRef = useRef<DemoState>({ ...INITIAL_STATE })
  const animStartRef = useRef(0)
  const targetViewportRef = useRef({ center: 0, pixelsPerUnit: 100 })
  const sourceViewportRef = useRef({ center: 0, pixelsPerUnit: 100 })
  const rafRef = useRef<number>(0)
  const fadeStartRef = useRef(0)
  const isPausedRef = useRef(false)

  const stopLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [])

  const startLoop = useCallback(() => {
    if (rafRef.current) return
    const tick = () => {
      onRedraw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [onRedraw])

  const startDemo = useCallback((constantId: string) => {
    if (!DEMO_AVAILABLE.has(constantId)) return

    const cssWidth = cssWidthRef.current
    const cssHeight = cssHeightRef.current

    // Compute target viewport for this constant's demo
    let target = { center: 0, pixelsPerUnit: 100 }
    if (constantId === 'phi') {
      target = goldenRatioDemoViewport(cssWidth, cssHeight)
    } else if (constantId === 'pi') {
      target = piDemoViewport(cssWidth, cssHeight)
    } else if (constantId === 'tau') {
      target = tauDemoViewport(cssWidth, cssHeight)
    } else if (constantId === 'e') {
      target = eDemoViewport(cssWidth, cssHeight)
    } else if (constantId === 'gamma') {
      target = gammaDemoViewport(cssWidth, cssHeight)
    } else if (constantId === 'sqrt2') {
      target = sqrt2DemoViewport(cssWidth, cssHeight)
    } else if (constantId === 'ramanujan') {
      target = ramanujanDemoViewport(cssWidth, cssHeight)
    }

    // Store source viewport for interpolation
    sourceViewportRef.current = {
      center: stateRef.current.center,
      pixelsPerUnit: stateRef.current.pixelsPerUnit,
    }
    targetViewportRef.current = target

    demoStateRef.current = {
      phase: 'animating',
      constantId,
      revealProgress: 0,
      opacity: 0,
    }
    isPausedRef.current = false
    animStartRef.current = performance.now()

    startLoop()
  }, [stateRef, cssWidthRef, cssHeightRef, startLoop])

  const cancelDemo = useCallback(() => {
    demoStateRef.current = { ...INITIAL_STATE }
    stopLoop()
  }, [stopLoop])

  /**
   * Called every frame from draw() to:
   * 1. Animate viewport during 'animating' phase
   * 2. Update reveal progress
   * 3. Detect user deviation during 'presenting' phase
   * 4. Handle fade-out timing
   */
  const tickDemo = useCallback(() => {
    const ds = demoStateRef.current
    if (ds.phase === 'idle') return

    const now = performance.now()
    const elapsed = now - animStartRef.current

    if (ds.phase === 'animating') {
      // Fade in
      ds.opacity = Math.min(1, elapsed / FADE_IN_MS)

      // Viewport interpolation
      const vpT = lerpViewport(
        sourceViewportRef.current, targetViewportRef.current,
        elapsed, VIEWPORT_ANIM_MS, stateRef.current
      )

      // Reveal progress: skip update when paused (user is scrubbing)
      if (!isPausedRef.current) {
        const revealStart = VIEWPORT_ANIM_MS * 0.6
        if (elapsed > revealStart) {
          ds.revealProgress = Math.min(1, (elapsed - revealStart) / REVEAL_ANIM_MS)
        }

        // Transition to presenting when both viewport and reveal are done
        const totalDuration = revealStart + REVEAL_ANIM_MS
        if (elapsed >= totalDuration) {
          ds.phase = 'presenting'
          ds.revealProgress = 1
          ds.opacity = 1
          snapViewport(targetViewportRef.current, stateRef.current)
        }
      }

      // Suppress unused variable warning — vpT is used implicitly
      // (lerpViewport mutates stateRef; vpT available for future use)
      void vpT

      // Apply zoom keyframes — overrides lerpViewport for demos with
      // irrationality zoom phases (√2, π). The keyframes drive the
      // actual number-line viewport to zoom into the constant's position.
      if (ds.constantId) {
        const kfs = getZoomKeyframes(
          ds.constantId, cssWidthRef.current, cssHeightRef.current
        )
        if (kfs) {
          const zoomVp = interpolateViewportKeyframes(kfs, ds.revealProgress)
          if (zoomVp) {
            stateRef.current.center = zoomVp.center
            stateRef.current.pixelsPerUnit = zoomVp.pixelsPerUnit
            // Update source+target so lerpViewport converges here next frame
            // and deviation detection uses the zoom viewport as reference
            sourceViewportRef.current = { ...zoomVp }
            targetViewportRef.current = { ...zoomVp }
          }
        }
      }
    } else if (ds.phase === 'presenting') {
      const deviation = computeViewportDeviation(
        stateRef.current, targetViewportRef.current
      )
      if (deviation > DEVIATION_THRESHOLD) {
        ds.phase = 'fading'
        fadeStartRef.current = now
        ds.opacity = 1
      }
    } else if (ds.phase === 'fading') {
      const fadeElapsed = now - fadeStartRef.current
      ds.opacity = Math.max(0, 1 - fadeElapsed / FADE_OUT_MS)

      if (ds.opacity <= 0) {
        demoStateRef.current = { ...INITIAL_STATE }
        stopLoop()
        return
      }
    }
  }, [stateRef, stopLoop, cssWidthRef, cssHeightRef])

  const setRevealProgress = useCallback((value: number) => {
    const ds = demoStateRef.current
    if (ds.phase === 'idle') return

    isPausedRef.current = true
    ds.revealProgress = Math.max(0, Math.min(1, value))

    // Apply zoom keyframes if scrubbing into a zoom phase
    let handled = false
    if (ds.constantId) {
      const kfs = getZoomKeyframes(
        ds.constantId, cssWidthRef.current, cssHeightRef.current
      )
      if (kfs) {
        const zoomVp = interpolateViewportKeyframes(kfs, ds.revealProgress)
        if (zoomVp) {
          stateRef.current.center = zoomVp.center
          stateRef.current.pixelsPerUnit = zoomVp.pixelsPerUnit
          sourceViewportRef.current = { ...zoomVp }
          targetViewportRef.current = { ...zoomVp }
          handled = true
        }
      }
    }
    if (!handled) {
      // Snap viewport to target (skip interpolation) when scrubbing
      snapViewport(targetViewportRef.current, stateRef.current)
    }

    // Ensure opacity is full while scrubbing
    ds.opacity = 1

    // If we were fading, go back to animating so the overlay stays visible
    if (ds.phase === 'fading') {
      ds.phase = 'animating'
    }

    onRedraw()
  }, [stateRef, onRedraw, cssWidthRef, cssHeightRef])

  return { demoState: demoStateRef, startDemo, tickDemo, cancelDemo, setRevealProgress }
}
