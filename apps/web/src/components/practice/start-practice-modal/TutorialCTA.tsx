'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

interface TutorialCTAProps {
  onStartTutorial: () => void
}

export function TutorialCTA({ onStartTutorial }: TutorialCTAProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { tutorialConfig, nextSkill, showTutorialGate, isStarting } = useStartPracticeModal()

  if (!showTutorialGate || !tutorialConfig || !nextSkill) {
    return null
  }

  return (
    <div
      data-element="tutorial-cta"
      className={css({
        borderRadius: '12px',
        overflow: 'hidden',
      })}
      style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)',
        border: `2px solid ${isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)'}`,
      }}
    >
      {/* Info section */}
      <div
        className={css({
          padding: '0.875rem 1rem',
          display: 'flex',
          gap: '0.625rem',
          alignItems: 'center',
        })}
      >
        <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>🌟</span>
        <div className={css({ flex: 1 })}>
          <p
            className={css({
              fontSize: '0.875rem',
              fontWeight: '600',
            })}
            style={{ color: isDark ? '#86efac' : '#166534' }}
          >
            You've unlocked: <strong>{tutorialConfig.title}</strong>
          </p>
          <p
            className={css({
              fontSize: '0.75rem',
              marginTop: '0.125rem',
            })}
            style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
          >
            Start with a quick tutorial
          </p>
        </div>
      </div>
      {/* Integrated start button */}
      <button
        type="button"
        data-action="start-tutorial"
        data-status={isStarting ? 'starting' : 'ready'}
        onClick={onStartTutorial}
        disabled={isStarting}
        className={css({
          width: '100%',
          padding: '0.875rem',
          fontSize: '1rem',
          fontWeight: 'bold',
          color: 'white',
          border: 'none',
          borderRadius: '0 0 10px 10px',
          cursor: isStarting ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          _hover: {
            filter: isStarting ? 'none' : 'brightness(1.05)',
          },
        })}
        style={{
          background: isStarting ? '#9ca3af' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          boxShadow: isStarting ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        {isStarting ? (
          'Starting...'
        ) : (
          <>
            <span>🎓</span>
            <span>Begin Tutorial</span>
            <span>→</span>
          </>
        )}
      </button>
    </div>
  )
}
