/**
 * Crosshair Rotation Hook
 *
 * Manages the continuous rotation animation of the heat crosshair based on
 * the hot/cold feedback system. Uses a spring-for-speed, manual-integration-for-angle
 * pattern for smooth transitions.
 *
 * Pattern:
 * 1. Spring animates the SPEED (degrees per second) - smooth transitions
 * 2. requestAnimationFrame loop integrates angle from speed
 * 3. Angle is bound to animated element via useSpringValue
 * 4. When speed is ~0, smoothly wind back to 0 degrees (upright)
 *
 * Usage:
 * ```tsx
 * const { rotationAngle } = useCrosshairRotation({
 *   targetSpeedDegPerSec: heatLevel * 360, // e.g., 0-360 deg/s based on proximity
 * })
 *
 * // Use with react-spring animated component
 * <animated.div style={{ transform: rotationAngle.to(a => `rotate(${a}deg)`) }} />
 * ```
 */

"use client";

import { useEffect, useRef } from "react";
import { useSpringValue, type SpringValue } from "@react-spring/web";

// ============================================================================
// Types
// ============================================================================

export interface UseCrosshairRotationOptions {
  /** Target rotation speed in degrees per second. 0 = stopped, higher = faster spin */
  targetSpeedDegPerSec: number;
}

export interface UseCrosshairRotationReturn {
  /** Animated rotation angle (degrees) - use with react-spring's animated components */
  rotationAngle: SpringValue<number>;
  /** Current rotation speed - useful for debugging */
  rotationSpeed: SpringValue<number>;
}

// ============================================================================
// Constants
// ============================================================================

/** Speed threshold below which we consider "stopped" and wind back to upright */
const WIND_BACK_THRESHOLD = 5; // deg/s

/** Prevent angle overflow after hours of play */
const MAX_ANGLE = 360000;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing crosshair rotation animation.
 *
 * This gives smooth speed transitions without the issues of CSS animation or
 * calling spring.start() 60 times per second.
 *
 * @param options - Configuration options
 * @returns Crosshair rotation animation values
 */
export function useCrosshairRotation(
  options: UseCrosshairRotationOptions,
): UseCrosshairRotationReturn {
  const { targetSpeedDegPerSec } = options;

  // Spring for rotation speed - this is what makes speed changes smooth
  const rotationSpeed = useSpringValue(0, {
    config: { tension: 200, friction: 30 },
  });

  // Spring value for the angle - we'll directly .set() this from the rAF loop
  // when rotating, or use spring animation when winding back to 0
  const rotationAngle = useSpringValue(0, {
    config: { tension: 120, friction: 14 }, // Gentle spring for wind-back
  });

  // Track whether we're winding back (to avoid repeated .start() calls)
  const isWindingBackRef = useRef(false);

  // Update the speed spring when target changes
  useEffect(() => {
    rotationSpeed.start(targetSpeedDegPerSec);
  }, [targetSpeedDegPerSec, rotationSpeed]);

  // requestAnimationFrame loop to integrate angle from speed
  // When speed is near 0, wind back to upright (0 degrees)
  useEffect(() => {
    let lastTime = performance.now();
    let frameId: number;

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000; // seconds
      lastTime = now;

      const speed = rotationSpeed.get(); // deg/s from the spring
      const currentAngle = rotationAngle.get();

      if (Math.abs(speed) < WIND_BACK_THRESHOLD) {
        // Speed is essentially 0 - wind back to upright
        if (!isWindingBackRef.current) {
          isWindingBackRef.current = true;
          // Find the nearest 0 (could be 0, 360, 720, etc. or -360, etc.)
          const nearestZero = Math.round(currentAngle / 360) * 360;
          rotationAngle.start(nearestZero);
        }
        // Let the spring handle it - don't set manually
      } else {
        // Speed is significant - integrate normally
        isWindingBackRef.current = false;

        let angle = currentAngle + speed * dt; // integrate

        // Keep angle in reasonable range (prevent overflow after hours of play)
        if (angle >= MAX_ANGLE) angle -= MAX_ANGLE;
        if (angle < 0) angle += 360;

        // Direct set - no extra springing on angle itself
        rotationAngle.set(angle);
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [rotationSpeed, rotationAngle]);

  return {
    rotationAngle,
    rotationSpeed,
  };
}
