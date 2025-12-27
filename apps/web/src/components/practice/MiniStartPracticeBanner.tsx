'use client'

import { useTheme } from '@/contexts/ThemeContext'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import type { StudentActivity } from '@/types/student'
import { css } from '../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

interface MiniStartPracticeBannerProps {
  /** Session mode data (null if not loaded yet) */
  sessionMode: SessionMode | null
  /** Current activity status */
  activity: StudentActivity | null
  /** Whether the viewer is a teacher (affects "Watch" vs "Resume" for active sessions) */
  isTeacher?: boolean
  /** Called when "Start" is clicked - should open StartPracticeModal */
  onStartPractice: () => void
  /** Called when "Resume" is clicked - navigates to active session */
  onResumePractice: () => void
  /** Called when "Watch" is clicked - opens session observer */
  onWatchSession: () => void
}

// ============================================================================
// Mode-specific configurations
// ============================================================================

interface ModeConfig {
  icon: string
  label: string
  sublabel?: string
  buttonLabel: string
  bgGradient: { light: string; dark: string }
  borderColor: { light: string; dark: string }
  textColor: { light: string; dark: string }
  buttonGradient: string
}

function getIdleModeConfig(sessionMode: SessionMode): ModeConfig {
  switch (sessionMode.type) {
    case 'remediation': {
      const hasBlockedPromotion = !!sessionMode.blockedPromotion
      const weakCount = sessionMode.weakSkills.length
      return {
        icon: hasBlockedPromotion ? '🔒' : '💪',
        label: hasBlockedPromotion ? 'Almost there!' : 'Build strength',
        sublabel: `${weakCount} skill${weakCount > 1 ? 's' : ''} to strengthen`,
        buttonLabel: 'Start',
        bgGradient: {
          light: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.05) 100%)',
          dark: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.08) 100%)',
        },
        borderColor: { light: '#fbbf24', dark: '#d97706' },
        textColor: { light: '#b45309', dark: '#fcd34d' },
        buttonGradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      }
    }
    case 'progression': {
      const tutorialRequired = sessionMode.tutorialRequired
      return {
        icon: '🌟',
        label: tutorialRequired ? 'New skill unlocked!' : 'Ready to learn',
        sublabel: sessionMode.nextSkill.displayName,
        buttonLabel: tutorialRequired ? 'Learn' : 'Start',
        bgGradient: {
          light: 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)',
          dark: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
        },
        borderColor: { light: '#22c55e', dark: '#16a34a' },
        textColor: { light: '#166534', dark: '#86efac' },
        buttonGradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
      }
    }
    case 'maintenance': {
      return {
        icon: '✨',
        label: 'All skills strong!',
        sublabel: `${sessionMode.skillCount} skills mastered`,
        buttonLabel: 'Start',
        bgGradient: {
          light: 'linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%)',
          dark: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
        },
        borderColor: { light: '#3b82f6', dark: '#2563eb' },
        textColor: { light: '#1d4ed8', dark: '#93c5fd' },
        buttonGradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
      }
    }
  }
}

function getActiveSessionConfig(activity: StudentActivity, isTeacher: boolean): ModeConfig {
  const progress = activity.sessionProgress
  const progressText = progress ? `${progress.current}/${progress.total} problems` : 'In progress'

  if (isTeacher) {
    // Teacher sees "Watch" option
    return {
      icon: '👁',
      label: 'Practicing now',
      sublabel: progressText,
      buttonLabel: 'Watch',
      bgGradient: {
        light: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)',
        dark: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)',
      },
      borderColor: { light: '#8b5cf6', dark: '#7c3aed' },
      textColor: { light: '#6d28d9', dark: '#c4b5fd' },
      buttonGradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    }
  } else {
    // Parent/student sees "Resume" option
    return {
      icon: '▶️',
      label: 'Session in progress',
      sublabel: progressText,
      buttonLabel: 'Resume',
      bgGradient: {
        light: 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(16, 185, 129, 0.04) 100%)',
        dark: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
      },
      borderColor: { light: '#22c55e', dark: '#16a34a' },
      textColor: { light: '#166534', dark: '#86efac' },
      buttonGradient: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
    }
  }
}

// ============================================================================
// Component
// ============================================================================

/**
 * Mini Start Practice Banner - compact version for QuickLook modal
 *
 * Shows different content based on state:
 * - Idle + session mode: Shows session mode info with "Start" CTA
 * - Active session (teacher): Shows "Watch" to observe
 * - Active session (parent): Shows "Resume" to continue
 *
 * Designed to fit above the Overview/Notes tabs.
 */
export function MiniStartPracticeBanner({
  sessionMode,
  activity,
  isTeacher = false,
  onStartPractice,
  onResumePractice,
  onWatchSession,
}: MiniStartPracticeBannerProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const isPracticing = activity?.status === 'practicing'

  // Determine config and handler based on state
  let config: ModeConfig
  let handleClick: () => void

  if (isPracticing) {
    config = getActiveSessionConfig(activity, isTeacher)
    handleClick = isTeacher ? onWatchSession : onResumePractice
  } else if (sessionMode) {
    config = getIdleModeConfig(sessionMode)
    handleClick = onStartPractice
  } else {
    // No session mode data yet - don't render
    return null
  }

  return (
    <div
      data-component="mini-start-practice-banner"
      data-mode={isPracticing ? 'active' : sessionMode?.type}
      data-variant={isPracticing ? (isTeacher ? 'watch' : 'resume') : 'start'}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderRadius: '8px',
        margin: '8px 12px 0',
        border: '1px solid',
      })}
      style={{
        background: isDark ? config.bgGradient.dark : config.bgGradient.light,
        borderColor: isDark ? config.borderColor.dark : config.borderColor.light,
      }}
    >
      {/* Icon */}
      <span
        className={css({
          fontSize: '1.25rem',
          lineHeight: 1,
          flexShrink: 0,
        })}
      >
        {config.icon}
      </span>

      {/* Text content */}
      <div
        className={css({
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
        })}
      >
        <div
          className={css({
            fontSize: '0.8125rem',
            fontWeight: '600',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          })}
          style={{ color: isDark ? config.textColor.dark : config.textColor.light }}
        >
          {config.label}
        </div>
        {config.sublabel && (
          <div
            className={css({
              fontSize: '0.6875rem',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '1px',
            })}
            style={{ color: isDark ? '#a1a1aa' : '#6b7280' }}
          >
            {config.sublabel}
          </div>
        )}
      </div>

      {/* Action button */}
      <button
        type="button"
        data-action={isPracticing ? (isTeacher ? 'watch-session' : 'resume-practice') : 'start-practice'}
        onClick={handleClick}
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '6px 12px',
          fontSize: '0.8125rem',
          fontWeight: '600',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.15s ease',
          _hover: {
            filter: 'brightness(1.05)',
            transform: 'translateY(-1px)',
          },
          _active: {
            transform: 'translateY(0)',
          },
        })}
        style={{
          background: config.buttonGradient,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        <span>{config.buttonLabel}</span>
        <span className={css({ fontSize: '0.75rem' })}>→</span>
      </button>
    </div>
  )
}

export default MiniStartPracticeBanner
