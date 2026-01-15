'use client'

import { animated, type SpringValue, to } from '@react-spring/web'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import { css } from '../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

interface MorphingBannerProps {
  /** The session mode to display */
  sessionMode: SessionMode
  /** Callback when user clicks the action button */
  onAction: () => void
  /** Whether an action is in progress */
  isLoading?: boolean
  /** Dark mode */
  isDark: boolean
  /** Animation progress: 0 = full banner, 1 = compact banner (SpringValue for smooth animation) */
  progress: SpringValue<number>
  /** Container width (SpringValue for smooth animation) */
  containerWidth: SpringValue<number>
  /** Container height (SpringValue for smooth animation) */
  containerHeight: SpringValue<number>
}

// ============================================================================
// Interpolation helper
// ============================================================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// ============================================================================
// Color Schemes
// ============================================================================

type ColorScheme = {
  bg: string
  border: string
  text: string
  subtext: string
  buttonBg: string
  buttonText: string
}

function getColorScheme(mode: SessionMode['type'], isDark: boolean): ColorScheme {
  switch (mode) {
    case 'remediation':
      return {
        bg: isDark
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.05) 100%)',
        border: isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(217, 119, 6, 0.3)',
        text: isDark ? '#fcd34d' : '#b45309',
        subtext: isDark ? '#d4d4d4' : '#525252',
        buttonBg: isDark
          ? 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
          : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
        buttonText: 'white',
      }
    case 'progression':
      return {
        bg: isDark
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(22, 163, 74, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(22, 163, 74, 0.05) 100%)',
        border: isDark ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.3)',
        text: isDark ? '#86efac' : '#166534',
        subtext: isDark ? '#d4d4d4' : '#525252',
        buttonBg: isDark
          ? 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)'
          : 'linear-gradient(90deg, #22c55e 0%, #16a34a 100%)',
        buttonText: 'white',
      }
    case 'maintenance':
      return {
        bg: isDark
          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%)',
        border: isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.3)',
        text: isDark ? '#93c5fd' : '#1d4ed8',
        subtext: isDark ? '#d4d4d4' : '#525252',
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

function getTitle(mode: SessionMode): string {
  switch (mode.type) {
    case 'remediation':
      return mode.blockedPromotion ? 'Almost there!' : 'Strengthening skills'
    case 'progression':
      return mode.tutorialRequired ? 'Ready to learn!' : 'Practice new skill'
    case 'maintenance':
      return 'All skills strong!'
  }
}

function getSubtitle(mode: SessionMode): string {
  switch (mode.type) {
    case 'remediation': {
      const skills = mode.weakSkills.slice(0, 2).map((s) => s.displayName)
      if (mode.blockedPromotion) {
        return `Strengthen ${skills.join(', ')} to unlock ${mode.blockedPromotion.nextSkill.displayName}`
      }
      return `Targeting: ${skills.join(', ')}${mode.weakSkills.length > 2 ? '...' : ''}`
    }
    case 'progression':
      return mode.nextSkill.displayName
    case 'maintenance':
      return `${mode.skillCount} skills mastered`
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
 * MorphingBanner - A banner that smoothly morphs between full and compact layouts
 *
 * Layout transitions:
 * - Full (progress=0): Vertical layout, button at bottom center
 * - Compact (progress=1): Horizontal layout, button on right
 *
 * All internal positions/sizes are interpolated from the SpringValues passed in,
 * creating a smooth morphing animation as progress changes.
 */
export function MorphingBanner({
  sessionMode,
  onAction,
  isLoading = false,
  isDark,
  progress,
  containerWidth,
  containerHeight,
}: MorphingBannerProps) {
  const colors = getColorScheme(sessionMode.type, isDark)
  const icon = getIcon(sessionMode)
  const title = getTitle(sessionMode)
  const subtitle = getSubtitle(sessionMode)
  const buttonText = getButtonText(sessionMode, isLoading)

  // Button dimensions (constants)
  const fullButtonHeight = 48
  const compactButtonWidth = 90
  const compactButtonHeight = 32

  // Icon sizes (constants)
  const fullIconSize = 32
  const compactIconSize = 16

  // Icon positions (constants for full mode)
  const fullIconX = 20
  const fullIconY = 16
  const compactIconX = 8

  // Text positions (constants)
  const fullTextX = 60
  const fullTextY = 16
  const compactTextX = 32

  // Interpolated button styles using to()
  const buttonStyles = to([progress, containerWidth, containerHeight], (p, width, height) => {
    // Full mode: full width, flush with bottom
    const fullButtonWidth = width
    const fullButtonX = 0
    const fullButtonY = height - fullButtonHeight
    // Compact mode: small button on right
    const compactButtonX = width - compactButtonWidth - 8
    const compactButtonY = (height - compactButtonHeight) / 2

    return {
      left: lerp(fullButtonX, compactButtonX, p),
      top: lerp(fullButtonY, compactButtonY, p),
      width: lerp(fullButtonWidth, compactButtonWidth, p),
      height: lerp(fullButtonHeight, compactButtonHeight, p),
      fontSize: lerp(16, 13, p),
      paddingLeft: lerp(24, 12, p),
      paddingRight: lerp(24, 12, p),
      // Border radius: flat bottom in full mode, rounded in compact
      borderTopLeftRadius: lerp(0, 8, p),
      borderTopRightRadius: lerp(0, 8, p),
      borderBottomLeftRadius: lerp(0, 8, p),
      borderBottomRightRadius: lerp(0, 8, p),
    }
  })

  // Interpolated icon styles
  const iconStyles = to([progress, containerHeight], (p, height) => {
    const compactIconY = (height - compactIconSize) / 2
    return {
      left: lerp(fullIconX, compactIconX, p),
      top: lerp(fullIconY, compactIconY, p),
      fontSize: lerp(fullIconSize, compactIconSize, p),
    }
  })

  // Interpolated text styles
  const textStyles = to([progress, containerHeight], (p, height) => {
    const compactTextY = (height - 16) / 2
    return {
      left: lerp(fullTextX, compactTextX, p),
      top: lerp(fullTextY, compactTextY, p),
      right: lerp(24, compactButtonWidth + 16, p),
    }
  })

  // Title font size
  const titleFontSize = to(progress, (p) => lerp(16, 13, p))

  // Title margin bottom
  const titleMarginBottom = to(progress, (p) => lerp(4, 0, p))

  // Subtitle opacity (fades out in compact mode)
  const subtitleOpacity = to(progress, (p) => 1 - p)

  return (
    <div
      data-component="morphing-banner"
      data-mode={sessionMode.type}
      className={css({
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        border: '1px solid',
      })}
      style={{
        background: colors.bg,
        borderColor: colors.border,
      }}
    >
      {/* Icon */}
      <animated.span
        style={{
          position: 'absolute',
          left: iconStyles.to((s) => s.left),
          top: iconStyles.to((s) => s.top),
          fontSize: iconStyles.to((s) => s.fontSize),
          lineHeight: 1,
        }}
      >
        {icon}
      </animated.span>

      {/* Text content */}
      <animated.div
        style={{
          position: 'absolute',
          left: textStyles.to((s) => s.left),
          top: textStyles.to((s) => s.top),
          right: textStyles.to((s) => s.right),
        }}
      >
        {/* Title - shows subtitle text in compact mode for more useful info */}
        <animated.p
          style={{
            fontSize: titleFontSize,
            fontWeight: 600,
            color: colors.text,
            marginBottom: titleMarginBottom,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </animated.p>
        {/* Subtitle - fades out in compact mode */}
        <animated.p
          style={{
            fontSize: 14,
            color: colors.subtext,
            opacity: subtitleOpacity,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {subtitle}
        </animated.p>
      </animated.div>

      {/* Action button */}
      <animated.button
        type="button"
        data-action="morphing-banner-action"
        onClick={onAction}
        disabled={isLoading}
        style={{
          position: 'absolute',
          left: buttonStyles.to((s) => s.left),
          top: buttonStyles.to((s) => s.top),
          width: buttonStyles.to((s) => s.width),
          height: buttonStyles.to((s) => s.height),
          fontSize: buttonStyles.to((s) => s.fontSize),
          paddingLeft: buttonStyles.to((s) => s.paddingLeft),
          paddingRight: buttonStyles.to((s) => s.paddingRight),
          borderTopLeftRadius: buttonStyles.to((s) => s.borderTopLeftRadius),
          borderTopRightRadius: buttonStyles.to((s) => s.borderTopRightRadius),
          borderBottomLeftRadius: buttonStyles.to((s) => s.borderBottomLeftRadius),
          borderBottomRightRadius: buttonStyles.to((s) => s.borderBottomRightRadius),
          background: isLoading ? '#9ca3af' : colors.buttonBg,
          color: colors.buttonText,
          border: 'none',
          fontWeight: 600,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
        className={css({
          _hover: {
            filter: isLoading ? 'none' : 'brightness(1.1)',
          },
        })}
      >
        {buttonText}
        {!isLoading && <span>→</span>}
      </animated.button>
    </div>
  )
}

export default MorphingBanner
