/**
 * Conjunctive BKT for Multi-Skill Problems
 *
 * When a problem requires multiple skills:
 * - CORRECT: Student knew ALL skills (positive evidence for each)
 * - INCORRECT: At least ONE skill failed (ambiguous - who's to blame?)
 *
 * For incorrect answers, we distribute "blame" probabilistically:
 * - Skills with lower P(known) are more likely to have caused the error
 *
 * Two blame attribution methods are available:
 * 1. Heuristic: blame(skill) ∝ (1 - P(known)) - fast, approximate
 * 2. Bayesian: proper P(~known_i | fail) via marginalization - exact, O(2^n)
 */

import { applyLearning, bktUpdate } from './bkt-core'
import type { BlameDistribution, SkillBktRecord } from './types'

/** Which blame attribution algorithm to use for incorrect multi-skill answers */
export type BlameMethod = 'heuristic' | 'bayesian'

/**
 * For a CORRECT multi-skill answer:
 * All skills receive positive evidence (student knew all of them).
 * Update each skill independently with the correct observation,
 * then apply learning transition.
 */
export function updateOnCorrect(
  skills: SkillBktRecord[]
): { skillId: string; updatedPKnown: number }[] {
  return skills.map((skill) => {
    // Surface data issues - log warning and let NaN propagate for UI error boundaries
    if (!Number.isFinite(skill.pKnown)) {
      console.warn(
        '[BKT] updateOnCorrect: Invalid pKnown for skill:',
        skill.skillId,
        skill.pKnown,
        '- letting NaN propagate'
      )
      return {
        skillId: skill.skillId,
        updatedPKnown: Number.NaN, // Let NaN propagate for UI error state
      }
    }
    const updated = applyLearning(bktUpdate(skill.pKnown, true, skill.params), skill.params.pLearn)
    if (!Number.isFinite(updated)) {
      console.warn(
        '[BKT] updateOnCorrect: Calculation produced NaN for skill:',
        skill.skillId,
        '- letting NaN propagate'
      )
    }
    return {
      skillId: skill.skillId,
      updatedPKnown: updated, // Let NaN propagate if it occurred
    }
  })
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
  // Surface data issues - log warning for any skills with invalid pKnown
  const invalidSkills = skills.filter((s) => !Number.isFinite(s.pKnown))
  if (invalidSkills.length > 0) {
    console.warn(
      '[BKT] updateOnIncorrect: Found skills with invalid pKnown - letting NaN propagate:',
      invalidSkills.map((s) => ({ id: s.skillId, pKnown: s.pKnown }))
    )
    // Return NaN for all skills so UI shows error state for the whole calculation
    return skills.map((skill) => ({
      skillId: skill.skillId,
      blameWeight: Number.NaN,
      updatedPKnown: Number.NaN,
    }))
  }

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
      updatedPKnown: weightedPKnown, // Let NaN propagate if it occurred
    }
  })
}

/**
 * For an INCORRECT multi-skill answer (PROPER BAYESIAN):
 * Compute exact posterior P(~know_i | fail) via marginalization over all
 * possible knowledge states.
 *
 * For n skills, this enumerates all 2^n combinations of (known, unknown) states,
 * computes P(fail | state) × P(state), and marginalizes to get P(~know_i | fail).
 *
 * Complexity: O(n × 2^n) - acceptable for n ≤ 6 (typical problem size)
 *
 * Mathematical derivation:
 *   P(~know_i | fail) = P(fail ∧ ~know_i) / P(fail)
 *
 * Where:
 *   P(fail) = Σ_states P(fail | state) × P(state)
 *   P(fail ∧ ~know_i) = Σ_{states where ~know_i} P(fail | state) × P(state)
 *   P(fail | state) = 1 - Π_j P(correct_j | state_j)
 *   P(correct_j | know_j) = 1 - pSlip_j
 *   P(correct_j | ~know_j) = pGuess_j
 */
export function bayesianUpdateOnIncorrect(skills: SkillBktRecord[]): BlameDistribution[] {
  const n = skills.length

  // Edge cases
  if (n === 0) return []
  if (n === 1) {
    // Single skill: standard BKT update, full blame
    return [
      {
        skillId: skills[0].skillId,
        blameWeight: 1.0,
        updatedPKnown: bktUpdate(skills[0].pKnown, false, skills[0].params),
      },
    ]
  }

  // Enumerate all 2^n knowledge states
  const numStates = 1 << n // 2^n
  let pFail = 0
  const pFailAndUnknown: number[] = new Array(n).fill(0)

  for (let state = 0; state < numStates; state++) {
    // state is a bitmask: bit i = 1 means skill i is known

    // P(this state) = product of P(known_i) or P(~known_i)
    let pState = 1
    for (let i = 0; i < n; i++) {
      const knows = (state >> i) & 1
      const pKnown = Math.max(0.001, Math.min(0.999, skills[i].pKnown))
      pState *= knows ? pKnown : 1 - pKnown
    }

    // P(correct | this state) = product of individual success probabilities
    // P(fail | this state) = 1 - P(correct | state)
    let pCorrectGivenState = 1
    for (let i = 0; i < n; i++) {
      const knows = (state >> i) & 1
      const { pSlip, pGuess } = skills[i].params
      const safeSlip = Math.max(0.001, Math.min(0.999, pSlip))
      const safeGuess = Math.max(0.001, Math.min(0.999, pGuess))
      // If knows: P(correct) = 1 - pSlip; if doesn't know: P(correct) = pGuess
      pCorrectGivenState *= knows ? 1 - safeSlip : safeGuess
    }
    const pFailGivenState = 1 - pCorrectGivenState

    // Accumulate P(fail)
    pFail += pFailGivenState * pState

    // Accumulate P(fail ∧ ~know_i) for each skill i
    for (let i = 0; i < n; i++) {
      const knowsI = (state >> i) & 1
      if (!knowsI) {
        pFailAndUnknown[i] += pFailGivenState * pState
      }
    }
  }

  // Compute posterior and updated pKnown for each skill
  return skills.map((skill, i) => {
    // P(~know_i | fail) = P(fail ∧ ~know_i) / P(fail)
    const pNotKnownGivenFail = pFail > 0.001 ? pFailAndUnknown[i] / pFail : 1 / n

    // Posterior P(known_i | fail) = 1 - P(~known_i | fail)
    const posteriorPKnown = 1 - pNotKnownGivenFail

    // Apply learning (small chance student learned from attempt)
    const finalPKnown = applyLearning(posteriorPKnown, skill.params.pLearn)

    return {
      skillId: skill.skillId,
      blameWeight: pNotKnownGivenFail, // Proper Bayesian blame
      updatedPKnown: finalPKnown,
    }
  })
}

/**
 * Unified incorrect update function that uses the specified blame method.
 */
export function updateOnIncorrectWithMethod(
  skills: SkillBktRecord[],
  method: BlameMethod = 'heuristic'
): BlameDistribution[] {
  return method === 'bayesian' ? bayesianUpdateOnIncorrect(skills) : updateOnIncorrect(skills)
}
