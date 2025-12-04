/**
 * Speech Announcements Hook
 *
 * Manages all speech-related side effects for the Know Your World game:
 * - Auto-speak hints when bubble opens
 * - Announce new region prompts (with delay after celebrations)
 * - "You found {region}" announcements
 * - Track celebration/speech timing coordination
 * - Auto-speak when hint cycles
 */

import { useCallback, useEffect, useRef } from 'react'

import type { CelebrationType } from '../../Provider'

export interface UseSpeechAnnouncementsOptions {
  // Speech capabilities
  isSpeechSupported: boolean
  isSpeaking: boolean
  speak: (text: string, withAccent: boolean) => void
  speakWithRegionName: (regionName: string, hint: string | null, withAccent: boolean) => void
  stopSpeaking: () => void

  // Current state
  currentPrompt: string | null
  currentRegionName: string | null
  hintText: string | null
  hintIndex: number
  withAccent: boolean
  autoSpeak: boolean

  // Hint bubble state
  showHintBubble: boolean
  setShowHintBubble: (show: boolean) => void
  hasHint: boolean
  hintsLocked: boolean

  // Refs for settings (to avoid effect re-runs)
  autoHintRef: React.RefObject<boolean>
  autoSpeakRef: React.RefObject<boolean>
  withAccentRef: React.RefObject<boolean>

  // Celebration state
  celebration: {
    regionId: string
    regionName: string
    type: CelebrationType
    startTime: number
  } | null
  puzzlePieceTarget: {
    regionId: string
    regionName: string
  } | null
}

export interface UseSpeechAnnouncementsReturn {
  /** Callback for speak button click */
  handleSpeakClick: () => void
}

export function useSpeechAnnouncements({
  isSpeechSupported,
  isSpeaking,
  speak,
  speakWithRegionName,
  stopSpeaking,
  currentPrompt,
  currentRegionName,
  hintText,
  hintIndex,
  withAccent,
  autoSpeak,
  showHintBubble,
  setShowHintBubble,
  hasHint,
  hintsLocked,
  autoHintRef,
  autoSpeakRef,
  withAccentRef,
  celebration,
  puzzlePieceTarget,
}: UseSpeechAnnouncementsOptions): UseSpeechAnnouncementsReturn {
  // ============================================================================
  // Speak Button Handler
  // ============================================================================

  const handleSpeakClick = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking()
    } else if (currentRegionName) {
      speakWithRegionName(currentRegionName, hintText, withAccent)
    }
  }, [isSpeaking, stopSpeaking, currentRegionName, hintText, speakWithRegionName, withAccent])

  // ============================================================================
  // Auto-speak hint when bubble opens
  // ============================================================================

  const prevShowHintBubbleRef = useRef(false)

  useEffect(() => {
    const justOpened = showHintBubble && !prevShowHintBubbleRef.current
    prevShowHintBubbleRef.current = showHintBubble

    if (justOpened && autoSpeak && currentRegionName && isSpeechSupported) {
      speakWithRegionName(currentRegionName, hintText, withAccent)
    }
  }, [
    showHintBubble,
    autoSpeak,
    currentRegionName,
    hintText,
    isSpeechSupported,
    speakWithRegionName,
    withAccent,
  ])

  // ============================================================================
  // Handle hint bubble and auto-speak when prompt changes
  // ============================================================================

  const prevPromptRef = useRef<string | null>(null)

  useEffect(() => {
    const isNewRegion = prevPromptRef.current !== null && prevPromptRef.current !== currentPrompt
    prevPromptRef.current = currentPrompt

    // Don't auto-show hints when locked (e.g., waiting for name confirmation)
    if (autoHintRef.current && hasHint && !hintsLocked) {
      setShowHintBubble(true)
      // If region changed and both auto-hint and auto-speak are enabled, speak immediately
      // This handles the case where the bubble was already open
      if (isNewRegion && autoSpeakRef.current && currentRegionName && isSpeechSupported) {
        speakWithRegionName(currentRegionName, hintText, withAccentRef.current ?? false)
      }
    } else {
      setShowHintBubble(false)
    }
  }, [
    currentPrompt,
    hasHint,
    currentRegionName,
    hintText,
    isSpeechSupported,
    speakWithRegionName,
    hintsLocked,
    autoHintRef,
    autoSpeakRef,
    withAccentRef,
    setShowHintBubble,
  ])

  // ============================================================================
  // Announce region name when a new prompt appears
  // ============================================================================

  const prevPromptForAnnouncementRef = useRef<string | null>(null)
  const lastFoundAnnouncementTimeRef = useRef<number>(0)
  const announcementTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (announcementTimeoutRef.current) {
        clearTimeout(announcementTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // Clear any pending announcement when prompt changes
    if (announcementTimeoutRef.current) {
      clearTimeout(announcementTimeoutRef.current)
      announcementTimeoutRef.current = null
    }

    // Only announce if we have speech support, a new prompt, and a region name
    if (!isSpeechSupported || !currentPrompt || !currentRegionName) {
      prevPromptForAnnouncementRef.current = currentPrompt
      return
    }

    // Check if this is a new prompt (not just re-render)
    if (currentPrompt === prevPromptForAnnouncementRef.current) {
      return
    }

    prevPromptForAnnouncementRef.current = currentPrompt

    // Calculate delay: give a breather after "You found" announcement
    // Wait at least 2 seconds after the last "You found" before announcing next region
    const MIN_DELAY_AFTER_FOUND = 2000
    const timeSinceLastFound = Date.now() - lastFoundAnnouncementTimeRef.current
    const delay = Math.max(0, MIN_DELAY_AFTER_FOUND - timeSinceLastFound)

    if (delay > 0) {
      // Schedule delayed announcement
      announcementTimeoutRef.current = setTimeout(() => {
        speakWithRegionName(currentRegionName, hintText, false)
        announcementTimeoutRef.current = null
      }, delay)
    } else {
      // No recent "You found", announce immediately
      speakWithRegionName(currentRegionName, hintText, false)
    }
  }, [currentPrompt, currentRegionName, hintText, isSpeechSupported, speakWithRegionName])

  // ============================================================================
  // Announce "You found {region}" when celebration/puzzle starts
  // ============================================================================

  const prevFoundAnnouncementRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isSpeechSupported) return

    // Determine what to announce (prioritize puzzlePieceTarget for learning mode)
    const regionId = puzzlePieceTarget?.regionId ?? celebration?.regionId
    const regionName = puzzlePieceTarget?.regionName ?? celebration?.regionName

    if (regionId && regionName) {
      // Use just regionId as key - prevents double announcement when
      // puzzlePieceTarget transitions to celebration for the same region
      if (regionId !== prevFoundAnnouncementRef.current) {
        prevFoundAnnouncementRef.current = regionId
        speak(`You found ${regionName}`, false)
      }
    } else {
      // Reset when neither is active
      prevFoundAnnouncementRef.current = null
    }
  }, [puzzlePieceTarget, celebration, isSpeechSupported, speak])

  // ============================================================================
  // Track celebration/speech timing for announcement breather
  // ============================================================================

  const celebrationActiveRef = useRef(false)
  const waitingForSpeechToFinishRef = useRef(false)
  const prevIsSpeakingRef = useRef(false)

  // Track celebration state
  useEffect(() => {
    if (celebration) {
      celebrationActiveRef.current = true
      // If speech is currently happening, wait for it to finish
      if (isSpeaking) {
        waitingForSpeechToFinishRef.current = true
      } else {
        // Speech already done (or not speaking), record time now
        lastFoundAnnouncementTimeRef.current = Date.now()
      }
    } else {
      celebrationActiveRef.current = false
      waitingForSpeechToFinishRef.current = false
    }
  }, [celebration, isSpeaking])

  // Track when speech finishes - if we were waiting, record the time
  useEffect(() => {
    const speechJustFinished = prevIsSpeakingRef.current && !isSpeaking
    prevIsSpeakingRef.current = isSpeaking

    if (speechJustFinished && waitingForSpeechToFinishRef.current) {
      // Speech just finished and we were waiting for it
      lastFoundAnnouncementTimeRef.current = Date.now()
      waitingForSpeechToFinishRef.current = false
    }
  }, [isSpeaking])

  // ============================================================================
  // Auto-speak when hint cycles (due to struggle detection or manual cycling)
  // ============================================================================

  const prevHintIndexRef = useRef(hintIndex)

  useEffect(() => {
    // Only speak if hint index actually changed (not initial render)
    if (
      hintIndex > prevHintIndexRef.current &&
      hintText &&
      isSpeechSupported &&
      currentRegionName
    ) {
      prevHintIndexRef.current = hintIndex
      // Speak just the hint (user already knows the region name)
      speak(hintText, false)
    } else if (hintIndex !== prevHintIndexRef.current) {
      prevHintIndexRef.current = hintIndex
    }
  }, [hintIndex, hintText, isSpeechSupported, currentRegionName, speak])

  return {
    handleSpeakClick,
  }
}
