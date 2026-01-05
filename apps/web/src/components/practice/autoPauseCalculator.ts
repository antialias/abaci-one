/**
 * Auto-pause threshold calculation utilities
 *
 * Calculates when to auto-pause based on the student's response times.
 * Uses mean + 2*stdDev with clamping between 30s and 5 minutes.
 */

import type { SlotResult } from "@/db/schema/session-plans";

// ============================================================================
// Constants
// ============================================================================

/** Default timeout when not enough samples for statistics (5 minutes) */
export const DEFAULT_PAUSE_TIMEOUT_MS = 5 * 60 * 1000;

/** Minimum problems needed for statistical calculation */
export const MIN_SAMPLES_FOR_STATISTICS = 5;

/** Minimum clamp for the auto-pause threshold (30 seconds) */
export const MIN_PAUSE_THRESHOLD_MS = 30_000;

/** Maximum clamp for the auto-pause threshold (5 minutes) */
export const MAX_PAUSE_THRESHOLD_MS = DEFAULT_PAUSE_TIMEOUT_MS;

// ============================================================================
// Types
// ============================================================================

/**
 * Auto-pause statistics for display and debugging
 */
export interface AutoPauseStats {
  /** Mean response time in milliseconds */
  meanMs: number;
  /** Standard deviation of response times in milliseconds */
  stdDevMs: number;
  /** Calculated threshold (mean + 2*stdDev) in milliseconds */
  thresholdMs: number;
  /** Number of samples used to calculate stats */
  sampleCount: number;
  /** Whether statistical calculation was used (vs default timeout) */
  usedStatistics: boolean;
}

/**
 * Information about why a session was paused
 */
export interface PauseInfo {
  /** When the pause occurred */
  pausedAt: Date;
  /** Why the session was paused */
  reason: "manual" | "auto-timeout" | "teacher";
  /** Auto-pause statistics (only present for auto-timeout) */
  autoPauseStats?: AutoPauseStats;
  /** Teacher's custom message (only present for teacher-initiated pause) */
  teacherMessage?: string;
}

/**
 * Response time statistics
 */
export interface ResponseTimeStats {
  /** Mean response time in milliseconds */
  mean: number;
  /** Standard deviation of response times in milliseconds */
  stdDev: number;
  /** Number of samples */
  count: number;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Calculate mean and standard deviation of response times
 */
export function calculateResponseTimeStats(
  results: SlotResult[],
): ResponseTimeStats {
  if (results.length === 0) {
    return { mean: 0, stdDev: 0, count: 0 };
  }

  const times = results.map((r) => r.responseTimeMs);
  const count = times.length;
  const mean = times.reduce((sum, t) => sum + t, 0) / count;

  if (count < 2) {
    return { mean, stdDev: 0, count };
  }

  const squaredDiffs = times.map((t) => (t - mean) ** 2);
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / (count - 1); // Sample std dev
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev, count };
}

/**
 * Calculate the auto-pause threshold and full stats for display.
 *
 * @returns threshold in ms and stats for debugging/display
 */
export function calculateAutoPauseInfo(results: SlotResult[]): {
  threshold: number;
  stats: AutoPauseStats;
} {
  const { mean, stdDev, count } = calculateResponseTimeStats(results);
  const usedStatistics = count >= MIN_SAMPLES_FOR_STATISTICS;

  let threshold: number;
  if (usedStatistics) {
    // Use mean + 2 standard deviations
    threshold = mean + 2 * stdDev;
    // Clamp between 30 seconds and 5 minutes
    threshold = Math.max(
      MIN_PAUSE_THRESHOLD_MS,
      Math.min(threshold, MAX_PAUSE_THRESHOLD_MS),
    );
  } else {
    threshold = DEFAULT_PAUSE_TIMEOUT_MS;
  }

  return {
    threshold,
    stats: {
      meanMs: mean,
      stdDevMs: stdDev,
      thresholdMs: threshold,
      sampleCount: count,
      usedStatistics,
    },
  };
}

/**
 * Get a human-readable explanation of how the auto-pause threshold was calculated.
 * Used in the SessionOverview component to explain the timing.
 */
export function getAutoPauseExplanation(stats: AutoPauseStats): string {
  if (!stats.usedStatistics) {
    return `Default timeout (${formatMs(stats.thresholdMs)}) - need ${MIN_SAMPLES_FOR_STATISTICS}+ problems for statistical calculation`;
  }

  const rawThreshold = stats.meanMs + 2 * stats.stdDevMs;
  const wasClamped =
    rawThreshold < MIN_PAUSE_THRESHOLD_MS ||
    rawThreshold > MAX_PAUSE_THRESHOLD_MS;

  let explanation = `mean (${formatMs(stats.meanMs)}) + 2×stdDev (${formatMs(stats.stdDevMs)}) = ${formatMs(rawThreshold)}`;

  if (wasClamped) {
    explanation += ` → clamped to ${formatMs(stats.thresholdMs)}`;
  }

  return explanation;
}

/**
 * Format milliseconds as a human-readable time string
 */
export function formatMs(ms: number): string {
  if (ms >= 60_000) {
    const minutes = ms / 60_000;
    return `${minutes.toFixed(1)}m`;
  }
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}
