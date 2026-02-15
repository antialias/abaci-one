import { useRef, useCallback } from 'react'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'

// ── Adaptive timing constants ────────────────────────────────────────

/**
 * Max ratio of effective duration to designed duration (stretch).
 * 3.0 means animation won't slow below ~0.33× designed speed.
 * Generous to accommodate TTS clips that are significantly longer
 * than the designed animation (e.g. 9.5s audio for a 5s animation).
 */
const MAX_STRETCH_RATIO = 3.0

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
  const mutedRef = useRef(false)
  const segmentsRef = useRef<SequencerSegment[]>([])
  const toneRef = useRef('')
  const segmentIndexRef = useRef(0)
  const segmentStartMsRef = useRef(0)
  const ttsFinishedRef = useRef(false)

  // Adaptive timing: effective durations used for completed segments,
  // so virtualTimeMs stays consistent after segment advancement.
  const completedEffDurationsRef = useRef<number[]>([])

  // Timing ref: when did the current segment's TTS audio finish?
  const ttsFinishedAtRef = useRef(0)

  // Latched audio duration for the current segment — set once when
  // metadata becomes available, stays stable for the rest of the segment
  // to prevent animFrac jumps when duration changes from null to real.
  const segAudioDurRef = useRef<number | null>(null)

  // Initial fraction for mid-segment resume: when startFrom is called
  // with a non-zero initialFrac, tick() maps elapsed time from
  // initialFrac→1 instead of 0→1, so the animation picks up exactly
  // where the user scrubbed regardless of adaptive timing.
  const initialFracRef = useRef(0)

  /** Speak a segment's TTS text, flagging ttsFinished when done. */
  const speakSegment = useCallback(
    (seg: SequencerSegment, tone: string, segIdx?: number) => {
      ttsFinishedRef.current = false

      // When muted, leave ttsFinished = false — the sequencer will hold at
      // the segment boundary (animFrac = 1) until releaseTtsGate() is called.
      // This lets the voice agent talk at their own pace.
      if (mutedRef.current) {
        return
      }

      speak(
        { say: { en: seg.ttsText }, tone: seg.ttsTone ?? tone },
      ).then(() => {
        ttsFinishedAtRef.current = performance.now()
        ttsFinishedRef.current = true
      }).catch(() => {
        ttsFinishedAtRef.current = performance.now()
        // TTS failed or cancelled — still allow segment advancement
        ttsFinishedRef.current = true
      })

      // Preload next segment's audio so the transition is instant (no network wait)
      if (segIdx !== undefined) {
        const nextSeg = segmentsRef.current[segIdx + 1]
        if (nextSeg) {
          audioManager.preloadForSpeak(
            { say: { en: nextSeg.ttsText }, tone: nextSeg.ttsTone ?? tone }
          )
        }
      }
    },
    [speak, audioManager]
  )

  /**
   * Begin sequencing from segment 0. Speaks the first segment's TTS
   * immediately.
   */
  const start = useCallback(
    (segments: SequencerSegment[], tone: string) => {
      if (segments.length === 0) return
      activeRef.current = true
      segmentsRef.current = segments
      toneRef.current = tone
      segmentIndexRef.current = 0
      segmentStartMsRef.current = performance.now()
      ttsFinishedRef.current = false
      completedEffDurationsRef.current = []
      segAudioDurRef.current = null
      initialFracRef.current = 0
      speakSegment(segments[0], tone, 0)
    },
    [speakSegment]
  )

  /**
   * Begin sequencing from an arbitrary segment index.
   * Pre-populates completedEffDurationsRef with designed durations for
   * skipped segments so virtualTimeMs stays consistent.
   *
   * @param initialFrac  Starting animation fraction (0–1) within the
   *                     segment. tick() maps elapsed time from
   *                     initialFrac→1 so progress resumes from the
   *                     exact scrubbed position regardless of adaptive
   *                     timing stretching the effective duration.
   */
  const startFrom = useCallback(
    (segments: SequencerSegment[], tone: string, fromIndex: number, initialFrac = 0) => {
      if (segments.length === 0 || fromIndex >= segments.length) return
      activeRef.current = true
      segmentsRef.current = segments
      toneRef.current = tone
      segmentIndexRef.current = fromIndex
      segmentStartMsRef.current = performance.now()
      ttsFinishedRef.current = false
      segAudioDurRef.current = null
      initialFracRef.current = initialFrac
      // Pre-fill completed durations for skipped segments using designed durations
      const effDurations: number[] = []
      for (let i = 0; i < fromIndex; i++) {
        effDurations[i] = segments[i].animationDurationMs
      }
      completedEffDurationsRef.current = effDurations
      speakSegment(segments[fromIndex], tone, fromIndex)
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
      const rawElapsed =
        (now - segmentStartMsRef.current) * speedMultiplier

      // Adaptive timing: latch audio duration once known, then use it for
      // the rest of the segment to prevent animFrac jumps.
      if (segAudioDurRef.current === null) {
        const dur = audioManager.getCurrentAudioDurationMs()
        if (dur !== null) segAudioDurRef.current = dur
      }
      const audioDurationMs = segAudioDurRef.current
      const effectiveDuration = computeEffectiveDuration(seg, audioDurationMs)

      // When resuming mid-segment (initialFrac > 0), only the remaining
      // portion of the segment's effective duration is left to play.
      // Map elapsed time into initialFrac→1 so the animation picks up
      // exactly where the user scrubbed, regardless of adaptive stretching.
      const startFrac = initialFracRef.current
      const remainingDuration = effectiveDuration * (1 - startFrac)
      const remainingFrac = remainingDuration > 0
        ? Math.min(1, rawElapsed / remainingDuration)
        : 1
      const animFrac = startFrac + remainingFrac * (1 - startFrac)

      // For advancement gating, use elapsed relative to remaining duration
      const segElapsed = rawElapsed

      // Advance when TTS is done AND animation is done or within tolerance.
      // The tolerance eliminates silent gaps: if the narrator finishes and
      // the animation has < 1s remaining, skip ahead so the next clip starts
      // immediately rather than waiting in silence.
      let allDone = false
      let advancedToNext = false
      const advanceThreshold = Math.max(0, remainingDuration - ADVANCE_TOLERANCE_MS)
      const shouldAdvance = ttsFinishedRef.current && segElapsed >= advanceThreshold

      if (shouldAdvance) {
        // Record effective duration for virtualTimeMs consistency
        completedEffDurationsRef.current[segIdx] = effectiveDuration

        const nextIdx = segIdx + 1
        if (nextIdx < segments.length) {
          // Advance to next segment — speak() handles cancellation internally
          // and won't clear the preloaded audio cache, so the next clip
          // starts instantly from the already-buffered Audio element.
          segmentIndexRef.current = nextIdx
          segmentStartMsRef.current = now
          ttsFinishedRef.current = false
          segAudioDurRef.current = null
          initialFracRef.current = 0 // new segment starts from 0
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
        // Account for initial frac when computing virtual time
        const currentStartFrac = initialFracRef.current
        const currentRemaining = currentEffective * (1 - currentStartFrac)
        virtualTimeMs += currentStartFrac * currentEffective + Math.min(
          currentElapsed,
          currentRemaining
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

  /** Release the TTS gate so the sequencer advances past the current segment.
   *  Used when muted: external code (e.g. voice-agent silence detection) calls
   *  this to signal the narrator finished speaking for the current segment. */
  const releaseTtsGate = useCallback(() => {
    if (!activeRef.current) return
    ttsFinishedAtRef.current = performance.now()
    ttsFinishedRef.current = true
  }, [])

  return { start, startFrom, tick, stop, mutedRef, releaseTtsGate, segmentIndexRef }
}
