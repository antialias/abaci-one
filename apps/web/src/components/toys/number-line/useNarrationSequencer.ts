import { useRef, useCallback } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'

// ── Adaptive timing constants ────────────────────────────────────────

/**
 * Max ratio of effective duration to designed duration (stretch).
 * 1.8 means animation won't slow below ~0.56× designed speed.
 */
const MAX_STRETCH_RATIO = 1.8

/**
 * Min ratio of effective duration to designed duration (compress).
 * 0.6 means animation won't speed above ~1.67× designed speed.
 * Only applies when `adaptiveCompress` is true on the segment.
 */
const MIN_COMPRESS_RATIO = 0.6

/**
 * When TTS finishes and the remaining animation time is within this
 * threshold, advance to the next segment immediately instead of waiting.
 * Eliminates silent gaps between segments for continuous narration flow.
 */
const ADVANCE_TOLERANCE_MS = 1000

/**
 * Compute effective animation duration based on actual TTS audio length.
 *
 * Default (stretch only): animation stretches to match longer audio but
 * never plays faster than the designed pace.
 *
 * With adaptiveCompress: animation can also speed up when audio is shorter,
 * clamped to MIN_COMPRESS_RATIO.
 *
 * Both directions are clamped to MAX_STRETCH_RATIO to prevent absurdly
 * slow animations.
 */
function computeEffectiveDuration(
  seg: SequencerSegment,
  audioDurationMs: number | null
): number {
  if (audioDurationMs === null) return seg.animationDurationMs
  const designedMs = seg.animationDurationMs
  const maxMs = designedMs * MAX_STRETCH_RATIO
  if (seg.adaptiveCompress) {
    const minMs = designedMs * MIN_COMPRESS_RATIO
    return Math.max(minMs, Math.min(audioDurationMs, maxMs))
  }
  // Stretch only: never faster than designed
  return Math.max(designedMs, Math.min(audioDurationMs, maxMs))
}

// ── Types ───────────────────────────────────────────────────────────

/** Minimum shape a segment needs for the sequencer to drive it. */
export interface SequencerSegment {
  ttsText: string
  ttsTone?: string
  animationDurationMs: number
  /**
   * Allow animation to compress (speed up) when audio is shorter than
   * the designed duration. Default: false (stretch only — animation
   * slows to match longer audio but never plays faster than designed).
   */
  adaptiveCompress?: boolean
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

  // Adaptive timing: effective durations used for completed segments,
  // so virtualTimeMs stays consistent after segment advancement.
  const completedEffDurationsRef = useRef<number[]>([])

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
      completedEffDurationsRef.current = []
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

      // Adaptive timing: adjust animation pace to match actual TTS audio length
      const audioDurationMs = audioManager.getCurrentAudioDurationMs()
      const effectiveDuration = computeEffectiveDuration(seg, audioDurationMs)

      const animFrac = Math.min(1, segElapsed / effectiveDuration)

      // Advance when TTS is done AND animation is done or within tolerance.
      // The tolerance eliminates silent gaps: if the narrator finishes and
      // the animation has < 1s remaining, skip ahead so the next clip starts
      // immediately rather than waiting in silence.
      let allDone = false
      let advancedToNext = false
      const advanceThreshold = Math.max(0, effectiveDuration - ADVANCE_TOLERANCE_MS)
      const shouldAdvance = ttsFinishedRef.current && segElapsed >= advanceThreshold

      if (shouldAdvance) {
        // Record effective duration for virtualTimeMs consistency
        completedEffDurationsRef.current[segIdx] = effectiveDuration

        const nextIdx = segIdx + 1
        if (nextIdx < segments.length) {
          // Advance to next segment
          console.log(`[NarrationSeq] advancing to segment[${nextIdx}]`)
          segmentIndexRef.current = nextIdx
          segmentStartMsRef.current = now
          ttsFinishedRef.current = false
          audioManager.stop()
          speakSegment(segments[nextIdx], toneRef.current, nextIdx)
          advancedToNext = true
        } else {
          allDone = true
          activeRef.current = false
        }
      }

      // Compute cumulative virtual time using effective durations
      let virtualTimeMs = 0
      const effDurations = completedEffDurationsRef.current
      for (let i = 0; i < segmentIndexRef.current; i++) {
        virtualTimeMs += effDurations[i] ?? segments[i].animationDurationMs
      }
      const currentSeg = segments[segmentIndexRef.current]
      if (currentSeg) {
        const currentElapsed =
          (now - segmentStartMsRef.current) * speedMultiplier
        const currentAudioMs = audioManager.getCurrentAudioDurationMs()
        const currentEffective = computeEffectiveDuration(currentSeg, currentAudioMs)
        virtualTimeMs += Math.min(
          currentElapsed,
          currentEffective
        )
      }

      return {
        segmentIndex: allDone
          ? segments.length - 1
          : segmentIndexRef.current,
        // When advancing to next segment, report animFrac=0 (new segment
        // just started) to avoid a one-frame discontinuity where the old
        // segment's partial animFrac is applied to the new segment's range.
        animFrac: allDone ? 1 : advancedToNext ? 0 : animFrac,
        virtualTimeMs,
        allDone,
      }
    },
    [audioManager, speakSegment]
  )

  return { start, tick, stop }
}
