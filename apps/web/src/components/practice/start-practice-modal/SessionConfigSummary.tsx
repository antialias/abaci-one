'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal, PART_TYPES } from '../StartPracticeModalContext'

export function SessionConfigSummary() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const {
    durationMinutes,
    estimatedProblems,
    enabledParts,
    problemsPerType,
    isExpanded,
    setIsExpanded,
  } = useStartPracticeModal()

  return (
    <div
      data-section="config-summary"
      className={css({
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      })}
      style={{
        maxHeight: isExpanded ? '0px' : '140px',
        opacity: isExpanded ? 0 : 1,
      }}
    >
      <button
        type="button"
        data-action="expand-config"
        onClick={() => setIsExpanded(true)}
        className={css({
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          background: 'none',
          border: 'none',
          padding: '1rem',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease',
          _hover: {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          },
          '@media (max-width: 480px), (max-height: 700px)': {
            padding: '0.75rem',
            gap: '0.5rem',
          },
        })}
      >
        {/* Duration */}
        <div data-element="duration-summary" className={css({ textAlign: 'center' })}>
          <div
            data-value="duration-minutes"
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'blue.300' : 'blue.600',
              lineHeight: 1,
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '1.25rem',
              },
            })}
          >
            {durationMinutes}
          </div>
          <div
            data-label="duration"
            className={css({
              fontSize: '0.6875rem',
              color: isDark ? 'gray.500' : 'gray.500',
              marginTop: '0.125rem',
            })}
          >
            min
          </div>
        </div>

        <div
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.600' : 'gray.300',
          })}
        >
          •
        </div>

        {/* Problems */}
        <div data-element="problems-summary" className={css({ textAlign: 'center' })}>
          <div
            data-value="problems-count"
            className={css({
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: isDark ? 'green.300' : 'green.600',
              lineHeight: 1,
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '1.25rem',
              },
            })}
          >
            ~{estimatedProblems}
          </div>
          <div
            data-label="problems"
            className={css({
              fontSize: '0.6875rem',
              color: isDark ? 'gray.500' : 'gray.500',
              marginTop: '0.125rem',
              '@media (max-width: 480px), (max-height: 700px)': {
                fontSize: '0.625rem',
              },
            })}
          >
            problems
          </div>
        </div>

        <div
          className={css({
            fontSize: '0.875rem',
            color: isDark ? 'gray.600' : 'gray.300',
            '@media (max-width: 480px), (max-height: 700px)': {
              fontSize: '0.75rem',
            },
          })}
        >
          •
        </div>

        {/* Modes with problem counts */}
        <div
          data-element="modes-summary"
          className={css({
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            '@media (max-width: 480px), (max-height: 700px)': {
              gap: '0.375rem',
            },
          })}
        >
          {PART_TYPES.filter((p) => p.enabled && enabledParts[p.type]).map(({ type, emoji }) => (
            <div
              key={type}
              data-mode={type}
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0',
              })}
            >
              <span
                data-element="mode-icon"
                className={css({
                  fontSize: '1.25rem',
                  lineHeight: 1,
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '1rem',
                  },
                })}
              >
                {emoji}
              </span>
              <span
                data-element="mode-count"
                className={css({
                  fontSize: '0.6875rem',
                  fontWeight: '600',
                  lineHeight: 1,
                  marginTop: '0.125rem',
                  '@media (max-width: 480px), (max-height: 700px)': {
                    fontSize: '0.625rem',
                  },
                })}
                style={{ color: isDark ? '#22c55e' : '#16a34a' }}
              >
                {problemsPerType[type]}
              </span>
            </div>
          ))}
        </div>

        {/* Expand indicator */}
        <div
          data-element="expand-indicator"
          className={css({
            marginLeft: '0.25rem',
            fontSize: '0.625rem',
            color: isDark ? 'gray.500' : 'gray.400',
            '@media (max-width: 480px), (max-height: 700px)': {
              fontSize: '0.5rem',
              marginLeft: '0.125rem',
            },
          })}
        >
          ▼
        </div>
      </button>
    </div>
  )
}
