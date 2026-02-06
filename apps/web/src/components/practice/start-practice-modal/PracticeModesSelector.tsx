'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal, PART_TYPES } from '../StartPracticeModalContext'

const DISABLED_PERCENT = 25

/** Shared styles for the +/× toggle badge in the bottom-left corner */
const toggleBadgeClass = css({
  position: 'absolute',
  top: '4px',
  left: '4px',
  width: '22px',
  height: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.875rem',
  fontWeight: 'bold',
  borderRadius: '50%',
  lineHeight: 1,
  transition: 'transform 0.25s ease, background-color 0.2s ease, color 0.2s ease',
  '@media (max-width: 480px), (max-height: 700px)': {
    top: '3px',
    left: '3px',
    width: '18px',
    height: '18px',
    fontSize: '0.75rem',
  },
})

export function PracticeModesSelector() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { partWeights, cyclePartWeight, disablePart, problemsPerType, enabledPartCount } =
    useStartPracticeModal()

  // Calculate segment widths
  const disabledCount = PART_TYPES.filter((p) => partWeights[p.type] === 0).length
  const reservedPercent = disabledCount * DISABLED_PERCENT
  const activeTotal = PART_TYPES.reduce((sum, p) => sum + partWeights[p.type], 0)
  const remainingPercent = 100 - reservedPercent

  // Only show ×2 when active segments have mixed weights
  const activeWeights = PART_TYPES.filter((p) => partWeights[p.type] > 0).map(
    (p) => partWeights[p.type]
  )
  const hasMixedWeights = activeWeights.length >= 2 && new Set(activeWeights).size > 1

  return (
    <div data-setting="practice-modes">
      <div
        data-element="modes-label"
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
        Practice Modes
      </div>
      <div
        data-element="proportion-bar"
        className={css({
          display: 'flex',
          gap: '2px',
          borderRadius: '12px',
          overflow: 'hidden',
          height: '56px',
          '@media (max-width: 480px), (max-height: 700px)': {
            height: '44px',
            borderRadius: '10px',
          },
        })}
        style={{
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        }}
      >
        {PART_TYPES.map(({ type, emoji, label }) => {
          const weight = partWeights[type]
          const isEnabled = weight > 0
          const problemCount = problemsPerType[type]
          const isLastActive = isEnabled && enabledPartCount === 1

          // Calculate width
          const widthPercent =
            weight === 0
              ? DISABLED_PERCENT
              : activeTotal > 0
                ? (remainingPercent * weight) / activeTotal
                : 0

          return (
            <button
              key={type}
              type="button"
              data-option={`mode-${type}`}
              data-enabled={isEnabled}
              data-weight={weight}
              onClick={() => cyclePartWeight(type)}
              className={css({
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
                border: 'none',
                cursor: 'pointer',
                transition: 'width 0.2s ease, background-color 0.15s ease, opacity 0.15s ease',
                padding: '0 0.5rem',
                '@media (max-width: 480px), (max-height: 700px)': {
                  gap: '0.25rem',
                  padding: '0 0.375rem',
                },
              })}
              style={{
                width: `${widthPercent}%`,
                backgroundColor: isEnabled
                  ? isDark
                    ? weight === 2
                      ? 'rgba(34, 197, 94, 0.25)'
                      : 'rgba(34, 197, 94, 0.15)'
                    : weight === 2
                      ? 'rgba(22, 163, 74, 0.15)'
                      : 'rgba(22, 163, 74, 0.08)'
                  : 'transparent',
                opacity: isEnabled ? 1 : 0.5,
              }}
            >
              {/* Problem count badge — top-right */}
              {isEnabled && (
                <span
                  data-element="problem-badge"
                  className={css({
                    position: 'absolute',
                    top: '2px',
                    right: '4px',
                    minWidth: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.6875rem',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: 'green.500',
                    borderRadius: '10px',
                    padding: '0 4px',
                    '@media (max-width: 480px), (max-height: 700px)': {
                      top: '1px',
                      right: '2px',
                      minWidth: '16px',
                      height: '16px',
                      fontSize: '0.5625rem',
                      borderRadius: '8px',
                      padding: '0 3px',
                    },
                  })}
                >
                  {problemCount}
                </span>
              )}
              {/* Toggle badge — top-left: "+" (0°) to add, rotates 45° to become "×" to remove */}
              {!isLastActive && (
                <span
                  data-element={isEnabled ? 'remove-hint' : 'add-hint'}
                  data-action={isEnabled ? 'disable-mode' : undefined}
                  role={isEnabled ? 'button' : undefined}
                  tabIndex={isEnabled ? 0 : undefined}
                  onClick={
                    isEnabled
                      ? (e) => {
                          e.stopPropagation()
                          disablePart(type)
                        }
                      : undefined
                  }
                  onKeyDown={
                    isEnabled
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation()
                            e.preventDefault()
                            disablePart(type)
                          }
                        }
                      : undefined
                  }
                  className={toggleBadgeClass}
                  style={{
                    transform: isEnabled ? 'rotate(45deg)' : 'rotate(0deg)',
                    color: isEnabled
                      ? isDark
                        ? '#f87171'
                        : '#dc2626'
                      : isDark
                        ? '#e2e8f0'
                        : '#334155',
                    backgroundColor: isEnabled
                      ? isDark
                        ? 'rgba(248, 113, 113, 0.15)'
                        : 'rgba(220, 38, 38, 0.1)'
                      : isDark
                        ? 'rgba(34, 197, 94, 0.3)'
                        : 'rgba(22, 163, 74, 0.15)',
                    cursor: isEnabled ? 'pointer' : undefined,
                  }}
                >
                  +
                </span>
              )}
              {/* Emoji */}
              <span
                className={css({
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  flexShrink: 0,
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '1rem',
                  },
                })}
              >
                {emoji}
              </span>
              {/* Label */}
              <span
                className={css({
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '0.625rem',
                  },
                })}
                style={{
                  color: isEnabled
                    ? isDark
                      ? '#e2e8f0'
                      : '#334155'
                    : isDark
                      ? '#94a3b8'
                      : '#94a3b8',
                }}
              >
                {label}
              </span>
              {/* ×2 badge — only when weights are mixed (otherwise proportions are equal) */}
              {weight === 2 && hasMixedWeights && (
                <span
                  data-element="weight-label"
                  className={css({
                    fontSize: '0.625rem',
                    fontWeight: 'bold',
                    lineHeight: 1,
                    flexShrink: 0,
                    '@media (max-width: 480px), (max-height: 700px)': {
                      fontSize: '0.5625rem',
                    },
                  })}
                  style={{
                    color: isDark ? '#4ade80' : '#16a34a',
                  }}
                >
                  ×2
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
