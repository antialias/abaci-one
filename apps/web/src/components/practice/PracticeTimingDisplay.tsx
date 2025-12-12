'use client'

import { useEffect, useState } from 'react'
import type { SessionPart, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { SpeedMeter } from './SpeedMeter'

interface PracticeTimingDisplayProps {
  /** Session results so far */
  results: SlotResult[]
  /** Session parts (to map result partNumber to part type) */
  parts: SessionPart[]
  /** Current attempt start time (for live timer) */
  attemptStartTime: number
  /** Accumulated pause time for current attempt */
  accumulatedPauseMs: number
  /** Whether session is paused */
  isPaused: boolean
  /** Current part type */
  currentPartType: 'abacus' | 'visualization' | 'linear'
  /** Whether dark mode is enabled */
  isDark: boolean
}

// Minimum samples needed for statistical display
const MIN_SAMPLES_FOR_STATS = 3

/**
 * Format milliseconds as a human-readable duration
 */
function formatTime(ms: number): string {
  if (ms < 0) return '0s'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }
  return `${seconds}s`
}

/**
 * Format milliseconds for display as decimal seconds
 */
function formatSecondsDecimal(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Calculate mean and standard deviation of response times
 */
function calculateStats(times: number[]): {
  mean: number
  stdDev: number
  count: number
} {
  if (times.length === 0) {
    return { mean: 0, stdDev: 0, count: 0 }
  }

  const count = times.length
  const mean = times.reduce((sum, t) => sum + t, 0) / count

  if (count < 2) {
    return { mean, stdDev: 0, count }
  }

  const squaredDiffs = times.map((t) => (t - mean) ** 2)
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (count - 1)
  const stdDev = Math.sqrt(variance)

  return { mean, stdDev, count }
}

function getPartTypeLabel(type: 'abacus' | 'visualization' | 'linear'): string {
  switch (type) {
    case 'abacus':
      return 'Abacus'
    case 'visualization':
      return 'Visualize'
    case 'linear':
      return 'Linear'
  }
}

function getPartTypeEmoji(type: 'abacus' | 'visualization' | 'linear'): string {
  switch (type) {
    case 'abacus':
      return '🧮'
    case 'visualization':
      return '🧠'
    case 'linear':
      return '💭'
  }
}

/**
 * PracticeTimingDisplay - Shows timing stats during practice
 *
 * Displays:
 * - Live timer for current problem
 * - Average time per problem with SpeedMeter visualization
 * - Breakdown by part type (abacus/visualization/linear)
 */
export function PracticeTimingDisplay({
  results,
  parts,
  attemptStartTime,
  accumulatedPauseMs,
  isPaused,
  currentPartType,
  isDark,
}: PracticeTimingDisplayProps) {
  // Live-updating current problem timer
  const [currentElapsedMs, setCurrentElapsedMs] = useState(0)

  // Update current timer every 100ms
  useEffect(() => {
    if (isPaused) return

    const updateTimer = () => {
      const elapsed = Date.now() - attemptStartTime - accumulatedPauseMs
      setCurrentElapsedMs(Math.max(0, elapsed))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 100)
    return () => clearInterval(interval)
  }, [attemptStartTime, accumulatedPauseMs, isPaused])

  // Calculate overall stats
  const allTimes = results.map((r) => r.responseTimeMs)
  const overallStats = calculateStats(allTimes)
  const hasEnoughData = overallStats.count >= MIN_SAMPLES_FOR_STATS

  // Calculate per-part-type stats
  const partTypeStats = (['abacus', 'visualization', 'linear'] as const).map((type) => {
    const typeTimes = results
      .filter((r) => {
        const part = parts[r.partNumber - 1]
        return part && part.type === type
      })
      .map((r) => r.responseTimeMs)
    return {
      type,
      ...calculateStats(typeTimes),
    }
  })

  // Filter to only part types with data
  const activePartTypes = partTypeStats.filter((s) => s.count > 0)

  // Calculate threshold for SpeedMeter (mean + 2 stddev, clamped)
  const threshold = hasEnoughData
    ? Math.max(30_000, Math.min(overallStats.mean + 2 * overallStats.stdDev, 5 * 60 * 1000))
    : 60_000 // Default 1 minute if not enough data

  return (
    <div
      data-component="practice-timing-display"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '0.75rem',
        backgroundColor: isDark ? 'gray.800' : 'white',
        borderRadius: '12px',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.200',
      })}
    >
      {/* Current problem timer - prominent display */}
      <div
        data-element="current-timer"
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          backgroundColor: isDark ? 'gray.700' : 'gray.100',
          borderRadius: '8px',
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
          <span className={css({ fontSize: '1rem' })}>{getPartTypeEmoji(currentPartType)}</span>
          <span
            className={css({
              fontSize: '0.75rem',
              fontWeight: '600',
              color: isDark ? 'gray.300' : 'gray.600',
              textTransform: 'uppercase',
            })}
          >
            This problem
          </span>
        </div>
        <span
          className={css({
            fontFamily: 'monospace',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            color:
              currentElapsedMs > threshold
                ? isDark
                  ? 'red.400'
                  : 'red.500'
                : currentElapsedMs > overallStats.mean + overallStats.stdDev
                  ? isDark
                    ? 'yellow.400'
                    : 'yellow.600'
                  : isDark
                    ? 'green.400'
                    : 'green.600',
          })}
        >
          {formatTime(currentElapsedMs)}
        </span>
      </div>

      {/* Speed meter - shows where current time falls relative to average */}
      {hasEnoughData && (
        <div data-element="speed-visualization">
          <SpeedMeter
            meanMs={overallStats.mean}
            stdDevMs={overallStats.stdDev}
            thresholdMs={threshold}
            currentTimeMs={currentElapsedMs}
            isDark={isDark}
            compact={true}
            averageLabel={`Avg: ${formatSecondsDecimal(overallStats.mean)}`}
            fastLabel=""
            slowLabel=""
          />
        </div>
      )}

      {/* Per-part-type breakdown */}
      {activePartTypes.length > 1 && (
        <div
          data-element="part-type-breakdown"
          className={css({
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
          })}
        >
          {activePartTypes.map((stats) => (
            <div
              key={stats.type}
              data-part-type={stats.type}
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.25rem 0.5rem',
                backgroundColor:
                  stats.type === currentPartType
                    ? isDark
                      ? 'blue.900'
                      : 'blue.100'
                    : isDark
                      ? 'gray.700'
                      : 'gray.100',
                borderRadius: '6px',
                border: stats.type === currentPartType ? '1px solid' : 'none',
                borderColor: isDark ? 'blue.700' : 'blue.300',
              })}
            >
              <span className={css({ fontSize: '0.875rem' })}>{getPartTypeEmoji(stats.type)}</span>
              <span
                className={css({
                  fontSize: '0.6875rem',
                  color: isDark ? 'gray.400' : 'gray.500',
                })}
              >
                {getPartTypeLabel(stats.type)}
              </span>
              <span
                className={css({
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.200' : 'gray.700',
                })}
              >
                {formatSecondsDecimal(stats.mean)}
              </span>
              <span
                className={css({
                  fontSize: '0.625rem',
                  color: isDark ? 'gray.500' : 'gray.400',
                })}
              >
                ({stats.count})
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Simple average display when not enough data for full visualization */}
      {!hasEnoughData && overallStats.count > 0 && (
        <div
          data-element="simple-average"
          className={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            fontSize: '0.75rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          <span>Avg so far:</span>
          <span
            className={css({
              fontFamily: 'monospace',
              fontWeight: 'bold',
              color: isDark ? 'gray.200' : 'gray.700',
            })}
          >
            {formatSecondsDecimal(overallStats.mean)}
          </span>
          <span>({overallStats.count} problems)</span>
        </div>
      )}
    </div>
  )
}
