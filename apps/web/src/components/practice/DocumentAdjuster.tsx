"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "../../../styled-system/css";

interface Corner {
  x: number;
  y: number;
}

interface DetectQuadsResult {
  detected: boolean;
  corners: Array<{ x: number; y: number }>;
  sourceCanvas: HTMLCanvasElement;
}

export interface DocumentAdjusterProps {
  /** The original captured image as a canvas */
  sourceCanvas: HTMLCanvasElement;
  /** Initial corner positions (in source image coordinates) */
  initialCorners: Corner[];
  /** Initial rotation in degrees (0, 90, 180, or 270) */
  initialRotation?: 0 | 90 | 180 | 270;
  /** Callback when user confirms with final File, corners, and rotation */
  onConfirm: (
    file: File,
    corners: Corner[],
    rotation: 0 | 90 | 180 | 270,
  ) => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Callback when user skips adjustment (uses original as-is) */
  onSkip?: () => void;
  /** OpenCV reference for transformations */
  cv: unknown;
  /** Optional function to re-detect quads in the source image (for autocrop) */
  detectQuadsInImage?: (canvas: HTMLCanvasElement) => DetectQuadsResult;
}

/**
 * DocumentAdjuster - Interstitial UI for adjusting document crop and rotation
 *
 * Displays the original image with draggable corner handles and a live preview
 * of the cropped/transformed result. Allows rotation in 90° increments.
 */
export function DocumentAdjuster({
  sourceCanvas,
  initialCorners,
  initialRotation = 0,
  onConfirm,
  onCancel,
  onSkip,
  cv,
  detectQuadsInImage,
}: DocumentAdjusterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [corners, setCorners] = useState<Corner[]>(initialCorners);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(initialRotation);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [autoDetectFailed, setAutoDetectFailed] = useState(false);
  const [detectedCorners, setDetectedCorners] = useState<Corner[] | null>(null);

  // Check if auto-detect would work on mount and store detected corners
  useEffect(() => {
    if (!detectQuadsInImage) return;
    const result = detectQuadsInImage(sourceCanvas);
    if (result.detected) {
      setDetectedCorners(result.corners);
    } else {
      setAutoDetectFailed(true);
      setDetectedCorners(null);
    }
  }, [detectQuadsInImage, sourceCanvas]);

  // Check if current corners match detected corners
  const cornersMatchDetected = !!(
    detectedCorners &&
    corners.length === 4 &&
    detectedCorners.length === 4 &&
    corners.every(
      (c, i) =>
        Math.abs(c.x - detectedCorners[i].x) < 1 &&
        Math.abs(c.y - detectedCorners[i].y) < 1,
    )
  );

  // Calculate display scale to fit source image in container
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const containerWidth = containerRef.current.clientWidth - 32; // padding
      const containerHeight = containerRef.current.clientHeight * 0.5; // half for source
      const scaleX = containerWidth / sourceCanvas.width;
      const scaleY = containerHeight / sourceCanvas.height;
      setDisplayScale(Math.min(scaleX, scaleY, 1));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [sourceCanvas.width, sourceCanvas.height]);

  // Update preview when corners or rotation change
  useEffect(() => {
    if (!previewCanvasRef.current || !cv) return;
    updatePreview();
  }, [corners, rotation, cv]);

  const updatePreview = useCallback(() => {
    const cvAny = cv as {
      imread: (canvas: HTMLCanvasElement) => unknown;
      Mat: new () => unknown;
      matFromArray: (
        rows: number,
        cols: number,
        type: number,
        data: number[],
      ) => unknown;
      Size: new (w: number, h: number) => unknown;
      Scalar: new () => unknown;
      getPerspectiveTransform: (src: unknown, dst: unknown) => unknown;
      warpPerspective: (
        src: unknown,
        dst: unknown,
        M: unknown,
        size: unknown,
        flags: number,
        borderMode: number,
        borderValue: unknown,
      ) => void;
      rotate: (src: unknown, dst: unknown, code: number) => void;
      imshow: (canvas: HTMLCanvasElement, mat: unknown) => void;
      CV_32FC2: number;
      INTER_LINEAR: number;
      BORDER_CONSTANT: number;
      ROTATE_90_CLOCKWISE: number;
      ROTATE_180: number;
      ROTATE_90_COUNTERCLOCKWISE: number;
    };

    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;

    // Helper to calculate distance
    const distance = (p1: Corner, p2: Corner) =>
      Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);

    try {
      // Calculate output dimensions from corners
      const width1 = distance(corners[0], corners[1]);
      const width2 = distance(corners[3], corners[2]);
      const height1 = distance(corners[0], corners[3]);
      const height2 = distance(corners[1], corners[2]);
      let outputWidth = Math.round((width1 + width2) / 2);
      let outputHeight = Math.round((height1 + height2) / 2);

      // Create perspective transform
      const srcPts = cvAny.matFromArray(4, 1, cvAny.CV_32FC2, [
        corners[0].x,
        corners[0].y,
        corners[1].x,
        corners[1].y,
        corners[2].x,
        corners[2].y,
        corners[3].x,
        corners[3].y,
      ]);

      const dstPts = cvAny.matFromArray(4, 1, cvAny.CV_32FC2, [
        0,
        0,
        outputWidth,
        0,
        outputWidth,
        outputHeight,
        0,
        outputHeight,
      ]);

      const M = cvAny.getPerspectiveTransform(srcPts, dstPts);
      const src = cvAny.imread(sourceCanvas);
      const warped = new cvAny.Mat();

      cvAny.warpPerspective(
        src,
        warped,
        M,
        new cvAny.Size(outputWidth, outputHeight),
        cvAny.INTER_LINEAR,
        cvAny.BORDER_CONSTANT,
        new cvAny.Scalar(),
      );

      // Apply rotation if needed
      let final = warped;
      if (rotation !== 0) {
        const rotated = new cvAny.Mat();
        const rotateCode =
          rotation === 90
            ? cvAny.ROTATE_90_CLOCKWISE
            : rotation === 180
              ? cvAny.ROTATE_180
              : cvAny.ROTATE_90_COUNTERCLOCKWISE;
        cvAny.rotate(warped, rotated, rotateCode);
        (warped as { delete: () => void }).delete();
        final = rotated;

        // Swap dimensions for 90/270 rotation
        if (rotation === 90 || rotation === 270) {
          [outputWidth, outputHeight] = [outputHeight, outputWidth];
        }
      }

      // Update preview canvas size and show result
      previewCanvas.width = outputWidth;
      previewCanvas.height = outputHeight;
      cvAny.imshow(previewCanvas, final);

      // Clean up
      (srcPts as { delete: () => void }).delete();
      (dstPts as { delete: () => void }).delete();
      (M as { delete: () => void }).delete();
      (src as { delete: () => void }).delete();
      (final as { delete: () => void }).delete();
    } catch (err) {
      console.warn("Preview update failed:", err);
    }
  }, [corners, rotation, sourceCanvas, cv]);

  // Handle corner dragging
  const handlePointerDown = useCallback(
    (index: number) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDraggingIndex(index);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingIndex === null) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (e.clientX - rect.left) / displayScale;
      const y = (e.clientY - rect.top) / displayScale;

      // Clamp to image bounds
      const clampedX = Math.max(0, Math.min(sourceCanvas.width, x));
      const clampedY = Math.max(0, Math.min(sourceCanvas.height, y));

      setCorners((prev) => {
        const next = [...prev];
        next[draggingIndex] = { x: clampedX, y: clampedY };
        return next;
      });
    },
    [draggingIndex, displayScale, sourceCanvas.width, sourceCanvas.height],
  );

  const handlePointerUp = useCallback(() => {
    setDraggingIndex(null);
  }, []);

  // Handle rotation
  const handleRotate = useCallback((direction: "cw" | "ccw") => {
    setRotation((prev) => {
      if (direction === "cw") {
        return ((prev + 90) % 360) as 0 | 90 | 180 | 270;
      } else {
        return ((prev - 90 + 360) % 360) as 0 | 90 | 180 | 270;
      }
    });
  }, []);

  // Handle autocrop - re-detect document edges and reset corners
  const handleAutocrop = useCallback(() => {
    if (!detectQuadsInImage) return;

    const result = detectQuadsInImage(sourceCanvas);
    if (result.detected && result.corners.length === 4) {
      setCorners(result.corners);
      // Reset rotation when auto-detecting
      setRotation(0);
      setAutoDetectFailed(false);
    } else {
      // Detection failed - disable the button
      setAutoDetectFailed(true);
    }
  }, [detectQuadsInImage, sourceCanvas]);

  // Handle confirm
  const handleConfirm = useCallback(async () => {
    if (!previewCanvasRef.current) return;
    setIsProcessing(true);

    try {
      // Force one final preview update
      updatePreview();

      const blob = await new Promise<Blob>((resolve, reject) => {
        previewCanvasRef.current!.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Failed to create blob"));
          },
          "image/jpeg",
          0.9,
        );
      });

      const file = new File([blob], `document-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });

      // Pass file, corners, and rotation to callback
      onConfirm(file, corners, rotation);
    } catch (err) {
      console.error("Failed to create file:", err);
    } finally {
      setIsProcessing(false);
    }
  }, [onConfirm, updatePreview, corners, rotation]);

  const displayWidth = sourceCanvas.width * displayScale;
  const displayHeight = sourceCanvas.height * displayScale;

  return (
    <div
      ref={containerRef}
      data-component="document-adjuster"
      className={css({
        position: "absolute",
        inset: 0,
        bg: "gray.900",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      })}
    >
      {/* Header */}
      <div
        className={css({
          p: 4,
          borderBottom: "1px solid",
          borderColor: "gray.700",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        })}
      >
        <button
          type="button"
          onClick={onCancel}
          className={css({
            px: 4,
            py: 2,
            color: "white",
            bg: "transparent",
            borderRadius: "md",
            cursor: "pointer",
            _hover: { bg: "gray.800" },
          })}
        >
          ← Back
        </button>
        <span className={css({ color: "white", fontWeight: "bold" })}>
          Adjust Document
        </span>
        <div className={css({ display: "flex", gap: 2 })}>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={isProcessing}
              data-action="skip-adjustment"
              className={css({
                px: 4,
                py: 2,
                bg: "gray.700",
                color: "white",
                borderRadius: "md",
                cursor: "pointer",
                _hover: { bg: "gray.600" },
                _disabled: { opacity: 0.5, cursor: "not-allowed" },
              })}
            >
              Skip
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            data-action="confirm-adjustment"
            className={css({
              px: 4,
              py: 2,
              bg: "green.500",
              color: "white",
              borderRadius: "md",
              fontWeight: "bold",
              cursor: "pointer",
              _hover: { bg: "green.600" },
              _disabled: { opacity: 0.5, cursor: "not-allowed" },
            })}
          >
            {isProcessing ? "Processing..." : "Done ✓"}
          </button>
        </div>
      </div>

      {/* Source image with corner handles */}
      <div
        className={css({
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          p: 4,
          gap: 4,
          overflow: "auto",
        })}
      >
        <div
          className={css({
            color: "gray.400",
            fontSize: "sm",
            textAlign: "center",
          })}
        >
          Drag corners to adjust crop area
        </div>

        {/* Source image container */}
        <div
          className={css({
            position: "relative",
            touchAction: "none",
          })}
          style={{ width: displayWidth, height: displayHeight }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Source image */}
          <canvas
            ref={(el) => {
              if (el) {
                el.width = sourceCanvas.width;
                el.height = sourceCanvas.height;
                const ctx = el.getContext("2d");
                ctx?.drawImage(sourceCanvas, 0, 0);
              }
            }}
            style={{
              width: displayWidth,
              height: displayHeight,
              borderRadius: "8px",
            }}
          />

          {/* Quad overlay */}
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: displayWidth,
              height: displayHeight,
              pointerEvents: "none",
            }}
          >
            {/* Darkened area outside quad */}
            <defs>
              <mask id="quadMask">
                <rect width="100%" height="100%" fill="white" />
                <polygon
                  points={corners
                    .map((c) => `${c.x * displayScale},${c.y * displayScale}`)
                    .join(" ")}
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.5)"
              mask="url(#quadMask)"
            />

            {/* Quad border */}
            <polygon
              points={corners
                .map((c) => `${c.x * displayScale},${c.y * displayScale}`)
                .join(" ")}
              fill="none"
              stroke="#22c55e"
              strokeWidth="2"
            />

            {/* Edge lines */}
            {corners.map((corner, i) => {
              const next = corners[(i + 1) % 4];
              return (
                <line
                  key={i}
                  x1={corner.x * displayScale}
                  y1={corner.y * displayScale}
                  x2={next.x * displayScale}
                  y2={next.y * displayScale}
                  stroke="#22c55e"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />
              );
            })}
          </svg>

          {/* Corner handles */}
          {corners.map((corner, index) => (
            <div
              key={index}
              data-element={`corner-handle-${index}`}
              onPointerDown={handlePointerDown(index)}
              className={css({
                position: "absolute",
                width: "40px",
                height: "40px",
                borderRadius: "full",
                bg: "green.500",
                border: "3px solid white",
                boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                cursor: "grab",
                transform: "translate(-50%, -50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "sm",
                touchAction: "none",
                _active: { cursor: "grabbing", bg: "green.600" },
              })}
              style={{
                left: corner.x * displayScale,
                top: corner.y * displayScale,
              }}
            >
              {index + 1}
            </div>
          ))}
        </div>

        {/* Rotation controls */}
        <div
          className={css({
            display: "flex",
            gap: 4,
            alignItems: "center",
          })}
        >
          <button
            type="button"
            onClick={() => handleRotate("ccw")}
            className={css({
              width: "48px",
              height: "48px",
              bg: "gray.700",
              color: "white",
              borderRadius: "full",
              fontSize: "2xl",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              _hover: { bg: "gray.600" },
            })}
            title="Rotate counter-clockwise"
          >
            ↺
          </button>
          <span
            className={css({
              color: "gray.400",
              fontSize: "sm",
              minWidth: "60px",
              textAlign: "center",
            })}
          >
            {rotation}°
          </span>
          <button
            type="button"
            onClick={() => handleRotate("cw")}
            className={css({
              width: "48px",
              height: "48px",
              bg: "gray.700",
              color: "white",
              borderRadius: "full",
              fontSize: "2xl",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              _hover: { bg: "gray.600" },
            })}
            title="Rotate clockwise"
          >
            ↻
          </button>
        </div>

        {/* Autocrop button - only show if detection function is available */}
        {detectQuadsInImage && (
          <button
            type="button"
            onClick={handleAutocrop}
            disabled={autoDetectFailed || cornersMatchDetected}
            data-action="autocrop"
            className={css({
              px: 4,
              py: 2,
              bg: autoDetectFailed
                ? "gray.600"
                : cornersMatchDetected
                  ? "green.600"
                  : "blue.600",
              color: "white",
              borderRadius: "lg",
              fontSize: "sm",
              fontWeight: "medium",
              cursor:
                autoDetectFailed || cornersMatchDetected
                  ? "default"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 2,
              opacity: autoDetectFailed ? 0.6 : 1,
              _hover:
                autoDetectFailed || cornersMatchDetected
                  ? {}
                  : { bg: "blue.500" },
            })}
            title={
              autoDetectFailed
                ? "No document edges detected"
                : cornersMatchDetected
                  ? "Document edges are currently applied"
                  : "Re-detect document edges automatically"
            }
          >
            <span>{cornersMatchDetected ? "✓" : "🔍"}</span>
            <span>
              {autoDetectFailed
                ? "No edges found"
                : cornersMatchDetected
                  ? "Edges detected"
                  : "Auto-detect edges"}
            </span>
          </button>
        )}

        {/* Preview */}
        <div className={css({ color: "gray.400", fontSize: "sm", mt: 2 })}>
          Preview
        </div>
        <div
          className={css({
            maxWidth: "100%",
            maxHeight: "200px",
            overflow: "hidden",
            borderRadius: "lg",
            border: "2px solid",
            borderColor: "gray.600",
          })}
        >
          <canvas
            ref={previewCanvasRef}
            className={css({
              maxWidth: "100%",
              maxHeight: "200px",
              objectFit: "contain",
            })}
          />
        </div>
      </div>
    </div>
  );
}

export default DocumentAdjuster;
