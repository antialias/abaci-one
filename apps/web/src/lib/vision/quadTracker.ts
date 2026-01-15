/**
 * Quad Tracker
 *
 * Temporal tracking for quadrilaterals across video frames.
 * Tracks multiple quads, calculates stability scores, and identifies
 * the best quad based on size, longevity, and corner stability.
 *
 * This is a pure module with no React dependencies.
 */

import type { DetectedQuad, Point } from "./quadDetector";
import { distance } from "./quadDetector";

// ============================================================================
// Types
// ============================================================================

/** A quad being tracked across frames */
export interface TrackedQuad extends DetectedQuad {
  /** Unique identifier for this tracked quad */
  id: string;
  /** How many frames this quad has been detected */
  frameCount: number;
  /** Last frame number when this quad was seen */
  lastSeenFrame: number;
  /** Stability score (0-1) based on corner position variance */
  stabilityScore: number;
  /** Whether the quad is considered stable (seen enough frames) */
  isStable: boolean;
  /** Whether the quad is locked (very stable, ideal for capture) */
  isLocked: boolean;
}

/** Configuration for quad tracking */
export interface QuadTrackerConfig {
  /** Number of frames to track in corner history. Default: 10 */
  historyLength: number;
  /** Minimum frames to be considered "stable". Default: 3 */
  minFramesForStable: number;
  /** Minimum frames to be considered "locked". Default: 5 */
  minFramesForLocked: number;
  /** Minimum stability score (0-1) for locked state. Default: 0.5 */
  minStabilityForLocked: number;
  /** Max corner movement as fraction of diagonal to match quads. Default: 0.08 */
  matchThreshold: number;
  /** Frames a quad can be missing before removal. Default: 3 */
  maxFramesMissing: number;
}

/** Default tracker configuration */
export const DEFAULT_QUAD_TRACKER_CONFIG: QuadTrackerConfig = {
  historyLength: 10,
  minFramesForStable: 3,
  minFramesForLocked: 5,
  minStabilityForLocked: 0.5,
  matchThreshold: 0.08,
  maxFramesMissing: 3,
};

/** Internal tracking data for a quad */
interface TrackingData {
  id: string;
  corners: [Point, Point, Point, Point];
  area: number;
  aspectRatio: number;
  frameCount: number;
  lastSeenFrame: number;
  stabilityScore: number;
  cornerHistory: Array<[Point, Point, Point, Point]>;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if two quads are the same based on corner positions
 */
function quadsMatch(
  q1: [Point, Point, Point, Point],
  q2: [Point, Point, Point, Point],
  frameDiagonal: number,
  threshold: number,
): boolean {
  const maxDist = frameDiagonal * threshold;
  let totalDist = 0;
  for (let i = 0; i < 4; i++) {
    totalDist += distance(q1[i], q2[i]);
  }
  return totalDist / 4 < maxDist;
}

/**
 * Calculate corner stability score from position history
 * Lower variance = higher stability (0-1)
 */
function calculateCornerStability(
  history: Array<[Point, Point, Point, Point]>,
): number {
  if (history.length < 2) return 0;

  let totalVariance = 0;
  for (let corner = 0; corner < 4; corner++) {
    const xs = history.map((h) => h[corner].x);
    const ys = history.map((h) => h[corner].y);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const varX = xs.reduce((a, b) => a + (b - meanX) ** 2, 0) / xs.length;
    const varY = ys.reduce((a, b) => a + (b - meanY) ** 2, 0) / ys.length;
    totalVariance += Math.sqrt(varX + varY);
  }

  // Convert variance to stability score
  // Normalize: variance of 0 = stability 1, variance of 50+ = stability 0
  const avgVariance = totalVariance / 4;
  return Math.max(0, 1 - avgVariance / 50);
}

// ============================================================================
// Quad Tracker
// ============================================================================

/**
 * Create a quad tracker instance
 *
 * @param config - Optional configuration overrides
 */
export function createQuadTracker(config: Partial<QuadTrackerConfig> = {}) {
  const cfg: QuadTrackerConfig = { ...DEFAULT_QUAD_TRACKER_CONFIG, ...config };

  // Internal state
  const trackedQuads = new Map<string, TrackingData>();
  let frameCount = 0;
  let bestQuad: TrackedQuad | null = null;

  /**
   * Update tracking with newly detected quads
   *
   * @param detectedQuads - Quads detected in current frame
   * @param frameSize - Frame dimensions for diagonal calculation
   * @returns The current best quad, or null if none
   */
  function update(
    detectedQuads: DetectedQuad[],
    frameSize: { width: number; height: number },
  ): TrackedQuad | null {
    const currentFrame = frameCount++;
    const frameDiagonal = Math.sqrt(
      frameSize.width ** 2 + frameSize.height ** 2,
    );

    // Track which tracked quads were seen this frame
    const seenIds = new Set<string>();

    // Match detected quads to tracked quads
    for (const detected of detectedQuads) {
      let matched = false;

      for (const [id, tracked] of trackedQuads) {
        if (
          !seenIds.has(id) &&
          quadsMatch(
            detected.corners,
            tracked.corners,
            frameDiagonal,
            cfg.matchThreshold,
          )
        ) {
          // Update existing tracked quad
          tracked.corners = detected.corners;
          tracked.area = detected.area;
          tracked.aspectRatio = detected.aspectRatio;
          tracked.frameCount++;
          tracked.lastSeenFrame = currentFrame;
          tracked.cornerHistory.push(detected.corners);
          if (tracked.cornerHistory.length > cfg.historyLength) {
            tracked.cornerHistory.shift();
          }
          tracked.stabilityScore = calculateCornerStability(
            tracked.cornerHistory,
          );
          seenIds.add(id);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // New quad - start tracking
        const newId = `quad_${currentFrame}_${Math.random().toString(36).slice(2, 8)}`;
        trackedQuads.set(newId, {
          id: newId,
          corners: detected.corners,
          area: detected.area,
          aspectRatio: detected.aspectRatio,
          frameCount: 1,
          lastSeenFrame: currentFrame,
          stabilityScore: 0,
          cornerHistory: [detected.corners],
        });
        seenIds.add(newId);
      }
    }

    // Remove quads not seen recently
    for (const [id, tracked] of trackedQuads) {
      if (currentFrame - tracked.lastSeenFrame > cfg.maxFramesMissing) {
        trackedQuads.delete(id);
      }
    }

    // Find best quad (highest score = frameCount * stability * sqrt(area))
    let best: TrackingData | null = null;
    let bestScore = 0;

    for (const tracked of trackedQuads.values()) {
      // Only consider quads seen recently
      if (currentFrame - tracked.lastSeenFrame > 2) continue;

      // Score: prioritize stability and longevity, then area
      const score =
        tracked.frameCount *
        (0.5 + tracked.stabilityScore) *
        Math.sqrt(tracked.area);

      if (score > bestScore) {
        bestScore = score;
        best = tracked;
      }
    }

    // Convert to TrackedQuad with status flags
    if (best) {
      const isStable = best.frameCount >= cfg.minFramesForStable;
      const isLocked =
        best.frameCount >= cfg.minFramesForLocked &&
        best.stabilityScore >= cfg.minStabilityForLocked;

      bestQuad = {
        id: best.id,
        corners: best.corners,
        area: best.area,
        aspectRatio: best.aspectRatio,
        frameCount: best.frameCount,
        lastSeenFrame: best.lastSeenFrame,
        stabilityScore: best.stabilityScore,
        isStable,
        isLocked,
      };
    } else {
      bestQuad = null;
    }

    return bestQuad;
  }

  /**
   * Get the current best quad without processing a new frame
   */
  function getBestQuad(): TrackedQuad | null {
    return bestQuad;
  }

  /**
   * Get all currently tracked quads
   */
  function getAllTracked(): TrackedQuad[] {
    const result: TrackedQuad[] = [];
    for (const tracked of trackedQuads.values()) {
      const isStable = tracked.frameCount >= cfg.minFramesForStable;
      const isLocked =
        tracked.frameCount >= cfg.minFramesForLocked &&
        tracked.stabilityScore >= cfg.minStabilityForLocked;

      result.push({
        id: tracked.id,
        corners: tracked.corners,
        area: tracked.area,
        aspectRatio: tracked.aspectRatio,
        frameCount: tracked.frameCount,
        lastSeenFrame: tracked.lastSeenFrame,
        stabilityScore: tracked.stabilityScore,
        isStable,
        isLocked,
      });
    }
    return result;
  }

  /**
   * Get current tracker statistics
   */
  function getStats(): {
    trackedCount: number;
    frameCount: number;
    bestStability: number;
    bestFrameCount: number;
  } {
    return {
      trackedCount: trackedQuads.size,
      frameCount,
      bestStability: bestQuad?.stabilityScore ?? 0,
      bestFrameCount: bestQuad?.frameCount ?? 0,
    };
  }

  /**
   * Reset all tracking state
   */
  function reset(): void {
    trackedQuads.clear();
    frameCount = 0;
    bestQuad = null;
  }

  return {
    update,
    getBestQuad,
    getAllTracked,
    getStats,
    reset,
    config: cfg,
  };
}

export type QuadTracker = ReturnType<typeof createQuadTracker>;
