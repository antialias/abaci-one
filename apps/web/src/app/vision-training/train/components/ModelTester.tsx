"use client";

import { useCallback, useRef, useState } from "react";
import { css } from "../../../../../styled-system/css";
import {
  CameraCapture,
  type CameraSource,
} from "@/components/vision/CameraCapture";
import { useColumnClassifier } from "@/hooks/useColumnClassifier";
import type { CalibrationGrid } from "@/types/vision";
import type { BeadPositionResult } from "@/lib/vision/columnClassifier";

interface ModelTesterProps {
  /** Number of physical abacus columns (default 4) */
  columnCount?: number;
}

/**
 * Visual representation of bead positions for a single column
 */
function BeadPositionDisplay({
  beadPosition,
  digit,
}: {
  beadPosition: BeadPositionResult;
  digit: number;
}) {
  const { heaven, earth, heavenConfidence, earthConfidence } = beadPosition;

  // Color based on confidence
  const heavenColor =
    heavenConfidence > 0.8
      ? "green.400"
      : heavenConfidence > 0.5
        ? "yellow.400"
        : "red.400";
  const earthColor =
    earthConfidence > 0.8
      ? "green.400"
      : earthConfidence > 0.5
        ? "yellow.400"
        : "red.400";

  return (
    <div
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        p: 2,
        bg: "gray.800",
        borderRadius: "md",
        minWidth: "60px",
      })}
    >
      {/* Heaven bead */}
      <div
        className={css({
          fontSize: "lg",
          opacity: heaven ? 1 : 0.3,
          transition: "opacity 0.2s",
        })}
        title={`Heaven: ${heaven ? "UP" : "DOWN"} (${(heavenConfidence * 100).toFixed(0)}%)`}
      >
        ●
      </div>

      {/* Reckoning bar */}
      <div
        className={css({
          width: "100%",
          height: "2px",
          bg: "gray.600",
          my: 0.5,
        })}
      />

      {/* Earth beads (4 positions) */}
      {[3, 2, 1, 0].map((pos) => (
        <div
          key={pos}
          className={css({
            fontSize: "lg",
            opacity: pos < earth ? 1 : 0.3,
            transition: "opacity 0.2s",
          })}
          title={`Earth ${pos + 1}: ${pos < earth ? "UP" : "DOWN"}`}
        >
          ●
        </div>
      ))}

      {/* Digit value */}
      <div
        className={css({
          mt: 1,
          fontSize: "xl",
          fontWeight: "bold",
          fontFamily: "mono",
          color: "white",
        })}
      >
        {digit}
      </div>

      {/* Confidence indicators */}
      <div
        className={css({
          fontSize: "2xs",
          color: "gray.500",
          textAlign: "center",
        })}
      >
        <span className={css({ color: heavenColor })}>
          H:{(heavenConfidence * 100).toFixed(0)}%
        </span>
        <span className={css({ mx: 0.5 })}>•</span>
        <span className={css({ color: earthColor })}>
          E:{(earthConfidence * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Test the trained model with live camera feed
 *
 * Shows the camera with marker detection, runs inference on each frame,
 * and displays the detected value with confidence.
 */
/** Results from classification */
interface ClassificationResults {
  digits: number[];
  confidences: number[];
  beadPositions: BeadPositionResult[];
}

/** Debug info about column images */
interface ColumnDebugInfo {
  dataUrls: string[];
  widths: number[];
  heights: number[];
  timestamp: number;
  canvasSize: { width: number; height: number } | null;
}

export function ModelTester({ columnCount = 4 }: ModelTesterProps) {
  const [cameraSource, setCameraSource] = useState<CameraSource>("local");
  const [isPhoneConnected, setIsPhoneConnected] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null);
  const [results, setResults] = useState<ClassificationResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [columnDebug, setColumnDebug] = useState<ColumnDebugInfo | null>(null);
  const [showDebug, setShowDebug] = useState(true);

  const captureElementRef = useRef<HTMLImageElement | HTMLVideoElement | null>(
    null,
  );
  const inferenceLoopRef = useRef<number | null>(null);
  const lastInferenceTimeRef = useRef<number>(0);
  const [inferenceCount, setInferenceCount] = useState(0);
  const isRunningInferenceRef = useRef(false); // Prevent overlapping inference calls

  const classifier = useColumnClassifier();

  // Track canvas element separately for continuous updates
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle capture from camera
  const handleCapture = useCallback(
    (element: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement) => {
      // For canvas, keep a direct reference (it updates continuously with rectified view)
      if (element instanceof HTMLCanvasElement) {
        canvasRef.current = element;
        captureElementRef.current = null; // Clear the image ref
      } else {
        canvasRef.current = null;
        captureElementRef.current = element;
      }
    },
    [],
  );

  // Run inference on current frame
  const runInference = useCallback(async () => {
    // Prevent overlapping inference calls
    if (isRunningInferenceRef.current) {
      console.log("[ModelTester] Skipping inference - previous still running");
      return;
    }
    isRunningInferenceRef.current = true;

    // Check for canvas first (rectified view), then video/image
    const canvas = canvasRef.current;
    const element = captureElementRef.current;

    if (!canvas && !element) {
      isRunningInferenceRef.current = false;
      return;
    }

    // For video, check if ready
    if (element instanceof HTMLVideoElement && element.readyState < 2) {
      isRunningInferenceRef.current = false;
      return;
    }
    // For image, check if loaded
    if (
      element instanceof HTMLImageElement &&
      (!element.complete || element.naturalWidth === 0)
    ) {
      isRunningInferenceRef.current = false;
      return;
    }

    try {
      // Import frame processor dynamically
      const { processImageFrame } = await import("@/lib/vision/frameProcessor");

      // Create image from current source
      let imageElement: HTMLImageElement;

      if (canvas) {
        // Read directly from the rectified canvas (which updates continuously)
        // Use PNG to avoid JPEG compression artifacts
        imageElement = new Image();
        imageElement.src = canvas.toDataURL("image/png");
        await new Promise((resolve, reject) => {
          imageElement.onload = resolve;
          imageElement.onerror = reject;
        });
      } else if (element instanceof HTMLVideoElement) {
        // For video, draw current frame to temp canvas
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = element.videoWidth;
        tempCanvas.height = element.videoHeight;
        const ctx = tempCanvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(element, 0, 0);

        imageElement = new Image();
        imageElement.src = tempCanvas.toDataURL("image/jpeg");
        await new Promise((resolve, reject) => {
          imageElement.onload = resolve;
          imageElement.onerror = reject;
        });
      } else {
        imageElement = element as HTMLImageElement;
      }

      // Slice into columns
      // IMPORTANT: If using rectified canvas, DON'T apply calibration again -
      // the canvas is already the perspective-corrected ROI
      const useCalibration = canvas ? null : calibration;
      const columnImages = processImageFrame(
        imageElement,
        useCalibration,
        columnCount,
      );

      if (columnImages.length === 0) return;

      // Convert column images to data URLs for debug display
      const debugInfo: ColumnDebugInfo = {
        dataUrls: [],
        widths: [],
        heights: [],
        timestamp: Date.now(),
        canvasSize: canvas
          ? { width: canvas.width, height: canvas.height }
          : null,
      };

      // Calculate average pixel value for each column to verify they're different
      const columnAvgs: number[] = [];
      for (const imageData of columnImages) {
        const debugCanvas = document.createElement("canvas");
        debugCanvas.width = imageData.width;
        debugCanvas.height = imageData.height;
        const ctx = debugCanvas.getContext("2d");
        if (ctx) {
          ctx.putImageData(imageData, 0, 0);
          debugInfo.dataUrls.push(debugCanvas.toDataURL("image/png"));
          debugInfo.widths.push(imageData.width);
          debugInfo.heights.push(imageData.height);

          // Calculate average grayscale value
          let sum = 0;
          for (let i = 0; i < imageData.data.length; i += 4) {
            sum += imageData.data[i]; // R channel (already grayscale so R=G=B)
          }
          const avg = sum / (imageData.data.length / 4);
          columnAvgs.push(avg);
        }
      }
      console.log(
        "[ModelTester] Column averages:",
        columnAvgs.map((a) => a.toFixed(1)),
      );
      console.log(
        "[ModelTester] Canvas size:",
        debugInfo.canvasSize,
        "columns:",
        columnImages.length,
        "size:",
        debugInfo.widths[0],
        "x",
        debugInfo.heights[0],
      );
      setColumnDebug(debugInfo);

      // Run classification
      console.log(
        "[ModelTester] Running classification on",
        columnImages.length,
        "columns",
      );
      const result = await classifier.classifyColumns(columnImages);
      console.log("[ModelTester] Classification result:", result);

      if (result) {
        setResults(result);
        setInferenceCount((c) => c + 1);
      } else {
        console.warn("[ModelTester] No result from classifier");
      }
    } catch (err) {
      console.error("[ModelTester] Inference error:", err);
    } finally {
      isRunningInferenceRef.current = false;
    }
  }, [calibration, columnCount, classifier]);

  // Start/stop inference loop
  const toggleTesting = useCallback(async () => {
    if (isRunning) {
      // Stop
      if (inferenceLoopRef.current) {
        cancelAnimationFrame(inferenceLoopRef.current);
        inferenceLoopRef.current = null;
      }
      setIsRunning(false);
      setResults(null);
      setInferenceCount(0);
    } else {
      // If model was previously unavailable, reset and try again
      if (classifier.isModelUnavailable) {
        console.log("[ModelTester] Resetting model state to retry loading...");
        await classifier.reset();
      }

      // Start
      setIsRunning(true);

      const loop = () => {
        const now = performance.now();
        // Run inference at ~10 FPS
        if (now - lastInferenceTimeRef.current > 100) {
          lastInferenceTimeRef.current = now;
          runInference();
        }
        inferenceLoopRef.current = requestAnimationFrame(loop);
      };

      loop();
    }
  }, [isRunning, runInference, classifier]);

  // Check if camera is ready
  const canTest = cameraSource === "local" || isPhoneConnected;

  return (
    <div
      data-component="model-tester"
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
        <span>🔬</span>
        <span className={css({ fontWeight: "medium", color: "purple.300" })}>
          Test Model
        </span>
        <span className={css({ fontSize: "xs", ml: "auto" })}>
          {classifier.isModelLoaded ? (
            <span className={css({ color: "green.400" })}>Model loaded</span>
          ) : classifier.isModelUnavailable ? (
            <span className={css({ color: "red.400" })}>
              Model incompatible
            </span>
          ) : classifier.isLoading ? (
            <span className={css({ color: "yellow.400" })}>Loading...</span>
          ) : null}
        </span>
      </div>

      {/* Model incompatibility warning */}
      {classifier.isModelUnavailable && (
        <div
          className={css({
            p: 3,
            mb: 3,
            bg: "red.900/30",
            border: "1px solid",
            borderColor: "red.700",
            borderRadius: "lg",
            fontSize: "sm",
            color: "red.300",
          })}
        >
          <div className={css({ fontWeight: "medium", mb: 1 })}>
            Model needs retraining
          </div>
          <div className={css({ fontSize: "xs", color: "gray.400" })}>
            The existing model uses the old architecture. Train a new model with
            the two-head bead position detection to use this feature.
          </div>
        </div>
      )}

      {/* Camera */}
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

      {/* Debug: Column Images being fed to model */}
      {isRunning && columnDebug && showDebug && (
        <div
          className={css({
            mt: 3,
            p: 3,
            bg: "gray.900",
            border: "1px solid",
            borderColor: "orange.700",
            borderRadius: "lg",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 2,
              mb: 2,
            })}
          >
            <span>🔍</span>
            <span
              className={css({
                fontWeight: "medium",
                color: "orange.300",
                fontSize: "sm",
              })}
            >
              Debug: Column Images Fed to Model
            </span>
            <button
              type="button"
              onClick={() => setShowDebug(false)}
              className={css({
                ml: "auto",
                px: 2,
                py: 0.5,
                fontSize: "xs",
                bg: "gray.700",
                border: "none",
                borderRadius: "sm",
                color: "gray.400",
                cursor: "pointer",
              })}
            >
              Hide
            </button>
          </div>
          <div
            className={css({
              display: "flex",
              gap: 2,
              flexWrap: "wrap",
              justifyContent: "center",
            })}
          >
            {columnDebug.dataUrls.map((url, idx) => (
              <div
                key={idx}
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  bg: "black",
                  p: 1,
                  borderRadius: "sm",
                })}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Column ${idx}`}
                  className={css({
                    border: "1px solid",
                    borderColor: "gray.600",
                    imageRendering: "pixelated",
                  })}
                  style={{
                    width: columnDebug.widths[idx] * 2, // Scale up for visibility
                    height: columnDebug.heights[idx] * 2,
                  }}
                />
                <span
                  className={css({ fontSize: "2xs", color: "gray.500", mt: 1 })}
                >
                  {columnDebug.widths[idx]}×{columnDebug.heights[idx]}
                </span>
                {results && results.digits[idx] !== undefined && (
                  <span
                    className={css({
                      fontSize: "xs",
                      color: "white",
                      fontWeight: "bold",
                      fontFamily: "mono",
                    })}
                  >
                    → {results.digits[idx]}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div
            className={css({
              fontSize: "2xs",
              color: "gray.500",
              mt: 2,
              textAlign: "center",
            })}
          >
            Model expects 64×128 grayscale • Canvas:{" "}
            {columnDebug.canvasSize?.width}×{columnDebug.canvasSize?.height} •
            Inferences: {inferenceCount} • Updated:{" "}
            {new Date(columnDebug.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Show debug toggle when hidden */}
      {isRunning && columnDebug && !showDebug && (
        <button
          type="button"
          onClick={() => setShowDebug(true)}
          className={css({
            mt: 2,
            px: 2,
            py: 1,
            fontSize: "xs",
            bg: "gray.800",
            border: "1px solid",
            borderColor: "gray.600",
            borderRadius: "sm",
            color: "gray.400",
            cursor: "pointer",
            width: "100%",
          })}
        >
          🔍 Show Debug Images
        </button>
      )}

      {/* Results display */}
      {isRunning && results && (
        <div
          className={css({
            mt: 3,
            p: 4,
            bg: "gray.900",
            borderRadius: "lg",
          })}
        >
          {/* Bead position columns */}
          <div
            className={css({
              display: "flex",
              justifyContent: "center",
              gap: 2,
              flexWrap: "wrap",
            })}
          >
            {results.beadPositions.map((beadPos, idx) => (
              <BeadPositionDisplay
                key={idx}
                beadPosition={beadPos}
                digit={results.digits[idx]}
              />
            ))}
          </div>

          {/* Combined value */}
          <div className={css({ mt: 3, textAlign: "center" })}>
            <div
              className={css({
                fontSize: "3xl",
                fontWeight: "bold",
                fontFamily: "mono",
                color: "white",
              })}
            >
              {results.digits.reduce((acc, d) => acc * 10 + d, 0)}
            </div>
            <div className={css({ fontSize: "xs", color: "gray.500" })}>
              Combined value (heaven×5 + earth per column)
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      {canTest && (
        <div
          className={css({ mt: 3, display: "flex", justifyContent: "center" })}
        >
          <button
            type="button"
            onClick={toggleTesting}
            disabled={classifier.isLoading}
            className={css({
              px: 6,
              py: 2,
              bg: isRunning ? "red.600" : "purple.600",
              color: "white",
              borderRadius: "md",
              border: "none",
              cursor: "pointer",
              fontWeight: "medium",
              _hover: { bg: isRunning ? "red.500" : "purple.500" },
              _disabled: { opacity: 0.5, cursor: "not-allowed" },
            })}
          >
            {classifier.isLoading
              ? "Loading..."
              : isRunning
                ? "Stop Testing"
                : "Start Testing"}
          </button>
        </div>
      )}

      {/* Calibration status */}
      <div
        className={css({
          fontSize: "xs",
          color: "gray.500",
          mt: 3,
          textAlign: "center",
        })}
      >
        {calibration ? (
          <span className={css({ color: "green.400" })}>
            ✓ Markers detected
          </span>
        ) : (
          <span>Point camera at abacus with markers</span>
        )}
      </div>
    </div>
  );
}
