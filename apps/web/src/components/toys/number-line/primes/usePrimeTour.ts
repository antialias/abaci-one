import { useRef, useCallback, useState, useEffect } from 'react'
import type { NumberLineState } from '../types'
import { PRIME_TOUR_STOPS, TOUR_TONE } from './primeTourStops'
import type { PrimeTourStop } from './primeTourStops'
import { computeSieveViewports, getSieveViewportState } from './renderSieveOverlay'
import type { SievePhaseViewports } from './renderSieveOverlay'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import {
  lerpViewport, snapViewport, computeViewportDeviation,
  FADE_IN_MS, FADE_OUT_MS,
  SUBTITLE_TOP_OFFSET, SUBTITLE_BOTTOM_OFFSET,
} from '../viewportAnimation'
import { useNarrationSequencer } from '../useNarrationSequencer'

export type TourPhase = 'idle' | 'flying' | 'dwelling' | 'fading'

export interface TourState {
  phase: TourPhase
  stopIndex: number | null
  /** 0-1 viewport interpolation progress */
  flightProgress: number
  /** 0-1 overlay opacity */
  opacity: number
  /** performance.now() when dwelling began — used for phase timing */
  dwellStartMs: number
  /** Gated elapsed time for overlays — pauses between segments when TTS is still playing */
  virtualDwellMs: number
}

const INITIAL_STATE: TourState = {
  phase: 'idle',
  stopIndex: null,
  flightProgress: 0,
  opacity: 0,
  dwellStartMs: 0,
  virtualDwellMs: 0,
}

// --- Animation timing ---
const FLIGHT_MS = 1400
const DEVIATION_THRESHOLD = 0.5

// --- Sieve speed debug tuning (module-level mutable) ---
let sieveSpeed = 0.25
export function getSieveSpeed(): number { return sieveSpeed }
export function setSieveSpeed(v: number): void { sieveSpeed = Math.max(0.1, v) }

/**
 * Multi-stop guided tour through prime number visualizations.
 *
 * State machine: idle → flying → dwelling → flying → ... → fading → idle
 *
 * Modeled on `useConstantDemo` but with multiple sequential stops,
 * TTS narration per stop, and auto-advance on narration completion.
 */
export function usePrimeTour(
  stateRef: React.MutableRefObject<NumberLineState>,
  cssWidthRef: React.MutableRefObject<number>,
  cssHeightRef: React.MutableRefObject<number>,
  onRedraw: () => void
) {
  const tourStateRef = useRef<TourState>({ ...INITIAL_STATE })
  const animStartRef = useRef(0)
  const sourceViewportRef = useRef({ center: 0, pixelsPerUnit: 100 })
  const targetViewportRef = useRef({ center: 0, pixelsPerUnit: 100 })
  const fadeStartRef = useRef(0)
  const rafRef = useRef<number>(0)
  const dwellStartRef = useRef(0)
  const ttsFinishedRef = useRef(false)

  // Sieve viewport animation keyframes (cached when ancient-trick dwell starts)
  const sieveViewportsRef = useRef<SievePhaseViewports[] | null>(null)

  // Narration sequencer for segmented stops
  const { start: seqStart, tick: seqTick, stop: seqStop } = useNarrationSequencer()

  // React state for overlay rendering (synced from ref in tickTour)
  const [currentStopIndex, setCurrentStopIndex] = useState<number | null>(null)

  const audioManager = useAudioManagerInstance()

  // TTS speak function — used for non-segmented (legacy) stops
  const speak = useTTS({ tone: TOUR_TONE, say: { en: '' } })

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

  /** Begin flying to a specific stop index. */
  const flyToStop = useCallback((index: number) => {
    const stop = PRIME_TOUR_STOPS[index]
    if (!stop) return

    sourceViewportRef.current = {
      center: stateRef.current.center,
      pixelsPerUnit: stateRef.current.pixelsPerUnit,
    }
    targetViewportRef.current = { ...stop.viewport }

    tourStateRef.current = {
      phase: 'flying',
      stopIndex: index,
      flightProgress: 0,
      opacity: tourStateRef.current.opacity, // preserve during mid-tour transitions
      dwellStartMs: 0,
      virtualDwellMs: 0,
    }
    animStartRef.current = performance.now()
    ttsFinishedRef.current = false
    setCurrentStopIndex(index)
    startLoop()
  }, [stateRef, startLoop])

  /** Start the tour from stop 0. */
  const startTour = useCallback(() => {
    tourStateRef.current = { ...INITIAL_STATE }
    audioManager.configure({ subtitleAnchor: 'top', subtitleBottomOffset: SUBTITLE_TOP_OFFSET })
    flyToStop(0)
  }, [flyToStop, audioManager])

  /** Advance to the next stop (or finish if on last). */
  const nextStop = useCallback(() => {
    const ts = tourStateRef.current
    if (ts.stopIndex === null) return
    const nextIdx = ts.stopIndex + 1
    if (nextIdx >= PRIME_TOUR_STOPS.length) {
      // Tour complete — fade out
      ts.phase = 'fading'
      fadeStartRef.current = performance.now()
      seqStop()
      audioManager.stop()
      return
    }
    seqStop()
    audioManager.stop()
    flyToStop(nextIdx)
  }, [flyToStop, seqStop, audioManager])

  /** Go back to the previous stop. */
  const prevStop = useCallback(() => {
    const ts = tourStateRef.current
    if (ts.stopIndex === null || ts.stopIndex <= 0) return
    seqStop()
    audioManager.stop()
    flyToStop(ts.stopIndex - 1)
  }, [flyToStop, seqStop, audioManager])

  /** Gracefully exit the tour. */
  const exitTour = useCallback(() => {
    const ts = tourStateRef.current
    if (ts.phase === 'idle') return
    ts.phase = 'fading'
    fadeStartRef.current = performance.now()
    seqStop()
    audioManager.stop()
  }, [seqStop, audioManager])

  /** Start TTS narration for the current stop (non-segmented, legacy). */
  const speakCurrentStop = useCallback((stop: PrimeTourStop) => {
    ttsFinishedRef.current = false
    speak(
      { say: { en: stop.ttsText }, tone: stop.ttsTone },
    ).then(() => {
      ttsFinishedRef.current = true
    }).catch(() => {
      // TTS failed or was cancelled — still allow auto-advance
      ttsFinishedRef.current = true
    })
  }, [speak])

  /**
   * Called every frame from draw() to update animation and detect deviation.
   */
  const tickTour = useCallback(() => {
    const ts = tourStateRef.current
    if (ts.phase === 'idle') return

    const now = performance.now()

    if (ts.phase === 'flying') {
      const elapsed = now - animStartRef.current

      // Fade in
      ts.opacity = Math.min(1, elapsed / FADE_IN_MS)

      // Viewport interpolation
      const vpT = lerpViewport(
        sourceViewportRef.current, targetViewportRef.current,
        elapsed, FLIGHT_MS, stateRef.current
      )

      ts.flightProgress = vpT

      // Transition to dwelling when flight complete
      if (vpT >= 1) {
        ts.phase = 'dwelling'
        ts.flightProgress = 1
        ts.opacity = 1
        ts.dwellStartMs = now
        ts.virtualDwellMs = 0
        snapViewport(targetViewportRef.current, stateRef.current)
        dwellStartRef.current = now

        // Start TTS narration
        const stop = PRIME_TOUR_STOPS[ts.stopIndex!]
        if (stop) {
          // Cache sieve viewport keyframes for ancient-trick stop
          if (stop.id === 'ancient-trick') {
            sieveViewportsRef.current = computeSieveViewports(cssWidthRef.current, 120)
          } else {
            sieveViewportsRef.current = null
          }

          if (stop.narrationSegments && stop.narrationSegments.length > 0) {
            // Segmented narration: drive via shared sequencer
            seqStart(stop.narrationSegments, stop.ttsTone)
          } else {
            // Single TTS clip (legacy)
            speakCurrentStop(stop)
          }
        }
      }
    } else if (ts.phase === 'dwelling') {
      const stop = PRIME_TOUR_STOPS[ts.stopIndex!]
      if (!stop) return

      // Detect user deviation from target viewport
      const deviation = computeViewportDeviation(
        stateRef.current, targetViewportRef.current
      )

      if (deviation > DEVIATION_THRESHOLD) {
        exitTour()
        return
      }

      const segments = stop.narrationSegments
      const speedMul = stop.id === 'ancient-trick' ? sieveSpeed : 1
      if (segments && segments.length > 0) {
        // --- Segmented narration: drive via shared sequencer ---
        const result = seqTick(speedMul)
        if (result) {
          ts.virtualDwellMs = result.virtualTimeMs
          if (result.allDone) {
            ttsFinishedRef.current = true
          }
        }
      } else {
        // Non-segmented: virtual time = wall-clock dwell time
        ts.virtualDwellMs = (now - dwellStartRef.current) * speedMul
      }

      // Animate viewport during sieve animation (ancient-trick stop)
      if (stop.id === 'ancient-trick' && sieveViewportsRef.current) {
        const vpState = getSieveViewportState(
          ts.virtualDwellMs,
          sieveViewportsRef.current,
          { center: 55, pixelsPerUnit: 5 },
          cssWidthRef.current,
          120
        )
        if (vpState) {
          stateRef.current.center = vpState.center
          stateRef.current.pixelsPerUnit = vpState.pixelsPerUnit
          targetViewportRef.current = { ...vpState } // keep deviation detection in sync
        }
      }

      // Auto-advance: TTS finished AND minDwellMs elapsed
      const dwellElapsed = now - dwellStartRef.current
      if (stop.autoAdvance && ttsFinishedRef.current && dwellElapsed >= stop.minDwellMs) {
        nextStop()
      }
    } else if (ts.phase === 'fading') {
      const fadeElapsed = now - fadeStartRef.current
      ts.opacity = Math.max(0, 1 - fadeElapsed / FADE_OUT_MS)

      if (ts.opacity <= 0) {
        tourStateRef.current = { ...INITIAL_STATE }
        setCurrentStopIndex(null)
        audioManager.configure({ subtitleAnchor: 'bottom', subtitleBottomOffset: SUBTITLE_BOTTOM_OFFSET })
        stopLoop()
        return
      }
    }
  }, [stateRef, stopLoop, speakCurrentStop, seqStart, seqTick, audioManager, nextStop, exitTour])

  /** The prime value the tour wants hovered (for forcing tooltip/arcs), or null. */
  const forcedHoverValue = (() => {
    const ts = tourStateRef.current
    if (ts.phase === 'idle' || ts.phase === 'fading') return null
    if (ts.stopIndex === null) return null
    const stop = PRIME_TOUR_STOPS[ts.stopIndex]
    return stop?.hoverValue ?? null
  })()

  // Reset subtitle offset if component unmounts mid-tour
  useEffect(() => {
    return () => {
      if (tourStateRef.current.phase !== 'idle') {
        audioManager.configure({ subtitleAnchor: 'bottom', subtitleBottomOffset: SUBTITLE_BOTTOM_OFFSET })
      }
    }
  }, [audioManager])

  return {
    tourState: tourStateRef,
    currentStopIndex,
    totalStops: PRIME_TOUR_STOPS.length,
    currentStop: currentStopIndex !== null ? PRIME_TOUR_STOPS[currentStopIndex] : null,
    startTour,
    nextStop,
    prevStop,
    exitTour,
    tickTour,
    forcedHoverValue,
  }
}
