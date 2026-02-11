import { useRef, useCallback, useState } from 'react'
import type { NumberLineState } from '../types'
import { PRIME_TOUR_STOPS, TOUR_TONE } from './primeTourStops'
import type { PrimeTourStop } from './primeTourStops'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'

export type TourPhase = 'idle' | 'flying' | 'dwelling' | 'fading'

export interface TourState {
  phase: TourPhase
  stopIndex: number | null
  /** 0-1 viewport interpolation progress */
  flightProgress: number
  /** 0-1 overlay opacity */
  opacity: number
}

const INITIAL_STATE: TourState = {
  phase: 'idle',
  stopIndex: null,
  flightProgress: 0,
  opacity: 0,
}

// --- Animation timing ---
const FLIGHT_MS = 1400
const FADE_IN_MS = 400
const FADE_OUT_MS = 600
const DEVIATION_THRESHOLD = 0.5

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

  // React state for overlay rendering (synced from ref in tickTour)
  const [currentStopIndex, setCurrentStopIndex] = useState<number | null>(null)

  const audioManager = useAudioManagerInstance()

  // TTS speak function — we pass different text per stop via overrides
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
    }
    animStartRef.current = performance.now()
    ttsFinishedRef.current = false
    setCurrentStopIndex(index)
    startLoop()
  }, [stateRef, startLoop])

  /** Start the tour from stop 0. */
  const startTour = useCallback(() => {
    tourStateRef.current = { ...INITIAL_STATE }
    flyToStop(0)
  }, [flyToStop])

  /** Advance to the next stop (or finish if on last). */
  const nextStop = useCallback(() => {
    const ts = tourStateRef.current
    if (ts.stopIndex === null) return
    const nextIdx = ts.stopIndex + 1
    if (nextIdx >= PRIME_TOUR_STOPS.length) {
      // Tour complete — fade out
      ts.phase = 'fading'
      fadeStartRef.current = performance.now()
      audioManager.stop()
      return
    }
    audioManager.stop()
    flyToStop(nextIdx)
  }, [flyToStop, audioManager])

  /** Go back to the previous stop. */
  const prevStop = useCallback(() => {
    const ts = tourStateRef.current
    if (ts.stopIndex === null || ts.stopIndex <= 0) return
    audioManager.stop()
    flyToStop(ts.stopIndex - 1)
  }, [flyToStop, audioManager])

  /** Gracefully exit the tour. */
  const exitTour = useCallback(() => {
    const ts = tourStateRef.current
    if (ts.phase === 'idle') return
    ts.phase = 'fading'
    fadeStartRef.current = performance.now()
    audioManager.stop()
  }, [audioManager])

  /** Start TTS narration for the current stop. */
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
      const vpT = Math.min(1, elapsed / FLIGHT_MS)
      const eased = 1 - Math.pow(1 - vpT, 3) // ease-out cubic
      const src = sourceViewportRef.current
      const tgt = targetViewportRef.current

      // Center: linear interpolation
      stateRef.current.center = src.center + (tgt.center - src.center) * eased
      // PPU: logarithmic interpolation for smooth zoom
      const logSrc = Math.log(src.pixelsPerUnit)
      const logTgt = Math.log(tgt.pixelsPerUnit)
      stateRef.current.pixelsPerUnit = Math.exp(logSrc + (logTgt - logSrc) * eased)

      ts.flightProgress = vpT

      // Transition to dwelling when flight complete
      if (vpT >= 1) {
        ts.phase = 'dwelling'
        ts.flightProgress = 1
        ts.opacity = 1
        stateRef.current.center = tgt.center
        stateRef.current.pixelsPerUnit = tgt.pixelsPerUnit
        dwellStartRef.current = now

        // Start TTS narration
        const stop = PRIME_TOUR_STOPS[ts.stopIndex!]
        if (stop) {
          speakCurrentStop(stop)
        }
      }
    } else if (ts.phase === 'dwelling') {
      const stop = PRIME_TOUR_STOPS[ts.stopIndex!]
      if (!stop) return

      // Detect user deviation from target viewport
      const tgt = targetViewportRef.current
      const current = stateRef.current
      const centerDev = Math.abs(current.center - tgt.center) / (Math.abs(tgt.center) || 1)
      const zoomDev = Math.abs(Math.log(current.pixelsPerUnit / tgt.pixelsPerUnit))
      const deviation = centerDev + zoomDev * 0.5

      if (deviation > DEVIATION_THRESHOLD) {
        exitTour()
        return
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
        stopLoop()
        return
      }
    }
  }, [stateRef, stopLoop, speakCurrentStop, nextStop, exitTour])

  /** The prime value the tour wants hovered (for forcing tooltip/arcs), or null. */
  const forcedHoverValue = (() => {
    const ts = tourStateRef.current
    if (ts.phase === 'idle' || ts.phase === 'fading') return null
    if (ts.stopIndex === null) return null
    const stop = PRIME_TOUR_STOPS[ts.stopIndex]
    return stop?.hoverValue ?? null
  })()

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
