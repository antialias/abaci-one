/**
 * CelebrationProgressionBanner
 *
 * A special version of ProgressionBanner that displays a celebration when
 * a student unlocks a new skill, then imperceptibly morphs into the normal
 * banner over ~60 seconds.
 *
 * This component interpolates 35+ CSS properties individually for a smooth,
 * magical transition that the student won't notice happening.
 */

'use client'

import { useEffect, useRef } from 'react'
import type { ProgressionMode } from '@/lib/curriculum/session-mode'
import {
  boxShadow,
  boxShadowsToCss,
  gradientStop,
  gradientToCss,
  lerp,
  lerpBoxShadows,
  lerpColor,
  lerpGradientStops,
  lerpRgbaString,
  type BoxShadow,
  type GradientStop,
  type RGBA,
} from '@/utils/interpolate'
import { fireConfettiCelebration } from '@/utils/confetti'
import { useCelebrationWindDown } from '@/hooks/useCelebrationWindDown'

// =============================================================================
// Types
// =============================================================================

interface CelebrationProgressionBannerProps {
  mode: ProgressionMode
  onAction: () => void
  isLoading: boolean
  variant: 'dashboard' | 'modal'
  isDark: boolean
  /** Speed multiplier for testing (1 = normal, 10 = 10x faster) */
  speedMultiplier?: number
  /** Force a specific progress value (0-1) for Storybook */
  forceProgress?: number
  /** Disable confetti for Storybook (to avoid spam) */
  disableConfetti?: boolean
}

// =============================================================================
// Style Definitions - Start (Celebration) and End (Normal) States
// =============================================================================

// Helper to create RGBA
const rgba = (r: number, g: number, b: number, a: number): RGBA => ({
  r,
  g,
  b,
  a,
})

// --- Container Background Gradients ---
const CELEBRATION_BG_LIGHT: GradientStop[] = [
  gradientStop(234, 179, 8, 0.2, 0), // yellow.500 @ 20%
  gradientStop(251, 191, 36, 0.1, 50), // yellow.400 @ 10%
  gradientStop(234, 179, 8, 0.2, 100),
]
const CELEBRATION_BG_DARK: GradientStop[] = [
  gradientStop(234, 179, 8, 0.25, 0),
  gradientStop(251, 191, 36, 0.15, 50),
  gradientStop(234, 179, 8, 0.25, 100),
]

const NORMAL_BG_LIGHT: GradientStop[] = [
  gradientStop(34, 197, 94, 0.06, 0), // green.500 @ 6%
  gradientStop(59, 130, 246, 0.04, 100), // blue.500 @ 4%
]
const NORMAL_BG_DARK: GradientStop[] = [
  gradientStop(34, 197, 94, 0.12, 0),
  gradientStop(59, 130, 246, 0.08, 100),
]

// Pad to same length (3 stops each)
const NORMAL_BG_LIGHT_PADDED: GradientStop[] = [
  ...NORMAL_BG_LIGHT.slice(0, 1),
  gradientStop(46, 163, 170, 0.05, 50), // midpoint interpolation
  ...NORMAL_BG_LIGHT.slice(1),
]
const NORMAL_BG_DARK_PADDED: GradientStop[] = [
  ...NORMAL_BG_DARK.slice(0, 1),
  gradientStop(46, 163, 170, 0.1, 50),
  ...NORMAL_BG_DARK.slice(1),
]

// --- Container Box Shadows ---
const CELEBRATION_SHADOWS: BoxShadow[] = [
  boxShadow(0, 0, 20, 0, 234, 179, 8, 0.4), // glow 1
  boxShadow(0, 0, 40, 0, 234, 179, 8, 0.2), // glow 2
]
const NORMAL_SHADOWS: BoxShadow[] = [
  boxShadow(0, 2, 8, 0, 0, 0, 0, 0.1), // subtle shadow
  boxShadow(0, 0, 0, 0, 0, 0, 0, 0), // transparent (padding)
]

// --- Button Background Gradients ---
const CELEBRATION_BTN_LIGHT: GradientStop[] = [
  gradientStop(252, 211, 77, 1, 0), // yellow.300
  gradientStop(245, 158, 11, 1, 100), // yellow.500
]
const CELEBRATION_BTN_DARK: GradientStop[] = [
  gradientStop(252, 211, 77, 1, 0),
  gradientStop(245, 158, 11, 1, 100),
]

const NORMAL_BTN: GradientStop[] = [
  gradientStop(34, 197, 94, 1, 0), // green.500
  gradientStop(22, 163, 74, 1, 100), // green.600
]

// --- Button Box Shadows ---
const CELEBRATION_BTN_SHADOW: BoxShadow[] = [boxShadow(0, 4, 15, 0, 245, 158, 11, 0.4)]
const NORMAL_BTN_SHADOW: BoxShadow[] = [boxShadow(0, 2, 4, 0, 0, 0, 0, 0.1)]

// --- Colors ---
const COLORS = {
  // Border
  celebrationBorder: '#eab308', // yellow.500
  normalBorderLight: '#4ade80', // green.400
  normalBorderDark: '#22c55e', // green.500

  // Title
  celebrationTitleLight: '#a16207', // yellow.700
  celebrationTitleDark: '#fef08a', // yellow.200
  normalTitleLight: '#166534', // green.800
  normalTitleDark: '#86efac', // green.300

  // Subtitle
  celebrationSubtitleLight: '#374151', // gray.700
  celebrationSubtitleDark: '#e5e7eb', // gray.200
  normalSubtitleLight: '#6b7280', // gray.500
  normalSubtitleDark: '#a1a1aa', // gray.400

  // Button text
  celebrationBtnTextLight: '#111827', // gray.900 (dark text on yellow)
  celebrationBtnTextDark: '#111827',
  normalBtnText: '#ffffff', // white
}

// =============================================================================
// Style Calculation
// =============================================================================

interface InterpolatedStyles {
  // Container
  containerBackground: string
  containerBorderWidth: number
  containerBorderColor: string
  containerBorderRadius: number
  containerPadding: number
  containerBoxShadow: string

  // Emoji
  emojiSize: number
  emojiRotation: number

  // Title
  titleFontSize: number
  titleColor: string
  titleTextShadow: string

  // Subtitle
  subtitleFontSize: number
  subtitleColor: string
  subtitleMarginTop: number

  // Button
  buttonPaddingY: number
  buttonPaddingX: number
  buttonFontSize: number
  buttonBackground: string
  buttonBorderRadius: number
  buttonBoxShadow: string
  buttonColor: string

  // Shimmer
  shimmerOpacity: number

  // Layout - all interpolated, no discrete jumps
  contentGap: number
  contentJustify: number // 0 = center, 1 = flex-start (use transform)
  textMarginLeft: number
  buttonWrapperPaddingX: number
  buttonWrapperPaddingBottom: number
}

function calculateStyles(
  progress: number,
  oscillation: number,
  isDark: boolean,
  variant: 'dashboard' | 'modal'
): InterpolatedStyles {
  const t = progress // 0 = celebration, 1 = normal

  // Get theme-appropriate values
  const celebrationBg = isDark ? CELEBRATION_BG_DARK : CELEBRATION_BG_LIGHT
  const normalBg = isDark ? NORMAL_BG_DARK_PADDED : NORMAL_BG_LIGHT_PADDED
  const celebrationBtn = isDark ? CELEBRATION_BTN_DARK : CELEBRATION_BTN_LIGHT
  const normalBorder = isDark ? COLORS.normalBorderDark : COLORS.normalBorderLight
  const celebrationTitle = isDark ? COLORS.celebrationTitleDark : COLORS.celebrationTitleLight
  const normalTitle = isDark ? COLORS.normalTitleDark : COLORS.normalTitleLight
  const celebrationSubtitle = isDark
    ? COLORS.celebrationSubtitleDark
    : COLORS.celebrationSubtitleLight
  const normalSubtitle = isDark ? COLORS.normalSubtitleDark : COLORS.normalSubtitleLight
  const celebrationBtnText = isDark ? COLORS.celebrationBtnTextDark : COLORS.celebrationBtnTextLight

  // Variant-specific sizes
  const isModal = variant === 'modal'
  const celebrationPadding = isModal ? 20 : 24
  const normalPadding = isModal ? 14 : 16
  const celebrationTitleSize = isModal ? 24 : 28
  const normalTitleSize = isModal ? 15 : 16
  const celebrationSubtitleSize = isModal ? 16 : 18
  const normalSubtitleSize = isModal ? 12 : 13
  const celebrationBtnPaddingY = isModal ? 14 : 16
  const normalBtnPaddingY = isModal ? 14 : 16
  const celebrationBtnPaddingX = isModal ? 28 : 32
  const normalBtnPaddingX = 0 // full width in normal mode
  const celebrationBtnFontSize = isModal ? 16 : 18
  const normalBtnFontSize = isModal ? 16 : 17

  // Wiggle amplitude decreases as we transition
  const wiggleAmplitude = 3 * (1 - t)
  const rotation = oscillation * wiggleAmplitude

  return {
    // Container
    containerBackground: gradientToCss(135, lerpGradientStops(celebrationBg, normalBg, t)),
    containerBorderWidth: lerp(3, 2, t),
    containerBorderColor: lerpColor(COLORS.celebrationBorder, normalBorder, t),
    containerBorderRadius: lerp(16, isModal ? 12 : 16, t),
    containerPadding: lerp(celebrationPadding, normalPadding, t),
    containerBoxShadow: boxShadowsToCss(lerpBoxShadows(CELEBRATION_SHADOWS, NORMAL_SHADOWS, t)),

    // Emoji - single emoji, just size and wiggle
    emojiSize: lerp(isModal ? 48 : 64, isModal ? 24 : 32, t),
    emojiRotation: rotation,

    // Title
    titleFontSize: lerp(celebrationTitleSize, normalTitleSize, t),
    titleColor: lerpColor(celebrationTitle, normalTitle, t),
    titleTextShadow: `0 0 ${lerp(20, 0, t)}px ${lerpRgbaString(rgba(234, 179, 8, 0.5), rgba(0, 0, 0, 0), t)}`,

    // Subtitle
    subtitleFontSize: lerp(celebrationSubtitleSize, normalSubtitleSize, t),
    subtitleColor: lerpColor(celebrationSubtitle, normalSubtitle, t),
    subtitleMarginTop: lerp(8, 2, t),

    // Button - always full width, wrapper controls visual width
    buttonPaddingY: lerp(celebrationBtnPaddingY, normalBtnPaddingY, t),
    buttonPaddingX: 0, // No horizontal padding on button itself
    buttonFontSize: lerp(celebrationBtnFontSize, normalBtnFontSize, t),
    buttonBackground: gradientToCss(135, lerpGradientStops(celebrationBtn, NORMAL_BTN, t)),
    buttonBorderRadius: lerp(12, 0, t),
    buttonBoxShadow: boxShadowsToCss(lerpBoxShadows(CELEBRATION_BTN_SHADOW, NORMAL_BTN_SHADOW, t)),
    buttonColor: lerpColor(celebrationBtnText, COLORS.normalBtnText, t),

    // Shimmer fades out
    shimmerOpacity: 1 - t,

    // Layout - all smoothly interpolated
    contentGap: lerp(4, 12, t), // Gap between emoji and text
    contentJustify: t, // 0 = centered layout, 1 = left-aligned
    textMarginLeft: lerp(0, 0, t), // Could add margin if needed
    buttonWrapperPaddingX: lerp(isModal ? 60 : 80, 0, t), // Shrinks button visually in celebration
    buttonWrapperPaddingBottom: lerp(celebrationPadding, 0, t),
  }
}

// =============================================================================
// Component
// =============================================================================

export function CelebrationProgressionBanner({
  mode,
  onAction,
  isLoading,
  variant,
  isDark,
  speedMultiplier = 1,
  forceProgress,
  disableConfetti = false,
}: CelebrationProgressionBannerProps) {
  const confettiFiredRef = useRef(false)

  const { progress, shouldFireConfetti, oscillation, onConfettiFired, isCelebrating } =
    useCelebrationWindDown({
      skillId: mode.nextSkill.skillId,
      tutorialRequired: mode.tutorialRequired,
      enabled: true,
      speedMultiplier,
      forceProgress,
    })

  // Fire confetti once (unless disabled for Storybook)
  useEffect(() => {
    if (shouldFireConfetti && !confettiFiredRef.current && !disableConfetti) {
      confettiFiredRef.current = true
      fireConfettiCelebration()
      onConfettiFired()
    }
  }, [shouldFireConfetti, onConfettiFired, disableConfetti])

  // If not celebrating at all, render the normal banner
  if (!isCelebrating && progress >= 1) {
    return (
      <NormalProgressionBanner
        mode={mode}
        onAction={onAction}
        isLoading={isLoading}
        variant={variant}
        isDark={isDark}
      />
    )
  }

  // Calculate all interpolated styles
  const styles = calculateStyles(progress, oscillation, isDark, variant)

  return (
    <div
      data-element="session-mode-banner"
      data-mode="progression"
      data-variant={variant}
      data-celebrating={isCelebrating}
      data-progress={progress.toFixed(3)}
      style={{
        position: 'relative',
        background: styles.containerBackground,
        borderWidth: `${styles.containerBorderWidth}px`,
        borderStyle: 'solid',
        borderColor: styles.containerBorderColor,
        borderRadius: `${styles.containerBorderRadius}px`,
        boxShadow: styles.containerBoxShadow,
        overflow: 'hidden',
      }}
    >
      {/* Shimmer overlay - fades out */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'celebrationShimmer 2s linear infinite',
          opacity: styles.shimmerOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* Content area - always row layout, centering achieved via flexbox */}
      <div
        style={{
          padding: `${styles.containerPadding}px`,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: `${styles.contentGap}px`,
        }}
      >
        {/* Emoji - single emoji with size and wiggle animation */}
        <span
          style={{
            fontSize: `${styles.emojiSize}px`,
            lineHeight: 1,
            flexShrink: 0,
            display: 'inline-block',
            transform: `rotate(${styles.emojiRotation}deg)`,
          }}
        >
          🌟
        </span>

        {/* Text content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title - same text throughout, only styling changes */}
          <div
            style={{
              fontSize: `${styles.titleFontSize}px`,
              fontWeight: 'bold',
              color: styles.titleColor,
              textShadow: styles.titleTextShadow,
            }}
          >
            New Skill Unlocked: <strong>{mode.nextSkill.displayName}</strong>
          </div>

          {/* Subtitle - same text throughout */}
          <div
            style={{
              fontSize: `${styles.subtitleFontSize}px`,
              color: styles.subtitleColor,
              marginTop: `${styles.subtitleMarginTop}px`,
            }}
          >
            Ready to start the tutorial
          </div>
        </div>
      </div>

      {/* Button wrapper - padding interpolates to control visual button width */}
      <div
        style={{
          padding: `0 ${styles.buttonWrapperPaddingX}px ${styles.buttonWrapperPaddingBottom}px`,
        }}
      >
        <button
          type="button"
          data-action="start-progression"
          onClick={onAction}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: `${styles.buttonPaddingY}px 16px`,
            fontSize: `${styles.buttonFontSize}px`,
            fontWeight: 'bold',
            background: styles.buttonBackground,
            color: styles.buttonColor,
            borderRadius: `${styles.buttonBorderRadius}px`,
            border: 'none',
            boxShadow: styles.buttonBoxShadow,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          {isLoading ? 'Starting...' : 'Begin Tutorial →'}
        </button>
      </div>

      {/* Inject keyframes for shimmer animation */}
      <style>
        {`
          @keyframes celebrationShimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
        `}
      </style>
    </div>
  )
}

// =============================================================================
// Normal Progression Banner (fallback when celebration is complete)
// =============================================================================

function NormalProgressionBanner({
  mode,
  onAction,
  isLoading,
  variant,
  isDark,
}: Omit<
  CelebrationProgressionBannerProps,
  'speedMultiplier' | 'forceProgress' | 'disableConfetti'
>) {
  return (
    <div
      data-element="session-mode-banner"
      data-mode="progression"
      data-variant={variant}
      style={{
        borderRadius: variant === 'modal' ? '12px' : '16px',
        overflow: 'hidden',
        border: '2px solid',
        borderColor: isDark ? '#22c55e' : '#4ade80',
        background: isDark
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)'
          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)',
      }}
    >
      {/* Info section */}
      <div
        style={{
          padding: variant === 'modal' ? '14px 16px' : '16px 20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: variant === 'modal' ? '24px' : '32px',
            lineHeight: 1,
          }}
        >
          🌟
        </span>
        <div style={{ flex: 1 }}>
          <p
            style={{
              fontSize: variant === 'modal' ? '15px' : '16px',
              fontWeight: 600,
              color: isDark ? '#86efac' : '#166534',
              margin: 0,
            }}
          >
            {mode.tutorialRequired ? 'New Skill Unlocked: ' : 'Ready to practice: '}
            <strong>{mode.nextSkill.displayName}</strong>
          </p>
          <p
            style={{
              fontSize: variant === 'modal' ? '12px' : '13px',
              marginTop: '2px',
              color: isDark ? '#a1a1aa' : '#6b7280',
              margin: 0,
            }}
          >
            {mode.tutorialRequired ? 'Ready to start the tutorial' : 'Continue building mastery'}
          </p>
        </div>
      </div>

      {/* Action button */}
      <button
        type="button"
        data-action="start-progression"
        onClick={onAction}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: variant === 'modal' ? '14px' : '16px',
          fontSize: variant === 'modal' ? '16px' : '17px',
          fontWeight: 'bold',
          color: 'white',
          border: 'none',
          borderRadius: 0,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: isLoading ? '#9ca3af' : 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          boxShadow: isLoading ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.15)',
        }}
      >
        {isLoading ? 'Starting...' : mode.tutorialRequired ? 'Begin Tutorial →' : "Let's Go! →"}
      </button>
    </div>
  )
}
