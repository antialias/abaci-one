import { useRef, useCallback, useEffect } from 'react'
import type { DemoState } from './useConstantDemo'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import {
  SUBTITLE_TOP_OFFSET, SUBTITLE_BOTTOM_OFFSET,
} from '../../viewportAnimation'
import { useNarrationSequencer } from '../../useNarrationSequencer'

// ── Shared types ────────────────────────────────────────────────────

export interface DemoNarrationSegment {
  /** Text sent to TTS for this segment */
  ttsText: string
  /** TTS tone override — falls back to the config's tone */
  ttsTone?: string
  /** revealProgress value at which this segment starts */
  startProgress: number
  /** revealProgress value at which this segment ends */
  endProgress: number
  /** Minimum wall-clock time (ms) to sweep from start to end */
  animationDurationMs: number
}

export interface DemoNarrationConfig {
  segments: DemoNarrationSegment[]
  tone: string
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * Generic TTS narration orchestrator for constant demos.
 *
 * Takes over `revealProgress` control from `useConstantDemo`'s 15s auto-play
 * by calling `setRevealProgress()` every frame. Each narration segment sweeps
 * progress from its startProgress to endProgress over animationDurationMs,
 * pausing at segment boundaries until both animation AND TTS complete.
 *
 * Supports multiple constants — pass a config map keyed by constantId.
 * Only constants present in the map get narration; others play silently
 * with the default 15s auto-play.
 *
 * When audio is disabled, `speak()` resolves immediately — gating depends
 * solely on `animationDurationMs`, producing a paced demo.
 *
 * @param configs  Static map: constantId → { segments, tone }. Must be
 *                 stable across renders (define at module level).
 */
export function useConstantDemoNarration(
  demoStateRef: React.MutableRefObject<DemoState>,
  setRevealProgress: (value: number) => void,
  configs: Record<string, DemoNarrationConfig>
) {
  const audioManager = useAudioManagerInstance()

  // Shared narration sequencer (handles TTS + segment gating)
  const { start: seqStart, tick: seqTick, stop: seqStop } = useNarrationSequencer()

  // Narration state refs
  const isNarratingRef = useRef(false)
  const activeConstantRef = useRef<string | null>(null)
  const activeConfigRef = useRef<DemoNarrationConfig | null>(null)
  const rafRef = useRef<number>(0)

  // Tracks which constantId we've already auto-started for, so we
  // don't re-trigger after the user scrubs or the demo restarts.
  const triggeredForRef = useRef<string | null>(null)

  /** Stop narration: cancel RAF, stop TTS, reset subtitle positioning. */
  const stopNarration = useCallback(() => {
    if (!isNarratingRef.current) return
    isNarratingRef.current = false
    activeConstantRef.current = null
    activeConfigRef.current = null
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    seqStop()
    audioManager.configure({ subtitleAnchor: 'bottom', subtitleBottomOffset: SUBTITLE_BOTTOM_OFFSET })
  }, [seqStop, audioManager])

  /** Start narration for the given constant. */
  const startNarration = useCallback((constantId: string) => {
    const config = configs[constantId]
    if (!config || config.segments.length === 0) return
    if (isNarratingRef.current) stopNarration()

    isNarratingRef.current = true
    activeConstantRef.current = constantId
    activeConfigRef.current = config

    // Position subtitles at top of viewport
    audioManager.configure({
      subtitleAnchor: 'top',
      subtitleBottomOffset: SUBTITLE_TOP_OFFSET,
    })

    // Start the sequencer (speaks segment 0 immediately)
    seqStart(config.segments, config.tone)

    // Start RAF tick loop
    const tick = () => {
      if (!isNarratingRef.current) return

      // Check if the demo is still active for this constant
      const ds = demoStateRef.current
      if (
        ds.phase === 'idle' ||
        ds.phase === 'fading' ||
        ds.constantId !== activeConstantRef.current
      ) {
        stopNarration()
        return
      }

      const cfg = activeConfigRef.current
      if (!cfg) { stopNarration(); return }

      // Drive progress via the shared sequencer
      const result = seqTick()
      if (!result) {
        // Sequencer finished or inactive — hold at final progress
        setRevealProgress(1)
        stopNarration()
        return
      }

      const seg = cfg.segments[result.segmentIndex]
      if (!seg) {
        setRevealProgress(1)
        stopNarration()
        return
      }

      // Sweep revealProgress linearly from seg.startProgress to seg.endProgress
      const targetProgress = seg.startProgress + (seg.endProgress - seg.startProgress) * result.animFrac
      setRevealProgress(targetProgress)

      if (result.allDone) {
        setRevealProgress(1)
        stopNarration()
        return
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [configs, demoStateRef, setRevealProgress, audioManager, seqStart, seqTick, stopNarration])

  /**
   * Idempotent auto-start: call from draw() after tickDemo().
   * Starts narration if the given constantId has a config AND narration
   * hasn't already been triggered for this demo session.
   */
  const startIfNeeded = useCallback((constantId: string | null) => {
    if (!constantId) return
    if (isNarratingRef.current) return
    if (triggeredForRef.current === constantId) return
    if (!configs[constantId]) return

    console.log(`[DemoNarration] startIfNeeded → starting narration for "${constantId}"`)
    triggeredForRef.current = constantId
    startNarration(constantId)
  }, [configs, startNarration])

  /**
   * Reset the auto-start trigger — call when a new demo session begins
   * (e.g. handleExploreConstant) so narration can re-trigger.
   */
  const reset = useCallback(() => {
    stopNarration()
    triggeredForRef.current = null
  }, [stopNarration])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isNarratingRef.current) {
        isNarratingRef.current = false
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = 0
        }
        seqStop()
        audioManager.configure({ subtitleAnchor: 'bottom', subtitleBottomOffset: SUBTITLE_BOTTOM_OFFSET })
      }
    }
  }, [seqStop, audioManager])

  return { startIfNeeded, stop: stopNarration, reset }
}
