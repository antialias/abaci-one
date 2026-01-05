/**
 * Zoom Lines Overlay Component
 *
 * Renders decorative lines connecting the indicator box (on main map)
 * to the magnifier window, creating a visual "pop out" effect.
 *
 * Features:
 * - Bezier curves with gentle outward bow
 * - Gradient fading toward magnifier
 * - Animated dash pattern
 * - Glow effect for premium feel
 * - Visibility culling for lines that would pass through rectangles
 *
 * Extracted from MapRenderer to improve maintainability.
 */

"use client";

import type { RefObject } from "react";
import {
  getAdjustedMagnifiedDimensions,
  getMagnifierDimensions,
} from "../../utils/magnifierDimensions";
import { getRenderedViewport } from "../labels";

// ============================================================================
// Types
// ============================================================================

interface Point {
  x: number;
  y: number;
}

interface SafeZoneMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface ParsedViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomLinesOverlayProps {
  /** Ref to SVG element */
  svgRef: RefObject<SVGSVGElement>;
  /** Ref to container element */
  containerRef: RefObject<HTMLDivElement>;
  /** Cursor position in screen coordinates */
  cursorPosition: Point;
  /** Parsed viewBox dimensions */
  parsedViewBox: ParsedViewBox;
  /** Safe zone margins */
  safeZoneMargins: SafeZoneMargins;
  /** Target magnifier top position */
  targetTop: number;
  /** Target magnifier left position */
  targetLeft: number;
  /** Target magnifier opacity */
  targetOpacity: number;
  /** Current zoom level */
  currentZoom: number;
  /** High zoom threshold for styling */
  highZoomThreshold: number;
  /** Whether dark mode is active */
  isDark: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a line segment passes through a rectangle (excluding endpoints)
 */
function linePassesThroughRect(
  from: Point,
  to: Point,
  rectLeft: number,
  rectTop: number,
  rectRight: number,
  rectBottom: number,
): boolean {
  // Sample points along the line (excluding endpoints)
  for (let t = 0.1; t <= 0.9; t += 0.1) {
    const px = from.x + (to.x - from.x) * t;
    const py = from.y + (to.y - from.y) * t;
    if (px > rectLeft && px < rectRight && py > rectTop && py < rectBottom) {
      return true;
    }
  }
  return false;
}

/**
 * Create a bezier path with elegant curve between two points
 */
function createBezierPath(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular offset creates gentle outward bow
  const bowAmount = dist * 0.06;
  const perpX = (-dy / dist) * bowAmount;
  const perpY = (dx / dist) * bowAmount;

  const midX = (from.x + to.x) / 2 + perpX;
  const midY = (from.y + to.y) / 2 + perpY;

  // Quadratic bezier for smooth curve
  return `M ${from.x} ${from.y} Q ${midX} ${midY}, ${to.x} ${to.y}`;
}

// ============================================================================
// Component
// ============================================================================

export function ZoomLinesOverlay({
  svgRef,
  containerRef,
  cursorPosition,
  parsedViewBox,
  safeZoneMargins,
  targetTop,
  targetLeft,
  targetOpacity,
  currentZoom,
  highZoomThreshold,
  isDark,
}: ZoomLinesOverlayProps) {
  // Need both refs to render
  if (!svgRef.current || !containerRef.current) {
    return null;
  }

  const containerRect = containerRef.current.getBoundingClientRect();
  const svgRect = svgRef.current.getBoundingClientRect();

  // Calculate leftover rectangle dimensions (area not covered by UI elements)
  const leftoverWidth =
    containerRect.width - safeZoneMargins.left - safeZoneMargins.right;
  const leftoverHeight =
    containerRect.height - safeZoneMargins.top - safeZoneMargins.bottom;

  // Get magnifier dimensions based on leftover rectangle (responsive to its aspect ratio)
  const { width: magnifierWidth, height: magnifierHeight } =
    getMagnifierDimensions(leftoverWidth, leftoverHeight);

  // Magnifier position
  const magTop = targetTop;
  const magLeft = targetLeft;

  // Calculate indicator box position in screen coordinates
  const {
    x: viewBoxX,
    y: viewBoxY,
    width: viewBoxWidth,
    height: viewBoxHeight,
  } = parsedViewBox;

  // Use adjusted dimensions to match magnifier aspect ratio
  const { width: indicatorWidth, height: indicatorHeight } =
    getAdjustedMagnifiedDimensions(
      viewBoxWidth,
      viewBoxHeight,
      currentZoom,
      leftoverWidth,
      leftoverHeight,
    );

  // Convert cursor to SVG coordinates (accounting for preserveAspectRatio)
  const viewport = getRenderedViewport(
    svgRect,
    viewBoxX,
    viewBoxY,
    viewBoxWidth,
    viewBoxHeight,
  );
  const svgOffsetX = svgRect.left - containerRect.left + viewport.letterboxX;
  const svgOffsetY = svgRect.top - containerRect.top + viewport.letterboxY;

  const cursorSvgX =
    (cursorPosition.x - svgOffsetX) / viewport.scale + viewBoxX;
  const cursorSvgY =
    (cursorPosition.y - svgOffsetY) / viewport.scale + viewBoxY;

  // Indicator box in SVG coordinates
  const indSvgLeft = cursorSvgX - indicatorWidth / 2;
  const indSvgTop = cursorSvgY - indicatorHeight / 2;
  const indSvgRight = indSvgLeft + indicatorWidth;
  const indSvgBottom = indSvgTop + indicatorHeight;

  // Convert indicator corners to screen coordinates
  const svgToScreen = (svgX: number, svgY: number): Point => ({
    x: (svgX - viewBoxX) * viewport.scale + svgOffsetX,
    y: (svgY - viewBoxY) * viewport.scale + svgOffsetY,
  });

  const indTL = svgToScreen(indSvgLeft, indSvgTop);
  const indTR = svgToScreen(indSvgRight, indSvgTop);
  const indBL = svgToScreen(indSvgLeft, indSvgBottom);
  const indBR = svgToScreen(indSvgRight, indSvgBottom);

  // Magnifier corners in screen coordinates
  const magTL = { x: magLeft, y: magTop };
  const magTR = { x: magLeft + magnifierWidth, y: magTop };
  const magBL = { x: magLeft, y: magTop + magnifierHeight };
  const magBR = { x: magLeft + magnifierWidth, y: magTop + magnifierHeight };

  // Define the corner pairs with identifiers
  const cornerPairs = [
    { from: indTL, to: magTL, corner: indTL },
    { from: indTR, to: magTR, corner: indTR },
    { from: indBL, to: magBL, corner: indBL },
    { from: indBR, to: magBR, corner: indBR },
  ];

  // Filter out lines that pass through either rectangle
  const visibleCornerPairs = cornerPairs.filter(({ from, to }) => {
    // Check if line passes through magnifier
    const passesThroughMag = linePassesThroughRect(
      from,
      to,
      magLeft,
      magTop,
      magLeft + magnifierWidth,
      magTop + magnifierHeight,
    );
    // Check if line passes through indicator
    const passesThroughInd = linePassesThroughRect(
      from,
      to,
      indTL.x,
      indTL.y,
      indBR.x,
      indBR.y,
    );
    return !passesThroughMag && !passesThroughInd;
  });

  const paths = visibleCornerPairs.map(({ from, to }) =>
    createBezierPath(from, to),
  );
  const visibleCorners = visibleCornerPairs.map(({ corner }) => corner);

  // Color based on zoom level (matches magnifier border)
  const isHighZoom = currentZoom > highZoomThreshold;
  const lineColor = isHighZoom
    ? isDark
      ? "#fbbf24"
      : "#f59e0b" // gold
    : isDark
      ? "#60a5fa"
      : "#3b82f6"; // blue
  const glowColor = isHighZoom
    ? "rgba(251, 191, 36, 0.6)"
    : "rgba(96, 165, 250, 0.6)";

  return (
    <svg
      data-element="zoom-lines"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 99, // Just below magnifier (100)
        overflow: "visible",
      }}
    >
      <defs>
        {/* Gradient for lines - fades toward magnifier */}
        <linearGradient
          id="zoom-line-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.8" />
          <stop offset="40%" stopColor={lineColor} stopOpacity="0.5" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.2" />
        </linearGradient>

        {/* Glow filter for premium effect */}
        <filter
          id="zoom-line-glow"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Animated dash pattern */}
        <pattern
          id="dash-pattern"
          patternUnits="userSpaceOnUse"
          width="12"
          height="1"
        >
          <rect width="8" height="1" fill={lineColor} opacity="0.6" />
        </pattern>
      </defs>

      {/* Glow layer (underneath) */}
      <g filter="url(#zoom-line-glow)" opacity={0.4}>
        {paths.map((d, i) => (
          <path
            key={`glow-${i}`}
            d={d}
            fill="none"
            stroke={glowColor}
            strokeWidth="6"
            strokeLinecap="round"
          />
        ))}
      </g>

      {/* Main lines with gradient */}
      <g opacity={targetOpacity}>
        {paths.map((d, i) => (
          <path
            key={`line-${i}`}
            d={d}
            fill="none"
            stroke="url(#zoom-line-gradient)"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              // Subtle animation for the lines
              strokeDasharray: "8 4",
              strokeDashoffset: "0",
              animation: "zoom-line-flow 1s linear infinite",
            }}
          />
        ))}
      </g>

      {/* Corner dots on indicator for visible lines only */}
      <g opacity={targetOpacity * 0.8}>
        {visibleCorners.map((corner, i) => (
          <circle
            key={`corner-${i}`}
            cx={corner.x}
            cy={corner.y}
            r="3"
            fill={lineColor}
            opacity="0.7"
          />
        ))}
      </g>

      <style>
        {`
          @keyframes zoom-line-flow {
            from { stroke-dashoffset: 12; }
            to { stroke-dashoffset: 0; }
          }
        `}
      </style>
    </svg>
  );
}
