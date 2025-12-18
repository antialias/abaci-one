'use client'

/**
 * BKT Context
 *
 * Provides BKT (Bayesian Knowledge Tracing) computation and skill classification
 * to components that need to display or work with skill mastery data.
 *
 * Key exports:
 * - BktProvider: Context provider that computes BKT from problem history
 * - useBktConfig: Hook for accessing/updating BKT configuration
 * - useSkillsByClassification: Hook for getting skills grouped by classification
 * - BKT_THRESHOLDS: Re-exported for convenience
 *
 * TERMINOLOGY:
 * - 'weak': P(known) < 0.5 - student needs more practice
 * - 'developing': 0.5 <= P(known) < 0.8 - student is making progress
 * - 'strong': P(known) >= 0.8 - student has mastered the skill
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { computeBktFromHistory, type SkillBktResult } from '@/lib/curriculum/bkt'
import {
  BKT_THRESHOLDS,
  classifySkill,
  type SkillClassification,
} from '@/lib/curriculum/config/bkt-integration'
import { getSkillDisplayName } from '@/lib/curriculum/skill-tutorial-config'
import type { ProblemResultWithContext } from '@/lib/curriculum/session-planner'

// Re-export thresholds for convenience
export { BKT_THRESHOLDS } from '@/lib/curriculum/config/bkt-integration'

// ============================================================================
// Types
// ============================================================================

export interface ClassifiedSkill {
  skillId: string
  displayName: string
  pKnown: number
  confidence: number
  classification: SkillClassification | null
}

interface BktConfigContextValue {
  /** Current confidence threshold being used */
  confidenceThreshold: number
  /** Set a preview threshold (doesn't persist) */
  setPreviewThreshold: (threshold: number) => void
  /** Reset to default threshold */
  resetThreshold: () => void
}

interface BktDataContextValue {
  /** All skills with BKT data */
  skills: ClassifiedSkill[]
  /** Skills classified as 'weak' (pKnown < 0.5) */
  weak: ClassifiedSkill[]
  /** Skills classified as 'developing' (0.5 <= pKnown < 0.8) */
  developing: ClassifiedSkill[]
  /** Skills classified as 'strong' (pKnown >= 0.8) */
  strong: ClassifiedSkill[]
  /** Whether there is any BKT data available */
  hasData: boolean
  /** Raw BKT results for advanced usage */
  rawBktResults: SkillBktResult[]
}

// Legacy interface for backwards compatibility with BktSettingsClient
interface LegacySkillsByClassification {
  /** @deprecated Use 'weak' instead */
  struggling: ClassifiedSkill[]
  /** @deprecated Use 'developing' instead */
  learning: ClassifiedSkill[]
  /** @deprecated Use 'strong' instead */
  mastered: ClassifiedSkill[]
  hasData: boolean
}

// ============================================================================
// Context
// ============================================================================

const BktConfigContext = createContext<BktConfigContextValue | null>(null)
const BktDataContext = createContext<BktDataContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

interface BktProviderProps {
  children: ReactNode
  /** Problem history to compute BKT from */
  problemHistory: ProblemResultWithContext[]
  /** Initial confidence threshold (defaults to BKT_THRESHOLDS.confidence) */
  initialThreshold?: number
}

export function BktProvider({
  children,
  problemHistory,
  initialThreshold = BKT_THRESHOLDS.confidence,
}: BktProviderProps) {
  const [previewThreshold, setPreviewThreshold] = useState<number | null>(null)
  const effectiveThreshold = previewThreshold ?? initialThreshold

  const resetThreshold = useCallback(() => {
    setPreviewThreshold(null)
  }, [])

  // Compute BKT from problem history
  const bktResult = useMemo(() => {
    if (!problemHistory || problemHistory.length === 0) {
      return { skills: [] }
    }
    return computeBktFromHistory(problemHistory, {
      confidenceThreshold: effectiveThreshold,
    })
  }, [problemHistory, effectiveThreshold])

  // Classify skills using unified thresholds
  const classifiedSkills = useMemo<ClassifiedSkill[]>(() => {
    return bktResult.skills.map((skill) => ({
      skillId: skill.skillId,
      displayName: getSkillDisplayName(skill.skillId),
      pKnown: skill.pKnown,
      confidence: skill.confidence,
      classification: classifySkill(skill.pKnown, skill.confidence),
    }))
  }, [bktResult.skills])

  // Group by classification
  const { weak, developing, strong } = useMemo(() => {
    const groups = {
      weak: [] as ClassifiedSkill[],
      developing: [] as ClassifiedSkill[],
      strong: [] as ClassifiedSkill[],
    }

    for (const skill of classifiedSkills) {
      if (skill.classification === 'weak') {
        groups.weak.push(skill)
      } else if (skill.classification === 'developing') {
        groups.developing.push(skill)
      } else if (skill.classification === 'strong') {
        groups.strong.push(skill)
      }
      // Skills with null classification (low confidence) are not grouped
    }

    // Sort each group by pKnown
    groups.weak.sort((a, b) => a.pKnown - b.pKnown)
    groups.developing.sort((a, b) => a.pKnown - b.pKnown)
    groups.strong.sort((a, b) => b.pKnown - a.pKnown)

    return groups
  }, [classifiedSkills])

  const configValue = useMemo<BktConfigContextValue>(
    () => ({
      confidenceThreshold: effectiveThreshold,
      setPreviewThreshold,
      resetThreshold,
    }),
    [effectiveThreshold, resetThreshold]
  )

  const dataValue = useMemo<BktDataContextValue>(
    () => ({
      skills: classifiedSkills,
      weak,
      developing,
      strong,
      hasData: classifiedSkills.length > 0,
      rawBktResults: bktResult.skills,
    }),
    [classifiedSkills, weak, developing, strong, bktResult.skills]
  )

  return (
    <BktConfigContext.Provider value={configValue}>
      <BktDataContext.Provider value={dataValue}>{children}</BktDataContext.Provider>
    </BktConfigContext.Provider>
  )
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Access BKT configuration (threshold settings)
 */
export function useBktConfig(): BktConfigContextValue {
  const context = useContext(BktConfigContext)
  if (!context) {
    throw new Error('useBktConfig must be used within a BktProvider')
  }
  return context
}

/**
 * Access BKT data (classified skills)
 */
export function useBktData(): BktDataContextValue {
  const context = useContext(BktDataContext)
  if (!context) {
    throw new Error('useBktData must be used within a BktProvider')
  }
  return context
}

/**
 * Get skills grouped by classification.
 *
 * Returns skills in three categories:
 * - weak: P(known) < 0.5 - needs more practice
 * - developing: 0.5 <= P(known) < 0.8 - making progress
 * - strong: P(known) >= 0.8 - mastered
 *
 * Also provides legacy aliases for backwards compatibility:
 * - struggling → weak
 * - learning → developing
 * - mastered → strong
 */
export function useSkillsByClassification(): BktDataContextValue & LegacySkillsByClassification {
  const data = useBktData()

  // Provide legacy aliases for backwards compatibility
  return useMemo(
    () => ({
      ...data,
      // Legacy aliases (for BktSettingsClient compatibility)
      struggling: data.weak,
      learning: data.developing,
      mastered: data.strong,
    }),
    [data]
  )
}
