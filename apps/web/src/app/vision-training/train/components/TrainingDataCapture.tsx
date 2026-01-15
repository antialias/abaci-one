"use client";

import { useCallback, useRef, useState } from "react";
import { css } from "../../../../../styled-system/css";
import {
  CameraCapture,
  type CameraSource,
} from "@/components/vision/CameraCapture";
import type { CalibrationGrid } from "@/types/vision";

interface TrainingDataCaptureProps {
  /** Called when samples are saved successfully */
  onSamplesCollected: () => void;
  /** Number of physical abacus columns (default 4) */
  columnCount?: number;
}

/**
 * Inline training data capture component for the training wizard
 *
 * Uses the reusable CameraCapture component which supports both
 * local device camera and phone camera via QR code.
 *
 * Captures abacus images and saves them as training data for the column classifier.
 */
export function TrainingDataCapture({
  onSamplesCollected,
  columnCount = 4,
}: TrainingDataCaptureProps) {
  // Capture state
  const [inputValue, setInputValue] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastCaptureStatus, setLastCaptureStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [cameraSource, setCameraSource] = useState<CameraSource>("local");
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const captureElementRef = useRef<HTMLImageElement | HTMLVideoElement | null>(
    null,
  );

  // Handle capture from camera
  const handleCapture = useCallback(
    (element: HTMLImageElement | HTMLVideoElement) => {
      captureElementRef.current = element;
    },
    [],
  );

  // Capture training data
  const captureTrainingData = useCallback(async () => {
    const value = parseInt(inputValue, 10);
    if (Number.isNaN(value) || value < 0) {
      setLastCaptureStatus({
        success: false,
        message: "Enter a valid non-negative number",
      });
      return;
    }

    // Get the current capture element
    const element = captureElementRef.current;
    if (!element) {
      setLastCaptureStatus({
        success: false,
        message: "No camera frame available",
      });
      return;
    }

    // For video, check if it's playing
    if (element instanceof HTMLVideoElement) {
      if (element.readyState < 2) {
        setLastCaptureStatus({ success: false, message: "Camera not ready" });
        return;
      }
    }

    // For image, check if it's loaded
    if (element instanceof HTMLImageElement) {
      if (!element.complete || element.naturalWidth === 0) {
        setLastCaptureStatus({
          success: false,
          message: "Camera frame not ready",
        });
        return;
      }
    }

    setIsCapturing(true);
    setLastCaptureStatus(null);

    try {
      // Import frame processor dynamically
      const { processImageFrame } = await import("@/lib/vision/frameProcessor");
      const { imageDataToBase64Png } = await import(
        "@/lib/vision/trainingData"
      );

      // For video elements, we need to draw to a temp image first
      let imageElement: HTMLImageElement;
      if (element instanceof HTMLVideoElement) {
        // Create a canvas to capture the video frame
        const canvas = document.createElement("canvas");
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to create canvas context");
        }
        ctx.drawImage(element, 0, 0);

        // Convert canvas to image
        imageElement = new Image();
        imageElement.src = canvas.toDataURL("image/jpeg");
        await new Promise((resolve, reject) => {
          imageElement.onload = resolve;
          imageElement.onerror = reject;
        });
      } else {
        imageElement = element;
      }

      // Slice the image into columns (using calibration if available for perspective correction)
      const columnImages = processImageFrame(
        imageElement,
        calibration,
        columnCount,
      );

      if (columnImages.length === 0) {
        throw new Error("Failed to slice image into columns");
      }

      // Convert to base64 and prepare request
      const columns = columnImages.map((imgData: ImageData, index: number) => ({
        columnIndex: index,
        imageData: imageDataToBase64Png(imgData),
      }));

      // Send to collect API
      const response = await fetch("/api/vision-training/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columns,
          correctAnswer: value,
          playerId: "training-wizard",
          sessionId: "manual-capture",
        }),
      });

      const result = await response.json();

      if (result.success) {
        setCaptureCount((c) => c + 1);
        setLastCaptureStatus({
          success: true,
          message: `Saved ${result.savedCount} columns for "${value}"`,
        });
        setInputValue("");
        // Focus input for next capture
        inputRef.current?.focus();
        onSamplesCollected();
      } else {
        throw new Error(result.error || "Failed to save");
      }
    } catch (error) {
      console.error("[TrainingDataCapture] Error:", error);
      setLastCaptureStatus({
        success: false,
        message: error instanceof Error ? error.message : "Failed to capture",
      });
    } finally {
      setIsCapturing(false);
    }
  }, [inputValue, columnCount, calibration, onSamplesCollected]);

  // Handle keyboard shortcut (Enter to capture)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isCapturing && inputValue) {
        captureTrainingData();
      }
    },
    [captureTrainingData, isCapturing, inputValue],
  );

  // Determine if capture is possible
  const canCapture = cameraSource === "local" || isPhoneConnected;

  return (
    <div
      data-component="training-data-capture"
      className={css({
        p: 3,
        bg: "blue.900/20",
        border: "1px solid",
        borderColor: "blue.700/50",
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
        <span>📸</span>
        <span className={css({ fontWeight: "medium", color: "blue.300" })}>
          Capture Training Data
        </span>
        {captureCount > 0 && (
          <span
            className={css({ fontSize: "xs", color: "green.400", ml: "auto" })}
          >
            +{captureCount} this session
          </span>
        )}
      </div>

      {/* Camera capture component */}
      <CameraCapture
        initialSource="local"
        onCapture={handleCapture}
        onSourceChange={setCameraSource}
        onPhoneConnected={setIsPhoneConnected}
        compact
        enableMarkerDetection
        columnCount={columnCount}
        onCalibrationChange={setCalibration}
        showRectifiedView
      />

      {/* Capture controls - show when camera is ready */}
      {canCapture && (
        <div className={css({ mt: 3 })}>
          <div className={css({ display: "flex", gap: 2, mb: 2 })}>
            <input
              ref={inputRef}
              type="number"
              min="0"
              placeholder={`Number (${columnCount} columns)`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCapturing}
              className={css({
                flex: 1,
                px: 3,
                py: 2,
                bg: "gray.700",
                border: "1px solid",
                borderColor: "gray.600",
                borderRadius: "md",
                color: "gray.100",
                fontSize: "md",
                fontFamily: "mono",
                _placeholder: { color: "gray.500" },
                _focus: { outline: "none", borderColor: "blue.500" },
                _disabled: { opacity: 0.5 },
              })}
            />
            <button
              type="button"
              onClick={captureTrainingData}
              disabled={isCapturing || !inputValue}
              className={css({
                px: 4,
                py: 2,
                bg: "green.600",
                color: "white",
                borderRadius: "md",
                border: "none",
                cursor: "pointer",
                fontWeight: "medium",
                whiteSpace: "nowrap",
                _hover: { bg: "green.500" },
                _disabled: { opacity: 0.5, cursor: "not-allowed" },
              })}
            >
              {isCapturing ? "..." : "Capture"}
            </button>
          </div>

          {/* Status message */}
          {lastCaptureStatus && (
            <div
              className={css({
                fontSize: "sm",
                color: lastCaptureStatus.success ? "green.400" : "red.400",
                display: "flex",
                alignItems: "center",
                gap: 1,
              })}
            >
              {lastCaptureStatus.success ? "✓" : "✗"}{" "}
              {lastCaptureStatus.message}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className={css({ fontSize: "xs", color: "gray.500", mt: 3 })}>
        <p>1. Point camera at your abacus with printed markers</p>
        <p>2. Wait for all 4 markers to be detected (green dots)</p>
        <p>3. Set beads to show a number</p>
        <p>4. Type that number and press Capture (or Enter)</p>
      </div>

      {/* Calibration status */}
      {calibration && (
        <div
          className={css({
            fontSize: "xs",
            color: "green.400",
            mt: 2,
            display: "flex",
            alignItems: "center",
            gap: 1,
          })}
        >
          <span>✓</span>
          <span>Markers detected - using perspective correction</span>
        </div>
      )}
    </div>
  );
}
