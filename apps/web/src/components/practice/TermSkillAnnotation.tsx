/**
 * Term Skill Annotation Component
 *
 * Shows skills used for a single term with their effective costs.
 * Effective cost = baseCost × rotationMultiplier
 *
 * Display format:
 * - shortName: effectiveCost (base × multiplier)
 * - e.g., "9=10-1: 6 (2×3)"
 *
 * Note: BKT provides fine-grained mastery (pKnown). The isPracticing flag here
 * is a simplified fallback indicating whether the skill is in the active practice rotation.
 */

import type { GenerationTraceStep, SkillMasteryDisplay } from '@/db/schema/session-plans'
import { getBaseComplexity } from '@/utils/skillComplexity'
import { css } from '../../../styled-system/css'

export interface TermSkillAnnotationProps {
  /** The generation trace step for this term */
  step: GenerationTraceStep
  /** Per-skill mastery context (from GenerationTrace.skillMasteryContext) */
  skillMasteryContext?: Record<string, SkillMasteryDisplay>
  /** Maximum complexity budget per term (for color coding) */
  maxBudget?: number
  /** Minimum complexity budget per term (for color coding) */
  minBudget?: number
  /** Whether this is the first term (exempt from min budget) */
  isFirstTerm: boolean
  /** Dark mode */
  isDark: boolean
  /** Compact mode - just show total cost, not per-skill breakdown */
  compact?: boolean
}

/**
 * Format a skill ID for human-readable display
 */
function formatSkillId(skillId: string): {
  shortName: string
  fullName: string
} {
  // "fiveComplements.4=5-1" → { shortName: "4=5-1", fullName: "5-complement for 4" }
  // "tenComplements.9=10-1" → { shortName: "9=10-1", fullName: "10-complement for 9" }
  // "basic.directAddition" → { shortName: "direct", fullName: "Direct addition" }

  const parts = skillId.split('.')
  const category = parts[0]
  const specific = parts[1] || skillId

  // For complement skills, the specific part is already descriptive
  if (category === 'fiveComplements' || category === 'tenComplements') {
    return { shortName: specific, fullName: `${category}: ${specific}` }
  }
  if (category === 'fiveComplementsSub' || category === 'tenComplementsSub') {
    return { shortName: specific, fullName: `${category}: ${specific}` }
  }
  if (category === 'basic') {
    const shortNames: Record<string, string> = {
      directAddition: 'direct+',
      heavenBead: 'heaven',
      simpleCombinations: 'simple',
      directSubtraction: 'direct-',
      heavenBeadSubtraction: 'heaven-',
      simpleCombinationsSub: 'simple-',
    }
    return {
      shortName: shortNames[specific] || specific,
      fullName: `Basic: ${specific}`,
    }
  }

  return { shortName: specific, fullName: skillId }
}

/**
 * Get rotation status multiplier abbreviation
 *
 * Note: BKT provides continuous multipliers (1-4) based on pKnown.
 * These are fallback multipliers when BKT data is insufficient.
 */
function getRotationAbbrev(isPracticing: boolean): string {
  return isPracticing ? '×3' : '×4'
}

/**
 * Determine cost status for color coding
 */
function getCostStatus(
  cost: number | undefined,
  maxBudget: number | undefined,
  minBudget: number | undefined,
  isFirstTerm: boolean
): 'over' | 'under' | 'ok' | 'unknown' {
  if (cost === undefined) return 'unknown'

  if (maxBudget !== undefined && cost > maxBudget) {
    return 'over'
  }

  if (minBudget !== undefined && cost < minBudget && !isFirstTerm) {
    return 'under'
  }

  return 'ok'
}

/**
 * Get color for cost status
 */
function getCostColor(status: 'over' | 'under' | 'ok' | 'unknown', isDark: boolean): string {
  switch (status) {
    case 'over':
      return isDark ? '#f87171' : '#dc2626' // red
    case 'under':
      return isDark ? '#fbbf24' : '#d97706' // yellow/amber
    case 'ok':
      return isDark ? '#4ade80' : '#16a34a' // green
    case 'unknown':
      return isDark ? '#9ca3af' : '#6b7280' // gray
  }
}

/**
 * Get status indicator icon
 */
function getCostStatusIcon(status: 'over' | 'under' | 'ok' | 'unknown'): string {
  switch (status) {
    case 'over':
      return '✗'
    case 'under':
      return '⚠'
    case 'ok':
      return '✓'
    case 'unknown':
      return ''
  }
}

export function TermSkillAnnotation({
  step,
  skillMasteryContext,
  maxBudget,
  minBudget,
  isFirstTerm,
  isDark,
  compact = false,
}: TermSkillAnnotationProps) {
  const { skillsUsed, complexityCost } = step

  // No skills = nothing to show
  if (skillsUsed.length === 0) {
    return (
      <span
        className={css({
          color: isDark ? 'gray.500' : 'gray.400',
          fontSize: '0.75rem',
          fontStyle: 'italic',
        })}
      >
        (no skills)
      </span>
    )
  }

  const costStatus = getCostStatus(complexityCost, maxBudget, minBudget, isFirstTerm)
  const costColor = getCostColor(costStatus, isDark)
  const statusIcon = getCostStatusIcon(costStatus)

  // Compact mode: just show total cost with color
  if (compact) {
    return (
      <span
        data-element="term-skill-annotation-compact"
        className={css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
        })}
        style={{ color: costColor }}
      >
        [{complexityCost ?? '?'}]{statusIcon && <span>{statusIcon}</span>}
        {isFirstTerm && minBudget !== undefined && (
          <span
            className={css({
              fontSize: '0.625rem',
              color: isDark ? 'gray.500' : 'gray.400',
            })}
          >
            *
          </span>
        )}
      </span>
    )
  }

  // Full mode: show per-skill breakdown
  return (
    <div
      data-element="term-skill-annotation"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '0.125rem',
        fontSize: '0.6875rem',
        fontFamily: 'monospace',
        lineHeight: 1.3,
      })}
    >
      {skillsUsed.map((skillId, i) => {
        const { shortName } = formatSkillId(skillId)
        const masteryInfo = skillMasteryContext?.[skillId]

        // Use mastery context if available, otherwise fall back to base cost
        const baseCost = masteryInfo?.baseCost ?? getBaseComplexity(skillId)
        const effectiveCost = masteryInfo?.effectiveCost ?? baseCost
        const isPracticing = masteryInfo?.isPracticing

        return (
          <span
            key={i}
            className={css({
              color: isDark ? 'gray.400' : 'gray.600',
            })}
          >
            {shortName}: <span style={{ color: costColor, fontWeight: 500 }}>{effectiveCost}</span>
            {isPracticing !== undefined && (
              <span className={css({ color: isDark ? 'gray.500' : 'gray.400' })}>
                {' '}
                ({baseCost}
                {getRotationAbbrev(isPracticing)})
              </span>
            )}
          </span>
        )
      })}

      {/* Total cost line */}
      <span
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          marginTop: '0.125rem',
          paddingTop: '0.125rem',
          borderTop: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          fontWeight: 'bold',
        })}
        style={{ color: costColor }}
      >
        = {complexityCost ?? '?'}
        {statusIcon && <span>{statusIcon}</span>}
        {isFirstTerm && minBudget !== undefined && (
          <span
            className={css({
              fontSize: '0.5625rem',
              color: isDark ? 'gray.500' : 'gray.400',
              fontWeight: 'normal',
            })}
          >
            (1st exempt)
          </span>
        )}
      </span>
    </div>
  )
}

/**
 * Inline version for use next to terms in vertical/linear problems
 * Shows skills in a single line with abbreviated format
 */
export function InlineTermSkillAnnotation({
  step,
  skillMasteryContext,
  isDark,
}: {
  step: GenerationTraceStep
  skillMasteryContext?: Record<string, SkillMasteryDisplay>
  isDark: boolean
}) {
  const { skillsUsed, complexityCost } = step

  if (skillsUsed.length === 0) {
    return null
  }

  const skillsText = skillsUsed
    .map((skillId) => {
      const { shortName } = formatSkillId(skillId)
      const masteryInfo = skillMasteryContext?.[skillId]
      const effectiveCost = masteryInfo?.effectiveCost ?? getBaseComplexity(skillId)
      return `${shortName}(${effectiveCost})`
    })
    .join(', ')

  return (
    <span
      data-element="inline-term-skill-annotation"
      className={css({
        fontSize: '0.625rem',
        fontFamily: 'monospace',
        color: isDark ? 'gray.500' : 'gray.400',
        whiteSpace: 'nowrap',
      })}
    >
      {skillsText}
      {complexityCost !== undefined && (
        <span className={css({ marginLeft: '0.25rem', fontWeight: 'bold' })}>
          ={complexityCost}
        </span>
      )}
    </span>
  )
}
