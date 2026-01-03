/**
 * Custom Cursor Component
 *
 * Displays a compass-style crosshair cursor with optional region name label.
 * Features heat-based styling that responds to hot/cold feedback.
 */

"use client";

import type { SpringValue } from "@react-spring/web";
import { memo } from "react";
import type { HeatCrosshairStyle } from "../../utils/heatStyles";
import { HeatCrosshair } from "./HeatCrosshair";

// ============================================================================
// Types
// ============================================================================

export interface CursorPosition {
  x: number;
  y: number;
}

export interface CursorSquish {
  x: number;
  y: number;
}

export interface CustomCursorProps {
  /** Position of cursor in container coordinates */
  position: CursorPosition;
  /** Scale factors for squish effect */
  squish: CursorSquish;
  /** Rotation angle spring value (degrees) */
  rotationAngle: SpringValue<number>;
  /** Heat-based styling for crosshair */
  heatStyle: HeatCrosshairStyle;
  /** Whether dark mode is active */
  isDark: boolean;
  /** Region name to display (optional) */
  regionName?: string | null;
  /** Flag emoji to display with region name (optional) */
  flagEmoji?: string | null;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Compass-style crosshair cursor with optional region name label.
 *
 * Features:
 * - Outer ring that rotates based on heat level
 * - Compass tick marks (cardinal directions highlighted)
 * - Fixed north indicator that counter-rotates to stay pointing up
 * - Optional region name label below cursor
 * - Heat-based color/opacity/glow styling
 *
 * @example
 * ```tsx
 * <CustomCursor
 *   position={{ x: 100, y: 200 }}
 *   squish={{ x: 1, y: 1 }}
 *   rotationAngle={rotationAngleSpring}
 *   heatStyle={crosshairHeatStyle}
 *   isDark={isDark}
 *   regionName="France"
 *   flagEmoji="\uD83C\uDDEB\uD83C\uDDF7"
 * />
 * ```
 */
export const CustomCursor = memo(function CustomCursor({
  position,
  squish,
  rotationAngle,
  heatStyle,
  isDark,
  regionName,
  flagEmoji,
}: CustomCursorProps) {
  return (
    <>
      {/* Main cursor crosshair */}
      <div
        data-element="custom-cursor"
        style={{
          position: "absolute",
          left: `${position.x}px`,
          top: `${position.y}px`,
          pointerEvents: "none",
          zIndex: 200,
          transform: `translate(-50%, -50%) scale(${squish.x}, ${squish.y})`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <HeatCrosshair
          size={32}
          rotationAngle={rotationAngle}
          heatStyle={heatStyle}
        />
      </div>

      {/* Cursor region name label - shows what to find under the cursor */}
      {regionName && (
        <div
          data-element="cursor-region-label"
          style={{
            position: "absolute",
            left: `${position.x}px`,
            top: `${position.y + 22}px`,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 201,
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            backgroundColor: isDark
              ? "rgba(30, 58, 138, 0.95)"
              : "rgba(219, 234, 254, 0.95)",
            border: `2px solid ${heatStyle.color}`,
            borderRadius: "6px",
            boxShadow:
              heatStyle.glowColor !== "transparent"
                ? `0 2px 8px rgba(0, 0, 0, 0.3), 0 0 12px ${heatStyle.glowColor}`
                : "0 2px 8px rgba(0, 0, 0, 0.3)",
            whiteSpace: "nowrap",
            opacity: Math.max(0.5, heatStyle.opacity), // Keep label visible but dimmed
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: "bold",
              color: isDark ? "#93c5fd" : "#1e40af",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Find
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: "bold",
              color: isDark ? "white" : "#1e3a8a",
            }}
          >
            {regionName}
          </span>
          {flagEmoji && <span style={{ fontSize: "14px" }}>{flagEmoji}</span>}
        </div>
      )}
    </>
  );
});
