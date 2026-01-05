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
 * - useSkillDistribution: Hook for 5-category skill distribution counts
 * - BKT_THRESHOLDS: Re-exported for convenience
 *
 * TERMINOLOGY (3-category BKT classification):
 * - 'weak': P(known) < 0.5 - student needs more practice
 * - 'developing': 0.5 <= P(known) < 0.8 - student is making progress
 * - 'strong': P(known) >= 0.8 - student has mastered the skill
 *
 * EXTENDED TERMINOLOGY (5-category with staleness):
 * - 'strong': Mastered and recently practiced (< 7 days)
 * - 'stale': Mastered but not recently practiced (7+ days) - needs refresh
 * - 'developing': Making progress (0.5 <= P(known) < 0.8)
 * - 'weak': Needs more practice (P(known) < 0.5)
 * - 'unassessed': Not enough data for confident classification
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  computeBktFromHistory,
  getStalenessWarning,
  type SkillBktResult,
} from '@/lib/curriculum/bkt'
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

/** 5-category extended classification (includes staleness and unassessed) */
export type ExtendedSkillClassification = 'strong' | 'stale' | 'developing' | 'weak' | 'unassessed'

/** Skill distribution counts for all 5 categories */
export interface SkillDistribution {
  strong: number
  stale: number
  developing: number
  weak: number
  unassessed: number
  total: number
}

/** Skill mastery data needed for staleness detection */
export interface SkillMasteryInfo {
  skillId: string
  lastPracticedAt: Date | null
  isPracticing: boolean
}

export interface ClassifiedSkill {
  skillId: string
  displayName: string
  pKnown: number
  confidence: number
  classification: SkillClassification | null
}

/** Extended skill with 5-category classification and staleness info */
export interface ExtendedClassifiedSkill extends ClassifiedSkill {
  /** 5-category classification (includes stale and unassessed) */
  extendedClassification: ExtendedSkillClassification
  /** Staleness warning message (null if recently practiced) */
  stalenessWarning: string | null
  /** Days since last practice (null if never practiced) */
  daysSinceLastPractice: number | null
  /** Whether the skill is currently being practiced */
  isPracticing: boolean
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

/** Extended BKT data with 5-category classification and staleness */
interface BktExtendedDataContextValue {
  /** All practicing skills with extended classification */
  extendedSkills: ExtendedClassifiedSkill[]
  /** Skills grouped by 5-category classification */
  byClassification: {
    strong: ExtendedClassifiedSkill[]
    stale: ExtendedClassifiedSkill[]
    developing: ExtendedClassifiedSkill[]
    weak: ExtendedClassifiedSkill[]
    unassessed: ExtendedClassifiedSkill[]
  }
  /** Counts for each category */
  distribution: SkillDistribution
  /** Whether extended data is available */
  hasExtendedData: boolean
}

// ============================================================================
// Context
// ============================================================================

const BktConfigContext = createContext<BktConfigContextValue | null>(null)
const BktDataContext = createContext<BktDataContextValue | null>(null)
const BktExtendedDataContext = createContext<BktExtendedDataContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute the extended 5-category classification from BKT classification and staleness.
 * This is the SINGLE SOURCE OF TRUTH for classification logic.
 */
export function getExtendedClassification(
  bktClassification: SkillClassification | null,
  stalenessWarning: string | null
): ExtendedSkillClassification {
  if (bktClassification === null) return 'unassessed'
  if (bktClassification === 'strong' && stalenessWarning) return 'stale'
  return bktClassification
}

/**
 * Compute days since last practice from a Date.
 */
function computeDaysSinceLastPractice(lastPracticedAt: Date | null): number | null {
  if (!lastPracticedAt) return null
  const now = new Date()
  const diffMs = now.getTime() - lastPracticedAt.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

interface BktProviderProps {
  children: ReactNode
  /** Problem history to compute BKT from */
  problemHistory: ProblemResultWithContext[]
  /** Initial confidence threshold (defaults to BKT_THRESHOLDS.confidence) */
  initialThreshold?: number
  /**
   * Optional skill mastery data for extended (5-category) classification.
   * When provided, enables staleness detection and unassessed skill tracking.
   */
  skillMasteryData?: SkillMasteryInfo[]
}

export function BktProvider({
  children,
  problemHistory,
  initialThreshold = BKT_THRESHOLDS.confidence,
  skillMasteryData,
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

  // Create a map of BKT results for quick lookup
  const bktResultsMap = useMemo(() => {
    const map = new Map<string, ClassifiedSkill>()
    for (const skill of classifiedSkills) {
      map.set(skill.skillId, skill)
    }
    return map
  }, [classifiedSkills])

  // Compute extended 5-category data when skillMasteryData is provided
  const extendedDataValue = useMemo<BktExtendedDataContextValue | null>(() => {
    if (!skillMasteryData) return null

    // Only process practicing skills for the distribution
    const practicingSkillData = skillMasteryData.filter((s) => s.isPracticing)

    const extendedSkills: ExtendedClassifiedSkill[] = practicingSkillData.map((skillMastery) => {
      const bktData = bktResultsMap.get(skillMastery.skillId)
      const daysSince = computeDaysSinceLastPractice(skillMastery.lastPracticedAt)
      const stalenessWarning = getStalenessWarning(daysSince)
      const baseClassification = bktData?.classification ?? null
      const extendedClassification = getExtendedClassification(baseClassification, stalenessWarning)

      return {
        skillId: skillMastery.skillId,
        displayName: bktData?.displayName ?? getSkillDisplayName(skillMastery.skillId),
        pKnown: bktData?.pKnown ?? 0,
        confidence: bktData?.confidence ?? 0,
        classification: baseClassification,
        extendedClassification,
        stalenessWarning,
        daysSinceLastPractice: daysSince,
        isPracticing: skillMastery.isPracticing,
      }
    })

    // Group by extended classification
    const byClassification = {
      strong: [] as ExtendedClassifiedSkill[],
      stale: [] as ExtendedClassifiedSkill[],
      developing: [] as ExtendedClassifiedSkill[],
      weak: [] as ExtendedClassifiedSkill[],
      unassessed: [] as ExtendedClassifiedSkill[],
    }

    for (const skill of extendedSkills) {
      byClassification[skill.extendedClassification].push(skill)
    }

    // Sort each group
    byClassification.strong.sort((a, b) => b.pKnown - a.pKnown)
    byClassification.stale.sort(
      (a, b) => (b.daysSinceLastPractice ?? 0) - (a.daysSinceLastPractice ?? 0)
    )
    byClassification.developing.sort((a, b) => b.pKnown - a.pKnown)
    byClassification.weak.sort((a, b) => a.pKnown - b.pKnown)
    byClassification.unassessed.sort((a, b) => a.displayName.localeCompare(b.displayName))

    // Compute distribution counts
    const distribution: SkillDistribution = {
      strong: byClassification.strong.length,
      stale: byClassification.stale.length,
      developing: byClassification.developing.length,
      weak: byClassification.weak.length,
      unassessed: byClassification.unassessed.length,
      total: extendedSkills.length,
    }

    return {
      extendedSkills,
      byClassification,
      distribution,
      hasExtendedData: extendedSkills.length > 0,
    }
  }, [skillMasteryData, bktResultsMap])

  return (
    <BktConfigContext.Provider value={configValue}>
      <BktDataContext.Provider value={dataValue}>
        <BktExtendedDataContext.Provider value={extendedDataValue}>
          {children}
        </BktExtendedDataContext.Provider>
      </BktDataContext.Provider>
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

/**
 * Access extended BKT data with 5-category classification.
 *
 * Requires BktProvider to have skillMasteryData prop set.
 * Returns null if extended data is not available.
 *
 * Categories:
 * - strong: Mastered and recently practiced (< 7 days)
 * - stale: Mastered but not recently practiced (7+ days)
 * - developing: Making progress (0.5 <= P(known) < 0.8)
 * - weak: Needs more practice (P(known) < 0.5)
 * - unassessed: Not enough data for confident classification
 */
export function useBktExtendedData(): BktExtendedDataContextValue | null {
  return useContext(BktExtendedDataContext)
}

/**
 * Access the 5-category skill distribution.
 *
 * Convenience hook that returns just the distribution counts.
 * Returns null if extended data is not available.
 */
export function useSkillDistribution(): SkillDistribution | null {
  const extendedData = useContext(BktExtendedDataContext)
  return extendedData?.distribution ?? null
}
