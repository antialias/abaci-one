'use client'

import type { SessionMode } from '@/lib/curriculum/session-mode'
import { css } from '../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

interface CompactBannerProps {
  /** The session mode to display */
  sessionMode: SessionMode
  /** Callback when user clicks the action button */
  onAction: () => void
  /** Whether an action is in progress */
  isLoading?: boolean
  /** Dark mode */
  isDark: boolean
}

// ============================================================================
// Color Schemes
// ============================================================================

type ColorScheme = {
  bg: string
  border: string
  text: string
  buttonBg: string
  buttonText: string
}

function getColorScheme(mode: SessionMode['type'], isDark: boolean): ColorScheme {
  switch (mode) {
    case 'remediation':
      return {
        bg: isDark
          ? 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(217, 119, 6, 0.1) 100%)'
          : 'linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.06) 100%)',
        border: isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(217, 119, 6, 0.3)',
        text: isDark ? '#fcd34d' : '#b45309',
        buttonBg: isDark
          ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
          : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
        buttonText: 'white',
      }
    case 'progression':
      return {
        bg: isDark
          ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.1) 100%)'
          : 'linear-gradient(90deg, rgba(34, 197, 94, 0.08) 0%, rgba(22, 163, 74, 0.05) 100%)',
        border: isDark ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.3)',
        text: isDark ? '#86efac' : '#166534',
        buttonBg: isDark
          ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
          : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
        buttonText: 'white',
      }
    case 'maintenance':
      return {
        bg: isDark
          ? 'linear-gradient(90deg, rgba(59, 130, 246, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)'
          : 'linear-gradient(90deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
        border: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)',
        text: isDark ? '#93c5fd' : '#1d4ed8',
        buttonBg: isDark
          ? 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)'
          : 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
        buttonText: 'white',
      }
  }
}

// ============================================================================
// Content Helpers
// ============================================================================

function getIcon(mode: SessionMode): string {
  switch (mode.type) {
    case 'remediation':
      return mode.blockedPromotion ? '🔒' : '💪'
    case 'progression':
      return '🌟'
    case 'maintenance':
      return '✨'
  }
}

function getLabel(mode: SessionMode): string {
  switch (mode.type) {
    case 'remediation': {
      const skills = mode.weakSkills.slice(0, 2).map((s) => s.displayName)
      if (mode.blockedPromotion) {
        return `Strengthen ${skills.join(', ')} to unlock ${mode.blockedPromotion.nextSkill.displayName}`
      }
      return `Targeting: ${skills.join(', ')}${mode.weakSkills.length > 2 ? '...' : ''}`
    }
    case 'progression':
      return mode.tutorialRequired
        ? `Ready: ${mode.nextSkill.displayName}`
        : `Practice: ${mode.nextSkill.displayName}`
    case 'maintenance':
      return `All ${mode.skillCount} skills strong`
  }
}

function getButtonText(mode: SessionMode, isLoading: boolean): string {
  if (isLoading) return '...'
  switch (mode.type) {
    case 'remediation':
      return 'Practice'
    case 'progression':
      return mode.tutorialRequired ? 'Tutorial' : 'Practice'
    case 'maintenance':
      return 'Practice'
  }
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * CompactBanner - Condensed single-line version for nav slot
 *
 * Shows essential info and action in a compact horizontal layout:
 * [Icon] [Short description] [Button]
 */
export function CompactBanner({
  sessionMode,
  onAction,
  isLoading = false,
  isDark,
}: CompactBannerProps) {
  const colors = getColorScheme(sessionMode.type, isDark)
  const icon = getIcon(sessionMode)
  const label = getLabel(sessionMode)
  const buttonText = getButtonText(sessionMode, isLoading)

  return (
    <div
      data-component="compact-banner"
      data-mode={sessionMode.type}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.375rem 0.5rem',
        borderRadius: '8px',
        border: '1px solid',
        transition: 'all 0.2s ease',
      })}
      style={{
        background: colors.bg,
        borderColor: colors.border,
      }}
    >
      {/* Icon */}
      <span
        className={css({
          fontSize: '1rem',
          lineHeight: 1,
          flexShrink: 0,
        })}
      >
        {icon}
      </span>

      {/* Label */}
      <span
        className={css({
          fontSize: '0.8125rem',
          fontWeight: '500',
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        })}
        style={{ color: colors.text }}
      >
        {label}
      </span>

      {/* Action button */}
      <button
        type="button"
        data-action="compact-banner-action"
        onClick={onAction}
        disabled={isLoading}
        className={css({
          padding: '0.375rem 0.625rem',
          fontSize: '0.75rem',
          fontWeight: '600',
          borderRadius: '6px',
          border: 'none',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          _hover: {
            filter: isLoading ? 'none' : 'brightness(1.1)',
          },
        })}
        style={{
          background: isLoading ? '#9ca3af' : colors.buttonBg,
          color: colors.buttonText,
        }}
      >
        {buttonText}
        {!isLoading && <span>→</span>}
      </button>
    </div>
  )
}

export default CompactBanner
