/**
 * Struggle Detection Hook
 *
 * Monitors user search behavior and automatically advances to the next hint
 * when the user appears to be struggling (based on time spent searching).
 */

import { useEffect, useRef } from 'react'

// Thresholds for triggering next hint
const STRUGGLE_TIME_THRESHOLD = 30000 // 30 seconds per hint level
const STRUGGLE_CHECK_INTERVAL = 5000 // Check every 5 seconds

export interface UseStruggleDetectionOptions {
  /** Whether hot/cold feedback is enabled (implies we're tracking search metrics) */
  effectiveHotColdEnabled: boolean
  /** Whether there are more hints available to show */
  hasMoreHints: boolean
  /** Current region prompt ID */
  currentPrompt: string | null
  /** Function to get search metrics */
  getSearchMetrics: (startTime: number) => { timeToFind: number }
  /** Function to advance to next hint */
  nextHint: () => void
  /** Ref to prompt start time */
  promptStartTime: React.RefObject<number>
}

/**
 * Hook that detects when a user is struggling to find a region and
 * automatically advances to the next hint level.
 *
 * Hint levels are based on time:
 * - Level 0 = first 30 seconds
 * - Level 1 = 30-60 seconds
 * - Level 2 = 60-90 seconds
 * - etc.
 */
export function useStruggleDetection({
  effectiveHotColdEnabled,
  hasMoreHints,
  currentPrompt,
  getSearchMetrics,
  nextHint,
  promptStartTime,
}: UseStruggleDetectionOptions): void {
  // Track which hint level triggered last hint
  const lastHintLevelRef = useRef(0)

  // Check for struggle and advance hint
  useEffect(() => {
    // Only run if hot/cold is enabled (means we're tracking search metrics)
    if (!effectiveHotColdEnabled || !hasMoreHints || !currentPrompt) return

    const checkStruggle = () => {
      const metrics = getSearchMetrics(promptStartTime.current ?? Date.now())

      // Calculate which hint level we should be at based on time
      // Level 0 = first 30 seconds, Level 1 = 30-60 seconds, etc.
      const expectedHintLevel = Math.floor(metrics.timeToFind / STRUGGLE_TIME_THRESHOLD)

      // If we should be at a higher hint level than last triggered, give next hint
      if (expectedHintLevel > lastHintLevelRef.current && hasMoreHints) {
        lastHintLevelRef.current = expectedHintLevel
        nextHint()
      }
    }

    const intervalId = setInterval(checkStruggle, STRUGGLE_CHECK_INTERVAL)

    return () => clearInterval(intervalId)
  }, [
    effectiveHotColdEnabled,
    hasMoreHints,
    currentPrompt,
    getSearchMetrics,
    nextHint,
    promptStartTime,
  ])

  // Reset hint level tracking when prompt changes
  useEffect(() => {
    lastHintLevelRef.current = 0
  }, [currentPrompt])
}
