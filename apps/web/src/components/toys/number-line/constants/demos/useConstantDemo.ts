import { useRef, useCallback } from 'react'
import type { NumberLineState } from '../../types'
import { goldenRatioDemoViewport } from './goldenRatioDemo'
import { piDemoViewport } from './piDemo'
import { tauDemoViewport } from './tauDemo'
import { eDemoViewport } from './eDemo'
import { gammaDemoViewport } from './gammaDemo'
import { sqrt2DemoViewport } from './sqrt2Demo'
import { sqrt3DemoViewport } from './sqrt3Demo'
import { ln2DemoViewport } from './ln2Demo'
import { ramanujanDemoViewport } from './ramanujanDemo'
import { feigenbaumDemoViewport } from './feigenbaumDemo'
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

import { CONSTANT_IDS } from '../../talkToNumber/explorationRegistry'

/** Constants that have demos available */
const DEMO_AVAILABLE = CONSTANT_IDS

/** Compute the target viewport for a given constant's demo. */
function getDemoViewport(
  constantId: string,
  cssWidth: number,
  cssHeight: number
): { center: number; pixelsPerUnit: number } {
  if (constantId === 'phi') return goldenRatioDemoViewport(cssWidth, cssHeight)
  if (constantId === 'pi') return piDemoViewport(cssWidth, cssHeight)
  if (constantId === 'tau') return tauDemoViewport(cssWidth, cssHeight)
  if (constantId === 'e') return eDemoViewport(cssWidth, cssHeight)
  if (constantId === 'gamma') return gammaDemoViewport(cssWidth, cssHeight)
  if (constantId === 'sqrt2') return sqrt2DemoViewport(cssWidth, cssHeight)
  if (constantId === 'sqrt3') return sqrt3DemoViewport(cssWidth, cssHeight)
  if (constantId === 'ln2') return ln2DemoViewport(cssWidth, cssHeight)
  if (constantId === 'ramanujan') return ramanujanDemoViewport(cssWidth, cssHeight)
  if (constantId === 'feigenbaum') return feigenbaumDemoViewport(cssWidth, cssHeight)
  return { center: 0, pixelsPerUnit: 100 }
}

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

  if (constantId === 'sqrt3') {
    const base = sqrt3DemoViewport(cssWidth, cssHeight)
    return [
      // Start at base viewport (matches the demo's initial fly-in target)
      { progress: 0.80, ...base },
      // Progressive zoom into √3 ≈ 1.7320508075688772...
      { progress: 0.82,  center: 2,       pixelsPerUnit: ppuForRange(cssWidth, 1, 2) },
      { progress: 0.835, center: 1.75,    pixelsPerUnit: ppuForRange(cssWidth, 1.7, 1.8) },
      { progress: 0.85,  center: 1.735,   pixelsPerUnit: ppuForRange(cssWidth, 1.73, 1.74) },
      { progress: 0.865, center: 1.7325,  pixelsPerUnit: ppuForRange(cssWidth, 1.732, 1.733) },
      { progress: 0.88,  center: 1.73205, pixelsPerUnit: ppuForRange(cssWidth, 1.7320, 1.7321) },
      { progress: 0.895, center: 1.732052, pixelsPerUnit: ppuForRange(cssWidth, 1.73205, 1.73206) },
      { progress: 0.91,  center: 1.7320508, pixelsPerUnit: ppuForRange(cssWidth, 1.732050, 1.732051) },
      // Zoom back out for the reveal phase (√3 label, star, formula)
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

  if (constantId === 'ln2') {
    const base = ln2DemoViewport(cssWidth, cssHeight)
    // Zoom in during seg 2 (more bounces) then HOLD for seg 3+4 so the
    // spiraling convergence is apparent from the arcs shrinking, not the
    // viewport. Zoom back out for the reveal labels.
    return [
      // Hold base viewport through seg 0 + seg 1 (place + first bounces)
      { progress: 0.00, ...base },
      { progress: 0.35, ...base },
      // Seg 2: zoom in as bounces 5–12 get smaller
      { progress: 0.45, center: 0.65, pixelsPerUnit: ppuForRange(cssWidth, 0.3, 1.0) },
      { progress: 0.55, center: 0.69, pixelsPerUnit: ppuForRange(cssWidth, 0.45, 0.85) },
      // Seg 3 + 4: hold steady — let the tiny arcs show convergence
      { progress: 0.86, center: 0.69, pixelsPerUnit: ppuForRange(cssWidth, 0.45, 0.85) },
      // Seg 5: zoom back out for reveal labels
      { progress: 0.90, center: 0.55, pixelsPerUnit: ppuForRange(cssWidth, 0.15, 1.05) },
      { progress: 1.00, center: 0.55, pixelsPerUnit: ppuForRange(cssWidth, 0.15, 1.05) },
    ]
  }

  if (constantId === 'feigenbaum') {
    const base = feigenbaumDemoViewport(cssWidth, cssHeight)
    return [
      // Seg 0–1: Focus on iteration track at r=2.8
      { progress: 0.000, ...base },
      // Seg 2: Sliding dial — shift center right
      { progress: 0.140, center: 2.9, pixelsPerUnit: ppuForRange(cssWidth, 2.5, 3.3) },
      // Seg 3: Approaching split point
      { progress: 0.200, center: 3.1, pixelsPerUnit: ppuForRange(cssWidth, 2.7, 3.5) },
      // Seg 3: First split at r=3.2
      { progress: 0.300, center: 3.1, pixelsPerUnit: ppuForRange(cssWidth, 2.8, 3.5) },
      // Seg 5: Moving to r=3.5
      { progress: 0.370, center: 3.3, pixelsPerUnit: ppuForRange(cssWidth, 2.9, 3.7) },
      // Seg 6: Cascade region
      { progress: 0.450, center: 3.45, pixelsPerUnit: ppuForRange(cssWidth, 3.0, 3.6) },
      // Seg 7: Zoom out for full diagram
      { progress: 0.560, center: 3.1, pixelsPerUnit: ppuForRange(cssWidth, 2.4, 3.7) },
      // Seg 7: Hold for diagram
      { progress: 0.640, center: 3.1, pixelsPerUnit: ppuForRange(cssWidth, 2.4, 3.7) },
      // Seg 8: Zoom in for gap bars
      { progress: 0.700, center: 3.25, pixelsPerUnit: ppuForRange(cssWidth, 2.9, 3.6) },
      // Seg 9: Pan right for ratios
      { progress: 0.770, center: 4.0, pixelsPerUnit: ppuForRange(cssWidth, 3.0, 5.5) },
      // Seg 10: Wide view for universality
      { progress: 0.820, center: 4.0, pixelsPerUnit: ppuForRange(cssWidth, 2.5, 5.5) },
      // Seg 11: Center on delta
      { progress: 0.910, center: 4.669, pixelsPerUnit: ppuForRange(cssWidth, 4.0, 5.3) },
      { progress: 1.000, center: 4.669, pixelsPerUnit: ppuForRange(cssWidth, 4.0, 5.3) },
    ]
  }

  if (constantId === 'ramanujan') {
    const base = ramanujanDemoViewport(cssWidth, cssHeight)
    return [
      // Act 1: divergence [0,15] — hold wide view for racing dot
      { progress: 0.000, ...base },
      { progress: 0.075, ...base },  // Hold through diverge + early hook
      // Act 2: harmonic/square convergence — zoom to s-parameter view [0,4]
      { progress: 0.100, center: 2,    pixelsPerUnit: ppuForRange(cssWidth, 0, 4) },
      // Act 3: knob/curve — widen to see s=2,3,4 points [−0.5,6.5]
      { progress: 0.260, center: 3,    pixelsPerUnit: ppuForRange(cssWidth, -0.5, 6.5) },
      // Act 4: pole — hold view for curve + approaching wall [−1,6]
      { progress: 0.420, center: 2.5,  pixelsPerUnit: ppuForRange(cssWidth, -1, 6) },
      // Act 5: bridge — failed attempts + smooth continuation [−3,5]
      { progress: 0.520, center: 1,    pixelsPerUnit: ppuForRange(cssWidth, -3, 5) },
      // Act 5→6 transition: crossing zero, flipper concept [−3,3]
      { progress: 0.650, center: 0,    pixelsPerUnit: ppuForRange(cssWidth, -3, 3) },
      // Act 6: flipper + connect — see both sides [−2,2]
      { progress: 0.700, center: 0,    pixelsPerUnit: ppuForRange(cssWidth, -2, 2) },
      // Act 7: volcano — tight on s=−1 [−2,1]
      { progress: 0.810, center: -0.5, pixelsPerUnit: ppuForRange(cssWidth, -2, 1) },
      // Act 7: trust — zoom OUT to see convergent points at s=2,3,4 [−1.5,5]
      { progress: 0.850, center: 1.75, pixelsPerUnit: ppuForRange(cssWidth, -1.5, 5) },
      // Act 7: reveal — zoom back tight for −1/12 starburst [−2,1]
      { progress: 0.895, center: -0.5, pixelsPerUnit: ppuForRange(cssWidth, -2, 1) },
      // Act 7: hold tight for recap + ghost note
      { progress: 1.000, center: -0.5, pixelsPerUnit: ppuForRange(cssWidth, -2, 1) },
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
  /** Restore a demo at a specific progress (skip fly-in, start paused) */
  restoreDemo: (constantId: string, progress: number) => void
  /** Called every frame from draw() to update animation and detect deviation */
  tickDemo: () => void
  cancelDemo: () => void
  /** Pauses auto-play and sets revealProgress to the given value (0-1) */
  setRevealProgress: (value: number) => void
  /** Signal that the user has zoomed/panned — demo will fade out */
  markUserInteraction: () => void
} {
  const demoStateRef = useRef<DemoState>({ ...INITIAL_STATE })
  const animStartRef = useRef(0)
  const targetViewportRef = useRef({ center: 0, pixelsPerUnit: 100 })
  const sourceViewportRef = useRef({ center: 0, pixelsPerUnit: 100 })
  const rafRef = useRef<number>(0)
  const fadeStartRef = useRef(0)
  const isPausedRef = useRef(false)
  const userInteractedRef = useRef(false)

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

    const target = getDemoViewport(constantId, cssWidthRef.current, cssHeightRef.current)

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
      // User zoomed/panned on the number line → dismiss the demo.
      // Checked BEFORE lerpViewport/zoom-keyframes so the user's
      // viewport position is preserved (not overwritten).
      if (userInteractedRef.current) {
        userInteractedRef.current = false
        ds.phase = 'fading'
        // Start the fade from the current opacity (may be < 1 during fly-in)
        fadeStartRef.current = now - (1 - ds.opacity) * FADE_OUT_MS
        return
      }

      // When paused (narration driving progress, or user scrubbed),
      // don't override the viewport — setRevealProgress() handles positioning.
      if (isPausedRef.current) {
        // When reveal is complete, transition to 'presenting' so
        // deviation detection continues via the normal path.
        if (ds.revealProgress >= 1) {
          ds.phase = 'presenting'
          ds.opacity = 1
          snapViewport(targetViewportRef.current, stateRef.current)
        }
        return
      }

      // --- Normal auto-play flow ---

      // Fade in
      ds.opacity = Math.min(1, elapsed / FADE_IN_MS)

      // Viewport interpolation
      const vpT = lerpViewport(
        sourceViewportRef.current, targetViewportRef.current,
        elapsed, VIEWPORT_ANIM_MS, stateRef.current
      )

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
      // User zoomed/panned → dismiss
      if (userInteractedRef.current) {
        userInteractedRef.current = false
        ds.phase = 'fading'
        fadeStartRef.current = now - (1 - ds.opacity) * FADE_OUT_MS
        return
      }
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

  /**
   * Restore a demo at a specific progress point (e.g. from URL params on reload).
   * Unlike startDemo, this skips the fly-in animation, snaps the viewport
   * immediately, and starts paused so the user can press play when ready.
   */
  const restoreDemo = useCallback((constantId: string, progress: number) => {
    if (!DEMO_AVAILABLE.has(constantId)) return
    const target = getDemoViewport(constantId, cssWidthRef.current, cssHeightRef.current)

    // Snap viewport (skip fly-in animation)
    sourceViewportRef.current = { ...target }
    targetViewportRef.current = { ...target }
    snapViewport(target, stateRef.current)

    // Initialize state — phase 'animating' + isPaused so tickDemo holds position
    demoStateRef.current = { phase: 'animating', constantId, revealProgress: 0, opacity: 1 }
    isPausedRef.current = true
    userInteractedRef.current = false
    animStartRef.current = performance.now()
    startLoop()

    // Delegate to setRevealProgress for zoom keyframe handling + viewport snap
    setRevealProgress(Math.max(0, Math.min(1, progress)))
  }, [stateRef, cssWidthRef, cssHeightRef, startLoop, setRevealProgress])

  const markUserInteraction = useCallback(() => {
    const ds = demoStateRef.current
    if (ds.phase === 'idle' || ds.phase === 'fading') return
    userInteractedRef.current = true
  }, [])

  return { demoState: demoStateRef, startDemo, restoreDemo, tickDemo, cancelDemo, setRevealProgress, markUserInteraction }
}
