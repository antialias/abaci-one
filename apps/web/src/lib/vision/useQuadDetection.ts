"use client";

/**
 * useQuadDetection Hook
 *
 * A React hook that combines OpenCV loading, quad detection, and temporal tracking.
 * Provides a clean API for detecting quadrilaterals in both camera feeds and static images.
 *
 * Usage:
 * ```tsx
 * import { OpenCvProvider } from 'opencv-react'
 * import { useQuadDetection } from '@/lib/vision/useQuadDetection'
 *
 * // Wrap your app/page with OpenCvProvider
 * <OpenCvProvider>
 *   <MyComponent />
 * </OpenCvProvider>
 *
 * // In your component:
 * function MyComponent() {
 *   const {
 *     isReady,
 *     detectInImage,
 *     processFrame,
 *     trackedQuad,
 *     stats,
 *     resetTracking,
 *   } = useQuadDetection()
 *
 *   // For static images:
 *   const quads = detectInImage(canvas)
 *
 *   // For camera feeds (call each frame):
 *   const bestQuad = processFrame(videoFrame)
 * }
 * ```
 */

import { useCallback, useMemo, useRef } from "react";
import { useOpenCv } from "opencv-react";
import {
  createQuadDetector,
  type DetectedQuad,
  type DebugPolygon,
  type QuadDetectorConfig,
} from "./quadDetector";
import {
  createQuadTracker,
  type TrackedQuad,
  type QuadTrackerConfig,
} from "./quadTracker";
import type { CV } from "./opencv/types";

// Re-export types for convenience
export type { DetectedQuad, Point, DebugPolygon } from "./quadDetector";
export type { TrackedQuad } from "./quadTracker";
export type { QuadDetectorConfig } from "./quadDetector";
export type { QuadTrackerConfig } from "./quadTracker";

/** Configuration for useQuadDetection */
export interface UseQuadDetectionConfig {
  /** Quad detector configuration */
  detector?: Partial<QuadDetectorConfig>;
  /** Quad tracker configuration */
  tracker?: Partial<QuadTrackerConfig>;
}

/** Stats returned by the hook */
export interface QuadDetectionStats {
  /** Number of quads currently being tracked */
  trackedCount: number;
  /** Total frames processed */
  frameCount: number;
  /** Stability score of the best quad (0-1) */
  bestStability: number;
  /** Frame count of the best quad */
  bestFrameCount: number;
}

/** Result from processing a single frame */
export interface FrameProcessingResult {
  /** Best tracked quad, or null if none */
  trackedQuad: TrackedQuad | null;
  /** All quads detected in this frame (before tracking) */
  detectedQuads: DetectedQuad[];
  /** Current tracking statistics */
  stats: QuadDetectionStats;
}

/** Return type of useQuadDetection */
export interface UseQuadDetectionReturn {
  /** Whether OpenCV is loaded and detector is ready */
  isReady: boolean;
  /** Whether OpenCV is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;

  /**
   * Detect quads in a static image (one-shot, no tracking)
   * @param source - Canvas to detect in
   * @returns Array of detected quads, sorted by area (largest first)
   */
  detectInImage: (source: HTMLCanvasElement) => DetectedQuad[];

  /**
   * Detect quads with debug info about all candidate polygons.
   * Use this to understand why detection is failing.
   * @param source - Canvas to detect in
   * @returns Quads and debug info about all candidates
   */
  detectWithDebug: (source: HTMLCanvasElement) => {
    quads: DetectedQuad[];
    debugPolygons: DebugPolygon[];
  };

  /**
   * Process a video frame with tracking
   * Call this each frame for camera/video feeds
   * @param source - Canvas from video frame
   * @param frameSize - Optional explicit frame size (inferred from source if not provided)
   * @returns Frame processing result with tracked quad, detected quads, and stats
   */
  processFrame: (
    source: HTMLCanvasElement,
    frameSize?: { width: number; height: number },
  ) => FrameProcessingResult;

  /** The current best tracked quad */
  trackedQuad: TrackedQuad | null;

  /** All currently tracked quads */
  allTrackedQuads: TrackedQuad[];

  /** Current tracking statistics */
  stats: QuadDetectionStats;

  /** Reset all tracking state (call when switching cameras, etc.) */
  resetTracking: () => void;
}

/**
 * React hook for quad detection with optional temporal tracking.
 *
 * Must be used inside an OpenCvProvider from 'opencv-react'.
 *
 * @param config - Optional configuration for detector and tracker
 */
export function useQuadDetection(
  config?: UseQuadDetectionConfig,
): UseQuadDetectionReturn {
  const { loaded: opencvLoaded, cv } = useOpenCv();

  // Track the current best quad in a ref for synchronous access
  const trackedQuadRef = useRef<TrackedQuad | null>(null);
  const allTrackedRef = useRef<TrackedQuad[]>([]);
  const statsRef = useRef<QuadDetectionStats>({
    trackedCount: 0,
    frameCount: 0,
    bestStability: 0,
    bestFrameCount: 0,
  });

  // Create detector when cv is available
  const detector = useMemo(() => {
    if (!opencvLoaded || !cv) return null;
    try {
      return createQuadDetector(cv as CV, config?.detector);
    } catch (err) {
      console.error("[useQuadDetection] Failed to create detector:", err);
      return null;
    }
  }, [opencvLoaded, cv, config?.detector]);

  // Create tracker (doesn't need cv)
  const tracker = useMemo(
    () => createQuadTracker(config?.tracker),
    [config?.tracker],
  );

  // Detect in static image (no tracking)
  const detectInImage = useCallback(
    (source: HTMLCanvasElement): DetectedQuad[] => {
      if (!detector) {
        console.warn(
          "[useQuadDetection] detectInImage called before detector ready",
        );
        return [];
      }
      return detector.detect(source);
    },
    [detector],
  );

  // Detect with debug info (for debugging detection issues)
  const detectWithDebug = useCallback(
    (
      source: HTMLCanvasElement,
    ): { quads: DetectedQuad[]; debugPolygons: DebugPolygon[] } => {
      if (!detector) {
        console.warn(
          "[useQuadDetection] detectWithDebug called before detector ready",
        );
        return { quads: [], debugPolygons: [] };
      }
      return detector.detectWithDebug(source);
    },
    [detector],
  );

  // Process video frame with tracking
  const processFrame = useCallback(
    (
      source: HTMLCanvasElement,
      frameSize?: { width: number; height: number },
    ): FrameProcessingResult => {
      if (!detector) {
        return {
          trackedQuad: null,
          detectedQuads: [],
          stats: statsRef.current,
        };
      }

      // Detect quads in frame
      const quads = detector.detect(source);

      // Determine frame size
      const size = frameSize ?? {
        width: source.width,
        height: source.height,
      };

      // Update tracker
      const bestQuad = tracker.update(quads, size);
      const currentStats = tracker.getStats();
      const allTracked = tracker.getAllTracked();

      // Update refs
      trackedQuadRef.current = bestQuad;
      allTrackedRef.current = allTracked;
      statsRef.current = currentStats;

      return {
        trackedQuad: bestQuad,
        detectedQuads: quads,
        stats: currentStats,
      };
    },
    [detector, tracker],
  );

  // Reset tracking
  const resetTracking = useCallback(() => {
    tracker.reset();
    trackedQuadRef.current = null;
    allTrackedRef.current = [];
    statsRef.current = {
      trackedCount: 0,
      frameCount: 0,
      bestStability: 0,
      bestFrameCount: 0,
    };
  }, [tracker]);

  return {
    isReady: !!detector,
    isLoading: !opencvLoaded,
    error: null, // opencv-react doesn't expose errors directly

    detectInImage,
    detectWithDebug,
    processFrame,

    trackedQuad: trackedQuadRef.current,
    allTrackedQuads: allTrackedRef.current,
    stats: statsRef.current,

    resetTracking,
  };
}
