'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal } from '../StartPracticeModalContext'

/**
 * Displays session focus information based on sessionMode.
 * Replaces TutorialCTA and RemediationCTA with a unified info display.
 */
export function SessionFocusInfo() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const {
    sessionMode,
    tutorialConfig,
    nextSkill,
    canSkipTutorial,
    includeTutorial,
    setIncludeTutorial,
  } = useStartPracticeModal()

  // Progression mode with tutorial
  if (sessionMode.type === 'progression' && tutorialConfig && nextSkill) {
    return (
      <div
        data-element="session-focus-info"
        data-focus-type="progression"
        className={css({
          borderRadius: '12px',
          overflow: 'hidden',
        })}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)',
          border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)'}`,
        }}
      >
        <div
          className={css({
            padding: '0.875rem 1rem',
            display: 'flex',
            gap: '0.625rem',
            alignItems: 'flex-start',
          })}
        >
          <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>
            {includeTutorial ? '🌟' : '📚'}
          </span>
          <div className={css({ flex: 1 })}>
            <p
              className={css({
                fontSize: '0.875rem',
                fontWeight: '600',
              })}
              style={{ color: isDark ? '#86efac' : '#166534' }}
            >
              {includeTutorial ? 'Learning' : 'Ready to learn'}: {tutorialConfig.title}
            </p>
            {includeTutorial ? (
              <p
                className={css({
                  fontSize: '0.75rem',
                  marginTop: '0.125rem',
                })}
                style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
              >
                Quick tutorial included (~2 min)
              </p>
            ) : (
              <p
                className={css({
                  fontSize: '0.75rem',
                  marginTop: '0.125rem',
                })}
                style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
              >
                Practicing existing skills
              </p>
            )}

            {/* Skip tutorial checkbox - only if user has other skills */}
            {canSkipTutorial && (
              <label
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                })}
                style={{ color: isDark ? '#d4d4d8' : '#52525b' }}
              >
                <input
                  type="checkbox"
                  checked={!includeTutorial}
                  onChange={(e) => setIncludeTutorial(!e.target.checked)}
                  className={css({
                    width: '14px',
                    height: '14px',
                    cursor: 'pointer',
                  })}
                />
                Skip tutorial, practice existing skills
              </label>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Remediation mode
  if (sessionMode.type === 'remediation' && sessionMode.weakSkills.length > 0) {
    const skillNames = sessionMode.weakSkills.map((s) => s.displayName).join(', ')
    return (
      <div
        data-element="session-focus-info"
        data-focus-type="remediation"
        className={css({
          borderRadius: '12px',
          padding: '0.875rem 1rem',
          display: 'flex',
          gap: '0.625rem',
          alignItems: 'flex-start',
        })}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.12) 0%, rgba(249, 115, 22, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(251, 191, 36, 0.06) 0%, rgba(249, 115, 22, 0.04) 100%)',
          border: `1px solid ${isDark ? 'rgba(251, 191, 36, 0.25)' : 'rgba(251, 191, 36, 0.2)'}`,
        }}
      >
        <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>⚡</span>
        <div>
          <p
            className={css({
              fontSize: '0.875rem',
              fontWeight: '600',
            })}
            style={{ color: isDark ? '#fcd34d' : '#b45309' }}
          >
            Strengthening: {skillNames}
          </p>
          <p
            className={css({
              fontSize: '0.75rem',
              marginTop: '0.125rem',
            })}
            style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
          >
            Focused practice on skills that need attention
          </p>
        </div>
      </div>
    )
  }

  // Maintenance mode
  if (sessionMode.type === 'maintenance') {
    const deferred = sessionMode.deferredProgression
    return (
      <div
        data-element="session-focus-info"
        data-focus-type="maintenance"
        className={css({
          borderRadius: '12px',
          padding: '0.875rem 1rem',
          display: 'flex',
          gap: '0.625rem',
          alignItems: 'flex-start',
        })}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%)',
          border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.2)'}`,
        }}
      >
        <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>✨</span>
        <div>
          <p
            className={css({
              fontSize: '0.875rem',
              fontWeight: '600',
            })}
            style={{ color: isDark ? '#93c5fd' : '#1d4ed8' }}
          >
            {deferred
              ? `Working toward: ${deferred.nextSkill.displayName}`
              : `Mixed review (${sessionMode.skillCount} skills)`}
          </p>
          <p
            className={css({
              fontSize: '0.75rem',
              marginTop: '0.125rem',
            })}
            style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
          >
            {deferred
              ? 'Building muscle memory before advancing'
              : 'All skills mastered - maintaining proficiency'}
          </p>
        </div>
      </div>
    )
  }

  // Fallback for progression without tutorial
  if (sessionMode.type === 'progression') {
    return (
      <div
        data-element="session-focus-info"
        data-focus-type="progression-no-tutorial"
        className={css({
          borderRadius: '12px',
          padding: '0.875rem 1rem',
          display: 'flex',
          gap: '0.625rem',
          alignItems: 'flex-start',
        })}
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)'
            : 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)',
          border: `1px solid ${isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.2)'}`,
        }}
      >
        <span className={css({ fontSize: '1.5rem', lineHeight: 1 })}>📈</span>
        <div>
          <p
            className={css({
              fontSize: '0.875rem',
              fontWeight: '600',
            })}
            style={{ color: isDark ? '#86efac' : '#166534' }}
          >
            {sessionMode.focusDescription}
          </p>
        </div>
      </div>
    )
  }

  return null
}
