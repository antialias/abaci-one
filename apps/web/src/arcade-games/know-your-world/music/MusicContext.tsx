/**
 * Music Context for Know Your World
 *
 * Provides music engine controls to all child components.
 * Handles automatic playback based on game state.
 * Switches between continental presets based on current region.
 * Layers hyper-local hints after a delay for specific regions.
 * Reacts to hot/cold feedback with temperature modulation.
 * Plays celebration flourishes when regions are found.
 */

'use client'

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useMusicEngine, type MusicEngine } from './useMusicEngine'
import { getPresetForRegion, getPresetIdForRegion, getHintForRegion } from './presets'
import {
  getTemperatureEffect,
  applyTemperatureToPattern,
  getCelebrationFlourish,
  buildPatternWithFlourish,
} from './presets/effects'
import type { FeedbackType } from '../utils/hotColdPhrases'
import type { CelebrationType } from '../Provider'

interface MusicContextValue extends MusicEngine {
  /** Enable music (initializes if needed, then starts playing) */
  enableMusic: () => Promise<void>
  /** Disable music (stops and mutes) */
  disableMusic: () => void
  /** Current continental preset ID */
  currentPresetId: string
  /** Current continental preset display name */
  currentPresetName: string
  /** Whether a hyper-local hint is currently active */
  isHintActive: boolean
  /** Current region ID that has the hint active (null if no hint) */
  hintRegionId: string | null
  /** Trigger a celebration flourish */
  playCelebration: (type: CelebrationType) => void
  /** Update temperature based on hot/cold feedback */
  setTemperature: (feedbackType: FeedbackType | null) => void
  /** Current temperature effect (for display) */
  currentTemperature: FeedbackType | null
}

const MusicContext = createContext<MusicContextValue | null>(null)

interface MusicProviderProps {
  children: ReactNode
  /** Whether the game is in an active playing state */
  isGameActive?: boolean
  /** Current region ID (country code or state code) */
  currentRegionId?: string | null
  /** Map type ('world' or 'usa') */
  mapType?: 'world' | 'usa'
  /** Current hot/cold feedback type */
  hotColdFeedback?: FeedbackType | null
  /** Current celebration state */
  celebration?: { type: CelebrationType; startTime: number } | null
}

/**
 * Build a combined pattern that layers continental + hyper-local hint.
 * Uses Strudel's stack() to play both simultaneously.
 */
function buildCombinedPattern(continentalPattern: string, hintPattern: string | null): string {
  if (!hintPattern) {
    return continentalPattern
  }

  // Wrap both patterns in stack() to play simultaneously
  // The hint pattern already has its own gain control for subtlety
  return `stack(
    ${continentalPattern},
    ${hintPattern}
  )`
}

export function MusicProvider({
  children,
  isGameActive = false,
  currentRegionId,
  mapType = 'world',
  hotColdFeedback,
  celebration,
}: MusicProviderProps) {
  const engine = useMusicEngine()
  const lastPresetIdRef = useRef<string>('default')
  const lastRegionIdRef = useRef<string | null | undefined>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const basePatternRef = useRef<string>('')
  const prevTemperatureRef = useRef<FeedbackType | null>(null)

  // State for UI display (instead of refs for things we need to expose)
  const [isHintActive, setIsHintActive] = useState(false)
  const [hintRegionId, setHintRegionId] = useState<string | null>(null)
  const [currentTemperature, setCurrentTemperatureState] = useState<FeedbackType | null>(null)

  // Get current preset ID and name based on region
  const currentPresetId = getPresetIdForRegion(currentRegionId, mapType)
  const currentPreset = getPresetForRegion(currentRegionId, mapType)
  const currentPresetName = currentPreset.name

  // Clear any pending hint timer
  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current)
      hintTimerRef.current = null
    }
    setIsHintActive(false)
    setHintRegionId(null)
  }, [])

  // Clear any pending celebration timer
  const clearCelebrationTimer = useCallback(() => {
    if (celebrationTimerRef.current) {
      clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = null
    }
  }, [])

  // Enable music (initialize if needed, then unmute and play)
  const enableMusic = useCallback(async () => {
    console.log('[MusicContext] enableMusic() called')
    if (!engine.isInitialized) {
      console.log('[MusicContext] Initializing engine...')
      await engine.initialize()
    }

    console.log('[MusicContext] Setting unmuted...')
    engine.setMuted(false)

    // Small delay to ensure unmute is processed
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Get the current preset pattern (without hint initially)
    const preset = getPresetForRegion(currentRegionId, mapType)
    console.log('[MusicContext] Evaluating preset pattern...')

    // Store the base pattern for celebrations
    basePatternRef.current = preset.pattern
    await engine.evaluatePattern(preset.pattern)

    console.log('[MusicContext] Checking if should play, isPlaying:', engine.isPlaying)
    if (!engine.isPlaying) {
      console.log('[MusicContext] Calling engine.play()...')
      await engine.play()
    } else {
      console.log('[MusicContext] Already playing, skipping play()')
    }
    console.log('[MusicContext] enableMusic() complete')
  }, [engine, currentRegionId, mapType])

  // Disable music
  const disableMusic = useCallback(() => {
    console.log('[MusicContext] disableMusic called')
    clearHintTimer()
    console.log('[MusicContext] Calling engine.stop()...')
    engine.stop()
    console.log('[MusicContext] Calling engine.setMuted(true)...')
    engine.setMuted(true)
    console.log('[MusicContext] disableMusic complete')
  }, [engine, clearHintTimer])

  // Handle region changes - update pattern and schedule hint
  useEffect(() => {
    const regionChanged = currentRegionId !== lastRegionIdRef.current
    const presetChanged = currentPresetId !== lastPresetIdRef.current

    if (!regionChanged && !presetChanged) return

    lastRegionIdRef.current = currentRegionId
    lastPresetIdRef.current = currentPresetId

    // Clear any pending hint from previous region
    clearHintTimer()
    // Reset temperature when region changes
    prevTemperatureRef.current = null
    setCurrentTemperatureState(null)

    // Only update if music is playing
    if (!engine.isPlaying || !engine.isInitialized || engine.isMuted) return

    const preset = getPresetForRegion(currentRegionId, mapType)
    const hint = getHintForRegion(currentRegionId, mapType)

    // Store the base pattern (continental + optional hint)
    basePatternRef.current = preset.pattern

    // Start with just the continental pattern
    engine.evaluatePattern(preset.pattern)

    // If there's a hyper-local hint, schedule it to layer in after the delay
    if (hint) {
      hintTimerRef.current = setTimeout(() => {
        // Only activate if still on the same region and music is playing
        if (currentRegionId === lastRegionIdRef.current && engine.isPlaying && !engine.isMuted) {
          setIsHintActive(true)
          setHintRegionId(currentRegionId || null)

          // Build combined pattern with hint layered on top
          const combinedPattern = buildCombinedPattern(preset.pattern, hint.pattern)
          basePatternRef.current = combinedPattern
          engine.evaluatePattern(combinedPattern)
        }
      }, hint.delayStart)
    }
  }, [currentRegionId, currentPresetId, mapType, engine, clearHintTimer])

  // Auto-play when game becomes active (only if not muted)
  useEffect(() => {
    console.log('[MusicContext] Auto-play effect check:', {
      isGameActive,
      isInitialized: engine.isInitialized,
      isMuted: engine.isMuted,
      isPlaying: engine.isPlaying,
    })
    if (isGameActive && engine.isInitialized && !engine.isMuted && !engine.isPlaying) {
      console.log('[MusicContext] Auto-play triggered!')
      const preset = getPresetForRegion(currentRegionId, mapType)
      // Store the base pattern for celebrations
      basePatternRef.current = preset.pattern
      engine.evaluatePattern(preset.pattern).then(() => {
        console.log('[MusicContext] Auto-play: calling engine.play()...')
        engine.play()
      })
    }
  }, [isGameActive, engine, currentRegionId, mapType])

  // Auto-stop when game becomes inactive
  useEffect(() => {
    if (!isGameActive && engine.isPlaying) {
      clearHintTimer()
      clearCelebrationTimer()
      engine.stop()
    }
  }, [isGameActive, engine, clearHintTimer, clearCelebrationTimer])

  // Set temperature based on hot/cold feedback
  const setTemperature = useCallback(
    (feedbackType: FeedbackType | null) => {
      // Don't update if same temperature (prevent infinite loops)
      if (feedbackType === prevTemperatureRef.current) return
      // Don't update if not playing
      if (!engine.isPlaying || !engine.isInitialized || engine.isMuted) return
      if (!basePatternRef.current) return

      prevTemperatureRef.current = feedbackType
      setCurrentTemperatureState(feedbackType)
      const effect = getTemperatureEffect(feedbackType)
      const modifiedPattern = applyTemperatureToPattern(basePatternRef.current, effect)

      if (modifiedPattern !== basePatternRef.current) {
        engine.evaluatePattern(modifiedPattern)
      }
    },
    [engine]
  )

  // React to hot/cold feedback prop changes
  useEffect(() => {
    if (hotColdFeedback !== undefined) {
      setTemperature(hotColdFeedback)
    }
  }, [hotColdFeedback, setTemperature])

  // Web Audio context for standalone celebrations (when Strudel music is off)
  const audioContextRef = useRef<AudioContext | null>(null)
  const lastCelebrationStartTimeRef = useRef<number | null>(null)

  // Play a Web Audio celebration (reliable one-shot sounds)
  const playWebAudioCelebration = useCallback((type: CelebrationType) => {
    // Get or create audio context
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        )()
      } catch {
        console.warn('[MusicContext] Web Audio API not supported')
        return
      }
    }

    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const now = ctx.currentTime

    // Helper to play a note
    const playNote = (
      frequency: number,
      startTime: number,
      duration: number,
      volume: number = 0.3
    ) => {
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.type = 'triangle' // Brighter than sine
      oscillator.frequency.setValueAtTime(frequency, startTime)

      gainNode.gain.setValueAtTime(0, startTime)
      gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.02)
      gainNode.gain.setValueAtTime(volume, startTime + duration * 0.7)
      gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.start(startTime)
      oscillator.stop(startTime + duration)
    }

    // Note frequencies (C major scale, higher octave for brightness)
    const NOTES = {
      C5: 523.25,
      E5: 659.25,
      G5: 784.0,
      C6: 1046.5,
      E6: 1318.5,
      G6: 1568.0,
    }

    switch (type) {
      case 'lightning':
        // Quick sparkle glissando
        playNote(NOTES.C6, now, 0.15, 0.4)
        playNote(NOTES.E6, now + 0.05, 0.15, 0.35)
        playNote(NOTES.G6, now + 0.1, 0.2, 0.3)
        break
      case 'standard':
        // Two-note chime
        playNote(NOTES.C6, now, 0.3, 0.35)
        playNote(NOTES.E6, now + 0.08, 0.35, 0.3)
        break
      case 'hard-earned':
        // Ascending arpeggio then chord
        playNote(NOTES.C5, now, 0.25, 0.3)
        playNote(NOTES.E5, now + 0.1, 0.25, 0.3)
        playNote(NOTES.G5, now + 0.2, 0.25, 0.3)
        // Final chord
        playNote(NOTES.C6, now + 0.35, 0.4, 0.25)
        playNote(NOTES.E6, now + 0.35, 0.4, 0.25)
        playNote(NOTES.G6, now + 0.35, 0.4, 0.25)
        break
    }
  }, [])

  // Play celebration flourish
  // Works in two modes:
  // 1. Music playing: Layers Strudel flourish on top of ducked base pattern
  // 2. Music off: Uses Web Audio API for reliable one-shot sounds
  const playCelebration = useCallback(
    (type: CelebrationType) => {
      console.log('[MusicContext] playCelebration called:', {
        type,
        isPlaying: engine.isPlaying,
        isInitialized: engine.isInitialized,
        isMuted: engine.isMuted,
        hasBasePattern: !!basePatternRef.current,
        currentPresetId,
      })

      // Clear any existing celebration timer
      clearCelebrationTimer()

      const musicIsPlaying = engine.isPlaying && !engine.isMuted && basePatternRef.current

      if (musicIsPlaying) {
        // Music is playing - layer Strudel flourish on top of ducked base
        const flourish = getCelebrationFlourish(type, currentPresetId)
        const patternWithFlourish = buildPatternWithFlourish(
          basePatternRef.current,
          flourish.pattern
        )
        console.log('[MusicContext] playCelebration: layering with Strudel music')
        engine.evaluatePatternFullVolume(patternWithFlourish)

        // Schedule return to base pattern after flourish duration
        celebrationTimerRef.current = setTimeout(() => {
          console.log('[MusicContext] playCelebration: restoring base pattern')
          if (engine.isPlaying && !engine.isMuted) {
            engine.evaluatePattern(basePatternRef.current)
          }
        }, flourish.duration)
      } else {
        // Music is off - use Web Audio API for reliable one-shot sound
        console.log('[MusicContext] playCelebration: using Web Audio (music off)')
        playWebAudioCelebration(type)
      }
    },
    [engine, currentPresetId, clearCelebrationTimer, playWebAudioCelebration]
  )

  // React to celebration prop changes - use startTime as stable identifier
  // to prevent duplicate plays from object reference changes
  const celebrationStartTime = celebration?.startTime
  const celebrationType = celebration?.type
  useEffect(() => {
    // Guard: only play if we have a new celebration (different startTime)
    if (
      celebrationType &&
      celebrationStartTime &&
      celebrationStartTime !== lastCelebrationStartTimeRef.current
    ) {
      console.log('[MusicContext] celebration prop effect - NEW celebration:', {
        celebrationType,
        celebrationStartTime,
        lastStartTime: lastCelebrationStartTimeRef.current,
      })
      lastCelebrationStartTimeRef.current = celebrationStartTime
      playCelebration(celebrationType)
    }
  }, [celebrationStartTime, celebrationType, playCelebration])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('[MusicContext] Cleanup on unmount')
      clearHintTimer()
      clearCelebrationTimer()
      // Close Web Audio context if it was created (access ref directly in cleanup)
      if (audioContextRef.current) {
        console.log('[MusicContext] Closing Web Audio context')
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
    }
  }, [clearHintTimer, clearCelebrationTimer])

  const value: MusicContextValue = useMemo(
    () => ({
      ...engine,
      enableMusic,
      disableMusic,
      currentPresetId,
      currentPresetName,
      isHintActive,
      hintRegionId,
      playCelebration,
      setTemperature,
      currentTemperature,
    }),
    [
      engine,
      enableMusic,
      disableMusic,
      currentPresetId,
      currentPresetName,
      isHintActive,
      hintRegionId,
      playCelebration,
      setTemperature,
      currentTemperature,
    ]
  )

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
}

export function useMusic(): MusicContextValue {
  const context = useContext(MusicContext)
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider')
  }
  return context
}

// Optional hook that returns null if outside provider (for optional music support)
export function useMusicOptional(): MusicContextValue | null {
  return useContext(MusicContext)
}
