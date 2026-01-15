"use client";

import type { ReactNode } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { css } from "../../../styled-system/css";
import type { CalibrationGrid, Point, QuadCorners, ROI } from "@/types/vision";

export interface CalibrationOverlayProps {
  /** Number of columns to configure */
  columnCount: number;
  /** Video dimensions */
  videoWidth: number;
  videoHeight: number;
  /** Container dimensions (displayed size) */
  containerWidth: number;
  containerHeight: number;
  /** Current calibration (if any) */
  initialCalibration?: CalibrationGrid | null;
  /** Called when calibration is completed */
  onComplete: (grid: CalibrationGrid) => void;
  /** Called when calibration is cancelled */
  onCancel: () => void;
  /** Video element for live preview */
  videoElement?: HTMLVideoElement | null;
  /** Called when corners change (for external preview) */
  onCornersChange?: (corners: QuadCorners) => void;
}

/** Imperative handle for controlling CalibrationOverlay from parent */
export interface CalibrationOverlayHandle {
  /** Rotate the calibration quad 90° in the given direction */
  rotate: (direction: "left" | "right") => void;
  /** Complete calibration with current settings */
  complete: () => void;
}

type CornerKey = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
type DragTarget = CornerKey | "quad" | `divider-${number}` | null;

/**
 * Convert QuadCorners to legacy ROI format (bounding box)
 */
function cornersToROI(corners: QuadCorners): ROI {
  const minX = Math.min(corners.topLeft.x, corners.bottomLeft.x);
  const maxX = Math.max(corners.topRight.x, corners.bottomRight.x);
  const minY = Math.min(corners.topLeft.y, corners.topRight.y);
  const maxY = Math.max(corners.bottomLeft.y, corners.bottomRight.y);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Interpolate a point along the edge of the quadrilateral
 * @param t - Position along the top/bottom edge (0 = left, 1 = right)
 * @param corners - The quadrilateral corners
 * @returns Top and bottom points for a vertical line at position t
 */
function getColumnLine(
  t: number,
  corners: QuadCorners,
): { top: Point; bottom: Point } {
  return {
    top: {
      x: corners.topLeft.x + t * (corners.topRight.x - corners.topLeft.x),
      y: corners.topLeft.y + t * (corners.topRight.y - corners.topLeft.y),
    },
    bottom: {
      x:
        corners.bottomLeft.x +
        t * (corners.bottomRight.x - corners.bottomLeft.x),
      y:
        corners.bottomLeft.y +
        t * (corners.bottomRight.y - corners.bottomLeft.y),
    },
  };
}

/**
 * CalibrationOverlay - Interactive quadrilateral calibration editor
 *
 * Allows users to:
 * 1. Drag 4 corners independently to match perspective
 * 2. Adjust column dividers within the quadrilateral
 * 3. Align the virtual grid over their physical abacus
 *
 * Control buttons (Cancel, Done, Rotate) are NOT rendered by this component.
 * Use the imperative handle to trigger rotate/complete from parent controls.
 */
export const CalibrationOverlay = forwardRef<
  CalibrationOverlayHandle,
  CalibrationOverlayProps
>(function CalibrationOverlay(
  {
    columnCount,
    videoWidth,
    videoHeight,
    containerWidth,
    containerHeight,
    initialCalibration,
    onComplete,
    onCancel,
    videoElement,
    onCornersChange,
  },
  ref,
): ReactNode {
  // Calculate actual visible video bounds (accounting for object-fit: contain letterboxing)
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  let displayedVideoWidth: number;
  let displayedVideoHeight: number;
  let videoOffsetX: number;
  let videoOffsetY: number;

  if (videoAspect > containerAspect) {
    // Video is wider than container - letterbox top/bottom
    displayedVideoWidth = containerWidth;
    displayedVideoHeight = containerWidth / videoAspect;
    videoOffsetX = 0;
    videoOffsetY = (containerHeight - displayedVideoHeight) / 2;
  } else {
    // Video is taller than container - letterbox left/right
    displayedVideoHeight = containerHeight;
    displayedVideoWidth = containerHeight * videoAspect;
    videoOffsetX = (containerWidth - displayedVideoWidth) / 2;
    videoOffsetY = 0;
  }

  // Uniform scale factor (maintains aspect ratio)
  const scale = displayedVideoWidth / videoWidth;

  // Initialize corners state
  const getDefaultCorners = (): QuadCorners => {
    // Default to a slightly trapezoidal shape (wider at bottom for typical desk perspective)
    // Use larger margins to ensure all corners are visible and draggable
    const topMargin = 0.15;
    const bottomMargin = 0.2; // Larger margin at bottom to keep handles visible
    const sideMargin = 0.15;
    const topInset = 0.03; // Make top slightly narrower than bottom for perspective
    return {
      topLeft: {
        x: videoWidth * (sideMargin + topInset),
        y: videoHeight * topMargin,
      },
      topRight: {
        x: videoWidth * (1 - sideMargin - topInset),
        y: videoHeight * topMargin,
      },
      bottomLeft: {
        x: videoWidth * sideMargin,
        y: videoHeight * (1 - bottomMargin),
      },
      bottomRight: {
        x: videoWidth * (1 - sideMargin),
        y: videoHeight * (1 - bottomMargin),
      },
    };
  };

  const [corners, setCorners] = useState<QuadCorners>(() => {
    if (initialCalibration?.corners) {
      return initialCalibration.corners;
    }
    // Convert from legacy ROI if available
    if (initialCalibration?.roi) {
      const roi = initialCalibration.roi;
      return {
        topLeft: { x: roi.x, y: roi.y },
        topRight: { x: roi.x + roi.width, y: roi.y },
        bottomLeft: { x: roi.x, y: roi.y + roi.height },
        bottomRight: { x: roi.x + roi.width, y: roi.y + roi.height },
      };
    }
    return getDefaultCorners();
  });

  // Initialize column dividers (evenly spaced)
  const getDefaultDividers = (): number[] => {
    const dividers: number[] = [];
    for (let i = 1; i < columnCount; i++) {
      dividers.push(i / columnCount);
    }
    return dividers;
  };

  const [dividers, setDividers] = useState<number[]>(
    initialCalibration?.columnDividers ?? getDefaultDividers(),
  );

  // Drag state
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const dragStartRef = useRef<{
    x: number;
    y: number;
    corners: QuadCorners;
    dividers: number[];
  } | null>(null);

  // Rotation animation state
  const [rotationAnimation, setRotationAnimation] = useState<{
    startCorners: QuadCorners;
    endCorners: QuadCorners;
    startTime: number;
  } | null>(null);
  const ROTATION_DURATION_MS = 300;

  // Easing function: easeOutCubic for smooth deceleration
  const easeOutCubic = (t: number): number => {
    return 1 - Math.pow(1 - t, 3);
  };

  // Interpolate between two points
  const lerpPoint = (a: Point, b: Point, t: number): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  // Interpolate between two sets of corners
  const lerpCorners = (
    a: QuadCorners,
    b: QuadCorners,
    t: number,
  ): QuadCorners => ({
    topLeft: lerpPoint(a.topLeft, b.topLeft, t),
    topRight: lerpPoint(a.topRight, b.topRight, t),
    bottomLeft: lerpPoint(a.bottomLeft, b.bottomLeft, t),
    bottomRight: lerpPoint(a.bottomRight, b.bottomRight, t),
  });

  // Animate rotation
  useEffect(() => {
    if (!rotationAnimation) return;

    let animationId: number;

    const animate = () => {
      const elapsed = performance.now() - rotationAnimation.startTime;
      const progress = Math.min(elapsed / ROTATION_DURATION_MS, 1);
      const easedProgress = easeOutCubic(progress);

      const interpolatedCorners = lerpCorners(
        rotationAnimation.startCorners,
        rotationAnimation.endCorners,
        easedProgress,
      );

      setCorners(interpolatedCorners);

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      } else {
        // Animation complete - ensure we're exactly at the end position
        setCorners(rotationAnimation.endCorners);
        setRotationAnimation(null);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [rotationAnimation]);

  // Notify parent when corners change
  useEffect(() => {
    onCornersChange?.(corners);
  }, [corners, onCornersChange]);

  // Handle pointer down on corners or dividers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent, target: DragTarget) => {
      e.preventDefault();
      e.stopPropagation();
      setDragTarget(target);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        corners: { ...corners },
        dividers: [...dividers],
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [corners, dividers],
  );

  // Handle pointer move during drag
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragTarget || !dragStartRef.current) return;

      const dx = (e.clientX - dragStartRef.current.x) / scale;
      const dy = (e.clientY - dragStartRef.current.y) / scale;
      const startCorners = dragStartRef.current.corners;

      if (dragTarget === "quad") {
        // Move entire quadrilateral
        // Calculate bounds to keep all corners within video
        const minX = Math.min(
          startCorners.topLeft.x,
          startCorners.bottomLeft.x,
        );
        const maxX = Math.max(
          startCorners.topRight.x,
          startCorners.bottomRight.x,
        );
        const minY = Math.min(startCorners.topLeft.y, startCorners.topRight.y);
        const maxY = Math.max(
          startCorners.bottomLeft.y,
          startCorners.bottomRight.y,
        );

        // Clamp movement to keep quad within video bounds
        const clampedDx = Math.max(-minX, Math.min(videoWidth - maxX, dx));
        const clampedDy = Math.max(-minY, Math.min(videoHeight - maxY, dy));

        setCorners({
          topLeft: {
            x: startCorners.topLeft.x + clampedDx,
            y: startCorners.topLeft.y + clampedDy,
          },
          topRight: {
            x: startCorners.topRight.x + clampedDx,
            y: startCorners.topRight.y + clampedDy,
          },
          bottomLeft: {
            x: startCorners.bottomLeft.x + clampedDx,
            y: startCorners.bottomLeft.y + clampedDy,
          },
          bottomRight: {
            x: startCorners.bottomRight.x + clampedDx,
            y: startCorners.bottomRight.y + clampedDy,
          },
        });
      } else if (
        dragTarget === "topLeft" ||
        dragTarget === "topRight" ||
        dragTarget === "bottomLeft" ||
        dragTarget === "bottomRight"
      ) {
        // Move single corner
        const startPoint = startCorners[dragTarget];
        const newPoint: Point = {
          x: Math.max(0, Math.min(videoWidth, startPoint.x + dx)),
          y: Math.max(0, Math.min(videoHeight, startPoint.y + dy)),
        };
        setCorners((prev) => ({
          ...prev,
          [dragTarget]: newPoint,
        }));
      } else if (dragTarget.startsWith("divider-")) {
        // Move divider
        const index = Number.parseInt(dragTarget.split("-")[1], 10);
        const startDividers = dragStartRef.current.dividers;

        // Calculate dx as fraction of quad width (average of top and bottom widths)
        const topWidth = startCorners.topRight.x - startCorners.topLeft.x;
        const bottomWidth =
          startCorners.bottomRight.x - startCorners.bottomLeft.x;
        const avgWidth = (topWidth + bottomWidth) / 2;
        const dxFraction = dx / avgWidth;

        const newDividers = [...startDividers];
        const minPos = index === 0 ? 0.05 : startDividers[index - 1] + 0.05;
        const maxPos =
          index === startDividers.length - 1
            ? 0.95
            : startDividers[index + 1] - 0.05;
        newDividers[index] = Math.max(
          minPos,
          Math.min(maxPos, startDividers[index] + dxFraction),
        );
        setDividers(newDividers);
      }
    },
    [dragTarget, scale, videoWidth, videoHeight],
  );

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    setDragTarget(null);
    dragStartRef.current = null;
  }, []);

  /**
   * Rotate corners 90° clockwise or counter-clockwise around the quad center
   * This reassigns corner labels, not their positions
   * Animates the transition smoothly
   */
  const handleRotate = useCallback(
    (direction: "left" | "right") => {
      // Don't start a new rotation if one is already in progress
      if (rotationAnimation) return;

      const currentCorners = corners;

      const newCorners =
        direction === "right"
          ? // Rotate 90° clockwise: TL→TR, TR→BR, BR→BL, BL→TL
            {
              topLeft: currentCorners.bottomLeft,
              topRight: currentCorners.topLeft,
              bottomRight: currentCorners.topRight,
              bottomLeft: currentCorners.bottomRight,
            }
          : // Rotate 90° counter-clockwise: TL→BL, BL→BR, BR→TR, TR→TL
            {
              topLeft: currentCorners.topRight,
              topRight: currentCorners.bottomRight,
              bottomRight: currentCorners.bottomLeft,
              bottomLeft: currentCorners.topLeft,
            };

      // Start animation
      setRotationAnimation({
        startCorners: currentCorners,
        endCorners: newCorners,
        startTime: performance.now(),
      });
    },
    [corners, rotationAnimation],
  );

  // Handle complete
  const handleComplete = useCallback(() => {
    const grid: CalibrationGrid = {
      roi: cornersToROI(corners),
      corners,
      columnCount,
      columnDividers: dividers,
      rotation: 0, // Deprecated - perspective handled by corners
    };
    onComplete(grid);
  }, [corners, columnCount, dividers, onComplete]);

  // Expose imperative methods to parent
  useImperativeHandle(
    ref,
    () => ({
      rotate: handleRotate,
      complete: handleComplete,
    }),
    [handleRotate, handleComplete],
  );

  // Convert corners to display coordinates (accounting for letterbox offset)
  const displayCorners: QuadCorners = {
    topLeft: {
      x: corners.topLeft.x * scale + videoOffsetX,
      y: corners.topLeft.y * scale + videoOffsetY,
    },
    topRight: {
      x: corners.topRight.x * scale + videoOffsetX,
      y: corners.topRight.y * scale + videoOffsetY,
    },
    bottomLeft: {
      x: corners.bottomLeft.x * scale + videoOffsetX,
      y: corners.bottomLeft.y * scale + videoOffsetY,
    },
    bottomRight: {
      x: corners.bottomRight.x * scale + videoOffsetX,
      y: corners.bottomRight.y * scale + videoOffsetY,
    },
  };

  // Create SVG path for the quadrilateral
  const quadPath = `M ${displayCorners.topLeft.x} ${displayCorners.topLeft.y}
    L ${displayCorners.topRight.x} ${displayCorners.topRight.y}
    L ${displayCorners.bottomRight.x} ${displayCorners.bottomRight.y}
    L ${displayCorners.bottomLeft.x} ${displayCorners.bottomLeft.y} Z`;

  const handleSize = 16;

  // Corner positions for handles
  const cornerPositions: { key: CornerKey; point: Point }[] = [
    { key: "topLeft", point: displayCorners.topLeft },
    { key: "topRight", point: displayCorners.topRight },
    { key: "bottomLeft", point: displayCorners.bottomLeft },
    { key: "bottomRight", point: displayCorners.bottomRight },
  ];

  return (
    <div
      data-component="calibration-overlay"
      className={css({
        position: "absolute",
        inset: 0,
        zIndex: 10,
      })}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Semi-transparent overlay outside quadrilateral */}
      <svg
        width={containerWidth}
        height={containerHeight}
        className={css({ position: "absolute", inset: 0 })}
      >
        {/* Darkened area outside quadrilateral */}
        <defs>
          <mask id="quad-mask">
            <rect width="100%" height="100%" fill="white" />
            <path d={quadPath} fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.5)"
          mask="url(#quad-mask)"
          style={{ pointerEvents: "none" }}
        />

        {/* Clickable fill area inside quadrilateral - for moving the entire quad */}
        <path
          d={quadPath}
          fill="transparent"
          style={{
            cursor: dragTarget === "quad" ? "grabbing" : "grab",
            touchAction: "none",
          }}
          onPointerDown={(e) => handlePointerDown(e, "quad")}
        />

        {/* Quadrilateral border */}
        <path
          d={quadPath}
          fill="none"
          stroke="#4ade80"
          strokeWidth="2"
          strokeDasharray="8,4"
          style={{ pointerEvents: "none" }}
        />

        {/* Column divider lines */}
        {dividers.map((divider, i) => {
          const line = getColumnLine(divider, displayCorners);
          return (
            <line
              key={i}
              x1={line.top.x}
              y1={line.top.y}
              x2={line.bottom.x}
              y2={line.bottom.y}
              stroke="#facc15"
              strokeWidth="3"
              style={{ cursor: "ew-resize", touchAction: "none" }}
              onPointerDown={(e) => handlePointerDown(e, `divider-${i}`)}
            />
          );
        })}

        {/* Beam indicator line (20% from top, interpolated) */}
        {(() => {
          const beamT = 0.2;
          const leftPoint: Point = {
            x:
              displayCorners.topLeft.x +
              beamT * (displayCorners.bottomLeft.x - displayCorners.topLeft.x),
            y:
              displayCorners.topLeft.y +
              beamT * (displayCorners.bottomLeft.y - displayCorners.topLeft.y),
          };
          const rightPoint: Point = {
            x:
              displayCorners.topRight.x +
              beamT *
                (displayCorners.bottomRight.x - displayCorners.topRight.x),
            y:
              displayCorners.topRight.y +
              beamT *
                (displayCorners.bottomRight.y - displayCorners.topRight.y),
          };
          return (
            <line
              x1={leftPoint.x}
              y1={leftPoint.y}
              x2={rightPoint.x}
              y2={rightPoint.y}
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="4,4"
              opacity="0.7"
            />
          );
        })()}
      </svg>

      {/* Corner drag handles */}
      {cornerPositions.map(({ key, point }) => (
        <div
          key={key}
          data-element={`handle-${key}`}
          className={css({
            position: "absolute",
            width: `${handleSize}px`,
            height: `${handleSize}px`,
            bg: "green.400",
            border: "2px solid white",
            borderRadius: "full",
            cursor: "move",
            transform: "translate(-50%, -50%)",
            // Prevent browser from treating touch drag as scroll
            touchAction: "none",
            _hover: {
              bg: "green.300",
              transform: "translate(-50%, -50%) scale(1.2)",
            },
          })}
          style={{
            left: point.x,
            top: point.y,
          }}
          onPointerDown={(e) => handlePointerDown(e, key)}
        />
      ))}
    </div>
  );
});

export default CalibrationOverlay;
