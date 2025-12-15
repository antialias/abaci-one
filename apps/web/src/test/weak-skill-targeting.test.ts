/**
 * Weak Skill Targeting Tests
 *
 * Tests the BKT-driven weak skill targeting pipeline:
 * 1. identifyWeakSkills() - identifies skills from BKT results
 * 2. addWeakSkillsToTargets() - adds weak skills to targetSkills
 * 3. Problem generator - prefers problems using targetSkills
 */

import { describe, expect, it } from 'vitest'
import type { SkillBktResult } from '@/lib/curriculum/bkt'
import { WEAK_SKILL_THRESHOLDS } from '@/lib/curriculum/config'
import { generateSingleProblemWithDiagnostics } from '@/utils/problemGenerator'
import { createBasicSkillSet, type SkillSet } from '@/types/tutorial'

// We need to access the private functions from session-planner
// For testing, we'll re-implement the logic here to test it independently

/**
 * Re-implementation of identifyWeakSkills for testing
 * (The actual function is private in session-planner.ts)
 */
function identifyWeakSkills(bktResults: Map<string, SkillBktResult> | undefined): string[] {
  if (!bktResults) return []

  const weakSkills: string[] = []
  const { confidenceThreshold, pKnownThreshold } = WEAK_SKILL_THRESHOLDS

  for (const [skillId, result] of bktResults) {
    // Weak = confident that P(known) is low
    if (result.confidence >= confidenceThreshold && result.pKnown < pKnownThreshold) {
      weakSkills.push(skillId)
    }
  }

  return weakSkills
}

/**
 * Re-implementation of addWeakSkillsToTargets for testing
 */
function addWeakSkillsToTargets(
  baseTargetSkills: Partial<SkillSet>,
  weakSkillIds: string[]
): Partial<SkillSet> {
  // Deep copy base
  const targetSkills: Partial<SkillSet> = JSON.parse(JSON.stringify(baseTargetSkills))

  // Add weak skills to targets
  for (const skillId of weakSkillIds) {
    const [category, skillKey] = skillId.split('.')
    if (category && skillKey) {
      if (!targetSkills[category as keyof SkillSet]) {
        ;(targetSkills as Record<string, Record<string, boolean>>)[category] = {}
      }
      ;(targetSkills as Record<string, Record<string, boolean>>)[category][skillKey] = true
    }
  }

  return targetSkills
}

describe('Weak Skill Targeting', () => {
  describe('identifyWeakSkills', () => {
    it('should return empty array when no BKT results', () => {
      expect(identifyWeakSkills(undefined)).toEqual([])
      expect(identifyWeakSkills(new Map())).toEqual([])
    })

    it('should identify skills with low P(known) and high confidence', () => {
      const bktResults = new Map<string, SkillBktResult>([
        // Weak: low P(known), high confidence
        [
          'fiveComplements.4=5-1',
          { skillId: 'fiveComplements.4=5-1', pKnown: 0.2, confidence: 0.5, opportunities: 10 },
        ],
        // Strong: high P(known), high confidence
        [
          'basic.directAddition',
          { skillId: 'basic.directAddition', pKnown: 0.9, confidence: 0.6, opportunities: 15 },
        ],
        // Unknown: low confidence (not enough data)
        [
          'tenComplements.9=10-1',
          { skillId: 'tenComplements.9=10-1', pKnown: 0.3, confidence: 0.1, opportunities: 2 },
        ],
      ])

      const weakSkills = identifyWeakSkills(bktResults)

      expect(weakSkills).toContain('fiveComplements.4=5-1')
      expect(weakSkills).not.toContain('basic.directAddition')
      expect(weakSkills).not.toContain('tenComplements.9=10-1')
    })

    it('should use configured thresholds', () => {
      // Verify we're using the config values
      expect(WEAK_SKILL_THRESHOLDS.pKnownThreshold).toBe(0.5)
      expect(WEAK_SKILL_THRESHOLDS.confidenceThreshold).toBe(0.3)

      const bktResults = new Map<string, SkillBktResult>([
        // Just below threshold - should be weak
        [
          'skill.belowThreshold',
          { skillId: 'skill.belowThreshold', pKnown: 0.49, confidence: 0.31, opportunities: 8 },
        ],
        // Just above threshold - should be strong
        [
          'skill.aboveThreshold',
          { skillId: 'skill.aboveThreshold', pKnown: 0.51, confidence: 0.31, opportunities: 8 },
        ],
        // Confidence just below threshold - should not be identified
        [
          'skill.lowConfidence',
          { skillId: 'skill.lowConfidence', pKnown: 0.2, confidence: 0.29, opportunities: 5 },
        ],
      ])

      const weakSkills = identifyWeakSkills(bktResults)

      expect(weakSkills).toContain('skill.belowThreshold')
      expect(weakSkills).not.toContain('skill.aboveThreshold')
      expect(weakSkills).not.toContain('skill.lowConfidence')
    })

    it('should identify multiple weak skills', () => {
      const bktResults = new Map<string, SkillBktResult>([
        [
          'fiveComplements.4=5-1',
          { skillId: 'fiveComplements.4=5-1', pKnown: 0.2, confidence: 0.5, opportunities: 10 },
        ],
        [
          'fiveComplements.3=5-2',
          { skillId: 'fiveComplements.3=5-2', pKnown: 0.3, confidence: 0.4, opportunities: 8 },
        ],
        [
          'tenComplements.9=10-1',
          { skillId: 'tenComplements.9=10-1', pKnown: 0.15, confidence: 0.6, opportunities: 12 },
        ],
        [
          'basic.directAddition',
          { skillId: 'basic.directAddition', pKnown: 0.95, confidence: 0.8, opportunities: 20 },
        ],
      ])

      const weakSkills = identifyWeakSkills(bktResults)

      expect(weakSkills).toHaveLength(3)
      expect(weakSkills).toContain('fiveComplements.4=5-1')
      expect(weakSkills).toContain('fiveComplements.3=5-2')
      expect(weakSkills).toContain('tenComplements.9=10-1')
    })
  })

  describe('addWeakSkillsToTargets', () => {
    it('should add weak skills to empty targetSkills', () => {
      const baseTargetSkills: Partial<SkillSet> = {}
      const weakSkills = ['fiveComplements.4=5-1', 'tenComplements.9=10-1']

      const result = addWeakSkillsToTargets(baseTargetSkills, weakSkills)

      expect(result.fiveComplements?.['4=5-1']).toBe(true)
      expect(result.tenComplements?.['9=10-1']).toBe(true)
    })

    it('should preserve existing targetSkills', () => {
      const baseTargetSkills: Partial<SkillSet> = {
        basic: { directAddition: true, heavenBead: false },
      }
      const weakSkills = ['fiveComplements.4=5-1']

      const result = addWeakSkillsToTargets(baseTargetSkills, weakSkills)

      expect(result.basic?.directAddition).toBe(true)
      expect(result.basic?.heavenBead).toBe(false)
      expect(result.fiveComplements?.['4=5-1']).toBe(true)
    })

    it('should handle skills in same category', () => {
      const baseTargetSkills: Partial<SkillSet> = {
        fiveComplements: { '4=5-1': true },
      }
      const weakSkills = ['fiveComplements.3=5-2', 'fiveComplements.2=5-3']

      const result = addWeakSkillsToTargets(baseTargetSkills, weakSkills)

      expect(result.fiveComplements?.['4=5-1']).toBe(true)
      expect(result.fiveComplements?.['3=5-2']).toBe(true)
      expect(result.fiveComplements?.['2=5-3']).toBe(true)
    })
  })

  describe('Problem Generator with targetSkills', () => {
    it('should prefer problems using target skills when available', () => {
      // Create allowed skills that include both basic and five complements
      const allowedSkills = createBasicSkillSet()
      allowedSkills.basic.directAddition = true
      allowedSkills.basic.heavenBead = true
      allowedSkills.fiveComplements['4=5-1'] = true
      allowedSkills.fiveComplements['3=5-2'] = true

      // Target only five complements
      const targetSkills: Partial<SkillSet> = {
        fiveComplements: { '4=5-1': true, '3=5-2': true },
      }

      // Generate many problems and count how many use target skills
      const problemCount = 50
      let targetSkillCount = 0

      for (let i = 0; i < problemCount; i++) {
        const result = generateSingleProblemWithDiagnostics({
          constraints: {
            numberRange: { min: 1, max: 9 },
            minTerms: 2,
            maxTerms: 3,
            problemCount: 1,
          },
          allowedSkills,
          targetSkills,
        })

        if (result.problem) {
          const usesTargetSkill = result.problem.skillsUsed.some(
            (skill) => skill === 'fiveComplements.4=5-1' || skill === 'fiveComplements.3=5-2'
          )
          if (usesTargetSkill) targetSkillCount++
        }
      }

      // With targeting, we expect MORE than baseline usage of target skills
      // Baseline without targeting would be roughly proportional to skill count
      // With 4 enabled skills, baseline would be ~50%
      // With targeting, should be significantly higher
      const targetSkillRate = targetSkillCount / problemCount

      // Expect at least 60% of problems to use target skills
      // This is a meaningful improvement over baseline
      expect(targetSkillRate).toBeGreaterThan(0.6)
    })

    it('should generate problems WITHOUT target skills when not specified', () => {
      const allowedSkills = createBasicSkillSet()
      allowedSkills.basic.directAddition = true
      allowedSkills.basic.heavenBead = true
      allowedSkills.fiveComplements['4=5-1'] = true
      allowedSkills.fiveComplements['3=5-2'] = true

      // No target skills - should get a mix
      const problemCount = 50
      let fiveComplementCount = 0

      for (let i = 0; i < problemCount; i++) {
        const result = generateSingleProblemWithDiagnostics({
          constraints: {
            numberRange: { min: 1, max: 9 },
            minTerms: 2,
            maxTerms: 3,
            problemCount: 1,
          },
          allowedSkills,
          // No targetSkills
        })

        if (result.problem) {
          const usesFiveComplement = result.problem.skillsUsed.some((skill) =>
            skill.startsWith('fiveComplements.')
          )
          if (usesFiveComplement) fiveComplementCount++
        }
      }

      const fiveComplementRate = fiveComplementCount / problemCount
      console.log(`Five complement usage (no targeting): ${(fiveComplementRate * 100).toFixed(1)}%`)

      // Without targeting, expect a more balanced distribution
      // Should be somewhere between 20-80% (not heavily skewed either way)
      expect(fiveComplementRate).toBeGreaterThan(0.1)
      expect(fiveComplementRate).toBeLessThan(0.9)
    })

    it('should show difference between targeted and non-targeted generation', () => {
      const allowedSkills = createBasicSkillSet()
      allowedSkills.basic.directAddition = true
      allowedSkills.basic.heavenBead = true
      allowedSkills.fiveComplements['4=5-1'] = true

      const targetSkills: Partial<SkillSet> = {
        fiveComplements: { '4=5-1': true },
      }

      const problemCount = 100

      // Generate WITHOUT targeting
      let nonTargetedFiveCompCount = 0
      for (let i = 0; i < problemCount; i++) {
        const result = generateSingleProblemWithDiagnostics({
          constraints: {
            numberRange: { min: 1, max: 9 },
            minTerms: 2,
            maxTerms: 3,
            problemCount: 1,
          },
          allowedSkills,
        })
        if (result.problem?.skillsUsed.includes('fiveComplements.4=5-1')) {
          nonTargetedFiveCompCount++
        }
      }

      // Generate WITH targeting
      let targetedFiveCompCount = 0
      for (let i = 0; i < problemCount; i++) {
        const result = generateSingleProblemWithDiagnostics({
          constraints: {
            numberRange: { min: 1, max: 9 },
            minTerms: 2,
            maxTerms: 3,
            problemCount: 1,
          },
          allowedSkills,
          targetSkills,
        })
        if (result.problem?.skillsUsed.includes('fiveComplements.4=5-1')) {
          targetedFiveCompCount++
        }
      }

      const nonTargetedRate = nonTargetedFiveCompCount / problemCount
      const targetedRate = targetedFiveCompCount / problemCount

      console.log(`Five complement usage:`)
      console.log(`  Without targeting: ${(nonTargetedRate * 100).toFixed(1)}%`)
      console.log(`  With targeting:    ${(targetedRate * 100).toFixed(1)}%`)
      console.log(`  Improvement:       ${((targetedRate - nonTargetedRate) * 100).toFixed(1)}pp`)

      // Key assertion: targeting should increase usage of targeted skills
      expect(targetedRate).toBeGreaterThan(nonTargetedRate)
    })
  })

  describe('Full Pipeline Integration', () => {
    it('should surface weak skills more when BKT identifies them', () => {
      // Simulate BKT results showing fiveComplements.4=5-1 is weak
      const bktResults = new Map<string, SkillBktResult>([
        [
          'basic.directAddition',
          { skillId: 'basic.directAddition', pKnown: 0.9, confidence: 0.8, opportunities: 20 },
        ],
        [
          'basic.heavenBead',
          { skillId: 'basic.heavenBead', pKnown: 0.85, confidence: 0.7, opportunities: 15 },
        ],
        [
          'fiveComplements.4=5-1',
          { skillId: 'fiveComplements.4=5-1', pKnown: 0.2, confidence: 0.5, opportunities: 10 },
        ],
      ])

      // Step 1: Identify weak skills
      const weakSkills = identifyWeakSkills(bktResults)
      expect(weakSkills).toContain('fiveComplements.4=5-1')
      expect(weakSkills).not.toContain('basic.directAddition')

      // Step 2: Add weak skills to targets
      const baseTargetSkills: Partial<SkillSet> = {}
      const targetSkills = addWeakSkillsToTargets(baseTargetSkills, weakSkills)
      expect(targetSkills.fiveComplements?.['4=5-1']).toBe(true)

      // Step 3: Generate problems with targeting
      const allowedSkills = createBasicSkillSet()
      allowedSkills.basic.directAddition = true
      allowedSkills.basic.heavenBead = true
      allowedSkills.fiveComplements['4=5-1'] = true

      const problemCount = 100
      let weakSkillProblemCount = 0

      for (let i = 0; i < problemCount; i++) {
        const result = generateSingleProblemWithDiagnostics({
          constraints: {
            numberRange: { min: 1, max: 9 },
            minTerms: 2,
            maxTerms: 3,
            problemCount: 1,
          },
          allowedSkills,
          targetSkills,
        })
        if (result.problem?.skillsUsed.includes('fiveComplements.4=5-1')) {
          weakSkillProblemCount++
        }
      }

      const weakSkillRate = weakSkillProblemCount / problemCount
      console.log(
        `Weak skill (fiveComplements.4=5-1) surfacing rate: ${(weakSkillRate * 100).toFixed(1)}%`
      )

      // With 3 enabled skills and targeting the weak one,
      // expect significantly more than 33% baseline
      expect(weakSkillRate).toBeGreaterThan(0.5)
    })
  })
})
