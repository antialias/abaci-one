import { useRef, useCallback } from 'react'
import type { NumberLineState } from '../../types'
import { goldenRatioDemoViewport } from './goldenRatioDemo'
import { piDemoViewport } from './piDemo'
import { tauDemoViewport } from './tauDemo'

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
/** Duration of fade-out when user deviates (ms) */
const FADE_OUT_MS = 600
/** Duration of initial fade-in (ms) */
const FADE_IN_MS = 400
/** How far the user can deviate before the demo fades out (fraction of viewport) */
const DEVIATION_THRESHOLD = 0.4

/** Constants that have demos available */
export const DEMO_AVAILABLE = new Set(['phi', 'pi', 'tau'])

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

      // Viewport interpolation (smooth exponential)
      const vpT = Math.min(1, elapsed / VIEWPORT_ANIM_MS)
      const eased = 1 - Math.pow(1 - vpT, 3) // ease-out cubic
      const src = sourceViewportRef.current
      const tgt = targetViewportRef.current

      // Interpolate center linearly
      stateRef.current.center = src.center + (tgt.center - src.center) * eased
      // Interpolate pixelsPerUnit logarithmically for smooth zoom
      const logSrc = Math.log(src.pixelsPerUnit)
      const logTgt = Math.log(tgt.pixelsPerUnit)
      stateRef.current.pixelsPerUnit = Math.exp(logSrc + (logTgt - logSrc) * eased)

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
          // Snap viewport exactly to target
          stateRef.current.center = tgt.center
          stateRef.current.pixelsPerUnit = tgt.pixelsPerUnit
        }
      }
    } else if (ds.phase === 'presenting') {
      // Detect deviation from target viewport
      const tgt = targetViewportRef.current
      const current = stateRef.current

      const centerDev = Math.abs(current.center - tgt.center) / (tgt.center || 1)
      const zoomDev = Math.abs(Math.log(current.pixelsPerUnit / tgt.pixelsPerUnit))

      // Combined deviation metric
      const deviation = centerDev + zoomDev * 0.5

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
  }, [stateRef, stopLoop])

  const setRevealProgress = useCallback((value: number) => {
    const ds = demoStateRef.current
    if (ds.phase === 'idle') return

    isPausedRef.current = true
    ds.revealProgress = Math.max(0, Math.min(1, value))

    // Snap viewport to target (skip interpolation) when scrubbing
    const tgt = targetViewportRef.current
    stateRef.current.center = tgt.center
    stateRef.current.pixelsPerUnit = tgt.pixelsPerUnit

    // Ensure opacity is full while scrubbing
    ds.opacity = 1

    // If we were fading, go back to animating so the overlay stays visible
    if (ds.phase === 'fading') {
      ds.phase = 'animating'
    }

    onRedraw()
  }, [stateRef, onRedraw])

  return { demoState: demoStateRef, startDemo, tickDemo, cancelDemo, setRevealProgress }
}
