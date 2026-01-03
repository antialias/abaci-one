/**
 * Safe Zone Debug Overlay
 *
 * Shows debug visualization for the safe zone fitting system:
 * - Green dashed rectangle: "leftover" area (viewport minus margins)
 * - Red/orange rectangle: crop region mapped to pixels
 * - Info panel with dimensions and viewBox info
 *
 * Only rendered when visual debug mode is enabled and fillContainer is true.
 */

"use client";

import { parseViewBox } from "../../maps";
import type { MapData } from "../../types";
import type { SafeZoneMargins } from "../../maps";

// ============================================================================
// Types
// ============================================================================

export interface SafeZoneDebugOverlayProps {
  /** Current SVG dimensions */
  svgDimensions: { width: number; height: number };
  /** Safe zone margins */
  safeZoneMargins: SafeZoneMargins;
  /** Display viewBox string */
  displayViewBox: string;
  /** Current map data */
  mapData: MapData;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Debug overlay showing safe zone rectangles.
 */
export function SafeZoneDebugOverlay({
  svgDimensions,
  safeZoneMargins,
  displayViewBox,
  mapData,
}: SafeZoneDebugOverlayProps) {
  // Calculate the leftover rectangle (viewport minus margins)
  const leftoverRect = {
    left: safeZoneMargins.left,
    top: safeZoneMargins.top,
    width: svgDimensions.width - safeZoneMargins.left - safeZoneMargins.right,
    height: svgDimensions.height - safeZoneMargins.top - safeZoneMargins.bottom,
  };

  // Calculate where the crop region appears in viewport pixels
  // Using the display viewBox to map SVG coords to pixels
  const viewBox = parseViewBox(displayViewBox);

  // Use custom crop if defined, otherwise use the full original map bounds (same as displayViewBox logic)
  const originalBounds = parseViewBox(mapData.originalViewBox);
  const cropRegion = mapData.customCrop
    ? parseViewBox(mapData.customCrop)
    : originalBounds;
  const isCustomCrop = !!mapData.customCrop;

  // With preserveAspectRatio="xMidYMid meet", the SVG is letterboxed
  // Calculate the actual scale and offset
  const scaleX = svgDimensions.width / viewBox.width;
  const scaleY = svgDimensions.height / viewBox.height;
  const actualScale = Math.min(scaleX, scaleY); // "meet" uses the smaller scale

  // Calculate letterbox offsets (the SVG content is centered)
  const renderedWidth = viewBox.width * actualScale;
  const renderedHeight = viewBox.height * actualScale;
  const offsetX = (svgDimensions.width - renderedWidth) / 2;
  const offsetY = (svgDimensions.height - renderedHeight) / 2;

  // SVG point (x, y) -> pixel, accounting for letterboxing
  const svgToPixelX = (x: number) => offsetX + (x - viewBox.x) * actualScale;
  const svgToPixelY = (y: number) => offsetY + (y - viewBox.y) * actualScale;

  const cropPixelRect = {
    left: svgToPixelX(cropRegion.x),
    top: svgToPixelY(cropRegion.y),
    width: cropRegion.width * actualScale,
    height: cropRegion.height * actualScale,
  };

  return (
    <>
      {/* Leftover rectangle (safe zone where crop should fit) - GREEN */}
      <div
        data-element="debug-leftover-rect"
        style={{
          position: "absolute",
          left: leftoverRect.left,
          top: leftoverRect.top,
          width: leftoverRect.width,
          height: leftoverRect.height,
          border: "3px dashed rgba(0, 255, 0, 0.8)",
          backgroundColor: "rgba(0, 255, 0, 0.05)",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            background: "rgba(0, 255, 0, 0.9)",
            color: "black",
            padding: "2px 6px",
            fontSize: "11px",
            fontWeight: "bold",
            borderRadius: "3px",
          }}
        >
          LEFTOVER ({Math.round(leftoverRect.width)}×
          {Math.round(leftoverRect.height)})
        </span>
      </div>

      {/* Crop region mapped to pixels - RED for custom, ORANGE for full map */}
      <div
        data-element="debug-crop-rect"
        style={{
          position: "absolute",
          left: cropPixelRect.left,
          top: cropPixelRect.top,
          width: cropPixelRect.width,
          height: cropPixelRect.height,
          border: `3px ${isCustomCrop ? "solid" : "dashed"} ${isCustomCrop ? "rgba(255, 0, 0, 0.8)" : "rgba(255, 165, 0, 0.8)"}`,
          backgroundColor: isCustomCrop
            ? "rgba(255, 0, 0, 0.05)"
            : "rgba(255, 165, 0, 0.05)",
          pointerEvents: "none",
          zIndex: 9998,
        }}
      >
        <span
          style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            background: isCustomCrop
              ? "rgba(255, 0, 0, 0.9)"
              : "rgba(255, 165, 0, 0.9)",
            color: isCustomCrop ? "white" : "black",
            padding: "2px 6px",
            fontSize: "11px",
            fontWeight: "bold",
            borderRadius: "3px",
          }}
        >
          {isCustomCrop ? "CROP" : "FULL MAP"} (
          {Math.round(cropPixelRect.width)}×{Math.round(cropPixelRect.height)})
        </span>
      </div>

      {/* Info panel showing calculations */}
      <div
        data-element="debug-safe-zone-info"
        style={{
          position: "absolute",
          bottom: 10,
          left: 10,
          background: "rgba(0, 0, 0, 0.85)",
          color: "white",
          padding: "8px 12px",
          fontSize: "11px",
          fontFamily: "monospace",
          borderRadius: "6px",
          pointerEvents: "none",
          zIndex: 9999,
          lineHeight: 1.4,
        }}
      >
        <div>
          <strong>Safe Zone Debug</strong>
        </div>
        <div>
          Viewport: {Math.round(svgDimensions.width)}×
          {Math.round(svgDimensions.height)}
        </div>
        <div>
          Margins: T={safeZoneMargins.top} R={safeZoneMargins.right} B=
          {safeZoneMargins.bottom} L=
          {safeZoneMargins.left}
        </div>
        <div style={{ color: "#0f0" }}>
          Leftover: {Math.round(leftoverRect.width)}×
          {Math.round(leftoverRect.height)}
        </div>
        <div style={{ color: isCustomCrop ? "#f00" : "#ffa500" }}>
          {isCustomCrop ? "Crop" : "Full Map"} (px):{" "}
          {Math.round(cropPixelRect.width)}×{Math.round(cropPixelRect.height)}
        </div>
        <div>ViewBox: {displayViewBox}</div>
      </div>
    </>
  );
}
