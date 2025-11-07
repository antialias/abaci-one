"use client";

/**
 * AbacusAnimatedBead - Interactive bead component for AbacusReact (Core Architecture)
 *
 * This is the **client-side bead component** injected into AbacusSVGRenderer by AbacusReact.
 * It provides animations and interactivity while the parent renderer handles positioning.
 *
 * ## Architecture Role:
 * - Injected into `AbacusSVGRenderer` via dependency injection (BeadComponent prop)
 * - Receives x,y position from `calculateBeadPosition()` (already calculated)
 * - Adds animations and interactions on top of the shared layout
 * - Used ONLY by AbacusReact (requires "use client")
 *
 * ## Features:
 * - ✅ React Spring animations for smooth position changes
 * - ✅ Drag gesture handling with @use-gesture/react
 * - ✅ Direction indicators for tutorials (pulsing arrows)
 * - ✅ 3D effects and gradients
 * - ✅ Click and hover interactions
 *
 * ## Comparison:
 * - `AbacusStaticBead` - Simple SVG shapes (no animations, RSC-compatible)
 * - `AbacusAnimatedBead` - This component (animations, gestures, client-only)
 *
 * Both receive the same position from `calculateBeadPosition()`, ensuring visual consistency.
 */

import React, { useCallback, useRef } from "react";
import { useSpring, animated, to } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import type { BeadComponentProps } from "./AbacusSVGRenderer";
import type { BeadConfig } from "./AbacusReact";

interface AnimatedBeadProps extends BeadComponentProps {
  // Animation controls
  enableAnimation: boolean;
  physicsConfig: any;

  // Gesture handling
  enableGestures: boolean;
  onGestureToggle?: (
    bead: BeadConfig,
    direction: "activate" | "deactivate",
  ) => void;

  // Direction indicators (for tutorials)
  showDirectionIndicator?: boolean;
  direction?: "activate" | "deactivate";
  isCurrentStep?: boolean;

  // 3D effects
  enhanced3d?: "none" | "subtle" | "realistic" | "delightful";
  columnIndex?: number;

  // Hover state from parent abacus
  isAbacusHovered?: boolean;
}

export function AbacusAnimatedBead({
  bead,
  x,
  y,
  size,
  shape,
  color,
  hideInactiveBeads,
  customStyle,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onRef,
  enableAnimation,
  physicsConfig,
  enableGestures,
  onGestureToggle,
  showDirectionIndicator,
  direction,
  isCurrentStep,
  enhanced3d = "none",
  columnIndex,
  isAbacusHovered = false,
}: AnimatedBeadProps) {
  // x, y are already calculated by AbacusSVGRenderer

  // Track hover state for showing hidden inactive beads
  const [isHovered, setIsHovered] = React.useState(false);

  // Use abacus hover if provided, otherwise use individual bead hover
  const effectiveHoverState = isAbacusHovered || isHovered;

  // Spring animation for position
  const [{ springX, springY }, api] = useSpring(() => ({
    springX: x,
    springY: y,
    config: physicsConfig,
  }));

  // Arrow pulse animation for direction indicators
  const [{ arrowPulse }, arrowApi] = useSpring(() => ({
    arrowPulse: 1,
    config: enableAnimation ? { tension: 200, friction: 10 } : { duration: 0 },
  }));

  const gestureStateRef = useRef({
    isDragging: false,
    lastDirection: null as "activate" | "deactivate" | null,
    startY: 0,
    threshold: size * 0.3,
    hasGestureTriggered: false,
  });

  // Calculate gesture direction based on bead type
  const getGestureDirection = useCallback(
    (deltaY: number) => {
      const movement = Math.abs(deltaY);
      if (movement < gestureStateRef.current.threshold) return null;

      if (bead.type === "heaven") {
        return deltaY > 0 ? "activate" : "deactivate";
      } else {
        return deltaY < 0 ? "activate" : "deactivate";
      }
    },
    [bead.type, size],
  );

  // Gesture handler
  const bind = enableGestures
    ? useDrag(
        ({ event, movement: [, deltaY], first, active }) => {
          if (first) {
            event?.preventDefault();
            gestureStateRef.current.isDragging = true;
            gestureStateRef.current.lastDirection = null;
            gestureStateRef.current.hasGestureTriggered = false;
            return;
          }

          if (!active || !gestureStateRef.current.isDragging) {
            if (!active) {
              gestureStateRef.current.isDragging = false;
              gestureStateRef.current.lastDirection = null;
              setTimeout(() => {
                gestureStateRef.current.hasGestureTriggered = false;
              }, 100);
            }
            return;
          }

          const currentDirection = getGestureDirection(deltaY);

          if (
            currentDirection &&
            currentDirection !== gestureStateRef.current.lastDirection
          ) {
            gestureStateRef.current.lastDirection = currentDirection;
            gestureStateRef.current.hasGestureTriggered = true;
            onGestureToggle?.(bead, currentDirection);
          }
        },
        {
          enabled: enableGestures,
          preventDefault: true,
        },
      )
    : () => ({});

  // Update spring animation when position changes
  React.useEffect(() => {
    if (enableAnimation) {
      api.start({ springX: x, springY: y, config: physicsConfig });
    } else {
      api.set({ springX: x, springY: y });
    }
  }, [x, y, enableAnimation, api, physicsConfig]);

  // Pulse animation for direction indicators
  React.useEffect(() => {
    if (showDirectionIndicator && direction && isCurrentStep) {
      const startPulse = () => {
        arrowApi.start({
          from: { arrowPulse: 1 },
          to: async (next) => {
            await next({ arrowPulse: 1.3 });
            await next({ arrowPulse: 1 });
          },
          loop: true,
        });
      };

      const timeoutId = setTimeout(startPulse, 200);
      return () => {
        clearTimeout(timeoutId);
        arrowApi.stop();
      };
    } else {
      arrowApi.set({ arrowPulse: 1 });
    }
  }, [showDirectionIndicator, direction, isCurrentStep, arrowApi]);

  // Render bead shape
  const renderShape = () => {
    const halfSize = size / 2;

    // Determine fill - use gradient for realistic mode, otherwise use color
    let fillValue = customStyle?.fill || color;
    if (enhanced3d === "realistic" && columnIndex !== undefined) {
      if (bead.type === "heaven") {
        fillValue = `url(#bead-gradient-${columnIndex}-heaven)`;
      } else {
        fillValue = `url(#bead-gradient-${columnIndex}-earth-${bead.position})`;
      }
    }

    // Calculate opacity based on state and settings
    let opacity: number;
    if (customStyle?.opacity !== undefined) {
      // Custom opacity always takes precedence
      opacity = customStyle.opacity;
    } else if (bead.active) {
      // Active beads are always full opacity
      opacity = 1;
    } else if (hideInactiveBeads && effectiveHoverState) {
      // Inactive beads that are hidden but being hovered show at low opacity
      opacity = 0.3;
    } else if (hideInactiveBeads) {
      // Inactive beads that are hidden and not hovered are invisible (handled below)
      opacity = 0;
    } else {
      // Inactive beads when hideInactiveBeads is false are full opacity
      opacity = 1;
    }

    const stroke = customStyle?.stroke || "#000";
    const strokeWidth = customStyle?.strokeWidth || 0.5;

    switch (shape) {
      case "diamond":
        return (
          <polygon
            points={`${size * 0.7},0 ${size * 1.4},${halfSize} ${size * 0.7},${size} 0,${halfSize}`}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
      case "square":
        return (
          <rect
            width={size}
            height={size}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
            rx="1"
            opacity={opacity}
          />
        );
      case "circle":
      default:
        return (
          <circle
            cx={halfSize}
            cy={halfSize}
            r={halfSize}
            fill={fillValue}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
    }
  };

  // Calculate offsets for shape positioning
  const getXOffset = () => {
    return shape === "diamond" ? size * 0.7 : size / 2;
  };

  const getYOffset = () => {
    return size / 2;
  };

  // Use animated.g if animations enabled, otherwise regular g
  const GElement = enableAnimation ? animated.g : "g";
  const DirectionIndicatorG =
    enableAnimation && showDirectionIndicator && direction ? animated.g : "g";

  // Build style object
  // Show pointer cursor on hidden beads so users know they can interact
  const shouldShowCursor =
    bead.active || !hideInactiveBeads || effectiveHoverState;
  const cursor = shouldShowCursor
    ? enableGestures
      ? "grab"
      : onClick
        ? "pointer"
        : "default"
    : "default";

  const beadStyle: any = enableAnimation
    ? {
        transform: to(
          [springX, springY],
          (sx, sy) =>
            `translate(${sx - getXOffset()}px, ${sy - getYOffset()}px)`,
        ),
        cursor,
        touchAction: "none" as const,
        transition: "opacity 0.2s ease-in-out",
        pointerEvents: "auto" as const, // Ensure hidden beads can still be hovered
      }
    : {
        transform: `translate(${x - getXOffset()}px, ${y - getYOffset()}px)`,
        cursor,
        touchAction: "none" as const,
        transition: "opacity 0.2s ease-in-out",
        pointerEvents: "auto" as const, // Ensure hidden beads can still be hovered
      };

  const handleClick = (event: React.MouseEvent) => {
    // Prevent click if gesture was triggered
    if (gestureStateRef.current.hasGestureTriggered) {
      event.preventDefault();
      return;
    }
    onClick?.(bead, event);
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsHovered(true);
    onMouseEnter?.(bead, e as any);
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    setIsHovered(false);
    onMouseLeave?.(bead, e as any);
  };

  return (
    <>
      <GElement
        className={`abacus-bead ${bead.active ? "active" : "inactive"} ${hideInactiveBeads && !bead.active ? "hidden-inactive" : ""}`}
        data-testid={`bead-place-${bead.placeValue}-${bead.type}${bead.type === "earth" ? `-pos-${bead.position}` : ""}`}
        style={beadStyle}
        {...bind()}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        ref={(el) => onRef?.(bead, el as any)}
      >
        {renderShape()}
      </GElement>

      {/* Direction indicator for tutorials */}
      {showDirectionIndicator && direction && (
        <DirectionIndicatorG
          className="direction-indicator"
          style={
            (enableAnimation
              ? {
                  transform: to(
                    [springX, springY, arrowPulse],
                    (sx, sy, pulse) => {
                      const centerX =
                        shape === "diamond" ? size * 0.7 : size / 2;
                      const centerY = size / 2;
                      // Scale from center: translate to position, then translate to center, scale, translate back
                      return `translate(${sx}px, ${sy}px) scale(${pulse}) translate(${-centerX}px, ${-centerY}px)`;
                    },
                  ),
                  pointerEvents: "none" as const,
                }
              : {
                  transform: `translate(${x}px, ${y}px) translate(${-(shape === "diamond" ? size * 0.7 : size / 2)}px, ${-size / 2}px)`,
                  pointerEvents: "none" as const,
                }) as any
          }
        >
          <text
            x={shape === "diamond" ? size * 0.7 : size / 2}
            y={size / 2}
            textAnchor="middle"
            dy=".35em"
            fontSize={size * 0.7}
            fill="#fbbf24"
            fontWeight="bold"
            stroke="#000"
            strokeWidth="1.5"
            paintOrder="stroke"
          >
            {bead.type === "heaven"
              ? direction === "activate"
                ? "↓"
                : "↑"
              : direction === "activate"
                ? "↑"
                : "↓"}
          </text>
        </DirectionIndicatorG>
      )}
    </>
  );
}
