/**
 * React hook for Euclid construction music via Strudel.
 *
 * Manages Strudel lifecycle, throttled pattern evaluation, one-shot
 * chimes/flourishes, and playback state.
 */

'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import type { ConstructionState } from '../types'
import type { FactStore } from '../engine/factStore'
import {
  geometryToPattern,
  intersectionChimePattern,
  completionFlourishPattern,
  getPointBounds,
} from './geometryToPattern'

// Declare global Strudel functions (made available after initStrudel)
declare global {
  function evaluate(code: string): Promise<unknown>
  function hush(): void
}

interface UseEuclidMusicOptions {
  constructionRef: React.MutableRefObject<ConstructionState>
  factStoreRef: React.MutableRefObject<FactStore>
  isComplete: boolean
}

export interface UseEuclidMusicReturn {
  isPlaying: boolean
  toggle: () => void
  notifyChange: () => void
  notifyIntersection: (x: number, y: number) => void
  notifyCompletion: () => void
}

/** Chime one-shot duration in ms */
const CHIME_DURATION = 2000
/** Flourish one-shot duration in ms */
const FLOURISH_DURATION = 4000
/** Throttle interval for pattern updates */
const THROTTLE_MS = 80

export function useEuclidMusic({
  constructionRef,
  factStoreRef,
  isComplete,
}: UseEuclidMusicOptions): UseEuclidMusicReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)
  const isInitializedRef = useRef(false)
  const initializingRef = useRef(false)
  const replRef = useRef<{ stop?: () => void } | null>(null)

  // Throttle state
  const lastUpdateRef = useRef(0)
  const trailingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // One-shot state
  const oneShotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentPatternRef = useRef<string>('')

  // Track isComplete for the pattern generator
  const isCompleteRef = useRef(isComplete)
  isCompleteRef.current = isComplete

  // Generate and evaluate the current construction pattern
  const evaluateCurrentPattern = useCallback(async () => {
    if (!isPlayingRef.current || !isInitializedRef.current) return

    const pattern = geometryToPattern(
      constructionRef.current,
      factStoreRef.current,
      isCompleteRef.current,
    )
    currentPatternRef.current = pattern

    try {
      await evaluate(pattern)
    } catch (err) {
      console.error('[EuclidMusic] Pattern evaluation failed:', err)
    }
  }, [constructionRef, factStoreRef])

  // Initialize Strudel (must be called from user gesture)
  const initialize = useCallback(async () => {
    if (isInitializedRef.current || initializingRef.current) return
    initializingRef.current = true

    try {
      // @ts-expect-error - @strudel/web doesn't have type declarations
      const { initStrudel, samples } = await import('@strudel/web')
      const repl = await initStrudel({
        prebake: () =>
          Promise.all([
            samples('github:switchangel/pad'),
            samples('github:tidalcycles/dirt-samples'),
          ]),
      })
      replRef.current = repl
      isInitializedRef.current = true
    } catch (err) {
      console.error('[EuclidMusic] Initialization failed:', err)
    } finally {
      initializingRef.current = false
    }
  }, [])

  // Toggle playback
  const toggle = useCallback(async () => {
    if (!isInitializedRef.current) {
      await initialize()
    }

    if (isPlayingRef.current) {
      // Stop
      try {
        if (typeof hush === 'function') hush()
        if (replRef.current?.stop) replRef.current.stop()
      } catch { /* ignore */ }
      isPlayingRef.current = false
      setIsPlaying(false)
    } else {
      // Start
      isPlayingRef.current = true
      setIsPlaying(true)
      await evaluateCurrentPattern()
    }
  }, [initialize, evaluateCurrentPattern])

  // Throttled pattern update (leading + trailing edge)
  const notifyChange = useCallback(() => {
    if (!isPlayingRef.current || !isInitializedRef.current) return

    const now = Date.now()

    if (trailingTimerRef.current) {
      clearTimeout(trailingTimerRef.current)
      trailingTimerRef.current = null
    }

    if (now - lastUpdateRef.current >= THROTTLE_MS) {
      // Leading edge
      lastUpdateRef.current = now
      evaluateCurrentPattern()
    } else {
      // Schedule trailing edge
      const remaining = THROTTLE_MS - (now - lastUpdateRef.current)
      trailingTimerRef.current = setTimeout(() => {
        lastUpdateRef.current = Date.now()
        trailingTimerRef.current = null
        evaluateCurrentPattern()
      }, remaining)
    }
  }, [evaluateCurrentPattern])

  // One-shot intersection chime
  const notifyIntersection = useCallback((x: number, y: number) => {
    if (!isPlayingRef.current || !isInitializedRef.current) return

    const { minX, maxX } = getPointBounds(constructionRef.current)

    const chime = intersectionChimePattern(x, y, minX, maxX)
    const main = currentPatternRef.current
    const stacked = main
      ? `stack(\n  ${main},\n  ${chime}\n)`
      : chime

    // Clear any existing one-shot timer
    if (oneShotTimerRef.current) {
      clearTimeout(oneShotTimerRef.current)
    }

    evaluate(stacked).catch(err =>
      console.error('[EuclidMusic] Chime evaluation failed:', err),
    )

    // Remove chime after decay
    oneShotTimerRef.current = setTimeout(() => {
      oneShotTimerRef.current = null
      if (isPlayingRef.current) {
        evaluateCurrentPattern()
      }
    }, CHIME_DURATION)
  }, [constructionRef, evaluateCurrentPattern])

  // Completion flourish
  const notifyCompletion = useCallback(() => {
    if (!isPlayingRef.current || !isInitializedRef.current) return

    // Update the main pattern with isComplete=true
    const main = geometryToPattern(
      constructionRef.current,
      factStoreRef.current,
      true,
    )
    currentPatternRef.current = main

    const flourish = completionFlourishPattern()
    const stacked = `stack(\n  ${main},\n  ${flourish}\n)`

    if (oneShotTimerRef.current) {
      clearTimeout(oneShotTimerRef.current)
    }

    evaluate(stacked).catch(err =>
      console.error('[EuclidMusic] Flourish evaluation failed:', err),
    )

    oneShotTimerRef.current = setTimeout(() => {
      oneShotTimerRef.current = null
      if (isPlayingRef.current) {
        evaluateCurrentPattern()
      }
    }, FLOURISH_DURATION)
  }, [constructionRef, factStoreRef, evaluateCurrentPattern])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trailingTimerRef.current) clearTimeout(trailingTimerRef.current)
      if (oneShotTimerRef.current) clearTimeout(oneShotTimerRef.current)

      try {
        if (typeof hush === 'function') hush()
        if (replRef.current?.stop) replRef.current.stop()
      } catch { /* ignore */ }

      replRef.current = null
      isPlayingRef.current = false
      isInitializedRef.current = false
    }
  }, [])

  return useMemo(() => ({
    isPlaying,
    toggle,
    notifyChange,
    notifyIntersection,
    notifyCompletion,
  }), [isPlaying, toggle, notifyChange, notifyIntersection, notifyCompletion])
}
