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
