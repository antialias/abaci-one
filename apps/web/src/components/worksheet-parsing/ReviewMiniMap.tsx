"use client";

/**
 * ReviewMiniMap - Spatial context component showing worksheet thumbnail with problem locations
 *
 * Features:
 * - Small thumbnail of the worksheet image
 * - Bounding boxes for each problem (color-coded by status)
 * - Current problem highlighted
 * - Click to jump to a specific problem
 */

import { type ReactNode, useRef, useEffect, useState, useMemo } from "react";
import { css } from "../../../styled-system/css";
import type { ParsedProblem, BoundingBox } from "@/lib/worksheet-parsing";

export interface ReviewMiniMapProps {
  /** Full worksheet image URL */
  worksheetImageUrl: string;
  /** All problems with their bounding boxes */
  problems: ParsedProblem[];
  /** Currently selected problem index (0-based) */
  currentIndex: number;
  /** Callback when a problem is clicked */
  onSelectProblem: (index: number) => void;
  /** Dark mode */
  isDark?: boolean;
  /** Compact mode (smaller size) */
  compact?: boolean;
}

/**
 * Get color for a problem based on its review status
 */
function getProblemColor(
  problem: ParsedProblem,
  isCurrent: boolean,
): { stroke: string; fill: string } {
  if (isCurrent) {
    return { stroke: "rgb(59, 130, 246)", fill: "rgba(59, 130, 246, 0.3)" }; // blue
  }

  // Based on review status
  switch (problem.reviewStatus) {
    case "approved":
      return { stroke: "rgb(34, 197, 94)", fill: "rgba(34, 197, 94, 0.2)" }; // green
    case "corrected":
      return { stroke: "rgb(168, 85, 247)", fill: "rgba(168, 85, 247, 0.2)" }; // purple
    case "flagged":
      return { stroke: "rgb(249, 115, 22)", fill: "rgba(249, 115, 22, 0.2)" }; // orange
    default: {
      // Pending - color by confidence
      const minConf = Math.min(
        problem.termsConfidence,
        problem.studentAnswerConfidence,
      );
      if (minConf < 0.7) {
        return { stroke: "rgb(250, 204, 21)", fill: "rgba(250, 204, 21, 0.2)" }; // yellow for low conf
      }
      return { stroke: "rgb(156, 163, 175)", fill: "rgba(156, 163, 175, 0.1)" }; // gray
    }
  }
}

/**
 * Convert normalized coordinates to pixel coordinates
 */
function toPixelCoords(
  box: BoundingBox,
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number; width: number; height: number } {
  // Calculate scale to fit image in container while maintaining aspect ratio
  const imageAspect = imageWidth / imageHeight;
  const containerAspect = containerWidth / containerHeight;

  let scale: number;
  let offsetX = 0;
  let offsetY = 0;

  if (imageAspect > containerAspect) {
    // Image is wider - fit to width
    scale = containerWidth / imageWidth;
    offsetY = (containerHeight - imageHeight * scale) / 2;
  } else {
    // Image is taller - fit to height
    scale = containerHeight / imageHeight;
    offsetX = (containerWidth - imageWidth * scale) / 2;
  }

  return {
    x: box.x * imageWidth * scale + offsetX,
    y: box.y * imageHeight * scale + offsetY,
    width: box.width * imageWidth * scale,
    height: box.height * imageHeight * scale,
  };
}

export function ReviewMiniMap({
  worksheetImageUrl,
  problems,
  currentIndex,
  onSelectProblem,
  isDark = true,
  compact = false,
}: ReviewMiniMapProps): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Load image to get natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = worksheetImageUrl;
  }, [worksheetImageUrl]);

  // Measure container
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calculate bounding boxes in pixel coordinates
  const boxes = useMemo(() => {
    if (!imageSize.width || !containerSize.width) return [];

    return problems.map((problem, index) => ({
      index,
      problem,
      coords: toPixelCoords(
        problem.problemBoundingBox,
        imageSize.width,
        imageSize.height,
        containerSize.width,
        containerSize.height,
      ),
      color: getProblemColor(problem, index === currentIndex),
    }));
  }, [problems, imageSize, containerSize, currentIndex]);

  // Calculate image positioning to fit in container
  const imageStyle = useMemo(() => {
    if (!imageSize.width || !containerSize.width) return {};

    const imageAspect = imageSize.width / imageSize.height;
    const containerAspect = containerSize.width / containerSize.height;

    if (imageAspect > containerAspect) {
      // Image is wider - fit to width
      return {
        width: "100%",
        height: "auto",
        marginTop: `${(containerSize.height - containerSize.width / imageAspect) / 2}px`,
      };
    } else {
      // Image is taller - fit to height
      return {
        width: "auto",
        height: "100%",
        marginLeft: `${(containerSize.width - containerSize.height * imageAspect) / 2}px`,
      };
    }
  }, [imageSize, containerSize]);

  return (
    <div
      data-component="review-mini-map"
      ref={containerRef}
      className={css({
        position: "relative",
        width: "100%",
        height: compact ? "120px" : "200px",
        backgroundColor: isDark ? "gray.900" : "gray.100",
        borderRadius: "lg",
        overflow: "hidden",
      })}
    >
      {/* Worksheet image */}
      <img
        src={worksheetImageUrl}
        alt="Worksheet"
        style={imageStyle}
        className={css({
          position: "absolute",
          top: 0,
          left: 0,
          objectFit: "contain",
          opacity: 0.7,
        })}
      />

      {/* Bounding boxes overlay */}
      <svg
        className={css({
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        })}
      >
        {boxes.map(({ index, coords, color }) => (
          <g key={index}>
            {/* Clickable rectangle */}
            <rect
              x={coords.x}
              y={coords.y}
              width={coords.width}
              height={coords.height}
              fill={color.fill}
              stroke={color.stroke}
              strokeWidth={index === currentIndex ? 2 : 1}
              style={{ cursor: "pointer", pointerEvents: "auto" }}
              onClick={() => onSelectProblem(index)}
            />
            {/* Problem number label */}
            {!compact && coords.width > 15 && (
              <text
                x={coords.x + coords.width / 2}
                y={coords.y + coords.height / 2}
                fill={
                  index === currentIndex
                    ? "rgb(59, 130, 246)"
                    : "rgb(156, 163, 175)"
                }
                fontSize="10"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ cursor: "pointer", pointerEvents: "auto" }}
                onClick={() => onSelectProblem(index)}
              >
                {index + 1}
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Legend - only in non-compact mode */}
      {!compact && (
        <div
          className={css({
            position: "absolute",
            bottom: 2,
            right: 2,
            display: "flex",
            gap: 2,
            padding: 1,
            backgroundColor: isDark ? "gray.800/90" : "white/90",
            borderRadius: "md",
            fontSize: "10px",
          })}
        >
          <span
            className={css({
              color: "gray.400",
              display: "flex",
              alignItems: "center",
              gap: 1,
            })}
          >
            <span
              className={css({
                width: "8px",
                height: "8px",
                borderRadius: "sm",
                backgroundColor: "rgb(34, 197, 94)",
              })}
            />
            Done
          </span>
          <span
            className={css({
              color: "gray.400",
              display: "flex",
              alignItems: "center",
              gap: 1,
            })}
          >
            <span
              className={css({
                width: "8px",
                height: "8px",
                borderRadius: "sm",
                backgroundColor: "rgb(250, 204, 21)",
              })}
            />
            Review
          </span>
        </div>
      )}
    </div>
  );
}

export default ReviewMiniMap;
