'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal, PART_TYPES } from '../StartPracticeModalContext'

export function PracticeModesSelector() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { enabledParts, togglePart, problemsPerType } = useStartPracticeModal()

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
        data-element="modes-options"
        className={css({
          display: 'flex',
          gap: '0.375rem',
          '@media (max-width: 480px), (max-height: 700px)': {
            gap: '0.25rem',
          },
        })}
      >
        {PART_TYPES.filter((p) => p.enabled).map(({ type, emoji, label }) => {
          const isEnabled = enabledParts[type]
          const problemCount = problemsPerType[type]
          return (
            <button
              key={type}
              type="button"
              data-option={`mode-${type}`}
              data-enabled={isEnabled}
              onClick={() => togglePart(type)}
              className={css({
                position: 'relative',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.625rem 0.25rem 0.5rem',
                borderRadius: '8px',
                border: '2px solid',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                '@media (max-width: 480px), (max-height: 700px)': {
                  padding: '0.375rem 0.125rem 0.25rem',
                  borderRadius: '6px',
                  gap: '0.125rem',
                },
              })}
              style={{
                borderColor: isEnabled
                  ? isDark
                    ? '#22c55e'
                    : '#16a34a'
                  : isDark
                    ? 'rgba(255,255,255,0.1)'
                    : 'rgba(0,0,0,0.08)',
                backgroundColor: isEnabled
                  ? isDark
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(22, 163, 74, 0.08)'
                  : 'transparent',
                opacity: isEnabled ? 1 : 0.5,
              }}
            >
              {/* Badge positioned at upper-right of button box */}
              {isEnabled && (
                <span
                  className={css({
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    minWidth: '22px',
                    minHeight: '22px',
                    aspectRatio: '1 / 1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: 'green.500',
                    borderRadius: '50%',
                    padding: '2px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    '@media (max-width: 480px), (max-height: 700px)': {
                      top: '-6px',
                      right: '-6px',
                      minWidth: '18px',
                      minHeight: '18px',
                      fontSize: '0.625rem',
                    },
                  })}
                >
                  {problemCount}
                </span>
              )}
              {/* Emoji */}
              <span
                className={css({
                  fontSize: '1.5rem',
                  lineHeight: 1,
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '1.25rem',
                  },
                })}
              >
                {emoji}
              </span>
              <span
                className={css({
                  fontSize: '0.6875rem',
                  fontWeight: '500',
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '0.5625rem',
                  },
                })}
                style={{
                  color: isDark ? '#e2e8f0' : '#334155',
                }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
