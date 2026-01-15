"use client";

import { useCallback, useRef } from "react";
import type { QuadCorners } from "@/types/vision";
import { saveBoundarySample } from "@/lib/vision/saveBoundarySample";

/** Default capture interval: 200ms (5fps) to match phone sending rate */
const DEFAULT_CAPTURE_INTERVAL_MS = 200;

/** Minimum capture interval: 200ms (5fps) - we need massive training data */
const MIN_CAPTURE_INTERVAL_MS = 200;

interface PassiveBoundaryCaptureConfig {
  /** Whether passive capture is enabled (default: true) */
  enabled?: boolean;
  /** Minimum interval between captures in ms (default: 200) */
  captureIntervalMs?: number;
  /** Device ID for organizing captures (default: "passive-remote") */
  deviceId?: string;
  /** Session ID for tracking which practice session captured the frame */
  sessionId?: string;
  /** Player ID for tracking which student was practicing */
  playerId?: string;
  /** Callback when capture succeeds */
  onCaptureSuccess?: () => void;
  /** Callback when capture fails */
  onCaptureError?: (error: string) => void;
}

interface UsePassiveBoundaryCaptureReturn {
  /**
   * Attempt to capture a boundary frame for training.
   * Call this whenever you have a frame with detected corners.
   * The hook will rate-limit captures automatically.
   *
   * @param imageData Base64 image data (JPEG or PNG, with or without data URL prefix)
   * @param corners Detected corner coordinates (in image pixel space)
   * @param frameWidth Width of the image in pixels
   * @param frameHeight Height of the image in pixels
   * @returns true if capture was attempted, false if rate-limited
   */
  maybeCapture: (
    imageData: string,
    corners: QuadCorners,
    frameWidth: number,
    frameHeight: number,
  ) => boolean;
  /** Number of successful captures this session */
  captureCount: number;
  /** Timestamp of last capture (0 if none) */
  lastCaptureTime: number;
  /** Whether a capture is currently in progress */
  isCapturing: boolean;
}

/**
 * Hook for passive boundary frame capture during practice sessions.
 *
 * This hook allows automatic collection of boundary detector training data
 * when markers are detected during normal practice sessions. It rate-limits
 * captures to avoid flooding storage.
 *
 * Uses the shared saveBoundarySample utility (same as BoundaryDataCapture).
 *
 * Usage:
 * ```tsx
 * const { maybeCapture } = usePassiveBoundaryCapture({ enabled: true })
 *
 * // In your frame handler when you have detected corners:
 * if (frame.detectedCorners && frame.mode === 'raw') {
 *   maybeCapture(frame.imageData, frame.detectedCorners, width, height)
 * }
 * ```
 */
export function usePassiveBoundaryCapture(
  config: PassiveBoundaryCaptureConfig = {},
): UsePassiveBoundaryCaptureReturn {
  const {
    enabled = true,
    captureIntervalMs = DEFAULT_CAPTURE_INTERVAL_MS,
    deviceId = "passive-remote",
    sessionId,
    playerId,
    onCaptureSuccess,
    onCaptureError,
  } = config;

  // Use refs to avoid re-renders and stale closures
  const lastCaptureTimeRef = useRef(0);
  const captureCountRef = useRef(0);
  const isCapturingRef = useRef(false);

  const maybeCapture = useCallback(
    (
      imageData: string,
      corners: QuadCorners,
      frameWidth: number,
      frameHeight: number,
    ): boolean => {
      // Skip if disabled
      if (!enabled) {
        return false;
      }

      // Skip if currently capturing
      if (isCapturingRef.current) {
        return false;
      }

      // Rate limit: check if enough time has passed since last capture
      const now = Date.now();
      const effectiveInterval = Math.max(
        captureIntervalMs,
        MIN_CAPTURE_INTERVAL_MS,
      );
      const timeSinceLastCapture = now - lastCaptureTimeRef.current;

      if (timeSinceLastCapture < effectiveInterval) {
        return false;
      }

      // Validate corners exist
      if (
        !corners?.topLeft ||
        !corners?.topRight ||
        !corners?.bottomLeft ||
        !corners?.bottomRight
      ) {
        return false;
      }

      // Mark as capturing and update timestamp optimistically
      isCapturingRef.current = true;
      lastCaptureTimeRef.current = now;

      // Use shared saveBoundarySample utility (fire and forget, but track success/failure)
      saveBoundarySample({
        imageData,
        corners,
        frameWidth,
        frameHeight,
        deviceId,
        sessionId,
        playerId,
      })
        .then((result) => {
          if (result.success) {
            captureCountRef.current++;
            console.log(
              `[PassiveBoundaryCapture] Captured frame #${captureCountRef.current} for training`,
            );
            onCaptureSuccess?.();
          } else {
            console.warn(
              "[PassiveBoundaryCapture] Capture failed:",
              result.error,
            );
            onCaptureError?.(result.error || "Unknown error");
          }
        })
        .catch((error) => {
          console.error("[PassiveBoundaryCapture] Unexpected error:", error);
          onCaptureError?.(error.message || "Unexpected error");
        })
        .finally(() => {
          isCapturingRef.current = false;
        });

      return true;
    },
    [
      enabled,
      captureIntervalMs,
      deviceId,
      sessionId,
      playerId,
      onCaptureSuccess,
      onCaptureError,
    ],
  );

  return {
    maybeCapture,
    get captureCount() {
      return captureCountRef.current;
    },
    get lastCaptureTime() {
      return lastCaptureTimeRef.current;
    },
    get isCapturing() {
      return isCapturingRef.current;
    },
  };
}
