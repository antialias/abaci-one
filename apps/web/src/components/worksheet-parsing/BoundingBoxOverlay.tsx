"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "../../../styled-system/css";
import type { ParsedProblem, BoundingBox } from "@/lib/worksheet-parsing";

interface BoundingBoxOverlayProps {
  /** The problems with bounding box data */
  problems: ParsedProblem[];
  /** Currently selected problem index (null if none) */
  selectedIndex: number | null;
  /** Callback when a problem is clicked */
  onSelectProblem: (index: number | null) => void;
  /** The image element to overlay on */
  imageRef: React.RefObject<HTMLImageElement | null>;
  /** Show debug info (raw coordinates, image dimensions) */
  debug?: boolean;
  /** Set of problem indices selected for re-parsing */
  selectedForReparse?: Set<number>;
  /** Callback when a problem is toggled for re-parsing */
  onToggleReparse?: (index: number) => void;
  /** Adjusted bounding boxes (overrides original when present) */
  adjustedBoxes?: Map<number, BoundingBox>;
  /** Callback when a bounding box is adjusted */
  onAdjustBox?: (index: number, box: BoundingBox) => void;
}

/** Handle positions for resize */
type HandlePosition = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

/** State for drag/resize operations */
interface DragState {
  type: "move" | "resize";
  index: number;
  handle?: HandlePosition;
  startX: number;
  startY: number;
  startBox: BoundingBox;
}

/**
 * Calculate the actual rendered dimensions of an image with object-fit: contain
 * Returns the offset and size of the actual image content within the element
 */
function getContainedImageDimensions(img: HTMLImageElement): {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
} {
  const naturalRatio = img.naturalWidth / img.naturalHeight;
  const elementRatio = img.clientWidth / img.clientHeight;

  let width: number;
  let height: number;

  if (naturalRatio > elementRatio) {
    // Image is wider than container - letterboxed top/bottom
    width = img.clientWidth;
    height = img.clientWidth / naturalRatio;
  } else {
    // Image is taller than container - letterboxed left/right
    height = img.clientHeight;
    width = img.clientHeight * naturalRatio;
  }

  const offsetX = (img.clientWidth - width) / 2;
  const offsetY = (img.clientHeight - height) / 2;

  return { offsetX, offsetY, width, height };
}

/**
 * BoundingBoxOverlay - SVG overlay that draws bounding boxes on worksheet images
 *
 * Uses normalized coordinates (0-1) from the parsing results to draw boxes
 * that highlight where each problem was detected on the worksheet.
 *
 * Features:
 * - All problems shown with semi-transparent boxes
 * - Selected problem highlighted with thicker border
 * - Click on a box to select that problem
 * - Automatically sizes to match the underlying image
 */
export function BoundingBoxOverlay({
  problems,
  selectedIndex,
  onSelectProblem,
  imageRef,
  debug = false,
  selectedForReparse = new Set(),
  onToggleReparse,
  adjustedBoxes = new Map(),
  onAdjustBox,
}: BoundingBoxOverlayProps): ReactNode {
  const [dimensions, setDimensions] = useState({
    elementWidth: 0,
    elementHeight: 0,
    // Actual image content dimensions (accounting for object-fit: contain)
    offsetX: 0,
    offsetY: 0,
    contentWidth: 0,
    contentHeight: 0,
    // Natural image dimensions (for debug display)
    naturalWidth: 0,
    naturalHeight: 0,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Drag/resize state
  const [dragState, setDragState] = useState<DragState | null>(null);

  // Hover state for showing checkbox on hover
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Update dimensions when image loads or resizes
  const updateDimensions = useCallback(() => {
    const img = imageRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      const contained = getContainedImageDimensions(img);
      setDimensions({
        elementWidth: img.clientWidth,
        elementHeight: img.clientHeight,
        offsetX: contained.offsetX,
        offsetY: contained.offsetY,
        contentWidth: contained.width,
        contentHeight: contained.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
      });
    }
  }, [imageRef]);

  // Watch for image load and resize
  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;

    // Update on load
    if (img.complete) {
      updateDimensions();
    } else {
      img.addEventListener("load", updateDimensions);
    }

    // Update on resize using ResizeObserver
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(img);

    return () => {
      img.removeEventListener("load", updateDimensions);
      observer.disconnect();
    };
  }, [imageRef, updateDimensions]);

  // Convert normalized coordinates to pixel coordinates
  // Accounts for object-fit: contain letterboxing
  const toPixels = useCallback(
    (box: BoundingBox) => ({
      x: dimensions.offsetX + box.x * dimensions.contentWidth,
      y: dimensions.offsetY + box.y * dimensions.contentHeight,
      width: box.width * dimensions.contentWidth,
      height: box.height * dimensions.contentHeight,
    }),
    [dimensions],
  );

  // Convert pixel coordinates back to normalized (0-1)
  const toNormalized = useCallback(
    (pixelBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    }): BoundingBox => ({
      x: Math.max(
        0,
        Math.min(
          1,
          (pixelBox.x - dimensions.offsetX) / dimensions.contentWidth,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          1,
          (pixelBox.y - dimensions.offsetY) / dimensions.contentHeight,
        ),
      ),
      width: Math.max(
        0.02,
        Math.min(1, pixelBox.width / dimensions.contentWidth),
      ),
      height: Math.max(
        0.02,
        Math.min(1, pixelBox.height / dimensions.contentHeight),
      ),
    }),
    [dimensions],
  );

  // Get the effective bounding box (adjusted or original)
  const getEffectiveBox = useCallback(
    (index: number, problem: ParsedProblem): BoundingBox => {
      return adjustedBoxes.get(index) ?? problem.problemBoundingBox;
    },
    [adjustedBoxes],
  );

  // Handle mouse down on box (start drag)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, index: number, handle?: HandlePosition) => {
      // Only allow drag/resize for boxes that are selected for reparse
      if (!selectedForReparse.has(index) || !onAdjustBox) return;

      e.preventDefault();
      e.stopPropagation();

      const problem = problems[index];
      const box = getEffectiveBox(index, problem);

      setDragState({
        type: handle ? "resize" : "move",
        index,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        startBox: { ...box },
      });
    },
    [selectedForReparse, onAdjustBox, problems, getEffectiveBox],
  );

  // Handle mouse move (drag/resize)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState || !onAdjustBox) return;

      const dx = (e.clientX - dragState.startX) / dimensions.contentWidth;
      const dy = (e.clientY - dragState.startY) / dimensions.contentHeight;

      let newBox: BoundingBox;

      if (dragState.type === "move") {
        // Move the entire box
        newBox = {
          x: Math.max(
            0,
            Math.min(1 - dragState.startBox.width, dragState.startBox.x + dx),
          ),
          y: Math.max(
            0,
            Math.min(1 - dragState.startBox.height, dragState.startBox.y + dy),
          ),
          width: dragState.startBox.width,
          height: dragState.startBox.height,
        };
      } else {
        // Resize based on handle
        const { handle, startBox } = dragState;
        let x = startBox.x;
        let y = startBox.y;
        let width = startBox.width;
        let height = startBox.height;

        // Adjust based on which handle is being dragged
        if (handle?.includes("w")) {
          const newX = Math.max(
            0,
            Math.min(startBox.x + startBox.width - 0.02, startBox.x + dx),
          );
          width = startBox.width - (newX - startBox.x);
          x = newX;
        }
        if (handle?.includes("e")) {
          width = Math.max(0.02, Math.min(1 - startBox.x, startBox.width + dx));
        }
        if (handle?.includes("n")) {
          const newY = Math.max(
            0,
            Math.min(startBox.y + startBox.height - 0.02, startBox.y + dy),
          );
          height = startBox.height - (newY - startBox.y);
          y = newY;
        }
        if (handle?.includes("s")) {
          height = Math.max(
            0.02,
            Math.min(1 - startBox.y, startBox.height + dy),
          );
        }

        newBox = { x, y, width, height };
      }

      onAdjustBox(dragState.index, newBox);
    },
    [dragState, onAdjustBox, dimensions],
  );

  // Handle mouse up (end drag)
  const handleMouseUp = useCallback(() => {
    setDragState(null);
  }, []);

  // Add global mouse listeners when dragging
  useEffect(() => {
    if (!dragState) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!dragState || !onAdjustBox) return;

      const dx = (e.clientX - dragState.startX) / dimensions.contentWidth;
      const dy = (e.clientY - dragState.startY) / dimensions.contentHeight;

      let newBox: BoundingBox;

      if (dragState.type === "move") {
        newBox = {
          x: Math.max(
            0,
            Math.min(1 - dragState.startBox.width, dragState.startBox.x + dx),
          ),
          y: Math.max(
            0,
            Math.min(1 - dragState.startBox.height, dragState.startBox.y + dy),
          ),
          width: dragState.startBox.width,
          height: dragState.startBox.height,
        };
      } else {
        const { handle, startBox } = dragState;
        let x = startBox.x;
        let y = startBox.y;
        let width = startBox.width;
        let height = startBox.height;

        if (handle?.includes("w")) {
          const newX = Math.max(
            0,
            Math.min(startBox.x + startBox.width - 0.02, startBox.x + dx),
          );
          width = startBox.width - (newX - startBox.x);
          x = newX;
        }
        if (handle?.includes("e")) {
          width = Math.max(0.02, Math.min(1 - startBox.x, startBox.width + dx));
        }
        if (handle?.includes("n")) {
          const newY = Math.max(
            0,
            Math.min(startBox.y + startBox.height - 0.02, startBox.y + dy),
          );
          height = startBox.height - (newY - startBox.y);
          y = newY;
        }
        if (handle?.includes("s")) {
          height = Math.max(
            0.02,
            Math.min(1 - startBox.y, startBox.height + dy),
          );
        }

        newBox = { x, y, width, height };
      }

      onAdjustBox(dragState.index, newBox);
    };

    const handleGlobalMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [dragState, onAdjustBox, dimensions]);

  // Don't render if we don't have valid dimensions
  if (dimensions.contentWidth === 0 || dimensions.contentHeight === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      data-element="bounding-box-overlay"
      className={css({
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none", // Allow clicks to pass through except on boxes
      })}
      style={{
        width: dimensions.elementWidth,
        height: dimensions.elementHeight,
      }}
    >
      <svg
        width={dimensions.elementWidth}
        height={dimensions.elementHeight}
        viewBox={`0 0 ${dimensions.elementWidth} ${dimensions.elementHeight}`}
        className={css({ display: "block" })}
      >
        {/* Debug: show actual image content bounds */}
        {debug && (
          <rect
            x={dimensions.offsetX}
            y={dimensions.offsetY}
            width={dimensions.contentWidth}
            height={dimensions.contentHeight}
            fill="none"
            stroke="cyan"
            strokeWidth={2}
            strokeDasharray="8 4"
          />
        )}
        {/* Render boxes in two passes: unselected first, then selected on top */}
        {[false, true].map((renderSelected) =>
          problems.map((problem, index) => {
            if (!problem.problemBoundingBox) return null;

            const isMarkedForReparse = selectedForReparse.has(index);

            // First pass: render unselected boxes
            // Second pass: render selected boxes (on top for drag/resize)
            if (renderSelected !== isMarkedForReparse) return null;

            // Use adjusted box if available, otherwise original
            const box = getEffectiveBox(index, problem);
            const pixels = toPixels(box);
            const isSelected = selectedIndex === index;
            const isCorrect = problem.studentAnswer === problem.correctAnswer;
            const hasAnswer = problem.studentAnswer != null;
            const isAdjusted = adjustedBoxes.has(index);
            const canDrag = isMarkedForReparse && onAdjustBox;
            const isHovered = hoveredIndex === index;
            const hasAnySelections = selectedForReparse.size > 0;

            // Determine box color based on status
            let strokeColor: string;
            let fillColor: string;
            if (isMarkedForReparse) {
              // Orange for problems marked for re-parsing
              strokeColor = "#f97316"; // orange-500
              fillColor = "rgba(249, 115, 22, 0.2)";
            } else if (isSelected) {
              strokeColor = "#3b82f6"; // blue-500
              fillColor = "rgba(59, 130, 246, 0.15)";
            } else if (!hasAnswer) {
              strokeColor = "#6b7280"; // gray-500
              fillColor = "rgba(107, 114, 128, 0.08)";
            } else if (isCorrect) {
              strokeColor = "#22c55e"; // green-500
              fillColor = "rgba(34, 197, 94, 0.08)";
            } else {
              strokeColor = "#ef4444"; // red-500
              fillColor = "rgba(239, 68, 68, 0.08)";
            }

            const handleBoxClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              // Toggle highlight selection (for viewing problem details)
              onSelectProblem(isSelected ? null : index);
            };

            const handleCheckboxClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (onToggleReparse) {
                onToggleReparse(index);
              }
            };

            // Resize handle size
            const handleSize = 10;

            // Handle positions for resize handles (corners only for simplicity)
            const handles: Array<{
              pos: HandlePosition;
              x: number;
              y: number;
              cursor: string;
            }> = [
              { pos: "nw", x: pixels.x, y: pixels.y, cursor: "nwse-resize" },
              {
                pos: "ne",
                x: pixels.x + pixels.width,
                y: pixels.y,
                cursor: "nesw-resize",
              },
              {
                pos: "sw",
                x: pixels.x,
                y: pixels.y + pixels.height,
                cursor: "nesw-resize",
              },
              {
                pos: "se",
                x: pixels.x + pixels.width,
                y: pixels.y + pixels.height,
                cursor: "nwse-resize",
              },
            ];

            return (
              <g
                key={`${renderSelected ? "selected" : "unselected"}-${problem.problemNumber ?? index}`}
              >
                {/* Background fill */}
                <rect
                  x={pixels.x}
                  y={pixels.y}
                  width={pixels.width}
                  height={pixels.height}
                  fill={fillColor}
                  rx={4}
                  ry={4}
                />
                {/* Border - draggable when selected for reparse */}
                <rect
                  x={pixels.x}
                  y={pixels.y}
                  width={pixels.width}
                  height={pixels.height}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isMarkedForReparse ? 3 : isSelected ? 3 : 1.5}
                  strokeDasharray={
                    isAdjusted
                      ? "none"
                      : isMarkedForReparse || isSelected
                        ? "none"
                        : "4 2"
                  }
                  rx={4}
                  ry={4}
                  style={{
                    pointerEvents: "all",
                    cursor: canDrag ? "move" : "pointer",
                  }}
                  onClick={canDrag ? undefined : handleBoxClick}
                  onMouseDown={
                    canDrag ? (e) => handleMouseDown(e, index) : undefined
                  }
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() =>
                    setHoveredIndex((prev) => (prev === index ? null : prev))
                  }
                />
                {/* Resize handles for selected boxes */}
                {canDrag &&
                  handles.map((handle) => (
                    <rect
                      key={handle.pos}
                      x={handle.x - handleSize / 2}
                      y={handle.y - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      fill="#f97316"
                      stroke="#ea580c"
                      strokeWidth={1}
                      rx={2}
                      ry={2}
                      style={{ pointerEvents: "all", cursor: handle.cursor }}
                      onMouseDown={(e) => handleMouseDown(e, index, handle.pos)}
                    />
                  ))}
                {/* Adjusted indicator */}
                {isAdjusted && isMarkedForReparse && (
                  <text
                    x={pixels.x + pixels.width - 4}
                    y={pixels.y + 14}
                    fill="#f97316"
                    fontSize={10}
                    fontWeight="bold"
                    textAnchor="end"
                    style={{ pointerEvents: "none" }}
                  >
                    ✎
                  </text>
                )}
                {/* Checkbox indicator - show on hover or if selected */}
                {onToggleReparse &&
                  (isHovered || isMarkedForReparse || hasAnySelections) && (
                    <g
                      style={{
                        opacity: isMarkedForReparse || isHovered ? 1 : 0.5,
                      }}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() =>
                        setHoveredIndex((prev) =>
                          prev === index ? null : prev,
                        )
                      }
                    >
                      <rect
                        x={pixels.x + pixels.width - 22}
                        y={pixels.y + 4}
                        width={18}
                        height={18}
                        fill={
                          isMarkedForReparse ? "#f97316" : "rgba(0, 0, 0, 0.6)"
                        }
                        stroke={isMarkedForReparse ? "#ea580c" : "#9ca3af"}
                        strokeWidth={2}
                        rx={3}
                        ry={3}
                        style={{ pointerEvents: "all", cursor: "pointer" }}
                        onClick={handleCheckboxClick}
                      />
                      {isMarkedForReparse && (
                        <text
                          x={pixels.x + pixels.width - 13}
                          y={pixels.y + 17}
                          fill="white"
                          fontSize={12}
                          fontWeight="bold"
                          textAnchor="middle"
                          style={{ pointerEvents: "none" }}
                        >
                          ✓
                        </text>
                      )}
                    </g>
                  )}
                {/* Problem number label */}
                <text
                  x={pixels.x + 4}
                  y={pixels.y + 14}
                  fill={strokeColor}
                  fontSize={12}
                  fontWeight={
                    isMarkedForReparse || isSelected ? "bold" : "normal"
                  }
                  fontFamily="monospace"
                  style={{ pointerEvents: "none" }}
                >
                  #{index + 1}
                </text>
              </g>
            );
          }),
        )}
      </svg>

      {/* Debug panel showing dimensions and selected box coordinates */}
      {debug && (
        <div
          data-element="bbox-debug-panel"
          className={css({
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: 2,
            backgroundColor: "rgba(0, 0, 0, 0.85)",
            color: "white",
            fontSize: "xs",
            fontFamily: "mono",
            maxHeight: "150px",
            overflow: "auto",
            pointerEvents: "auto",
          })}
        >
          <div className={css({ marginBottom: 1 })}>
            <strong>Image Debug:</strong> natural={dimensions.naturalWidth}x
            {dimensions.naturalHeight} | element={dimensions.elementWidth}x
            {dimensions.elementHeight} | content=
            {Math.round(dimensions.contentWidth)}x
            {Math.round(dimensions.contentHeight)} | offset=(
            {Math.round(dimensions.offsetX)},{Math.round(dimensions.offsetY)})
          </div>
          {selectedIndex !== null && problems[selectedIndex] && (
            <div>
              <strong>Selected #{selectedIndex + 1}:</strong> raw=(
              {problems[selectedIndex].problemBoundingBox.x.toFixed(3)},{" "}
              {problems[selectedIndex].problemBoundingBox.y.toFixed(3)},{" "}
              {problems[selectedIndex].problemBoundingBox.width.toFixed(3)},{" "}
              {problems[selectedIndex].problemBoundingBox.height.toFixed(3)}) |
              pixels=(
              {Math.round(
                toPixels(problems[selectedIndex].problemBoundingBox).x,
              )}
              ,{" "}
              {Math.round(
                toPixels(problems[selectedIndex].problemBoundingBox).y,
              )}
              ,{" "}
              {Math.round(
                toPixels(problems[selectedIndex].problemBoundingBox).width,
              )}
              x
              {Math.round(
                toPixels(problems[selectedIndex].problemBoundingBox).height,
              )}
              )
            </div>
          )}
          <div className={css({ marginTop: 1, color: "cyan" })}>
            Cyan dashed border = actual image content bounds (accounting for
            object-fit: contain)
          </div>
        </div>
      )}
    </div>
  );
}

export default BoundingBoxOverlay;
