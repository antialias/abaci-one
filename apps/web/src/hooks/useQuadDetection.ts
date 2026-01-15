"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  QuadDetector,
  QuadTracker,
  captureVideoFrame,
  loadImageToCanvas,
  getFallbackCorners,
  type Corner,
  type QuadDetectionOptions,
  type QuadDetectionResult,
  type TrackedQuadResult,
} from "@/lib/vision/quadDetection";

// Re-export types for convenience
export type {
  Corner,
  DetectedQuad,
  TrackedQuad,
  QuadDetectionOptions,
  QuadDetectionResult,
  TrackedQuadResult,
} from "@/lib/vision/quadDetection";

// Re-export utility functions
export {
  loadImageToCanvas,
  captureVideoFrame,
  orderCorners,
  distance,
} from "@/lib/vision/quadDetection";

/**
 * React hook for quad detection in static images.
 *
 * Provides lazy loading of OpenCV and simple detection API.
 *
 * @example
 * ```tsx
 * function ImageScanner() {
 *   const { isReady, detect, extract, load } = useQuadDetection()
 *
 *   const handleImage = async (file: File) => {
 *     await load()
 *     const canvas = await loadImageToCanvas(file)
 *     if (!canvas) return
 *
 *     const result = detect(canvas)
 *     if (result.bestQuad) {
 *       const extracted = extract(canvas, result.bestQuad.corners)
 *     }
 *   }
 * }
 * ```
 */
export function useQuadDetection(options?: QuadDetectionOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(QuadDetector.isLoaded());
  const [error, setError] = useState<string | null>(null);
  const detectorRef = useRef<QuadDetector | null>(QuadDetector.getInstance());
  const optionsRef = useRef(options);

  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  /**
   * Load OpenCV and initialize detector.
   * Safe to call multiple times - returns immediately if already loaded.
   */
  const load = useCallback(async (): Promise<boolean> => {
    if (detectorRef.current) return true;

    setIsLoading(true);
    setError(null);

    try {
      detectorRef.current = await QuadDetector.load();
      setIsReady(true);
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load OpenCV";
      setError(message);
      console.error("QuadDetector load failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Detect quads in a canvas.
   * Returns null if detector is not loaded.
   */
  const detect = useCallback(
    (canvas: HTMLCanvasElement): QuadDetectionResult | null => {
      if (!detectorRef.current) return null;
      return detectorRef.current.detect(canvas, optionsRef.current);
    },
    [],
  );

  /**
   * Detect quads in an image file.
   * Automatically loads the detector if needed.
   */
  const detectInImage = useCallback(
    async (
      source: File | HTMLCanvasElement,
    ): Promise<{
      detected: boolean;
      corners: Corner[];
      sourceCanvas: HTMLCanvasElement;
    }> => {
      // Ensure loaded
      await load();

      // Get canvas
      let canvas: HTMLCanvasElement | null;
      if (source instanceof File) {
        canvas = await loadImageToCanvas(source);
      } else {
        canvas = source;
      }

      if (!canvas) {
        // Return fallback
        const fallbackCanvas = document.createElement("canvas");
        fallbackCanvas.width = 100;
        fallbackCanvas.height = 100;
        return {
          detected: false,
          corners: getFallbackCorners(100, 100),
          sourceCanvas: fallbackCanvas,
        };
      }

      // Detect
      const detector = detectorRef.current;
      if (!detector) {
        return {
          detected: false,
          corners: getFallbackCorners(canvas.width, canvas.height),
          sourceCanvas: canvas,
        };
      }

      const result = detector.detect(canvas, optionsRef.current);
      return {
        detected: result.detected,
        corners:
          result.bestQuad?.corners ??
          getFallbackCorners(canvas.width, canvas.height),
        sourceCanvas: canvas,
      };
    },
    [load],
  );

  /**
   * Extract a quad region using perspective transform.
   */
  const extract = useCallback(
    (
      canvas: HTMLCanvasElement,
      corners: Corner[],
    ): HTMLCanvasElement | null => {
      if (!detectorRef.current) return null;
      return detectorRef.current.extract(canvas, corners);
    },
    [],
  );

  /**
   * Analyze document orientation.
   */
  const analyzeOrientation = useCallback(
    (canvas: HTMLCanvasElement): 0 | 90 | 180 | 270 => {
      if (!detectorRef.current) return 0;
      return detectorRef.current.analyzeOrientation(canvas);
    },
    [],
  );

  /**
   * Rotate a canvas.
   */
  const rotate = useCallback(
    (
      canvas: HTMLCanvasElement,
      degrees: 0 | 90 | 180 | 270,
    ): HTMLCanvasElement => {
      if (!detectorRef.current) return canvas;
      return detectorRef.current.rotate(canvas, degrees);
    },
    [],
  );

  /**
   * Get OpenCV reference (for advanced use).
   */
  const getCV = useCallback(() => {
    return detectorRef.current?.getCV() ?? null;
  }, []);

  return {
    /** Whether OpenCV is currently loading */
    isLoading,
    /** Whether the detector is ready to use */
    isReady,
    /** Error message if loading failed */
    error,
    /** Load OpenCV (call before using detect/extract) */
    load,
    /** Detect quads in a canvas */
    detect,
    /** Detect quads in an image file (auto-loads) */
    detectInImage,
    /** Extract a quad region */
    extract,
    /** Analyze document orientation */
    analyzeOrientation,
    /** Rotate a canvas */
    rotate,
    /** Get OpenCV reference */
    getCV,
    /** Get the detector instance */
    detector: detectorRef.current,
  };
}

/**
 * React hook for quad tracking in camera feeds.
 *
 * Provides frame-to-frame tracking with stability detection.
 *
 * @example
 * ```tsx
 * function CameraScanner() {
 *   const { isReady, processFrame, isStable, isLocked, tracker } = useQuadTracking()
 *   const videoRef = useRef<HTMLVideoElement>(null)
 *   const overlayRef = useRef<HTMLCanvasElement>(null)
 *
 *   useEffect(() => {
 *     if (!isReady) return
 *
 *     const loop = () => {
 *       const frame = captureVideoFrame(videoRef.current!)
 *       if (frame && overlayRef.current) {
 *         const result = processFrame(frame)
 *         tracker.drawOverlay(overlayRef.current, result, frame.width, frame.height)
 *       }
 *       requestAnimationFrame(loop)
 *     }
 *     requestAnimationFrame(loop)
 *   }, [isReady])
 * }
 * ```
 */
export function useQuadTracking(options?: QuadDetectionOptions) {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  const detectorRef = useRef<QuadDetector | null>(null);
  const trackerRef = useRef<QuadTracker | null>(null);
  const optionsRef = useRef(options);

  // Update options when they change
  useEffect(() => {
    optionsRef.current = options;
    trackerRef.current?.setOptions(options ?? {});
  }, [options]);

  /**
   * Load OpenCV and initialize tracker.
   */
  const load = useCallback(async (): Promise<boolean> => {
    if (trackerRef.current) return true;

    setIsLoading(true);
    setError(null);

    try {
      detectorRef.current = await QuadDetector.load();
      trackerRef.current = new QuadTracker(
        detectorRef.current,
        optionsRef.current,
      );
      setIsReady(true);
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load OpenCV";
      setError(message);
      console.error("QuadTracker load failed:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Process a video frame and update tracking.
   */
  const processFrame = useCallback(
    (frame: HTMLCanvasElement): TrackedQuadResult | null => {
      if (!trackerRef.current) return null;

      const result = trackerRef.current.processFrame(frame);
      setIsStable(result.isStable);
      setIsLocked(result.isLocked);
      return result;
    },
    [],
  );

  /**
   * Process video element directly (convenience method).
   */
  const processVideo = useCallback(
    (
      video: HTMLVideoElement,
      overlayCanvas?: HTMLCanvasElement,
    ): TrackedQuadResult | null => {
      const frame = captureVideoFrame(video);
      if (!frame) return null;

      const result = processFrame(frame);

      if (overlayCanvas && result && trackerRef.current) {
        trackerRef.current.drawOverlay(
          overlayCanvas,
          result,
          video.videoWidth,
          video.videoHeight,
        );
      }

      return result;
    },
    [processFrame],
  );

  /**
   * Reset tracking state.
   */
  const reset = useCallback(() => {
    trackerRef.current?.reset();
    setIsStable(false);
    setIsLocked(false);
  }, []);

  /**
   * Get current best quad corners.
   */
  const getBestCorners = useCallback((): Corner[] | null => {
    return trackerRef.current?.getBestCorners() ?? null;
  }, []);

  /**
   * Get the last stable frame.
   */
  const getLastStableFrame = useCallback((): HTMLCanvasElement | null => {
    return trackerRef.current?.getLastStableFrame() ?? null;
  }, []);

  /**
   * Get OpenCV reference.
   */
  const getCV = useCallback(() => {
    return detectorRef.current?.getCV() ?? null;
  }, []);

  return {
    /** Whether OpenCV is currently loading */
    isLoading,
    /** Whether the tracker is ready */
    isReady,
    /** Error message if loading failed */
    error,
    /** Load OpenCV (call before processing frames) */
    load,
    /** Process a canvas frame */
    processFrame,
    /** Process video element directly */
    processVideo,
    /** Reset tracking state */
    reset,
    /** Whether detection is stable */
    isStable,
    /** Whether detection is locked */
    isLocked,
    /** Get current best corners */
    getBestCorners,
    /** Get last stable frame */
    getLastStableFrame,
    /** Get OpenCV reference */
    getCV,
    /** Get detector instance */
    detector: detectorRef.current,
    /** Get tracker instance */
    tracker: trackerRef.current,
  };
}

export default useQuadDetection;
