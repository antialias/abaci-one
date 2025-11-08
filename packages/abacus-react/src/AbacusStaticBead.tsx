/**
 * StaticBead - Pure SVG bead with no animations or interactions
 * Used by AbacusStatic for server-side rendering
 */

import type { BeadConfig, BeadStyle } from "./AbacusReact";
import type { CustomBeadContent, CustomBeadContext } from "./AbacusContext";

export interface StaticBeadProps {
  bead: BeadConfig;
  x: number;
  y: number;
  size: number;
  shape: "diamond" | "square" | "circle" | "custom";
  color: string;
  customStyle?: BeadStyle;
  customBeadContent?: CustomBeadContent;
  hideInactiveBeads?: boolean;
}

export function AbacusStaticBead({
  bead,
  x,
  y,
  size,
  shape,
  color,
  customStyle,
  customBeadContent,
  hideInactiveBeads = false,
}: StaticBeadProps) {
  // Don't render inactive beads if hideInactiveBeads is true
  if (!bead.active && hideInactiveBeads) {
    return null;
  }

  const halfSize = size / 2;
  const opacity = bead.active ? (customStyle?.opacity ?? 1) : 0.3;
  const fill = customStyle?.fill || color;
  const stroke = customStyle?.stroke || "#000";
  const strokeWidth = customStyle?.strokeWidth || 0.5;

  // Calculate offset based on shape (matching AbacusReact positioning)
  const getXOffset = () => {
    if (shape === "custom") return halfSize;
    return shape === "diamond" ? size * 0.7 : halfSize;
  };

  const getYOffset = () => {
    return halfSize;
  };

  const transform = `translate(${x - getXOffset()}, ${y - getYOffset()})`;

  const renderShape = () => {
    // Custom bead content (emoji, image, or SVG)
    if (shape === "custom" && customBeadContent) {
      // Build context for function-based custom beads
      const beadContext: CustomBeadContext = {
        type: bead.type,
        value: bead.value,
        active: bead.active,
        position: bead.position,
        placeValue: bead.placeValue,
        color,
        size,
      };

      switch (customBeadContent.type) {
        case "emoji":
          return (
            <text
              x={halfSize}
              y={halfSize}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={size * 1.5}
              opacity={opacity}
              style={{ userSelect: "none" }}
            >
              {customBeadContent.value}
            </text>
          );
        case "emoji-function": {
          const emoji = customBeadContent.value(beadContext);
          return (
            <text
              x={halfSize}
              y={halfSize}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={size * 1.5}
              opacity={opacity}
              style={{ userSelect: "none" }}
            >
              {emoji}
            </text>
          );
        }
        case "image":
          return (
            <image
              href={customBeadContent.url}
              x={0}
              y={0}
              width={customBeadContent.width || size}
              height={customBeadContent.height || size}
              opacity={opacity}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        case "image-function": {
          const imageProps = customBeadContent.value(beadContext);
          return (
            <image
              href={imageProps.url}
              x={0}
              y={0}
              width={imageProps.width || size}
              height={imageProps.height || size}
              opacity={opacity}
              preserveAspectRatio="xMidYMid meet"
            />
          );
        }
        case "svg":
          return (
            <g
              opacity={opacity}
              dangerouslySetInnerHTML={{ __html: customBeadContent.content }}
            />
          );
        case "svg-function": {
          const svgContent = customBeadContent.value(beadContext);
          return (
            <g
              opacity={opacity}
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          );
        }
      }
    }

    // Standard shapes
    switch (shape) {
      case "diamond":
        return (
          <polygon
            points={`${size * 0.7},0 ${size * 1.4},${halfSize} ${size * 0.7},${size} 0,${halfSize}`}
            fill={fill}
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
            fill={fill}
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
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            opacity={opacity}
          />
        );
    }
  };

  return (
    <g
      className={`abacus-bead ${bead.active ? "active" : "inactive"} ${hideInactiveBeads && !bead.active ? "hidden-inactive" : ""}`}
      data-testid={`bead-place-${bead.placeValue}-${bead.type}${bead.type === "earth" ? `-pos-${bead.position}` : ""}`}
      transform={transform}
      style={{ transition: "opacity 0.2s ease-in-out" }}
    >
      {renderShape()}
    </g>
  );
}
