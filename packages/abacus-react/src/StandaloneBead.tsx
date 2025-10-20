"use client";

import React from "react";
import { useSpring, animated } from "@react-spring/web";
import {
  useAbacusConfig,
  getDefaultAbacusConfig,
  type BeadShape,
} from "./AbacusContext";

export interface StandaloneBeadProps {
  /** Size of the bead in pixels */
  size?: number;
  /** Override the shape from context (diamond, circle, square) */
  shape?: BeadShape;
  /** Override the color from context */
  color?: string;
  /** Enable animation */
  animated?: boolean;
  /** Custom className */
  className?: string;
  /** Custom style */
  style?: React.CSSProperties;
  /** Active state for the bead */
  active?: boolean;
}

/**
 * Standalone Bead component that respects the AbacusDisplayContext.
 * This component renders a single abacus bead with styling from the context.
 *
 * Usage:
 * ```tsx
 * import { StandaloneBead, AbacusDisplayProvider } from '@soroban/abacus-react';
 *
 * <AbacusDisplayProvider>
 *   <StandaloneBead size={28} color="#8b5cf6" />
 * </AbacusDisplayProvider>
 * ```
 */
export const StandaloneBead: React.FC<StandaloneBeadProps> = ({
  size = 28,
  shape: shapeProp,
  color: colorProp,
  animated: animatedProp,
  className,
  style,
  active = true,
}) => {
  // Try to use context config, fallback to defaults if no context
  let contextConfig;
  try {
    contextConfig = useAbacusConfig();
  } catch {
    // No context provider, use defaults
    contextConfig = getDefaultAbacusConfig();
  }

  // Use props if provided, otherwise fall back to context config
  const shape = shapeProp ?? contextConfig.beadShape;
  const enableAnimation = animatedProp ?? contextConfig.animated;
  const color = colorProp ?? "#000000";

  const [springs, api] = useSpring(() => ({
    scale: 1,
    config: { tension: 300, friction: 20 },
  }));

  React.useEffect(() => {
    if (enableAnimation) {
      api.start({ scale: 1 });
    }
  }, [enableAnimation, api]);

  const renderShape = () => {
    const halfSize = size / 2;
    const actualColor = active ? color : "rgb(211, 211, 211)";

    switch (shape) {
      case "diamond":
        return (
          <polygon
            points={`${size * 0.7},0 ${size * 1.4},${halfSize} ${size * 0.7},${size} 0,${halfSize}`}
            fill={actualColor}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
      case "square":
        return (
          <rect
            width={size}
            height={size}
            fill={actualColor}
            stroke="#000"
            strokeWidth="0.5"
            rx="1"
          />
        );
      case "circle":
      default:
        return (
          <circle
            cx={halfSize}
            cy={halfSize}
            r={halfSize}
            fill={actualColor}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
    }
  };

  const getXOffset = () => {
    return shape === "diamond" ? size * 0.7 : size / 2;
  };

  const getYOffset = () => {
    return size / 2;
  };

  const AnimatedG = animated.g;

  return (
    <svg
      width={size * (shape === "diamond" ? 1.4 : 1)}
      height={size}
      className={className}
      style={style}
    >
      <AnimatedG
        transform={`translate(0, 0)`}
        style={
          enableAnimation
            ? {
                transform: springs.scale.to((s) => `scale(${s})`),
                transformOrigin: "center",
              }
            : undefined
        }
      >
        {renderShape()}
      </AnimatedG>
    </svg>
  );
};
