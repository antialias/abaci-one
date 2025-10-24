import type { ScoreBreakdown } from '../types'

/**
 * Calculate Longest Common Subsequence length
 * Measures how many cards are in correct relative order
 */
export function longestCommonSubsequence(seq1: number[], seq2: number[]): number {
  const m = seq1.length
  const n = seq2.length
  const dp: number[][] = Array(m + 1)
    .fill(0)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (seq1[i - 1] === seq2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Count inversions (out-of-order pairs)
 * Measures how scrambled the sequence is
 */
export function countInversions(userSeq: number[], correctSeq: number[]): number {
  // Create mapping from value to correct position
  const correctPositions: Record<number, number> = {}
  for (let idx = 0; idx < correctSeq.length; idx++) {
    correctPositions[correctSeq[idx]] = idx
  }

  // Convert user sequence to correct-position sequence
  const userCorrectPositions = userSeq.map((val) => correctPositions[val])

  // Count inversions
  let inversions = 0
  for (let i = 0; i < userCorrectPositions.length; i++) {
    for (let j = i + 1; j < userCorrectPositions.length; j++) {
      if (userCorrectPositions[i] > userCorrectPositions[j]) {
        inversions++
      }
    }
  }

  return inversions
}

/**
 * Calculate comprehensive score breakdown
 */
export function calculateScore(
  userSequence: number[],
  correctSequence: number[],
  startTime: number
): ScoreBreakdown {
  // LCS-based score (relative order)
  const lcsLength = longestCommonSubsequence(userSequence, correctSequence)
  const relativeOrderScore = (lcsLength / correctSequence.length) * 100

  // Exact position matches
  let exactMatches = 0
  for (let i = 0; i < userSequence.length; i++) {
    if (userSequence[i] === correctSequence[i]) {
      exactMatches++
    }
  }
  const exactPositionScore = (exactMatches / correctSequence.length) * 100

  // Inversion-based score (organization)
  const inversions = countInversions(userSequence, correctSequence)
  const maxInversions = (correctSequence.length * (correctSequence.length - 1)) / 2
  const inversionScore = Math.max(0, ((maxInversions - inversions) / maxInversions) * 100)

  // Weighted final score
  // - 50% for relative order (LCS)
  // - 30% for exact positions
  // - 20% for organization (inversions)
  const finalScore = Math.round(
    relativeOrderScore * 0.5 + exactPositionScore * 0.3 + inversionScore * 0.2
  )

  return {
    finalScore,
    exactMatches,
    lcsLength,
    inversions,
    relativeOrderScore: Math.round(relativeOrderScore),
    exactPositionScore: Math.round(exactPositionScore),
    inversionScore: Math.round(inversionScore),
    elapsedTime: Math.floor((Date.now() - startTime) / 1000),
  }
}
