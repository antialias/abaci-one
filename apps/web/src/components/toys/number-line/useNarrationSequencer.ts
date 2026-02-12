import { useRef, useCallback } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'

// ── Types ───────────────────────────────────────────────────────────

/** Minimum shape a segment needs for the sequencer to drive it. */
export interface SequencerSegment {
  ttsText: string
  ttsTone?: string
  animationDurationMs: number
}

/** Returned by `tick()` every frame while the sequencer is active. */
export interface SequencerTickResult {
  /** Index of the segment currently playing. */
  segmentIndex: number
  /** 0–1 fraction of the current segment's animation duration elapsed. */
  animFrac: number
  /**
   * Cumulative virtual time (ms): sum of completed segment durations
   * plus clamped elapsed time in the current segment. Useful for
   * driving time-based overlays (e.g. sieve animation).
   */
  virtualTimeMs: number
  /** True when all segments have completed (both TTS and animation). */
  allDone: boolean
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * Reusable TTS segment sequencer.
 *
 * Encapsulates the three-ref pattern (segmentIndex, segmentStartMs,
 * ttsFinished), the `speakSegment` function, and the dual-gate
 * advancement logic (advance only when both TTS **and** animation
 * duration have completed).
 *
 * Used by both `usePrimeTour` (for segmented stops) and
 * `useConstantDemoNarration` (for all constant demos).
 *
 * The sequencer does **not** own a RAF loop — callers invoke `tick()`
 * from their own animation frame.
 */
export function useNarrationSequencer() {
  const audioManager = useAudioManagerInstance()
  const speak = useTTS({ tone: '', say: { en: '' } })

  const activeRef = useRef(false)
  const segmentsRef = useRef<SequencerSegment[]>([])
  const toneRef = useRef('')
  const segmentIndexRef = useRef(0)
  const segmentStartMsRef = useRef(0)
  const ttsFinishedRef = useRef(false)

  /** Speak a segment's TTS text, flagging ttsFinished when done. */
  const speakSegment = useCallback(
    (seg: SequencerSegment, tone: string, segIdx?: number) => {
      console.log(`[NarrationSeq] speakSegment[${segIdx ?? '?'}]: "${seg.ttsText.slice(0, 50)}"`)
      ttsFinishedRef.current = false
      speak(
        { say: { en: seg.ttsText }, tone: seg.ttsTone ?? tone },
      ).then(() => {
        ttsFinishedRef.current = true
      }).catch(() => {
        // TTS failed or cancelled — still allow segment advancement
        ttsFinishedRef.current = true
      })
    },
    [speak]
  )

  /**
   * Begin sequencing from segment 0. Speaks the first segment's TTS
   * immediately.
   */
  const start = useCallback(
    (segments: SequencerSegment[], tone: string) => {
      if (segments.length === 0) return
      console.log(`[NarrationSeq] START — ${segments.length} segments`)
      activeRef.current = true
      segmentsRef.current = segments
      toneRef.current = tone
      segmentIndexRef.current = 0
      segmentStartMsRef.current = performance.now()
      ttsFinishedRef.current = false
      speakSegment(segments[0], tone, 0)
    },
    [speakSegment]
  )

  /** Stop sequencing and cancel current TTS playback. */
  const stop = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    audioManager.stop()
  }, [audioManager])

  /**
   * Advance the sequencer by one frame. Call from your RAF loop.
   *
   * @param speedMultiplier  Scale factor for elapsed time (default 1).
   *                         Values > 1 speed up; < 1 slow down.
   * @returns Current state, or `null` if the sequencer is not active.
   */
  const tick = useCallback(
    (speedMultiplier = 1): SequencerTickResult | null => {
      if (!activeRef.current) return null

      const segments = segmentsRef.current
      const segIdx = segmentIndexRef.current
      const seg = segments[segIdx]
      if (!seg) {
        activeRef.current = false
        return null
      }

      const now = performance.now()
      const segElapsed =
        (now - segmentStartMsRef.current) * speedMultiplier
      const animFrac = Math.min(1, segElapsed / seg.animationDurationMs)

      // Check if current segment is complete (both TTS and animation)
      let allDone = false
      if (
        ttsFinishedRef.current &&
        segElapsed >= seg.animationDurationMs
      ) {
        const nextIdx = segIdx + 1
        if (nextIdx < segments.length) {
          // Advance to next segment
          console.log(`[NarrationSeq] advancing to segment[${nextIdx}]`)
          segmentIndexRef.current = nextIdx
          segmentStartMsRef.current = now
          ttsFinishedRef.current = false
          audioManager.stop()
          speakSegment(segments[nextIdx], toneRef.current, nextIdx)
        } else {
          allDone = true
          activeRef.current = false
        }
      }

      // Compute cumulative virtual time
      let virtualTimeMs = 0
      for (let i = 0; i < segmentIndexRef.current; i++) {
        virtualTimeMs += segments[i].animationDurationMs
      }
      const currentSeg = segments[segmentIndexRef.current]
      if (currentSeg) {
        const currentElapsed =
          (now - segmentStartMsRef.current) * speedMultiplier
        virtualTimeMs += Math.min(
          currentElapsed,
          currentSeg.animationDurationMs
        )
      }

      return {
        segmentIndex: allDone
          ? segments.length - 1
          : segmentIndexRef.current,
        animFrac: allDone ? 1 : animFrac,
        virtualTimeMs,
        allDone,
      }
    },
    [audioManager, speakSegment]
  )

  return { start, tick, stop }
}
