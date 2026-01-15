"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createQuadDetector,
  type DetectedQuad as ModularDetectedQuad,
  type QuadDetectorConfig,
} from "@/lib/vision/quadDetector";
import {
  createQuadTracker,
  type TrackedQuad as ModularTrackedQuad,
} from "@/lib/vision/quadTracker";
import type { CV, CVMat } from "@/lib/vision/opencv/types";

// Re-export config type for consumers
export type { QuadDetectorConfig } from "@/lib/vision/quadDetector";

/**
 * Hook for document detection using OpenCV.js directly
 *
 * Features:
 * - Lazy loads OpenCV.js (~8MB) only when first used
 * - Uses modular quadDetector and quadTracker from @/lib/vision
 * - Scores quads by: size, aspect ratio, and temporal stability
 * - Filters out small quads (likely printed on page) vs page-sized quads
 * - Provides highlightDocument for drawing detected quad on overlay
 * - Provides extractDocument for cropping/deskewing captured image
 */

/** Internal tracked quad type for backward compatibility */
interface TrackedQuad extends ModularTrackedQuad {
  /** History of corner positions for stability calculation (used by extractDocument) */
  cornerHistory?: Array<Array<{ x: number; y: number }>>;
}

export interface DocumentDetectionDebugInfo {
  /** Time taken to load OpenCV in ms */
  loadTimeMs: number | null;
  /** Last detection attempt time in ms */
  lastDetectionMs: number | null;
  /** Number of quads detected this frame */
  quadsDetected: number;
  /** Number of tracked quad candidates */
  trackedQuads: number;
  /** Best quad's stability score */
  bestQuadStability: number;
  /** Best quad's frame count */
  bestQuadFrameCount: number;
  /** Last error message from detection */
  lastDetectionError: string | null;
}

/** Minimum frames a quad must be seen to be considered stable */
const MIN_FRAMES_FOR_STABLE = 3;
/** Minimum frames for "locked" state */
const LOCKED_FRAME_COUNT = 5;
/** Minimum stability score for locked state */
const MIN_STABILITY_FOR_LOCKED = 0.5;

export interface DetectQuadsInImageResult {
  /** Whether a document quad was detected */
  detected: boolean;
  /** Corner positions (detected or fallback to full image) */
  corners: Array<{ x: number; y: number }>;
  /** The source canvas for the image */
  sourceCanvas: HTMLCanvasElement;
}

export interface UseDocumentDetectionReturn {
  /** Whether OpenCV is still loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Whether scanner is ready to use */
  isReady: boolean;
  /**
   * Ensure OpenCV is loaded before using detection functions.
   * Call this before using highlightDocument, extractDocument, or detectQuadsInImage.
   * Returns true if OpenCV loaded successfully, false otherwise.
   */
  ensureOpenCVLoaded: () => Promise<boolean>;
  /** Whether detection is currently stable (good time to capture) */
  isStable: boolean;
  /** Whether detection is locked (very stable, ideal to capture) */
  isLocked: boolean;
  /** Debug information for troubleshooting */
  debugInfo: DocumentDetectionDebugInfo;
  /** OpenCV reference for external use (e.g., DocumentAdjuster) */
  cv: unknown;
  /**
   * Get the current best quad's corner positions
   * Returns null if no quad is detected
   */
  getBestQuadCorners: () => Array<{ x: number; y: number }> | null;
  /**
   * Capture the current video frame as a canvas
   * Returns null if capture fails
   */
  captureSourceFrame: (video: HTMLVideoElement) => HTMLCanvasElement | null;
  /**
   * Draw detected document edges on overlay canvas
   * Returns true if document was detected, false otherwise
   */
  highlightDocument: (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
  ) => boolean;
  /**
   * Extract and deskew the detected document
   * Returns canvas with cropped document, or null if extraction failed
   */
  extractDocument: (video: HTMLVideoElement) => HTMLCanvasElement | null;
  /**
   * Detect quads in a static image (for file uploads and gallery edits)
   * Returns detected corners or fallback corners (full image)
   */
  detectQuadsInImage: (canvas: HTMLCanvasElement) => DetectQuadsInImageResult;
  /**
   * Load an image file into a canvas
   * Returns the canvas, or null if loading failed
   */
  loadImageToCanvas: (file: File) => Promise<HTMLCanvasElement | null>;
  /**
   * Reset all tracking state (call when returning from adjustment mode)
   */
  resetTracking: () => void;
  /**
   * Update detector configuration (recreates detector with new settings)
   */
  updateDetectorConfig: (config: Partial<QuadDetectorConfig>) => void;
  /**
   * Current detector configuration
   */
  detectorConfig: Partial<QuadDetectorConfig>;
}

export interface UseDocumentDetectionOptions {
  /** Initial detector configuration */
  detectorConfig?: Partial<QuadDetectorConfig>;
}

export function useDocumentDetection(
  options?: UseDocumentDetectionOptions,
): UseDocumentDetectionReturn {
  // Start with isLoading=false since we won't load until requested
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cvRef = useRef<CV | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);

  // Detector configuration (can be updated dynamically)
  const [detectorConfig, setDetectorConfig] = useState<
    Partial<QuadDetectorConfig>
  >(options?.detectorConfig ?? {});

  // Modular detector and tracker (created after OpenCV loads)
  const detectorRef = useRef<ReturnType<typeof createQuadDetector> | null>(
    null,
  );
  const trackerRef = useRef<ReturnType<typeof createQuadTracker> | null>(null);

  // Best quad tracking
  const bestQuadRef = useRef<TrackedQuad | null>(null);
  const lastStableFrameRef = useRef<HTMLCanvasElement | null>(null);

  // Debug info tracking
  const [debugInfo, setDebugInfo] = useState<DocumentDetectionDebugInfo>({
    loadTimeMs: null,
    lastDetectionMs: null,
    quadsDetected: 0,
    trackedQuads: 0,
    bestQuadStability: 0,
    bestQuadFrameCount: 0,
    lastDetectionError: null,
  });
  const loadStartTimeRef = useRef<number>(0);

  // Helper to check if OpenCV is fully initialized
  const isOpenCVReady = useCallback((): boolean => {
    const cv = (window as unknown as { cv?: { imread?: unknown } }).cv;
    return !!(cv && typeof cv.imread === "function");
  }, []);

  // Lazy load OpenCV.js - only when explicitly requested
  const ensureOpenCVLoaded = useCallback(async (): Promise<boolean> => {
    // Already loaded
    if (cvRef.current) return true;

    // Already loading - wait for it
    if (loadPromiseRef.current) {
      await loadPromiseRef.current;
      return cvRef.current !== null;
    }

    // Start loading
    setIsLoading(true);
    loadStartTimeRef.current = Date.now();

    loadPromiseRef.current = (async () => {
      try {
        if (typeof window !== "undefined") {
          if (!isOpenCVReady()) {
            const existingScript = document.querySelector(
              'script[src="/opencv.js"]',
            );

            if (!existingScript) {
              await new Promise<void>((resolve, reject) => {
                const script = document.createElement("script");
                script.src = "/opencv.js";
                script.async = true;

                script.onload = () => {
                  const checkReady = () => {
                    if (isOpenCVReady()) {
                      resolve();
                    } else {
                      const cv = (
                        window as unknown as {
                          cv?: { onRuntimeInitialized?: () => void };
                        }
                      ).cv;
                      if (cv) {
                        const previousCallback = cv.onRuntimeInitialized;
                        cv.onRuntimeInitialized = () => {
                          previousCallback?.();
                          resolve();
                        };
                      } else {
                        reject(new Error("OpenCV.js loaded but cv not found"));
                      }
                    }
                  };
                  checkReady();
                };

                script.onerror = () =>
                  reject(new Error("Failed to load OpenCV.js"));
                document.head.appendChild(script);
              });
            } else {
              await new Promise<void>((resolve, reject) => {
                const maxWait = 30000;
                const startTime = Date.now();

                const checkReady = () => {
                  if (isOpenCVReady()) {
                    resolve();
                  } else if (Date.now() - startTime > maxWait) {
                    reject(new Error("OpenCV.js loading timed out"));
                  } else {
                    const cv = (
                      window as unknown as {
                        cv?: { onRuntimeInitialized?: () => void };
                      }
                    ).cv;
                    if (cv) {
                      const previousCallback = cv.onRuntimeInitialized;
                      cv.onRuntimeInitialized = () => {
                        previousCallback?.();
                        resolve();
                      };
                    } else {
                      setTimeout(checkReady, 100);
                    }
                  }
                };
                checkReady();
              });
            }
          }
        }

        // Store OpenCV reference
        cvRef.current = (window as unknown as { cv: CV }).cv;

        // Create modular detector and tracker with current config
        detectorRef.current = createQuadDetector(cvRef.current, detectorConfig);
        trackerRef.current = createQuadTracker({
          minFramesForStable: MIN_FRAMES_FOR_STABLE,
          minFramesForLocked: LOCKED_FRAME_COUNT,
          minStabilityForLocked: MIN_STABILITY_FOR_LOCKED,
        });

        const loadTime = Date.now() - loadStartTimeRef.current;
        setDebugInfo((prev) => ({ ...prev, loadTimeMs: loadTime }));
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to load OpenCV:", err);
        setError(err instanceof Error ? err.message : "Failed to load OpenCV");
        setIsLoading(false);
        throw err;
      }
    })();

    try {
      await loadPromiseRef.current;
      return cvRef.current !== null;
    } catch {
      return false;
    }
  }, [isOpenCVReady, detectorConfig]);

  // Recreate detector when config changes (if OpenCV is already loaded)
  useEffect(() => {
    if (cvRef.current && detectorRef.current) {
      detectorRef.current = createQuadDetector(cvRef.current, detectorConfig);
    }
  }, [detectorConfig]);

  // Update detector config function
  const updateDetectorConfig = useCallback(
    (newConfig: Partial<QuadDetectorConfig>) => {
      setDetectorConfig((prev) => ({ ...prev, ...newConfig }));
    },
    [],
  );

  // Reusable canvas for video frame capture
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Helper to capture video frame to canvas
  const captureVideoFrame = useCallback(
    (video: HTMLVideoElement): HTMLCanvasElement | null => {
      if (!video.videoWidth || !video.videoHeight) return null;

      if (!frameCanvasRef.current) {
        frameCanvasRef.current = document.createElement("canvas");
      }
      const frameCanvas = frameCanvasRef.current;

      if (
        frameCanvas.width !== video.videoWidth ||
        frameCanvas.height !== video.videoHeight
      ) {
        frameCanvas.width = video.videoWidth;
        frameCanvas.height = video.videoHeight;
      }

      const ctx = frameCanvas.getContext("2d");
      if (!ctx) return null;

      ctx.drawImage(video, 0, 0);
      return frameCanvas;
    },
    [],
  );

  // Calculate distance between two points (kept for extractDocument)
  const distance = useCallback(
    (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
      return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    },
    [],
  );

  // Draw quad on overlay canvas
  const drawQuad = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      corners: Array<{ x: number; y: number }>,
      color: string,
      lineWidth: number,
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(corners[0].x, corners[0].y);
      for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i].x, corners[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      // Draw corner circles
      ctx.fillStyle = color;
      for (const corner of corners) {
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, lineWidth * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    [],
  );

  const highlightDocument = useCallback(
    (video: HTMLVideoElement, overlayCanvas: HTMLCanvasElement): boolean => {
      const detector = detectorRef.current;
      const tracker = trackerRef.current;
      if (!detector || !tracker) return false;

      const startTime = performance.now();

      try {
        const frameCanvas = captureVideoFrame(video);
        if (!frameCanvas) {
          setDebugInfo((prev) => ({
            ...prev,
            lastDetectionError: "Failed to capture video frame",
          }));
          return false;
        }

        // Resize overlay to match video
        if (
          overlayCanvas.width !== video.videoWidth ||
          overlayCanvas.height !== video.videoHeight
        ) {
          overlayCanvas.width = video.videoWidth;
          overlayCanvas.height = video.videoHeight;
        }

        const overlayCtx = overlayCanvas.getContext("2d");
        if (!overlayCtx) return false;

        // Clear overlay
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

        // Use modular detector
        const detectedQuads = detector.detect(frameCanvas);

        // Use modular tracker
        const bestQuad = tracker.update(detectedQuads, {
          width: frameCanvas.width,
          height: frameCanvas.height,
        });
        const stats = tracker.getStats();

        const detectionTime = performance.now() - startTime;

        // Draw all detected quads (faded) for debugging
        for (const quad of detectedQuads) {
          drawQuad(overlayCtx, quad.corners, "rgba(100, 100, 100, 0.3)", 2);
        }

        // Draw best quad with color based on stability
        if (bestQuad) {
          // Update bestQuadRef for extractDocument
          bestQuadRef.current = bestQuad;

          let color: string;
          let lineWidth: number;

          if (bestQuad.isLocked) {
            color = "rgba(0, 255, 100, 0.95)";
            lineWidth = 6;
            // Save stable frame
            if (!lastStableFrameRef.current) {
              lastStableFrameRef.current = document.createElement("canvas");
            }
            lastStableFrameRef.current.width = frameCanvas.width;
            lastStableFrameRef.current.height = frameCanvas.height;
            const stableCtx = lastStableFrameRef.current.getContext("2d");
            stableCtx?.drawImage(frameCanvas, 0, 0);
          } else if (bestQuad.isStable) {
            color = "rgba(100, 255, 100, 0.85)";
            lineWidth = 5;
          } else {
            color = "rgba(255, 200, 0, 0.8)";
            lineWidth = 4;
          }

          drawQuad(overlayCtx, bestQuad.corners, color, lineWidth);
        } else {
          bestQuadRef.current = null;
        }

        // Update debug info
        setDebugInfo((prev) => ({
          ...prev,
          lastDetectionMs: Math.round(detectionTime),
          quadsDetected: detectedQuads.length,
          trackedQuads: stats.trackedCount,
          bestQuadStability: bestQuad?.stabilityScore ?? 0,
          bestQuadFrameCount: bestQuad?.frameCount ?? 0,
          lastDetectionError: null,
        }));

        return !!bestQuad;
      } catch (err) {
        setDebugInfo((prev) => ({
          ...prev,
          lastDetectionError:
            err instanceof Error ? err.message : "Unknown error",
        }));
        return false;
      }
    },
    [captureVideoFrame, drawQuad],
  );

  /**
   * Analyze document orientation and return rotation needed (0, 90, 180, 270)
   * Uses edge detection to find dominant text line direction
   * and content density to detect upside-down orientation
   */
  const analyzeOrientation = useCallback(
    (canvas: HTMLCanvasElement): 0 | 90 | 180 | 270 => {
      const cv = cvRef.current;
      if (!cv) return 0;

      let src: CVMat | null = null;
      let gray: CVMat | null = null;
      let edges: CVMat | null = null;

      try {
        src = cv.imread(canvas);
        gray = new cv.Mat();
        edges = new cv.Mat();

        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Apply Canny edge detection
        cv.Canny(gray, edges, 50, 150);

        const width = edges.cols;
        const height = edges.rows;

        // Sample horizontal and vertical edge strips to determine orientation
        // For text documents, horizontal lines (text) should dominate
        let horizontalEdges = 0;
        let verticalEdges = 0;

        // Sample middle section of the image (avoid margins)
        const marginX = Math.floor(width * 0.1);
        const marginY = Math.floor(height * 0.1);
        const sampleHeight = height - 2 * marginY;

        // Count edge pixels in horizontal strips vs vertical strips
        // Use a simple row/column scan approach
        const edgeData = new Uint8Array(
          (edges as unknown as { data: ArrayBuffer }).data,
        );

        // Count horizontal edge continuity (text lines are horizontal)
        for (let y = marginY; y < height - marginY; y += 5) {
          let runLength = 0;
          for (let x = marginX; x < width - marginX; x++) {
            if (edgeData[y * width + x] > 0) {
              runLength++;
            } else {
              if (runLength > 10) horizontalEdges += runLength;
              runLength = 0;
            }
          }
          if (runLength > 10) horizontalEdges += runLength;
        }

        // Count vertical edge continuity
        for (let x = marginX; x < width - marginX; x += 5) {
          let runLength = 0;
          for (let y = marginY; y < height - marginY; y++) {
            if (edgeData[y * width + x] > 0) {
              runLength++;
            } else {
              if (runLength > 10) verticalEdges += runLength;
              runLength = 0;
            }
          }
          if (runLength > 10) verticalEdges += runLength;
        }

        // Determine if we need 90° rotation
        // If vertical edges significantly dominate, text is probably sideways
        const ratio = horizontalEdges / (verticalEdges + 1);
        let rotation: 0 | 90 | 180 | 270 = 0;

        if (ratio < 0.5) {
          // Vertical edges dominate - rotate 90° clockwise
          rotation = 90;
        } else if (ratio > 2) {
          // Horizontal edges dominate - correct orientation (or 180°)
          rotation = 0;
        }

        // Now check if upside down by comparing content density
        // Top of document usually has more content (headers, titles)
        const topThird = Math.floor(sampleHeight / 3);

        let topDensity = 0;
        let bottomDensity = 0;

        for (let y = marginY; y < marginY + topThird; y++) {
          for (let x = marginX; x < width - marginX; x += 3) {
            if (edgeData[y * width + x] > 0) topDensity++;
          }
        }

        for (let y = height - marginY - topThird; y < height - marginY; y++) {
          for (let x = marginX; x < width - marginX; x += 3) {
            if (edgeData[y * width + x] > 0) bottomDensity++;
          }
        }

        // If bottom has significantly more content, probably upside down
        if (bottomDensity > topDensity * 1.5) {
          rotation = rotation === 0 ? 180 : rotation === 90 ? 270 : rotation;
        }

        return rotation;
      } catch (err) {
        console.warn("Orientation analysis failed:", err);
        return 0;
      } finally {
        src?.delete();
        gray?.delete();
        edges?.delete();
      }
    },
    [],
  );

  /**
   * Rotate a canvas by the specified degrees (0, 90, 180, 270)
   */
  const rotateCanvas = useCallback(
    (
      canvas: HTMLCanvasElement,
      degrees: 0 | 90 | 180 | 270,
    ): HTMLCanvasElement => {
      if (degrees === 0) return canvas;

      const cv = cvRef.current;
      if (!cv) return canvas;

      let src: CVMat | null = null;
      let dst: CVMat | null = null;

      try {
        src = cv.imread(canvas);
        dst = new cv.Mat();

        const rotateCode =
          degrees === 90
            ? cv.ROTATE_90_CLOCKWISE
            : degrees === 180
              ? cv.ROTATE_180
              : cv.ROTATE_90_COUNTERCLOCKWISE;

        cv.rotate(src, dst, rotateCode);

        const outputCanvas = document.createElement("canvas");
        if (degrees === 90 || degrees === 270) {
          outputCanvas.width = canvas.height;
          outputCanvas.height = canvas.width;
        } else {
          outputCanvas.width = canvas.width;
          outputCanvas.height = canvas.height;
        }

        cv.imshow(outputCanvas, dst);
        return outputCanvas;
      } catch (err) {
        console.warn("Canvas rotation failed:", err);
        return canvas;
      } finally {
        src?.delete();
        dst?.delete();
      }
    },
    [],
  );

  const extractDocument = useCallback(
    (video: HTMLVideoElement): HTMLCanvasElement | null => {
      const cv = cvRef.current;
      const bestQuad = bestQuadRef.current;
      if (!cv || !bestQuad) return null;

      try {
        // Use stable frame if available, otherwise capture current
        const sourceCanvas =
          lastStableFrameRef.current &&
          bestQuad.frameCount >= LOCKED_FRAME_COUNT
            ? lastStableFrameRef.current
            : captureVideoFrame(video);

        if (!sourceCanvas) return null;

        const corners = bestQuad.corners;

        // Calculate output dimensions (maintain aspect ratio)
        const width1 = distance(corners[0], corners[1]);
        const width2 = distance(corners[3], corners[2]);
        const height1 = distance(corners[0], corners[3]);
        const height2 = distance(corners[1], corners[2]);
        const outputWidth = Math.round((width1 + width2) / 2);
        const outputHeight = Math.round((height1 + height2) / 2);

        // Create source points matrix
        const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
          corners[0].x,
          corners[0].y,
          corners[1].x,
          corners[1].y,
          corners[2].x,
          corners[2].y,
          corners[3].x,
          corners[3].y,
        ]);

        // Create destination points matrix
        const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0,
          0,
          outputWidth,
          0,
          outputWidth,
          outputHeight,
          0,
          outputHeight,
        ]);

        // Get perspective transform
        const M = cv.getPerspectiveTransform(srcPts, dstPts);

        // Read source image
        const src = cv.imread(sourceCanvas);

        // Create output mat
        const dst = new cv.Mat();

        // Apply perspective warp
        cv.warpPerspective(
          src,
          dst,
          M,
          new cv.Size(outputWidth, outputHeight),
          cv.INTER_LINEAR,
          cv.BORDER_CONSTANT,
          new cv.Scalar(),
        );

        // Create output canvas
        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        cv.imshow(outputCanvas, dst);

        // Clean up
        srcPts.delete();
        dstPts.delete();
        M.delete();
        src.delete();
        dst.delete();

        // Auto-rotate based on content analysis
        const rotation = analyzeOrientation(outputCanvas);
        if (rotation !== 0) {
          console.log(`Auto-rotating document by ${rotation}°`);
          return rotateCanvas(outputCanvas, rotation);
        }

        return outputCanvas;
      } catch (err) {
        console.warn("Document extraction failed:", err);
        return null;
      }
    },
    [captureVideoFrame, distance, analyzeOrientation, rotateCanvas],
  );

  // Reset tracking state (call when returning from adjustment mode)
  const resetTracking = useCallback(() => {
    trackerRef.current?.reset();
    bestQuadRef.current = null;
    lastStableFrameRef.current = null;
    setDebugInfo((prev) => ({
      ...prev,
      quadsDetected: 0,
      trackedQuads: 0,
      bestQuadStability: 0,
      bestQuadFrameCount: 0,
    }));
  }, []);

  // Compute derived state (use isStable/isLocked from tracked quad)
  const bestQuad = bestQuadRef.current;
  const isStable = bestQuad?.isStable ?? false;
  const isLocked = bestQuad?.isLocked ?? false;

  // Get current best quad corners
  const getBestQuadCorners = useCallback((): Array<{
    x: number;
    y: number;
  }> | null => {
    const quad = bestQuadRef.current;
    if (!quad) return null;
    return [...quad.corners];
  }, []);

  // Capture source frame (expose captureVideoFrame)
  const captureSourceFrame = useCallback(
    (video: HTMLVideoElement): HTMLCanvasElement | null => {
      const frame = captureVideoFrame(video);
      if (!frame) return null;
      // Return a copy so caller can keep it
      const copy = document.createElement("canvas");
      copy.width = frame.width;
      copy.height = frame.height;
      const ctx = copy.getContext("2d");
      ctx?.drawImage(frame, 0, 0);
      return copy;
    },
    [captureVideoFrame],
  );

  /**
   * Load an image file into a canvas
   */
  const loadImageToCanvas = useCallback(
    async (file: File): Promise<HTMLCanvasElement | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };

        img.src = url;
      });
    },
    [],
  );

  /**
   * Detect quads in a static image (for file uploads and gallery edits)
   * Returns detected corners or fallback corners (full image)
   */
  const detectQuadsInImage = useCallback(
    (canvas: HTMLCanvasElement): DetectQuadsInImageResult => {
      // Fallback corners (full image)
      const fallbackCorners = [
        { x: 0, y: 0 },
        { x: canvas.width, y: 0 },
        { x: canvas.width, y: canvas.height },
        { x: 0, y: canvas.height },
      ];

      const detector = detectorRef.current;
      if (!detector) {
        return {
          detected: false,
          corners: fallbackCorners,
          sourceCanvas: canvas,
        };
      }

      try {
        // Use modular detector
        const detectedQuads = detector.detect(canvas);

        if (detectedQuads.length > 0) {
          // Return the best quad (largest area, already sorted)
          return {
            detected: true,
            corners: detectedQuads[0].corners,
            sourceCanvas: canvas,
          };
        }

        // No quads detected - return fallback
        return {
          detected: false,
          corners: fallbackCorners,
          sourceCanvas: canvas,
        };
      } catch (err) {
        console.warn("Quad detection failed:", err);
        return {
          detected: false,
          corners: fallbackCorners,
          sourceCanvas: canvas,
        };
      }
    },
    [],
  );

  return {
    isLoading,
    error,
    isReady: !isLoading && !error && detectorRef.current !== null,
    ensureOpenCVLoaded,
    isStable,
    isLocked: !!isLocked,
    debugInfo,
    cv: cvRef.current,
    getBestQuadCorners,
    captureSourceFrame,
    highlightDocument,
    extractDocument,
    detectQuadsInImage,
    loadImageToCanvas,
    resetTracking,
    updateDetectorConfig,
    detectorConfig,
  };
}

export default useDocumentDetection;
