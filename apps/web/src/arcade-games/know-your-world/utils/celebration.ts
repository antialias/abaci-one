/**
 * Celebration Classification Utility
 *
 * Determines the type of celebration based on how the user found the region.
 * Uses search metrics from the hot/cold feedback system to classify:
 * - Lightning: Fast and direct find
 * - Standard: Normal discovery
 * - Hard-earned: Extensive searching, shows perseverance
 */

import type { SearchMetrics } from "../hooks/useHotColdFeedback";
import type { CelebrationType } from "../Provider";

// Thresholds for classification
const LIGHTNING_TIME_MS = 3000; // Under 3 seconds
const LIGHTNING_EFFICIENCY = 0.7; // Very direct path

const HARD_EARNED_TIME_MS = 20000; // Over 20 seconds
const HARD_EARNED_EFFICIENCY = 0.3; // Wandered a lot
const HARD_EARNED_REVERSALS = 10; // Many direction changes
const HARD_EARNED_NEAR_MISSES = 2; // Got close multiple times

/**
 * Classify the celebration type based on search metrics.
 *
 * @param metrics - Search metrics from useHotColdFeedback
 * @returns The celebration type: 'lightning', 'standard', or 'hard-earned'
 */
export function classifyCelebration(metrics: SearchMetrics): CelebrationType {
  // Lightning: Fast and direct
  // Kid knew exactly where to look - reward the speed!
  if (
    metrics.timeToFind < LIGHTNING_TIME_MS &&
    metrics.searchEfficiency > LIGHTNING_EFFICIENCY
  ) {
    return "lightning";
  }

  // Hard-earned: Any of these indicate real effort
  // Kid really worked for it - acknowledge the perseverance!
  if (
    metrics.timeToFind > HARD_EARNED_TIME_MS ||
    metrics.searchEfficiency < HARD_EARNED_EFFICIENCY ||
    metrics.directionReversals > HARD_EARNED_REVERSALS ||
    metrics.nearMissCount > HARD_EARNED_NEAR_MISSES
  ) {
    return "hard-earned";
  }

  // Standard: Normal discovery
  return "standard";
}

// Celebration timing configuration
export const CELEBRATION_TIMING = {
  lightning: {
    flashDuration: 400,
    confettiDuration: 600,
    soundDuration: 200,
    totalDuration: 600,
  },
  standard: {
    flashDuration: 600,
    confettiDuration: 1000,
    soundDuration: 400,
    totalDuration: 1000,
  },
  "hard-earned": {
    flashDuration: 800,
    confettiDuration: 1500,
    soundDuration: 600,
    totalDuration: 1500,
  },
} as const;

// Confetti configuration per celebration type
export const CONFETTI_CONFIG = {
  lightning: {
    count: 12,
    spread: 60,
    colors: ["#fbbf24", "#fcd34d", "#fef3c7"], // Gold sparkles
  },
  standard: {
    count: 20,
    spread: 90,
    colors: ["#fbbf24", "#22c55e", "#3b82f6", "#f472b6"], // Colorful mix
  },
  "hard-earned": {
    count: 35,
    spread: 120,
    colors: ["#fbbf24", "#22c55e", "#8b5cf6", "#ec4899", "#f97316"], // Big party!
  },
} as const;
