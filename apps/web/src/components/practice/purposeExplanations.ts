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
      'Zeroes in on the specific skills your child is currently learning. The system analyzes recent performance to identify which skills need the most attention and generates problems targeting those. Complexity is capped to keep the focus on learning, not struggling.',
    shortExplanation: 'Targets skills your child is actively working to master.',
  },
  reinforce: {
    label: 'Reinforcement',
    shortLabel: 'Reinforce',
    emoji: '💪',
    color: 'orange',
    explanation:
      'Extra reps on skills the system has flagged as not yet solid. When a skill drops below 50% mastery confidence, reinforce problems give additional targeted practice on that specific weakness until it sticks.',
    shortExplanation: 'Extra reps on skills flagged as not yet solid.',
  },
  review: {
    label: 'Spaced Review',
    shortLabel: 'Review',
    emoji: '🔄',
    color: 'green',
    explanation:
      "Each review problem targets one specific previously-learned skill that hasn't been practiced recently. The system cycles through stale skills so nothing gets forgotten — the core idea behind spaced repetition.",
    shortExplanation: 'Revisits one stale skill per problem to prevent forgetting.',
  },
  challenge: {
    label: 'Challenge',
    shortLabel: 'Challenge',
    emoji: '⭐',
    color: 'purple',
    explanation:
      'Harder problems with no complexity ceiling. Every challenge problem requires at least one advanced technique and draws freely from all learned skills — no hand-holding on which skill to use. Builds real fluency under pressure.',
    shortExplanation: 'Hard problems combining multiple skills, no difficulty cap.',
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
