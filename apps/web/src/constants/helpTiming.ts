/**
 * Timing configuration for progressive help system
 *
 * Production values give the kid time to try on their own before hints appear.
 * Debug values allow fast iteration during development.
 */
export const HELP_TIMING = {
  production: {
    /** Delay before showing coach hint */
    coachHintDelayMs: 5000,
    /** Delay before showing bead tooltip */
    beadTooltipDelayMs: 10000,
    /** Duration of celebration animation */
    celebrationDurationMs: 800,
    /** Duration of fade-out transition */
    transitionDurationMs: 300,
  },
  debug: {
    /** Delay before showing coach hint */
    coachHintDelayMs: 1000,
    /** Delay before showing bead tooltip */
    beadTooltipDelayMs: 3000,
    /** Duration of celebration animation */
    celebrationDurationMs: 500,
    /** Duration of fade-out transition */
    transitionDurationMs: 200,
  },
} as const

export type HelpTimingConfig = {
  readonly coachHintDelayMs: number
  readonly beadTooltipDelayMs: number
  readonly celebrationDurationMs: number
  readonly transitionDurationMs: number
}

/**
 * Get timing configuration based on debug mode
 */
export function getHelpTiming(debug: boolean): HelpTimingConfig {
  return debug ? HELP_TIMING.debug : HELP_TIMING.production
}

/**
 * Progressive assistance timing configuration
 *
 * Controls the escalation from idle → encouragement → help offer → auto-pause.
 * Production values give kids time; debug values allow fast iteration.
 */
export const PROGRESSIVE_ASSISTANCE_TIMING = {
  production: {
    /** Default encouragement delay when not enough data for stats (ms) */
    defaultEncouragementMs: 15_000,
    /** Default help offer delay when not enough data for stats (ms) */
    defaultHelpOfferMs: 30_000,
    /** Min clamp for encouragement threshold (ms) */
    minEncouragementMs: 8_000,
    /** Max clamp for encouragement threshold (ms) */
    maxEncouragementMs: 45_000,
    /** Min clamp for help offer threshold (ms) */
    minHelpOfferMs: 15_000,
    /** Max clamp for help offer threshold (ms) */
    maxHelpOfferMs: 90_000,
    /** Number of wrong answers before suggesting help */
    wrongAnswerThreshold: 3,
    /** Grace period after all terms helped before moveOn becomes available (ms) */
    moveOnGraceMs: 12_000,
  },
  debug: {
    defaultEncouragementMs: 3_000,
    defaultHelpOfferMs: 6_000,
    minEncouragementMs: 2_000,
    maxEncouragementMs: 10_000,
    minHelpOfferMs: 4_000,
    maxHelpOfferMs: 15_000,
    wrongAnswerThreshold: 2,
    moveOnGraceMs: 3_000,
  },
} as const

export interface ProgressiveAssistanceTimingConfig {
  readonly defaultEncouragementMs: number
  readonly defaultHelpOfferMs: number
  readonly minEncouragementMs: number
  readonly maxEncouragementMs: number
  readonly minHelpOfferMs: number
  readonly maxHelpOfferMs: number
  readonly wrongAnswerThreshold: number
  readonly moveOnGraceMs: number
}

/**
 * Get progressive assistance timing based on debug mode
 */
export function getProgressiveAssistanceTiming(debug: boolean): ProgressiveAssistanceTimingConfig {
  return debug ? PROGRESSIVE_ASSISTANCE_TIMING.debug : PROGRESSIVE_ASSISTANCE_TIMING.production
}

/**
 * Check if we should use debug timing
 * - Always false in production builds
 * - True in development if localStorage flag is set or storybook
 */
export function shouldUseDebugTiming(): boolean {
  if (typeof window === 'undefined') return false
  if (process.env.NODE_ENV === 'production') return false

  // Check for storybook
  if (window.location?.href?.includes('storybook')) return true

  // Check for localStorage flag
  try {
    return localStorage.getItem('helpDebugTiming') === 'true'
  } catch {
    return false
  }
}
