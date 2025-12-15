/**
 * Conjunctive BKT for Multi-Skill Problems
 *
 * When a problem requires multiple skills:
 * - CORRECT: Student knew ALL skills (positive evidence for each)
 * - INCORRECT: At least ONE skill failed (ambiguous - who's to blame?)
 *
 * For incorrect answers, we distribute "blame" probabilistically:
 * - Skills with lower P(known) are more likely to have caused the error
 * - blame(skill) ∝ (1 - P(known))
 */

import { applyLearning, bktUpdate } from './bkt-core'
import type { BlameDistribution, SkillBktRecord } from './types'

/**
 * For a CORRECT multi-skill answer:
 * All skills receive positive evidence (student knew all of them).
 * Update each skill independently with the correct observation,
 * then apply learning transition.
 */
export function updateOnCorrect(
  skills: SkillBktRecord[]
): { skillId: string; updatedPKnown: number }[] {
  return skills.map((skill) => ({
    skillId: skill.skillId,
    updatedPKnown: applyLearning(bktUpdate(skill.pKnown, true, skill.params), skill.params.pLearn),
  }))
}

/**
 * For an INCORRECT multi-skill answer:
 * Distribute blame probabilistically based on which skill most likely failed.
 *
 * The key insight: If we have skills A, B, C and the answer is wrong,
 * the probability that skill X caused the failure is proportional to
 * how likely the student doesn't know X.
 *
 * Simplified approximation:
 *   blame(X) ∝ (1 - pKnown(X)) / Σ(1 - pKnown(all))
 *
 * We then apply a weighted update where skills unlikely to have caused
 * the error receive less negative evidence.
 */
export function updateOnIncorrect(skills: SkillBktRecord[]): BlameDistribution[] {
  // Calculate total "unknown-ness" across all skills
  const totalUnknown = skills.reduce((sum, s) => sum + (1 - s.pKnown), 0)

  if (totalUnknown < 0.001) {
    // All skills appear mastered - must be a slip, distribute evenly
    const evenWeight = 1 / skills.length
    return skills.map((skill) => ({
      skillId: skill.skillId,
      blameWeight: evenWeight,
      // Full negative update since we have no basis to differentiate
      updatedPKnown: bktUpdate(skill.pKnown, false, skill.params),
    }))
  }

  return skills.map((skill) => {
    // Blame weight is proportional to (1 - pKnown)
    const blameWeight = (1 - skill.pKnown) / totalUnknown

    // Calculate full negative update
    const fullNegativeUpdate = bktUpdate(skill.pKnown, false, skill.params)

    // Weighted update: soften negative evidence for skills unlikely to have caused error
    // - High blame weight (skill likely caused error): use more of the negative update
    // - Low blame weight (skill unlikely caused error): stay closer to prior
    const weightedPKnown = skill.pKnown * (1 - blameWeight) + fullNegativeUpdate * blameWeight

    return {
      skillId: skill.skillId,
      blameWeight,
      updatedPKnown: weightedPKnown,
    }
  })
}
