/**
 * Heat Crosshair Component
 *
 * Reusable compass-style crosshair SVG with heat-based styling.
 * Features rotating outer ring with fixed north indicator.
 */

"use client";

import { animated, type SpringValue } from "@react-spring/web";
import { memo } from "react";
import type { HeatCrosshairStyle } from "../../utils/heatStyles";

// ============================================================================
// Constants
// ============================================================================

const COMPASS_ANGLES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

// ============================================================================
// Types
// ============================================================================

export interface HeatCrosshairProps {
  /** Size of the crosshair in pixels */
  size: number;
  /** Rotation angle spring value (degrees) */
  rotationAngle: SpringValue<number>;
  /** Heat-based styling for crosshair */
  heatStyle: HeatCrosshairStyle;
  /** Drop shadow intensity (0-1), default 0.5 */
  shadowIntensity?: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Compass-style crosshair SVG with heat-based styling.
 *
 * Renders:
 * - Outer ring that rotates based on heat level
 * - 12 compass tick marks (cardinal directions highlighted in white)
 * - Center dot
 * - North indicator (red triangle) that counter-rotates to stay pointing up
 *
 * All dimensions are calculated proportionally based on the `size` prop.
 *
 * @example
 * ```tsx
 * <HeatCrosshair
 *   size={32}
 *   rotationAngle={rotationAngleSpring}
 *   heatStyle={crosshairHeatStyle}
 * />
 * ```
 */
export const HeatCrosshair = memo(function HeatCrosshair({
  size,
  rotationAngle,
  heatStyle,
  shadowIntensity = 0.5,
}: HeatCrosshairProps) {
  // Calculate proportional dimensions based on size
  const center = size / 2;
  const ringRadius = size * 0.40625; // 13/32 or 16/40
  const cardinalInnerR = ringRadius * 0.69; // 9/13 or 10/16
  const minorInnerR = ringRadius * 0.846; // 11/13 or 14/16
  const centerDotRadius = size * 0.047; // 1.5/32 or ~1.9/40
  const northTriangleSize = size * 0.125; // 4/32 or 5/40

  // Cardinal tick stroke width scales with size
  const cardinalStrokeWidth = size > 36 ? 2.5 : 2;
  const shadowBlur = size > 36 ? 3 : 2;

  return (
    <animated.svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        filter: `drop-shadow(0 1px ${shadowBlur}px rgba(0,0,0,${shadowIntensity + 0.1}))`,
        transform: rotationAngle.to((a) => `rotate(${a}deg)`),
      }}
    >
      {/* Outer ring */}
      <circle
        cx={center}
        cy={center}
        r={ringRadius}
        fill="none"
        stroke={heatStyle.color}
        strokeWidth={heatStyle.strokeWidth}
        opacity={heatStyle.opacity}
      />

      {/* Compass tick marks - 12 ticks around the ring */}
      {COMPASS_ANGLES.map((angle) => {
        const isCardinal = angle % 90 === 0;
        const rad = (angle * Math.PI) / 180;
        const innerR = isCardinal ? cardinalInnerR : minorInnerR;
        const outerR = ringRadius;
        return (
          <line
            key={angle}
            x1={center + innerR * Math.sin(rad)}
            y1={center - innerR * Math.cos(rad)}
            x2={center + outerR * Math.sin(rad)}
            y2={center - outerR * Math.cos(rad)}
            stroke={isCardinal ? "white" : heatStyle.color}
            strokeWidth={isCardinal ? cardinalStrokeWidth : 1}
            strokeLinecap="round"
            opacity={heatStyle.opacity}
          />
        );
      })}

      {/* Center dot */}
      <circle
        cx={center}
        cy={center}
        r={centerDotRadius}
        fill={heatStyle.color}
        opacity={heatStyle.opacity}
      />

      {/* Counter-rotating group to keep N fixed pointing up */}
      <animated.g
        style={{
          transformOrigin: `${center}px ${center}px`,
          transform: rotationAngle.to((a) => `rotate(${-a}deg)`),
        }}
      >
        {/* North indicator - red triangle pointing up */}
        <polygon
          points={`${center},${center - ringRadius - northTriangleSize * 0.25} ${center - northTriangleSize * 0.5},${center - ringRadius + northTriangleSize * 0.75} ${center + northTriangleSize * 0.5},${center - ringRadius + northTriangleSize * 0.75}`}
          fill="#ef4444"
          opacity={0.9}
        />
      </animated.g>
    </animated.svg>
  );
});
