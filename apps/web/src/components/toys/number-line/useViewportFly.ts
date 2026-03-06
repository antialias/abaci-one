/**
 * useViewportFly — animated viewport transitions for conference calls,
 * look_at commands, and indicate highlights.
 *
 * Extracted from NumberLine.tsx. Manages callFlyRef, conference-number
 * fly-in, lookAtFnRef assignment, and indicateFnRef assignment.
 */

import { useRef, useEffect, useCallback } from 'react'
import type { NumberLineState } from './types'
import { lerpViewport } from './viewportAnimation'
import type { Viewport } from './viewportAnimation'
import type { CallState } from './talkToNumber/useRealtimeVoice'

export interface UseViewportFlyOptions {
  stateRef: React.MutableRefObject<NumberLineState>
  cssWidthRef: React.MutableRefObject<number>
  draw: () => void
  conferenceNumbers: number[]
  voiceState: CallState
  /** When true, indicate's auto-zoom is suppressed (game controls viewport). */
  suppressIndicateZoomRef: React.MutableRefObject<boolean>
}

export interface UseViewportFlyReturn {
  /** Animate viewport to show a center point with a given range of units. */
  lookAt: (center: number, range: number) => void
  /** Show a temporary indicator with optional auto-zoom. */
  indicate: (
    numbers: number[],
    range?: { from: number; to: number },
    durationSeconds?: number,
    persistent?: boolean
  ) => void
  /** Ref to the current indicator state (read by draw()). */
  indicatorRef: React.MutableRefObject<{
    numbers: number[]
    range?: { from: number; to: number }
    startMs: number
    holdMs: number
  } | null>
}

export function useViewportFly({
  stateRef,
  cssWidthRef,
  draw,
  conferenceNumbers,
  voiceState,
  suppressIndicateZoomRef,
}: UseViewportFlyOptions): UseViewportFlyReturn {
  const callFlyRef = useRef<{
    src: Viewport
    tgt: Viewport
    startMs: number
    raf: number
  } | null>(null)

  const indicatorRef = useRef<{
    numbers: number[]
    range?: { from: number; to: number }
    startMs: number
    holdMs: number
  } | null>(null)

  // Internal fly helper
  const startFly = useCallback(
    (tgt: Viewport, durationMs = 800) => {
      const src: Viewport = {
        center: stateRef.current.center,
        pixelsPerUnit: stateRef.current.pixelsPerUnit,
      }
      const startMs = performance.now()

      if (callFlyRef.current) cancelAnimationFrame(callFlyRef.current.raf)

      const fly = (callFlyRef.current = { src, tgt, startMs, raf: 0 })
      const tick = () => {
        const elapsed = performance.now() - fly.startMs
        const t = lerpViewport(fly.src, fly.tgt, elapsed, durationMs, stateRef.current)
        draw()
        if (t < 1) {
          fly.raf = requestAnimationFrame(tick)
        } else {
          callFlyRef.current = null
        }
      }
      fly.raf = requestAnimationFrame(tick)
    },
    [stateRef, draw]
  )

  const lookAt = useCallback(
    (center: number, range: number) => {
      const cssWidth = cssWidthRef.current
      if (cssWidth <= 0) return
      const targetPpu = cssWidth / Math.max(range, 0.01)
      startFly({ center, pixelsPerUnit: targetPpu })
    },
    [cssWidthRef, startFly]
  )

  // Animate viewport to fit all conference call participants
  useEffect(() => {
    if (conferenceNumbers.length === 0 || voiceState !== 'active') {
      if (callFlyRef.current) {
        cancelAnimationFrame(callFlyRef.current.raf)
        callFlyRef.current = null
      }
      return
    }

    const cssWidth = cssWidthRef.current
    if (cssWidth <= 0) return

    const lo = Math.min(...conferenceNumbers)
    const hi = Math.max(...conferenceNumbers)
    const span = hi - lo
    const center = (lo + hi) / 2

    let targetPpu: number
    if (span === 0) {
      targetPpu = cssWidth / 10
    } else {
      targetPpu = (cssWidth * 0.4) / span
    }

    const currentPpu = stateRef.current.pixelsPerUnit
    const screenLo = (center - lo) * currentPpu
    const screenHi = (hi - center) * currentPpu
    const alreadyFits =
      screenLo < cssWidth * 0.4 &&
      screenHi < cssWidth * 0.4 &&
      Math.abs(stateRef.current.center - center) * currentPpu < cssWidth * 0.3
    if (alreadyFits && conferenceNumbers.length <= 1) {
      draw()
      return
    }

    targetPpu = Math.min(targetPpu, Math.max(currentPpu, cssWidth / 10))
    startFly({ center, pixelsPerUnit: targetPpu })

    return () => {
      if (callFlyRef.current) {
        cancelAnimationFrame(callFlyRef.current.raf)
        callFlyRef.current = null
      }
    }
  }, [conferenceNumbers, voiceState, draw, cssWidthRef, stateRef, startFly])

  const indicate = useCallback(
    (
      numbers: number[],
      range?: { from: number; to: number },
      durationSeconds?: number,
      persistent?: boolean
    ) => {
      const holdMs = persistent
        ? Infinity
        : durationSeconds != null
          ? Math.max(1, Math.min(30, durationSeconds)) * 1000
          : 4000

      // Compute bounding extent of all indicated content
      const allValues = [...numbers]
      if (range) {
        allValues.push(range.from, range.to)
      }
      if (allValues.length > 0) {
        const minVal = Math.min(...allValues)
        const maxVal = Math.max(...allValues)
        const cssWidth = cssWidthRef.current
        const ppu = stateRef.current.pixelsPerUnit
        const viewCenter = stateRef.current.center
        const halfView = cssWidth / (2 * ppu)
        const viewMin = viewCenter - halfView
        const viewMax = viewCenter + halfView

        if (!suppressIndicateZoomRef.current && (minVal < viewMin || maxVal > viewMax)) {
          const span = maxVal - minVal
          const center = (minVal + maxVal) / 2
          const rangeWithMargin = Math.max(span / 0.8, 0.01)
          lookAt(center, rangeWithMargin)
        }
      }

      indicatorRef.current = { numbers, range, startMs: performance.now(), holdMs }
      const tick = () => {
        if (!indicatorRef.current) return
        draw()
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    },
    [cssWidthRef, stateRef, draw, lookAt]
  )

  return { lookAt, indicate, indicatorRef }
}
