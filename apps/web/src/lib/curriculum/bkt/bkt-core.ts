/**
 * Core BKT (Bayesian Knowledge Tracing) Update Equations
 *
 * Standard BKT is a Hidden Markov Model where:
 * - Hidden state: student knows the skill or not
 * - Observations: correct or incorrect answers
 *
 * Four key parameters:
 * - P(L0) = pInit: prior probability of knowing
 * - P(T) = pLearn: probability of learning on each opportunity
 * - P(S) = pSlip: probability of error despite knowing
 * - P(G) = pGuess: probability of correct despite not knowing
 */

import type { BktParams } from './types'

/**
 * Standard BKT update for a SINGLE skill given an observation.
 *
 * Uses Bayes' theorem to update P(known) based on the observation:
 *
 * For correct answer:
 *   P(known | correct) = P(correct | known) × P(known) / P(correct)
 *   where P(correct | known) = 1 - P(slip)
 *   and   P(correct | ¬known) = P(guess)
 *
 * For incorrect answer:
 *   P(known | incorrect) = P(incorrect | known) × P(known) / P(incorrect)
 *   where P(incorrect | known) = P(slip)
 *   and   P(incorrect | ¬known) = 1 - P(guess)
 *
 * @param priorPKnown - Current P(known) before this observation
 * @param isCorrect - Whether the student answered correctly
 * @param params - BKT parameters (pInit, pLearn, pSlip, pGuess)
 * @returns Updated P(known) after the observation
 */
export function bktUpdate(priorPKnown: number, isCorrect: boolean, params: BktParams): number {
  const { pSlip, pGuess } = params

  // Guard against division by zero
  const safeSlip = Math.max(0.001, Math.min(0.999, pSlip))
  const safeGuess = Math.max(0.001, Math.min(0.999, pGuess))
  const safePrior = Math.max(0.001, Math.min(0.999, priorPKnown))

  if (isCorrect) {
    // P(correct) = P(known) × (1 - pSlip) + P(¬known) × pGuess
    const pCorrect = safePrior * (1 - safeSlip) + (1 - safePrior) * safeGuess
    // P(known | correct) via Bayes
    const pKnownGivenCorrect = (safePrior * (1 - safeSlip)) / pCorrect
    return pKnownGivenCorrect
  } else {
    // P(incorrect) = P(known) × pSlip + P(¬known) × (1 - pGuess)
    const pIncorrect = safePrior * safeSlip + (1 - safePrior) * (1 - safeGuess)
    // P(known | incorrect) via Bayes
    const pKnownGivenIncorrect = (safePrior * safeSlip) / pIncorrect
    return pKnownGivenIncorrect
  }
}

/**
 * Apply learning transition after observation.
 *
 * After each observation, there's a chance the student learned:
 * P(known after) = P(known) + P(¬known) × P(learn)
 *
 * This models the possibility that even if the student didn't know
 * the skill before, they may have learned it from this opportunity.
 *
 * @param pKnown - Current P(known) after Bayesian update
 * @param pLearn - P(T) probability of learning
 * @returns P(known) after learning transition
 */
export function applyLearning(pKnown: number, pLearn: number): number {
  return pKnown + (1 - pKnown) * pLearn
}
