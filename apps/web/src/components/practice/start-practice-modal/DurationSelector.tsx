'use client'

import Link from 'next/link'
import { useTheme } from '@/contexts/ThemeContext'
import { useEffectiveTier } from '@/hooks/useTier'
import { estimateSessionProblemCount } from '@/lib/curriculum/time-estimation'
import { DURATION_OPTIONS } from '@/lib/tier-limits'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal, PART_TYPES } from '../StartPracticeModalContext'

export function DurationSelector() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { studentId, durationMinutes, setDurationMinutes, partWeights, avgTermsPerProblem, secondsPerTerm } =
    useStartPracticeModal()
  const { tier, limits } = useEffectiveTier(studentId)
  const availableOptions = DURATION_OPTIONS.filter((d) => d <= limits.maxSessionMinutes)
  const hasLockedOptions = availableOptions.length < DURATION_OPTIONS.length

  return (
    <div data-setting="duration">
      <div
        data-element="duration-label"
        className={css({
          fontSize: '0.6875rem',
          fontWeight: '600',
          color: isDark ? 'gray.500' : 'gray.400',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            marginBottom: '0.25rem',
            fontSize: '0.625rem',
          },
        })}
      >
        Duration
      </div>
      <div
        data-element="duration-options"
        className={css({
          display: 'flex',
          gap: '0.375rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            gap: '0.25rem',
          },
        })}
      >
        {hasLockedOptions && tier !== 'guest' && (
          <Link
            href="/pricing"
            data-action="unlock-durations"
            className={css({
              fontSize: '0.625rem',
              color: isDark ? 'purple.400' : 'purple.500',
              textDecoration: 'none',
              alignSelf: 'flex-end',
              marginBottom: '0.25rem',
              _hover: { textDecoration: 'underline' },
            })}
          >
            Unlock 15 & 20 min
          </Link>
        )}
        {availableOptions.map((min) => {
          // Estimate problems for this duration using weight-based time allocation
          const totalWeight = PART_TYPES.reduce((sum, p) => sum + partWeights[p.type], 0)
          let problems = 0
          if (totalWeight > 0) {
            for (const { type } of PART_TYPES) {
              if (partWeights[type] > 0) {
                const minutesForType = min * (partWeights[type] / totalWeight)
                problems += estimateSessionProblemCount(
                  minutesForType,
                  avgTermsPerProblem,
                  secondsPerTerm,
                  type
                )
              }
            }
          }
          const isSelected = durationMinutes === min
          return (
            <button
              key={min}
              type="button"
              data-option={`duration-${min}`}
              data-selected={isSelected}
              onClick={() => setDurationMinutes(min)}
              className={css({
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.125rem',
                padding: '0.5rem 0.25rem',
                borderRadius: '8px',
                border: '2px solid',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '@media (max-width: 480px), (max-height: 700px)': {
                  padding: '0.375rem 0.125rem',
                  borderRadius: '6px',
                  gap: '0',
                },
              })}
              style={{
                borderColor: isSelected
                  ? isDark
                    ? '#60a5fa'
                    : '#3b82f6'
                  : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.08)',
                backgroundColor: isSelected
                  ? isDark
                    ? 'rgba(96, 165, 250, 0.15)'
                    : 'rgba(59, 130, 246, 0.08)'
                  : 'transparent',
              }}
            >
              <span
                className={css({
                  fontSize: '0.9375rem',
                  fontWeight: '600',
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '0.8125rem',
                  },
                })}
                style={{
                  color: isSelected
                    ? isDark
                      ? '#93c5fd'
                      : '#2563eb'
                    : isDark
                      ? '#e2e8f0'
                      : '#334155',
                }}
              >
                {min}m
              </span>
              <span
                className={css({
                  fontSize: '0.625rem',
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '0.5625rem',
                  },
                })}
                style={{
                  color: isDark ? '#64748b' : '#94a3b8',
                }}
              >
                ~{problems}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
