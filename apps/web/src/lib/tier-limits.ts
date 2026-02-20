/**
 * Subscription tier limits — single source of truth.
 *
 * Both server-side enforcement and client-side UI (DurationSelector, etc.)
 * derive from these values. Change a limit here and it propagates everywhere.
 */

/** All available session duration options (minutes). */
export const DURATION_OPTIONS = [5, 10, 15, 20] as const
export type DurationOption = (typeof DURATION_OPTIONS)[number]

export type TierName = 'guest' | 'free' | 'family'

export interface TierLimits {
  maxPracticeStudents: number
  maxSessionMinutes: DurationOption
  maxSessionsPerWeek: number // Infinity = unlimited
  maxOfflineParsingPerMonth: number
}

export const TIER_LIMITS: Record<TierName, TierLimits> = {
  guest: {
    maxPracticeStudents: 1,
    maxSessionMinutes: 10,
    maxSessionsPerWeek: Infinity, // can't enforce — cookies clearable
    maxOfflineParsingPerMonth: 3,
  },
  free: {
    maxPracticeStudents: 1,
    maxSessionMinutes: 10,
    maxSessionsPerWeek: 5,
    maxOfflineParsingPerMonth: 3,
  },
  family: {
    maxPracticeStudents: Infinity,
    maxSessionMinutes: 20,
    maxSessionsPerWeek: Infinity,
    maxOfflineParsingPerMonth: 30,
  },
} as const

/** Duration options available for a given tier. */
export function durationOptionsForTier(tier: TierName): DurationOption[] {
  const max = TIER_LIMITS[tier].maxSessionMinutes
  return DURATION_OPTIONS.filter((d) => d <= max)
}
