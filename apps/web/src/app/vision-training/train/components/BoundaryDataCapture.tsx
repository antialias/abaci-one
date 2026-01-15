"use client";

import { useCallback, useRef, useState } from "react";
import { css } from "../../../../../styled-system/css";
import {
  CameraCapture,
  type CameraSource,
} from "@/components/vision/CameraCapture";
import { saveBoundarySample } from "@/lib/vision/saveBoundarySample";
import type { CalibrationGrid } from "@/types/vision";

interface BoundaryDataCaptureProps {
  /** Called when samples are saved successfully */
  onSamplesCollected: () => void;
}

/** Minimum time between auto-captures (ms) - keep low to maximize training data */
const AUTO_CAPTURE_COOLDOWN_MS = 200;

/**
 * Capture training data for the boundary detector model.
 *
 * Unlike TrainingDataCapture which slices images into columns for digit classification,
 * this component captures FULL frames with their marker corner positions.
 * These samples train a model to detect abacus boundaries without markers.
 *
 * CRITICAL: This component AUTO-CAPTURES when all 4 markers are detected.
 * Marker detection is ephemeral - by the time a user could click a button,
 * the video frame has changed and markers may be gone. So we capture
 * immediately when markers are found, with rate limiting to prevent spam.
 *
 * The captured data includes:
 * - The raw video frame (before perspective correction)
 * - The detected marker corner positions (ground truth for training)
 */
export function BoundaryDataCapture({
  onSamplesCollected,
}: BoundaryDataCaptureProps) {
  // Capture state
  const [isAutoCapturing, setIsAutoCapturing] = useState(false);
  const [lastCaptureStatus, setLastCaptureStatus] = useState<{
    success: boolean;
    message: string;
    timestamp: number;
  } | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [cameraSource, setCameraSource] = useState<CameraSource>("local");
  const [markersCurrentlyVisible, setMarkersCurrentlyVisible] = useState(false);

  const captureElementRef = useRef<
    HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | null
  >(null);
  const lastCaptureTimeRef = useRef<number>(0);
  const isCapturingRef = useRef(false);

  // Handle video/image/canvas element from camera
  const handleCapture = useCallback(
    (element: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => {
      captureElementRef.current = element;
    },
    [],
  );

  /**
   * Auto-capture when calibration changes (markers detected).
   * This is called on every frame where markers are found - we rate-limit here.
   */
  const handleCalibrationChange = useCallback(
    async (calibration: CalibrationGrid | null) => {
      // Track marker visibility for UI
      const hasCorners = calibration?.corners != null;
      setMarkersCurrentlyVisible(hasCorners);

      // Only proceed if we have valid corners and auto-capture is enabled
      if (!hasCorners || !isAutoCapturing) return;

      // Rate limit - don't capture more than once per cooldown period
      const now = Date.now();
      if (now - lastCaptureTimeRef.current < AUTO_CAPTURE_COOLDOWN_MS) return;

      // Prevent concurrent captures
      if (isCapturingRef.current) return;

      const element = captureElementRef.current;
      if (!element) return;

      // For video, check if it's playing
      if (element instanceof HTMLVideoElement && element.readyState < 2) return;

      // For image, check if it's loaded
      if (
        element instanceof HTMLImageElement &&
        (!element.complete || element.naturalWidth === 0)
      )
        return;

      // For canvas, check dimensions
      if (
        element instanceof HTMLCanvasElement &&
        (element.width === 0 || element.height === 0)
      )
        return;

      // Mark as capturing
      isCapturingRef.current = true;
      lastCaptureTimeRef.current = now;

      try {
        // Create a canvas to capture the raw frame
        const canvas = document.createElement("canvas");
        let width: number;
        let height: number;

        if (element instanceof HTMLVideoElement) {
          width = element.videoWidth;
          height = element.videoHeight;
        } else if (element instanceof HTMLCanvasElement) {
          width = element.width;
          height = element.height;
        } else {
          width = element.naturalWidth;
          height = element.naturalHeight;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to create canvas context");
        ctx.drawImage(element, 0, 0);

        // Convert to base64 PNG (saveBoundarySample handles the data URL prefix)
        const frameDataUrl = canvas.toDataURL("image/png");

        // Use shared saveBoundarySample utility
        // CRITICAL: Use the corners from THIS callback, not stale state
        const result = await saveBoundarySample({
          imageData: frameDataUrl,
          corners: calibration.corners!,
          frameWidth: width,
          frameHeight: height,
          deviceId: "explicit-training",
        });

        if (result.success) {
          setCaptureCount((c) => c + 1);
          setLastCaptureStatus({
            success: true,
            message: "Auto-captured frame",
            timestamp: now,
          });
          onSamplesCollected();
        } else {
          throw new Error(result.error || "Failed to save");
        }
      } catch (error) {
        console.error("[BoundaryDataCapture] Auto-capture error:", error);
        setLastCaptureStatus({
          success: false,
          message: error instanceof Error ? error.message : "Capture failed",
          timestamp: now,
        });
      } finally {
        isCapturingRef.current = false;
      }
    },
    [isAutoCapturing, onSamplesCollected],
  );

  // Determine if capture is possible
  const canCapture = cameraSource === "local" || isPhoneConnected;

  return (
    <div
      data-component="boundary-data-capture"
      className={css({
        p: 3,
        bg: "purple.900/20",
        border: "1px solid",
        borderColor: "purple.700/50",
        borderRadius: "lg",
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 2,
          mb: 3,
        })}
      >
        <span>🎯</span>
        <span className={css({ fontWeight: "medium", color: "purple.300" })}>
          Capture Boundary Frames
        </span>
        {captureCount > 0 && (
          <span
            className={css({ fontSize: "xs", color: "green.400", ml: "auto" })}
          >
            +{captureCount} this session
          </span>
        )}
      </div>

      {/* Camera capture component - no rectified view, we want raw frames */}
      <CameraCapture
        initialSource="local"
        onCapture={handleCapture}
        onSourceChange={setCameraSource}
        onPhoneConnected={setIsPhoneConnected}
        compact
        enableMarkerDetection
        columnCount={4}
        onCalibrationChange={handleCalibrationChange}
        showRectifiedView={false}
        forceRawMode
      />

      {/* Capture controls - show when camera is ready */}
      {canCapture && (
        <div className={css({ mt: 3 })}>
          {/* Auto-capture toggle */}
          <button
            type="button"
            onClick={() => setIsAutoCapturing(!isAutoCapturing)}
            className={css({
              width: "100%",
              py: 3,
              bg: isAutoCapturing ? "red.600" : "green.600",
              color: "white",
              borderRadius: "md",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "md",
              _hover: { bg: isAutoCapturing ? "red.500" : "green.500" },
              transition: "all 0.2s",
            })}
          >
            {isAutoCapturing ? "⏹ Stop Capturing" : "▶ Start Auto-Capture"}
          </button>

          {/* Status panel */}
          <div
            className={css({
              mt: 2,
              p: 2,
              bg: isAutoCapturing
                ? markersCurrentlyVisible
                  ? "green.900/30"
                  : "yellow.900/30"
                : "gray.800",
              border: "1px solid",
              borderColor: isAutoCapturing
                ? markersCurrentlyVisible
                  ? "green.700/50"
                  : "yellow.700/50"
                : "gray.700",
              borderRadius: "md",
              fontSize: "sm",
            })}
          >
            {isAutoCapturing ? (
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: 1,
                })}
              >
                {/* Live marker status */}
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    color: markersCurrentlyVisible ? "green.300" : "yellow.300",
                  })}
                >
                  {markersCurrentlyVisible ? (
                    <>
                      <span
                        className={css({
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          borderRadius: "full",
                          bg: "green.400",
                          animation: "pulse 1s infinite",
                        })}
                      />
                      <span>Markers visible — auto-capturing</span>
                    </>
                  ) : (
                    <>
                      <span>⚠️</span>
                      <span>Waiting for markers...</span>
                    </>
                  )}
                </div>

                {/* Last capture status */}
                {lastCaptureStatus && (
                  <div
                    className={css({
                      fontSize: "xs",
                      color: lastCaptureStatus.success
                        ? "green.400"
                        : "red.400",
                    })}
                  >
                    {lastCaptureStatus.success ? "✓" : "✗"}{" "}
                    {lastCaptureStatus.message}
                  </div>
                )}
              </div>
            ) : (
              <div className={css({ color: "gray.400", textAlign: "center" })}>
                Click "Start Auto-Capture" then point camera at markers
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className={css({ fontSize: "xs", color: "gray.500", mt: 3 })}>
        <p className={css({ fontWeight: "medium", mb: 1 })}>How it works:</p>
        <p>1. Click "Start Auto-Capture" to begin</p>
        <p>2. Point camera at abacus with all 4 ArUco markers visible</p>
        <p>3. Frames auto-capture rapidly (~5/sec) when markers detected</p>
        <p>4. Move the abacus/camera to vary angle, lighting, distance</p>
        <p>5. Click "Stop Capturing" when done</p>
      </div>
    </div>
  );
}
