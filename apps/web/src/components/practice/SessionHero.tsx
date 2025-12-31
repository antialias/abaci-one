'use client'

import { useMemo } from 'react'
import { PRACTICE_TYPES, type PracticeTypeId } from '@/constants/practiceTypes'
import type { SessionPart, SessionPlan, SlotResult } from '@/db/schema/session-plans'
import { css } from '../../../styled-system/css'
import { TrendIndicator } from './TrendIndicator'

export interface SessionHeroProps {
  plan: SessionPlan
  studentName: string
  /** Whether we just transitioned from active practice - shows celebration header */
  justCompleted?: boolean
  /** Previous session accuracy (0-1) for trend comparison */
  previousAccuracy: number | null
  /** Dark mode */
  isDark: boolean
}

/**
 * SessionHero - The top section of session summary
 *
 * Contains:
 * - Header (celebration when just completed, date otherwise)
 * - Stats Row (Accuracy, Score, Duration)
 * - Practice Type Badges
 * - Trend Indicator (comparison to previous session)
 */
export function SessionHero({
  plan,
  studentName,
  justCompleted = false,
  previousAccuracy,
  isDark,
}: SessionHeroProps) {
  const results = plan.results as SlotResult[]
  const parts = (plan.parts ?? []) as SessionPart[]

  // Get unique practice types from the session parts
  const practiceTypesInSession = useMemo(() => {
    const typeIds = new Set<PracticeTypeId>()
    for (const part of parts) {
      if (part.slots && part.slots.length > 0) {
        typeIds.add(part.type as PracticeTypeId)
      }
    }
    return PRACTICE_TYPES.filter((t) => typeIds.has(t.id as PracticeTypeId))
  }, [parts])

  // Format session date
  const sessionDate = useMemo(() => {
    const timestamp = plan.startedAt ?? plan.createdAt
    if (!timestamp) return null
    // Handle both Date objects and millisecond timestamps
    const date =
      typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp as unknown as string)
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }, [plan.startedAt, plan.createdAt])

  const totalProblems = results.length
  const correctProblems = results.filter((r) => r.isCorrect).length
  const accuracy = totalProblems > 0 ? correctProblems / totalProblems : 0

  // Timestamps are serialized as milliseconds from the API (not Date objects)
  const startedAtMs = plan.startedAt as unknown as number
  const completedAtMs = plan.completedAt as unknown as number
  const sessionDurationMinutes =
    startedAtMs && completedAtMs ? (completedAtMs - startedAtMs) / 1000 / 60 : 0

  // Determine overall performance message
  const performanceMessage = getPerformanceMessage(accuracy)

  return (
    <div
      data-component="session-hero"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      })}
    >
      {/* Header - celebration when just completed, date otherwise */}
      {justCompleted ? (
        <div
          data-section="celebration-header"
          className={css({
            textAlign: 'center',
            padding: '1.5rem',
            backgroundColor: isDark
              ? accuracy >= 0.8
                ? 'green.900'
                : accuracy >= 0.6
                  ? 'yellow.900'
                  : 'orange.900'
              : accuracy >= 0.8
                ? 'green.50'
                : accuracy >= 0.6
                  ? 'yellow.50'
                  : 'orange.50',
            borderRadius: '16px',
            border: '2px solid',
            borderColor: isDark
              ? accuracy >= 0.8
                ? 'green.700'
                : accuracy >= 0.6
                  ? 'yellow.700'
                  : 'orange.700'
              : accuracy >= 0.8
                ? 'green.200'
                : accuracy >= 0.6
                  ? 'yellow.200'
                  : 'orange.200',
          })}
        >
          <div
            className={css({
              fontSize: '4rem',
              marginBottom: '0.5rem',
            })}
          >
            {accuracy >= 0.9 ? '🌟' : accuracy >= 0.8 ? '🎉' : accuracy >= 0.6 ? '👍' : '💪'}
          </div>
          <h1
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
              marginBottom: '0.25rem',
            })}
          >
            Great Work, {studentName}!
          </h1>
          <p
            className={css({
              fontSize: '1rem',
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {performanceMessage}
          </p>
        </div>
      ) : (
        <div
          data-section="date-header"
          className={css({
            textAlign: 'center',
            marginBottom: '0.5rem',
          })}
        >
          <h1
            className={css({
              fontSize: '1.25rem',
              fontWeight: 'bold',
              color: isDark ? 'gray.100' : 'gray.800',
            })}
          >
            {sessionDate ?? 'Practice Session'}
          </h1>
        </div>
      )}

      {/* Practice type badges */}
      {practiceTypesInSession.length > 0 && (
        <div
          data-element="practice-types"
          className={css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
            justifyContent: 'center',
          })}
        >
          {practiceTypesInSession.map((type) => (
            <span
              key={type.id}
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                px: '0.75rem',
                py: '0.25rem',
                fontSize: '0.8125rem',
                fontWeight: 'medium',
                borderRadius: 'full',
                backgroundColor: isDark ? 'gray.700' : 'gray.100',
                color: isDark ? 'gray.200' : 'gray.700',
              })}
            >
              <span>{type.icon}</span>
              <span>{type.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div
        data-element="stats-grid"
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
        })}
      >
        <div
          data-element="stat-accuracy"
          className={css({
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <div
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: isDark
                ? accuracy >= 0.8
                  ? 'green.400'
                  : accuracy >= 0.6
                    ? 'yellow.400'
                    : 'orange.400'
                : accuracy >= 0.8
                  ? 'green.600'
                  : accuracy >= 0.6
                    ? 'yellow.600'
                    : 'orange.600',
            })}
          >
            {Math.round(accuracy * 100)}%
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Accuracy
          </div>
        </div>

        <div
          data-element="stat-problems"
          className={css({
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <div
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.400' : 'blue.600',
            })}
          >
            {correctProblems}/{totalProblems}
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            Correct
          </div>
        </div>

        <div
          data-element="stat-time"
          className={css({
            textAlign: 'center',
            padding: '1rem',
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            boxShadow: 'sm',
          })}
        >
          <div
            className={css({
              fontSize: '2rem',
              fontWeight: 'bold',
              color: isDark ? 'purple.400' : 'purple.600',
            })}
          >
            {sessionDurationMinutes < 1 ? '< 1' : Math.round(sessionDurationMinutes)}
          </div>
          <div
            className={css({
              fontSize: '0.75rem',
              color: isDark ? 'gray.400' : 'gray.500',
            })}
          >
            {sessionDurationMinutes < 1 ? 'Minute' : 'Minutes'}
          </div>
        </div>
      </div>

      {/* Trend indicator */}
      {previousAccuracy !== null && (
        <div
          data-element="trend-row"
          className={css({
            display: 'flex',
            justifyContent: 'center',
          })}
        >
          <TrendIndicator current={accuracy} previous={previousAccuracy} isDark={isDark} />
        </div>
      )}
    </div>
  )
}

function getPerformanceMessage(accuracy: number): string {
  if (accuracy >= 0.95) return 'Outstanding! You are a math champion!'
  if (accuracy >= 0.9) return 'Excellent work! Keep up the great practice!'
  if (accuracy >= 0.8) return 'Great job! Your hard work is paying off!'
  if (accuracy >= 0.7) return "Good effort! You're getting stronger!"
  if (accuracy >= 0.6) return 'Nice try! Practice makes perfect!'
  return "Keep practicing! You'll get better with each session!"
}

export default SessionHero
