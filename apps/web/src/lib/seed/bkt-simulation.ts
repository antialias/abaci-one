import { applyLearning, bktUpdate } from '../curriculum/bkt/bkt-core'
import { getDefaultParams } from '../curriculum/bkt/skill-priors'
import { BKT_THRESHOLDS } from '../curriculum/config/bkt-integration'
import type { TargetClassification } from './types'

/**
 * Simulate BKT computation for a sequence of correct/incorrect answers.
 * Used to predict what pKnown will result from a given sequence.
 *
 * IMPORTANT: This matches the actual BKT computation behavior:
 * - CORRECT: bktUpdate + applyLearning (student may have learned from this)
 * - INCORRECT: bktUpdate only (no learning transition on failure)
 */
/**
 * Per-answer evidence weight, mirroring computeBktFromHistory's blend
 * (pKnown ← pKnown·(1−w) + updated·w). The real classifier derives w from
 * response time, help usage and retries; a seed profile with a slow response
 * band therefore needs the same w here or its target classification drifts.
 */
export type EvidenceWeightFn = (isCorrect: boolean) => number

export function simulateBktSequence(
  skillId: string,
  sequence: boolean[],
  evidenceWeight?: EvidenceWeightFn
): number {
  const params = getDefaultParams(skillId)
  let pKnown = params.pInit

  for (const isCorrect of sequence) {
    const updated = bktUpdate(pKnown, isCorrect, params)
    // Only apply learning transition on CORRECT answers
    // (matches updateOnCorrect vs updateOnIncorrect behavior)
    const next = isCorrect ? applyLearning(updated, params.pLearn) : updated
    const w = evidenceWeight?.(isCorrect) ?? 1
    pKnown = pKnown * (1 - w) + next * w
  }

  return pKnown
}

/**
 * Design a sequence of correct/incorrect answers that will reliably produce
 * the target BKT classification.
 *
 * Key insight: The ORDER of correct/incorrect matters more than the ratio.
 * - Ending with correct answers → higher pKnown
 * - Ending with incorrect answers → lower pKnown
 *
 * IMPORTANT: BKT dynamics are "swingy" - a single correct can push pKnown
 * from 0.3 to ~0.7, and a single incorrect can drop from 0.7 to ~0.3.
 * The "developing" range (0.5-0.8) is narrow and requires careful calibration.
 */
export function designSequenceForClassification(
  skillId: string,
  problemCount: number,
  target: TargetClassification,
  evidenceWeight?: EvidenceWeightFn
): boolean[] {
  // For very few problems, use simple patterns
  if (problemCount <= 3) {
    switch (target) {
      case 'strong':
        return Array(problemCount).fill(true)
      case 'weak':
        return Array(problemCount).fill(false)
      case 'developing':
        // All correct for tiny counts since multi-skill coupling pulls down
        return Array(problemCount).fill(true)
    }
  }

  // For longer sequences, use empirically-tuned patterns
  switch (target) {
    case 'strong': {
      // 85% correct, ending with streak of correct
      // Early mistakes, then a clean run. Slow-answer weights damp correct
      // evidence, so shed early mistakes until the run really lands strong.
      for (
        let incorrect = Math.max(1, Math.floor(problemCount * 0.15));
        incorrect >= 0;
        incorrect--
      ) {
        const sequence = [
          ...Array(incorrect).fill(false),
          ...Array(problemCount - incorrect).fill(true),
        ]
        if (simulateBktSequence(skillId, sequence, evidenceWeight) >= BKT_THRESHOLDS.strong) {
          return sequence
        }
      }
      return Array(problemCount).fill(true)
    }

    case 'weak': {
      // 90% incorrect, ending with long streak of incorrect
      // A lucky start, then failure. Fast-answer weights amplify correct
      // evidence, so shed the lucky answers until the run really lands weak.
      for (let correct = Math.max(1, Math.floor(problemCount * 0.1)); correct >= 0; correct--) {
        const sequence = [
          ...Array(correct).fill(true),
          ...Array(problemCount - correct).fill(false),
        ]
        if (simulateBktSequence(skillId, sequence, evidenceWeight) < BKT_THRESHOLDS.weak) {
          return sequence
        }
      }
      return Array(problemCount).fill(false)
    }

    case 'developing': {
      // The developing range (0.5-0.8) is narrow and BKT is swingy.
      // Try multiple pattern types to find one that lands in range.

      // Pattern generators to try (in order of preference)
      const patternGenerators = [
        // Pattern 1: End with exactly 1 correct after many incorrect
        (n: number, correct: number) => {
          const endCorrect = 1
          const startCorrect = correct - endCorrect
          return [
            ...Array(startCorrect).fill(true),
            ...Array(n - correct).fill(false),
            ...Array(endCorrect).fill(true),
          ]
        },

        // Pattern 2: Alternating ending with correct
        (n: number, correct: number) => {
          const seq: boolean[] = []
          let remainingCorrect = correct
          let remainingIncorrect = n - correct
          while (remainingCorrect > 0 || remainingIncorrect > 0) {
            if (
              remainingIncorrect > 0 &&
              (remainingIncorrect > remainingCorrect || remainingCorrect === 0)
            ) {
              seq.push(false)
              remainingIncorrect--
            } else if (remainingCorrect > 0) {
              seq.push(true)
              remainingCorrect--
            }
          }
          return seq
        },

        // Pattern 3: Front-loaded correct, then incorrect, ending with 1 correct
        (n: number, correct: number) => {
          const endCorrect = 1
          const frontCorrect = correct - endCorrect
          return [
            ...Array(frontCorrect).fill(true),
            ...Array(n - correct).fill(false),
            ...Array(endCorrect).fill(true),
          ]
        },

        // Pattern 4: Sandwich - incorrect, correct, incorrect
        (n: number, correct: number) => {
          const thirdIncorrect = Math.floor((n - correct) / 2)
          return [
            ...Array(thirdIncorrect).fill(false),
            ...Array(correct).fill(true),
            ...Array(n - correct - thirdIncorrect).fill(false),
          ]
        },
      ]

      // Try different correct counts with each pattern
      for (const correctRatio of [0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7]) {
        const correctCount = Math.max(1, Math.round(problemCount * correctRatio))

        for (const generatePattern of patternGenerators) {
          const sequence = generatePattern(problemCount, correctCount)

          // Verify sequence length is correct
          if (sequence.length !== problemCount) continue

          const pKnown = simulateBktSequence(skillId, sequence, evidenceWeight)

          // Check if it lands in developing range
          if (pKnown >= BKT_THRESHOLDS.weak && pKnown < BKT_THRESHOLDS.strong) {
            return sequence
          }
        }
      }

      // If we still can't find a pattern, try edge cases
      for (let correct = 1; correct < problemCount; correct++) {
        const sequence = [
          ...Array(correct - 1).fill(true),
          ...Array(problemCount - correct).fill(false),
          true, // End with one correct
        ]
        const pKnown = simulateBktSequence(skillId, sequence, evidenceWeight)
        if (pKnown >= BKT_THRESHOLDS.weak && pKnown < BKT_THRESHOLDS.strong) {
          return sequence
        }
      }

      // Ultimate fallback: Just end with 1 correct after all incorrect
      return [...Array(problemCount - 1).fill(false), true]
    }
  }
}
