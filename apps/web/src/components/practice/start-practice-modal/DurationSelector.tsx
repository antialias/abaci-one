'use client'

import * as HoverCard from '@radix-ui/react-hover-card'
import { useTheme } from '@/contexts/ThemeContext'
import { useEffectiveTier } from '@/hooks/useTier'
import { estimateSessionProblemCount } from '@/lib/curriculum/time-estimation'
import { DURATION_OPTIONS } from '@/lib/tier-limits'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal, PART_TYPES } from '../StartPracticeModalContext'

/** Small inline lock SVG icon. */
function LockIcon({ color }: { color: string }) {
  return (
    <svg
      data-element="lock-icon"
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      style={{ position: 'absolute', top: 4, right: 4 }}
    >
      <path
        d="M12 7H4a1 1 0 00-1 1v5a1 1 0 001 1h8a1 1 0 001-1V8a1 1 0 00-1-1z"
        fill={color}
      />
      <path
        d="M5.5 7V5a2.5 2.5 0 015 0v2"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function DurationSelector() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { studentId, durationMinutes, setDurationMinutes, partWeights, avgTermsPerProblem, secondsPerTerm } =
    useStartPracticeModal()
  const { limits } = useEffectiveTier(studentId)

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
        {DURATION_OPTIONS.map((min) => {
          const isLocked = min > limits.maxSessionMinutes
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
          const isSelected = !isLocked && durationMinutes === min

          const button = (
            <button
              key={min}
              type="button"
              data-option={`duration-${min}`}
              data-selected={isSelected}
              data-locked={isLocked || undefined}
              onClick={
                isLocked
                  ? () => window.open('/pricing', '_blank')
                  : () => setDurationMinutes(min)
              }
              className={css({
                position: 'relative',
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
                opacity: isLocked ? 0.4 : 1,
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
              {isLocked && <LockIcon color={isDark ? '#94a3b8' : '#64748b'} />}
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

          if (!isLocked) return button

          return (
            <HoverCard.Root key={min} openDelay={200} closeDelay={300}>
              <HoverCard.Trigger asChild>{button}</HoverCard.Trigger>
              <HoverCard.Portal>
                <HoverCard.Content
                  data-component="upgrade-hover-card"
                  side="top"
                  align="center"
                  sideOffset={8}
                  className={css({
                    zIndex: 15000,
                    borderRadius: '10px',
                    padding: '0.875rem 1rem',
                    maxWidth: '240px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0, 0, 0, 0.06)',
                    animationDuration: '200ms',
                    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    willChange: 'transform, opacity',
                    '&[data-state="open"]': {
                      '&[data-side="top"]': { animationName: 'slideDownAndFade' },
                      '&[data-side="bottom"]': { animationName: 'slideUpAndFade' },
                    },
                  })}
                  style={{
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.08)'}`,
                  }}
                >
                  <div
                    data-element="upgrade-title"
                    className={css({
                      fontSize: '0.8125rem',
                      fontWeight: '600',
                      marginBottom: '0.375rem',
                    })}
                    style={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                  >
                    Longer sessions
                  </div>
                  <div
                    data-element="upgrade-body"
                    className={css({
                      fontSize: '0.75rem',
                      lineHeight: '1.5',
                      marginBottom: '0.75rem',
                    })}
                    style={{ color: isDark ? '#94a3b8' : '#64748b' }}
                  >
                    The Family Plan unlocks 15 & 20 minute sessions, unlimited students, and more.
                  </div>
                  <a
                    href="/pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-action="upgrade-cta"
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      textDecoration: 'none',
                      _hover: { textDecoration: 'underline' },
                    })}
                    style={{ color: isDark ? '#a78bfa' : '#7c3aed' }}
                  >
                    See plans
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M6 3h7v7M13 3L5 11"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                  <HoverCard.Arrow
                    width={12}
                    height={6}
                    style={{ fill: isDark ? '#1e293b' : '#ffffff' }}
                  />
                </HoverCard.Content>
              </HoverCard.Portal>
            </HoverCard.Root>
          )
        })}
      </div>
    </div>
  )
}
