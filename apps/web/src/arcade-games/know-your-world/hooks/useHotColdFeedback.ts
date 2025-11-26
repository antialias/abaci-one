/**
 * Hot/Cold audio feedback hook for Know Your World
 *
 * Provides audible feedback as the user moves their cursor toward or away
 * from the target region. Uses sophisticated path analysis with:
 * - Moving average direction calculation over recent positions
 * - Hysteresis to prevent flip-flopping between warmer/colder
 * - Special case detection (overshot, stuck)
 * - Multi-layer anti-spam (cooldowns, confidence gating)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { speakText } from '../utils/speechSynthesis'
import { getRandomPhrase, type FeedbackType } from '../utils/hotColdPhrases'

// Configuration constants
const HISTORY_LENGTH = 25 // Max positions to track
const WINDOW_SIZE = 8 // Positions for moving average
const SAMPLE_INTERVAL = 100 // ms between samples
const FEEDBACK_COOLDOWN = 1200 // ms between any feedback
const SAME_TYPE_COOLDOWN = 3000 // ms before repeating same type
const FOUND_IT_COOLDOWN = 800 // ms between found_it feedback (shorter for responsiveness)
const MIN_DISTANCE_CHANGE = 30 // px of distance-to-target change to trigger feedback
const CONFIDENCE_THRESHOLD = 0.45 // Min trend confidence

// Distance thresholds (pixels)
const VERY_CLOSE = 50
const CLOSE = 120
const MEDIUM = 250
const FAR = 400

// Hysteresis thresholds for zone transitions
const WARMING_ENTER = -0.2 // Must be clearly negative to enter warming
const WARMING_EXIT = 0.08 // Can exit warming with slight positive
const COOLING_ENTER = 0.2 // Must be clearly positive to enter cooling
const COOLING_EXIT = -0.08 // Can exit cooling with slight negative

// Map locale to BCP 47 language tag for speech
const LOCALE_TO_LANG: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
  es: 'es-ES',
  ja: 'ja-JP',
  hi: 'hi-IN',
  la: 'it-IT',
  goh: 'de-DE',
}

interface PathEntry {
  x: number
  y: number
  timestamp: number
  distance: number
}

type Zone = 'warming' | 'neutral' | 'cooling'

interface HotColdState {
  history: PathEntry[]
  historyIndex: number
  filledCount: number
  lastFeedbackTime: number
  lastFoundItTime: number // Separate cooldown for found_it
  lastFeedbackType: FeedbackType | null
  currentZone: Zone
  totalDistanceChange: number // Cumulative |delta| of distance-to-target
  lastDistanceToTarget: number | null // For calculating deltas
  consecutiveNeutralSamples: number
  lastSampleTime: number
  wasOverTarget: boolean
  minDistanceSinceLastFeedback: number
}

interface UseHotColdFeedbackParams {
  enabled: boolean
  targetRegionId: string | null
  isSpeaking: boolean // From useSpeakHint, to avoid speech conflicts
}

interface CheckPositionParams {
  cursorPosition: { x: number; y: number }
  targetCenter: { x: number; y: number } | null
  hoveredRegionId: string | null
}

function createInitialState(): HotColdState {
  return {
    history: new Array(HISTORY_LENGTH).fill(null),
    historyIndex: 0,
    filledCount: 0,
    lastFeedbackTime: 0,
    lastFoundItTime: 0,
    lastFeedbackType: null,
    currentZone: 'neutral',
    totalDistanceChange: 0,
    lastDistanceToTarget: null,
    consecutiveNeutralSamples: 0,
    lastSampleTime: 0,
    wasOverTarget: false,
    minDistanceSinceLastFeedback: Infinity,
  }
}

/**
 * Get the most recent N entries from the circular buffer
 */
function getRecentEntries(
  state: HotColdState,
  count: number
): (PathEntry | null)[] {
  const entries: (PathEntry | null)[] = []
  const actualCount = Math.min(count, state.filledCount)

  for (let i = 0; i < actualCount; i++) {
    const index =
      (state.historyIndex - actualCount + i + HISTORY_LENGTH) % HISTORY_LENGTH
    entries.push(state.history[index])
  }

  return entries
}

/**
 * Calculate weighted moving average direction.
 * Returns a value from -1 (getting closer) to +1 (getting farther).
 */
function calculateMovingAverageDirection(state: HotColdState): number {
  if (state.filledCount < WINDOW_SIZE + 1) return 0

  const entries = getRecentEntries(state, WINDOW_SIZE + 1).filter(
    (e): e is PathEntry => e !== null
  )
  if (entries.length < WINDOW_SIZE + 1) return 0

  // Calculate weighted distance deltas (more recent = higher weight)
  let weightedDeltaSum = 0
  let weightSum = 0

  for (let i = 1; i < entries.length; i++) {
    const delta = entries[i].distance - entries[i - 1].distance
    const weight = i // Linear weighting
    weightedDeltaSum += delta * weight
    weightSum += weight
  }

  // Normalize by average distance to handle scale differences
  const avgDistance =
    entries.reduce((s, e) => s + e.distance, 0) / entries.length
  if (avgDistance < 1) return 0

  const normalizedDirection = weightedDeltaSum / weightSum / (avgDistance * 0.1)

  return Math.max(-1, Math.min(1, normalizedDirection))
}

/**
 * Calculate trend confidence (0-1).
 * Higher confidence = more consistent direction.
 */
function calculateTrendConfidence(state: HotColdState): number {
  if (state.filledCount < 4) return 0

  const entries = getRecentEntries(state, WINDOW_SIZE + 1).filter(
    (e): e is PathEntry => e !== null
  )
  if (entries.length < 4) return 0

  // Count direction changes
  let directionChanges = 0
  let lastSign = 0

  for (let i = 1; i < entries.length; i++) {
    const delta = entries[i].distance - entries[i - 1].distance
    const sign = Math.sign(delta)

    if (lastSign !== 0 && sign !== 0 && sign !== lastSign) {
      directionChanges++
    }
    if (sign !== 0) lastSign = sign
  }

  // Fewer direction changes = higher confidence
  const maxChanges = entries.length - 2
  return maxChanges > 0 ? 1 - directionChanges / maxChanges : 0
}

/**
 * Apply hysteresis to zone transitions.
 * Different thresholds for entering vs exiting zones.
 */
function updateZoneWithHysteresis(state: HotColdState, direction: number): Zone {
  const previousZone = state.currentZone

  switch (previousZone) {
    case 'neutral':
      if (direction < WARMING_ENTER) return 'warming'
      if (direction > COOLING_ENTER) return 'cooling'
      return 'neutral'

    case 'warming':
      if (direction > WARMING_EXIT) return 'neutral'
      return 'warming'

    case 'cooling':
      if (direction < COOLING_EXIT) return 'neutral'
      return 'cooling'

    default:
      return 'neutral'
  }
}

/**
 * Determine feedback type based on zone, distance, and special cases.
 */
function determineFeedbackType(
  state: HotColdState,
  zone: Zone,
  currentDistance: number,
  isOverTarget: boolean
): FeedbackType | null {
  // Priority 1: Actually over the target
  if (isOverTarget) {
    return 'found_it'
  }

  // Priority 2: Overshot detection - was very close, now moving away
  if (
    zone === 'cooling' &&
    state.minDistanceSinceLastFeedback < VERY_CLOSE &&
    currentDistance > CLOSE
  ) {
    return 'overshot'
  }

  // Priority 3: Zone-based feedback
  if (zone === 'warming') {
    if (currentDistance < VERY_CLOSE) return 'on_fire'
    if (currentDistance < CLOSE) return 'hot'
    return 'warmer'
  }

  if (zone === 'cooling') {
    if (currentDistance > FAR) return 'freezing'
    if (currentDistance > MEDIUM) return 'cold'
    return 'colder'
  }

  return null
}

export function useHotColdFeedback({
  enabled,
  targetRegionId,
  isSpeaking: externalSpeaking,
}: UseHotColdFeedbackParams) {
  const locale = useLocale()
  const [isSpeaking, setIsSpeaking] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)
  const stateRef = useRef<HotColdState>(createInitialState())

  // Reset state when target changes
  useEffect(() => {
    stateRef.current = createInitialState()
  }, [targetRegionId])

  const speak = useCallback(
    (type: FeedbackType) => {
      const phrase = getRandomPhrase(type)
      const targetLang = LOCALE_TO_LANG[locale] || 'en-US'

      const { cancel } = speakText(phrase, targetLang, {
        rate: 1.1, // Slightly faster than hints
        onStart: () => setIsSpeaking(true),
        onEnd: () => {
          setIsSpeaking(false)
          cancelRef.current = null
        },
        onError: () => {
          setIsSpeaking(false)
          cancelRef.current = null
        },
      })

      cancelRef.current = cancel
    },
    [locale]
  )

  const checkPosition = useCallback(
    ({ cursorPosition, targetCenter, hoveredRegionId }: CheckPositionParams) => {
      if (!enabled || !targetCenter || !targetRegionId) return
      if (isSpeaking || externalSpeaking) return

      const now = performance.now()
      const state = stateRef.current

      // Calculate distance to target (always needed)
      const dx = cursorPosition.x - targetCenter.x
      const dy = cursorPosition.y - targetCenter.y
      const currentDistance = Math.sqrt(dx * dx + dy * dy)

      // Check if hovering over target
      const isOverTarget = hoveredRegionId === targetRegionId

      // PRIORITY 1: Instant "found_it" when hovering over target
      // Only gate is a short cooldown to prevent spam
      if (isOverTarget) {
        const timeSinceLastFoundIt = now - state.lastFoundItTime
        if (timeSinceLastFoundIt >= FOUND_IT_COOLDOWN) {
          speak('found_it')
          state.lastFoundItTime = now
          state.lastFeedbackTime = now
          state.lastFeedbackType = 'found_it'
          state.wasOverTarget = true
        }
        return // Don't process other feedback when over target
      }

      // Track if we just left the target
      if (state.wasOverTarget) {
        state.wasOverTarget = false
      }

      // Sampling throttle (only for non-found_it feedback)
      if (now - state.lastSampleTime < SAMPLE_INTERVAL) return
      state.lastSampleTime = now

      // Track minimum distance since last feedback (for overshot detection)
      state.minDistanceSinceLastFeedback = Math.min(
        state.minDistanceSinceLastFeedback,
        currentDistance
      )

      // Accumulate total distance-to-target change (not cursor movement)
      if (state.lastDistanceToTarget !== null) {
        const distanceDelta = Math.abs(currentDistance - state.lastDistanceToTarget)
        state.totalDistanceChange += distanceDelta
      }
      state.lastDistanceToTarget = currentDistance

      // Add to circular buffer
      const entry: PathEntry = {
        x: cursorPosition.x,
        y: cursorPosition.y,
        timestamp: now,
        distance: currentDistance,
      }
      state.history[state.historyIndex % HISTORY_LENGTH] = entry
      state.historyIndex++
      state.filledCount = Math.min(state.filledCount + 1, HISTORY_LENGTH)

      // Gate 1: Cooldown check
      const timeSinceLastFeedback = now - state.lastFeedbackTime
      if (timeSinceLastFeedback < FEEDBACK_COOLDOWN) return

      // Gate 2: Minimum distance-to-target change (not cursor movement)
      // This allows small regions to trigger feedback based on approach/retreat
      if (state.totalDistanceChange < MIN_DISTANCE_CHANGE) return

      // Gate 3: Need enough history
      if (state.filledCount < WINDOW_SIZE + 1) return

      // Calculate metrics
      const direction = calculateMovingAverageDirection(state)
      const confidence = calculateTrendConfidence(state)

      // Gate 4: Trend confidence (skip during erratic searching)
      if (confidence < CONFIDENCE_THRESHOLD) {
        state.consecutiveNeutralSamples++

        // "Stuck" detection after many neutral samples
        if (state.consecutiveNeutralSamples > 15) {
          state.consecutiveNeutralSamples = 0
          speak('stuck')
          state.lastFeedbackTime = now
          state.lastFeedbackType = 'stuck'
          state.totalDistanceChange = 0
          state.lastDistanceToTarget = null
          state.minDistanceSinceLastFeedback = Infinity
        }
        return
      }

      state.consecutiveNeutralSamples = 0

      // Update zone with hysteresis
      const zone = updateZoneWithHysteresis(state, direction)
      state.currentZone = zone

      // Determine feedback type (isOverTarget is false here, handled above)
      const feedbackType = determineFeedbackType(
        state,
        zone,
        currentDistance,
        false
      )

      if (!feedbackType) return

      // Gate 5: Don't repeat same type within extended cooldown
      if (
        feedbackType === state.lastFeedbackType &&
        timeSinceLastFeedback < SAME_TYPE_COOLDOWN
      ) {
        return
      }

      // Speak the feedback
      speak(feedbackType)

      // Record feedback
      state.lastFeedbackTime = now
      state.lastFeedbackType = feedbackType
      state.totalDistanceChange = 0
      state.lastDistanceToTarget = null
      state.minDistanceSinceLastFeedback = Infinity
    },
    [enabled, targetRegionId, isSpeaking, externalSpeaking, speak]
  )

  const reset = useCallback(() => {
    if (cancelRef.current) {
      cancelRef.current()
      cancelRef.current = null
    }
    setIsSpeaking(false)
    stateRef.current = createInitialState()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cancelRef.current) {
        cancelRef.current()
      }
    }
  }, [])

  return { checkPosition, reset, isSpeaking }
}
