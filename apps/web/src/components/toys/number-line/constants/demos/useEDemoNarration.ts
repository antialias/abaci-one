import { useRef, useCallback, useEffect } from 'react'
import type { DemoState } from './useConstantDemo'
import { E_DEMO_SEGMENTS, E_DEMO_TONE } from './eDemoNarration'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'

/** Subtitle offset from top edge when anchored to top during narration. */
const NARRATION_SUBTITLE_TOP_OFFSET = 16

/**
 * Orchestrates TTS narration for the e demo ("The Magic Vine").
 *
 * Takes over `revealProgress` control from `useConstantDemo`'s 15s auto-play
 * by calling `setRevealProgress()` every frame. Each narration segment sweeps
 * progress from its startProgress to endProgress over animationDurationMs,
 * pausing at segment boundaries until both animation AND TTS complete.
 *
 * When audio is disabled, `speak()` resolves immediately — gating depends
 * solely on `animationDurationMs`, producing a ~70s paced demo.
 */
export function useEDemoNarration(
  demoStateRef: React.MutableRefObject<DemoState>,
  setRevealProgress: (value: number) => void
) {
  const audioManager = useAudioManagerInstance()
  const speak = useTTS({ tone: E_DEMO_TONE, say: { en: '' } })

  // Narration state refs
  const isNarratingRef = useRef(false)
  const segmentIndexRef = useRef(0)
  const segmentStartMsRef = useRef(0)
  const ttsFinishedRef = useRef(false)
  const rafRef = useRef<number>(0)

  /** Speak a segment's TTS text, resolving ttsFinishedRef when done. */
  const speakSegment = useCallback((segIdx: number) => {
    const seg = E_DEMO_SEGMENTS[segIdx]
    if (!seg) return
    ttsFinishedRef.current = false
    speak(
      { say: { en: seg.ttsText }, tone: seg.ttsTone ?? E_DEMO_TONE },
    ).then(() => {
      ttsFinishedRef.current = true
    }).catch(() => {
      // TTS failed or cancelled — still allow segment advancement
      ttsFinishedRef.current = true
    })
  }, [speak])

  /** Stop narration: cancel RAF, stop TTS, reset subtitle positioning. */
  const stopNarration = useCallback(() => {
    if (!isNarratingRef.current) return
    isNarratingRef.current = false
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    audioManager.stop()
    audioManager.configure({ subtitleAnchor: 'bottom', subtitleBottomOffset: 64 })
  }, [audioManager])

  /** Start narration from segment 0. */
  const startNarration = useCallback(() => {
    if (isNarratingRef.current) return

    isNarratingRef.current = true
    segmentIndexRef.current = 0
    segmentStartMsRef.current = performance.now()
    ttsFinishedRef.current = false

    // Position subtitles at top of viewport
    audioManager.configure({
      subtitleAnchor: 'top',
      subtitleBottomOffset: NARRATION_SUBTITLE_TOP_OFFSET,
    })

    // Start TTS for segment 0
    speakSegment(0)

    // Start RAF tick loop
    const tick = () => {
      if (!isNarratingRef.current) return

      // Check if the demo is still active
      const ds = demoStateRef.current
      if (ds.phase === 'idle' || ds.phase === 'fading' || ds.constantId !== 'e') {
        stopNarration()
        return
      }

      const now = performance.now()
      const segIdx = segmentIndexRef.current
      const seg = E_DEMO_SEGMENTS[segIdx]

      if (!seg) {
        // All segments done
        stopNarration()
        return
      }

      const elapsed = now - segmentStartMsRef.current
      const animFrac = Math.min(1, elapsed / seg.animationDurationMs)

      // Sweep revealProgress linearly from seg.startProgress to seg.endProgress
      const targetProgress = seg.startProgress + (seg.endProgress - seg.startProgress) * animFrac
      setRevealProgress(targetProgress)

      // Check if this segment is complete (both TTS and animation done)
      if (animFrac >= 1 && ttsFinishedRef.current) {
        const nextIdx = segIdx + 1
        if (nextIdx < E_DEMO_SEGMENTS.length) {
          // Advance to next segment
          segmentIndexRef.current = nextIdx
          segmentStartMsRef.current = now
          ttsFinishedRef.current = false
          audioManager.stop()
          speakSegment(nextIdx)
        } else {
          // All segments complete — hold at final progress
          setRevealProgress(1)
          stopNarration()
          return
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [demoStateRef, setRevealProgress, audioManager, speakSegment, stopNarration])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isNarratingRef.current) {
        isNarratingRef.current = false
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = 0
        }
        // Restore subtitle positioning
        audioManager.configure({ subtitleAnchor: 'bottom', subtitleBottomOffset: 64 })
      }
    }
  }, [audioManager])

  return {
    startNarration,
    stopNarration,
    isNarratingRef,
  }
}
