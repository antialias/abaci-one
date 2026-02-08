'use client'

import { useEffect, useRef } from 'react'
import { useAudioHelp } from '@/contexts/AudioHelpContext'
import { AUDIO_MANIFEST_MAP } from '@/lib/audio/audioManifest'

interface UseTutorialAudioHelpOptions {
  currentStepIndex: number
  stepTitle: string | undefined
}

/**
 * Plays audio for tutorial steps when they change.
 * Uses pre-generated clips when available, falls back to browser SpeechSynthesis.
 */
export function useTutorialAudioHelp({ currentStepIndex, stepTitle }: UseTutorialAudioHelpOptions) {
  const { isEnabled, playClip, stop } = useAudioHelp()
  const lastStepIndexRef = useRef<number>(-1)

  useEffect(() => {
    if (!isEnabled) return
    if (currentStepIndex === lastStepIndexRef.current) return
    lastStepIndexRef.current = currentStepIndex

    // Try a pre-generated tutorial clip first
    // Map step indices to tutorial clip IDs
    const tutorialClipMap: Record<number, string> = {
      0: 'tutorial-welcome',
      1: 'tutorial-look-at-abacus',
      2: 'tutorial-tap-the-bead',
      3: 'tutorial-this-is-one',
      4: 'tutorial-move-bead-up',
      5: 'tutorial-this-is-five',
    }

    const clipId = tutorialClipMap[currentStepIndex]
    if (clipId && AUDIO_MANIFEST_MAP[clipId]) {
      playClip(clipId)
      return
    }

    // Fall back to browser SpeechSynthesis for steps without pre-generated clips
    if (stepTitle && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      stop() // Stop any playing audio clip first
      const utterance = new SpeechSynthesisUtterance(stepTitle)
      utterance.rate = 0.9
      utterance.pitch = 1.0
      speechSynthesis.cancel()
      speechSynthesis.speak(utterance)
    }
  }, [isEnabled, currentStepIndex, stepTitle, playClip, stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        speechSynthesis.cancel()
      }
    }
  }, [stop])
}
