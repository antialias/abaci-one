/**
 * Purpose Explanations Utility
 *
 * Provides human-readable labels and explanations for problem purposes
 * (focus, reinforce, review, challenge).
 */

import type { ProblemSlot } from '@/db/schema/session-plans'

export type PurposeType = ProblemSlot['purpose']

/**
 * Purpose display configuration
 */
export interface PurposeConfig {
  /** Display label (e.g., "Focus Practice") */
  label: string
  /** Short label for compact displays (e.g., "Focus") */
  shortLabel: string
  /** Emoji icon */
  emoji: string
  /** Color theme name (used for styling) */
  color: 'blue' | 'orange' | 'green' | 'purple'
  /** Full explanation text for tooltips and expanded views */
  explanation: string
  /** Short description (1 sentence) for collapsed views */
  shortExplanation: string
}

/**
 * Purpose configurations
 */
export const purposeConfigs: Record<PurposeType, PurposeConfig> = {
  focus: {
    label: 'Focus Practice',
    shortLabel: 'Focus',
    emoji: '🎯',
    color: 'blue',
    explanation:
      "Building mastery of your current curriculum skills. These problems are at the heart of what you're learning right now.",
    shortExplanation: 'Practicing a skill you are currently learning.',
  },
  reinforce: {
    label: 'Reinforcement',
    shortLabel: 'Reinforce',
    emoji: '💪',
    color: 'orange',
    explanation:
      'Extra practice for skills identified as needing more work. These problems target areas where mastery is still developing.',
    shortExplanation: 'Extra practice for a skill that needs more work.',
  },
  review: {
    label: 'Spaced Review',
    shortLabel: 'Review',
    emoji: '🔄',
    color: 'green',
    explanation:
      'Keeping mastered skills fresh through spaced repetition. Regular review prevents forgetting and strengthens long-term memory.',
    shortExplanation: 'Keeping a mastered skill fresh through review.',
  },
  challenge: {
    label: 'Mixed Practice',
    shortLabel: 'Challenge',
    emoji: '⭐',
    color: 'purple',
    explanation:
      "Problems that combine multiple mastered skills. Great for building fluency and applying what you've learned in new ways.",
    shortExplanation: 'Combining multiple skills to build fluency.',
  },
}

/**
 * Get purpose configuration by purpose type
 */
export function getPurposeConfig(purpose: PurposeType): PurposeConfig {
  return purposeConfigs[purpose]
}

/**
 * Get purpose label with emoji
 */
export function getPurposeLabelWithEmoji(purpose: PurposeType): string {
  const config = purposeConfigs[purpose]
  return `${config.emoji} ${config.shortLabel}`
}

/**
 * Get purpose colors for styling (matches existing theme patterns)
 */
export function getPurposeColors(
  purpose: PurposeType,
  isDark: boolean
): {
  background: string
  text: string
  border: string
} {
  const colorMap = {
    blue: {
      background: isDark ? 'blue.900' : 'blue.100',
      text: isDark ? 'blue.200' : 'blue.700',
      border: isDark ? 'blue.700' : 'blue.300',
    },
    orange: {
      background: isDark ? 'orange.900' : 'orange.100',
      text: isDark ? 'orange.200' : 'orange.700',
      border: isDark ? 'orange.700' : 'orange.300',
    },
    green: {
      background: isDark ? 'green.900' : 'green.100',
      text: isDark ? 'green.200' : 'green.700',
      border: isDark ? 'green.700' : 'green.300',
    },
    purple: {
      background: isDark ? 'purple.900' : 'purple.100',
      text: isDark ? 'purple.200' : 'purple.700',
      border: isDark ? 'purple.700' : 'purple.300',
    },
  }

  const config = purposeConfigs[purpose]
  return colorMap[config.color]
}
