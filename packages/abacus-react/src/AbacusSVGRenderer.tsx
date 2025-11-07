/**
 * AbacusSVGRenderer - Shared SVG rendering component (Core Architecture)
 *
 * This is the **single SVG renderer** used by both AbacusStatic and AbacusReact to guarantee
 * pixel-perfect visual consistency. It implements dependency injection to support different
 * bead components while maintaining identical layout.
 *
 * ## Architecture Role:
 * ```
 * AbacusStatic + AbacusReact
 *         ↓
 * calculateStandardDimensions() ← Single source for all layout dimensions
 *         ↓
 * AbacusSVGRenderer ← This component (shared structure)
 *         ↓
 * calculateBeadPosition() ← Exact positioning for every bead
 *         ↓
 * BeadComponent (injected) ← AbacusStaticBead OR AbacusAnimatedBead
 * ```
 *
 * ## Key Features:
 * - ✅ No "use client" directive - works in React Server Components
 * - ✅ No hooks or state - pure rendering from props
 * - ✅ Dependency injection for bead components
 * - ✅ Supports 3D gradients, background glows, overlays (via props)
 * - ✅ Same props → same dimensions → same positions → same layout
 *
 * ## Why This Matters:
 * Before this architecture, AbacusStatic and AbacusReact had ~700 lines of duplicate
 * SVG rendering code with separate dimension calculations. This led to layout inconsistencies.
 * Now they share this single renderer, eliminating duplication and guaranteeing consistency.
 */

import React from "react";
import type { AbacusLayoutDimensions } from "./AbacusUtils";
import type {
  BeadConfig,
  AbacusCustomStyles,
  ValidPlaceValues,
} from "./AbacusReact";
import {
  numberToAbacusState,
  calculateBeadPosition,
  calculateAbacusCrop,
  type AbacusState,
  type CropPadding,
} from "./AbacusUtils";

/**
 * Props that bead components must accept
 */
export interface BeadComponentProps {
  bead: BeadConfig;
  x: number;
  y: number;
  size: number;
  shape: "circle" | "diamond" | "square";
  color: string;
  hideInactiveBeads: boolean;
  customStyle?: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
  };
  onClick?: (bead: BeadConfig, event?: React.MouseEvent) => void;
  onMouseEnter?: (bead: BeadConfig, event?: React.MouseEvent) => void;
  onMouseLeave?: (bead: BeadConfig, event?: React.MouseEvent) => void;
  onRef?: (bead: BeadConfig, element: SVGElement | null) => void;
}

/**
 * Props for the SVG renderer
 */
export interface AbacusSVGRendererProps {
  // Core data
  value: number | bigint;
  columns: number;
  state: AbacusState;
  beadConfigs: BeadConfig[][]; // Array of columns, each containing beads

  // Layout
  dimensions: AbacusLayoutDimensions;
  scaleFactor?: number;

  // Appearance
  beadShape: "circle" | "diamond" | "square";
  colorScheme: string;
  colorPalette: string;
  hideInactiveBeads: boolean;
  frameVisible: boolean;
  showNumbers: boolean;
  customStyles?: AbacusCustomStyles;
  interactive?: boolean; // Enable interactive CSS styles

  // Cropping
  cropToActiveBeads?: boolean | { padding?: CropPadding };

  // Tutorial features
  highlightColumns?: number[];
  columnLabels?: string[];

  // 3D Enhancement (optional - only used by AbacusReact)
  defsContent?: React.ReactNode; // Custom defs content (gradients, patterns, etc.)

  // Additional content (overlays, etc.)
  children?: React.ReactNode; // Rendered at the end of the SVG

  // Dependency injection
  BeadComponent: React.ComponentType<any>; // Accept any bead component (base props + extra props)
  getBeadColor: (
    bead: BeadConfig,
    totalColumns: number,
    colorScheme: string,
    colorPalette: string,
  ) => string;

  // Event handlers (optional, passed through to beads)
  onBeadClick?: (bead: BeadConfig, event?: React.MouseEvent) => void;
  onBeadMouseEnter?: (bead: BeadConfig, event?: React.MouseEvent) => void;
  onBeadMouseLeave?: (bead: BeadConfig, event?: React.MouseEvent) => void;
  onBeadRef?: (bead: BeadConfig, element: SVGElement | null) => void;

  // Extra props calculator (for animations, gestures, etc.)
  // This function is called for each bead to get extra props
  calculateExtraBeadProps?: (
    bead: BeadConfig,
    baseProps: BeadComponentProps,
  ) => Record<string, any>;
}

/**
 * Pure SVG renderer for abacus
 * Uses dependency injection to support both static and animated beads
 */
export function AbacusSVGRenderer({
  value,
  columns,
  state,
  beadConfigs,
  dimensions,
  scaleFactor = 1,
  beadShape,
  colorScheme,
  colorPalette,
  hideInactiveBeads,
  frameVisible,
  showNumbers,
  customStyles,
  interactive = false,
  cropToActiveBeads,
  highlightColumns = [],
  columnLabels = [],
  defsContent,
  children,
  BeadComponent,
  getBeadColor,
  onBeadClick,
  onBeadMouseEnter,
  onBeadMouseLeave,
  onBeadRef,
  calculateExtraBeadProps,
}: AbacusSVGRendererProps) {
  const {
    width,
    height,
    rodSpacing,
    barY,
    beadSize,
    barThickness,
    labelHeight,
    numbersHeight,
  } = dimensions;

  // Calculate crop viewBox if enabled
  let viewBox = `0 0 ${width} ${height}`;
  let svgWidth = width;
  let svgHeight = height;

  if (cropToActiveBeads) {
    const padding =
      typeof cropToActiveBeads === "object"
        ? cropToActiveBeads.padding
        : undefined;
    // Use the actual scaleFactor so crop calculations match the rendered abacus size
    const crop = calculateAbacusCrop(
      Number(value),
      columns,
      scaleFactor,
      padding,
    );
    viewBox = crop.viewBox;
    svgWidth = crop.width;
    svgHeight = crop.height;
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={svgWidth}
      height={svgHeight}
      viewBox={viewBox}
      className={`abacus-svg ${hideInactiveBeads ? "hide-inactive-mode" : ""} ${interactive ? "interactive" : ""}`}
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        <style>{`
          /* CSS-based opacity system for hidden inactive beads */
          .abacus-bead {
            transition: opacity 0.2s ease-in-out;
          }

          /* Hidden inactive beads are invisible by default */
          .hide-inactive-mode .abacus-bead.hidden-inactive {
            opacity: 0;
          }

          /* Interactive abacus: When hovering over the abacus, hidden inactive beads become semi-transparent */
          .abacus-svg.hide-inactive-mode.interactive:hover .abacus-bead.hidden-inactive {
            opacity: 0.5;
          }

          /* Interactive abacus: When hovering over a specific hidden inactive bead, it becomes fully visible */
          .hide-inactive-mode.interactive .abacus-bead.hidden-inactive:hover {
            opacity: 1 !important;
          }

          /* Non-interactive abacus: Hidden inactive beads always stay at opacity 0 */
          .abacus-svg.hide-inactive-mode:not(.interactive) .abacus-bead.hidden-inactive {
            opacity: 0 !important;
          }
        `}</style>

        {/* Custom defs content (for 3D gradients, patterns, etc.) */}
        {defsContent}
      </defs>

      {/* Background glow effects - rendered behind everything */}
      {Array.from({ length: columns }, (_, colIndex) => {
        const placeValue = columns - 1 - colIndex;
        const columnStyles = customStyles?.columns?.[colIndex];
        const backgroundGlow = columnStyles?.backgroundGlow;

        if (!backgroundGlow) return null;

        const x = colIndex * rodSpacing + rodSpacing / 2;
        const glowWidth = rodSpacing + (backgroundGlow.spread || 0);
        const glowHeight = height + (backgroundGlow.spread || 0);

        return (
          <rect
            key={`background-glow-pv${placeValue}`}
            x={x - glowWidth / 2}
            y={-(backgroundGlow.spread || 0) / 2}
            width={glowWidth}
            height={glowHeight}
            fill={backgroundGlow.fill || "rgba(59, 130, 246, 0.2)"}
            filter={
              backgroundGlow.blur ? `blur(${backgroundGlow.blur}px)` : "none"
            }
            opacity={backgroundGlow.opacity ?? 0.6}
            rx={8}
            style={{ pointerEvents: "none" }}
          />
        );
      })}

      {/* Column highlights */}
      {highlightColumns.map((colIndex) => {
        if (colIndex < 0 || colIndex >= columns) return null;

        const x = colIndex * rodSpacing + rodSpacing / 2;
        const highlightWidth = rodSpacing * 0.9;
        const highlightHeight = height - labelHeight - numbersHeight;

        return (
          <rect
            key={`column-highlight-${colIndex}`}
            x={x - highlightWidth / 2}
            y={labelHeight}
            width={highlightWidth}
            height={highlightHeight}
            fill="rgba(59, 130, 246, 0.15)"
            stroke="rgba(59, 130, 246, 0.4)"
            strokeWidth={2}
            rx={6}
            style={{ pointerEvents: "none" }}
          />
        );
      })}

      {/* Column labels */}
      {columnLabels.map((label, colIndex) => {
        if (!label || colIndex >= columns) return null;

        const x = colIndex * rodSpacing + rodSpacing / 2;

        return (
          <text
            key={`column-label-${colIndex}`}
            x={x}
            y={labelHeight / 2 + 5}
            textAnchor="middle"
            fontSize="14"
            fontWeight="600"
            fill="rgba(0, 0, 0, 0.7)"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {label}
          </text>
        );
      })}

      {/* Rods (column posts) */}
      {frameVisible &&
        beadConfigs.map((_, colIndex) => {
          const placeValue = columns - 1 - colIndex;
          const x = colIndex * rodSpacing + rodSpacing / 2;

          // Apply custom column post styling (column-specific overrides global)
          const columnStyles = customStyles?.columns?.[colIndex];
          const globalColumnPosts = customStyles?.columnPosts;
          const rodStyle = {
            fill:
              columnStyles?.columnPost?.fill ||
              globalColumnPosts?.fill ||
              "rgb(0, 0, 0, 0.1)",
            stroke:
              columnStyles?.columnPost?.stroke ||
              globalColumnPosts?.stroke ||
              "none",
            strokeWidth:
              columnStyles?.columnPost?.strokeWidth ??
              globalColumnPosts?.strokeWidth ??
              0,
            opacity:
              columnStyles?.columnPost?.opacity ??
              globalColumnPosts?.opacity ??
              1,
          };

          return (
            <rect
              key={`rod-pv${placeValue}`}
              x={x - dimensions.rodWidth / 2}
              y={labelHeight}
              width={dimensions.rodWidth}
              height={height - labelHeight - numbersHeight}
              fill={rodStyle.fill}
              stroke={rodStyle.stroke}
              strokeWidth={rodStyle.strokeWidth}
              opacity={rodStyle.opacity}
              className="column-post"
            />
          );
        })}

      {/* Reckoning bar */}
      {frameVisible && (
        <rect
          x={0}
          y={barY}
          width={columns * rodSpacing}
          height={barThickness}
          fill={customStyles?.reckoningBar?.fill || "rgb(0, 0, 0, 0.15)"}
          stroke={customStyles?.reckoningBar?.stroke || "rgba(0, 0, 0, 0.3)"}
          strokeWidth={customStyles?.reckoningBar?.strokeWidth || 2}
          opacity={customStyles?.reckoningBar?.opacity ?? 1}
        />
      )}

      {/* Beads - delegated to injected component */}
      {beadConfigs.map((columnBeads, colIndex) => {
        const placeValue = columns - 1 - colIndex;
        // Get column state for inactive earth bead positioning
        const columnState = state[placeValue] || {
          heavenActive: false,
          earthActive: 0,
        };

        return (
          <g key={`column-${colIndex}`}>
            {columnBeads.map((bead, beadIndex) => {
              // Calculate position using shared utility with column state for accurate positioning
              const position = calculateBeadPosition(bead, dimensions, {
                earthActive: columnState.earthActive,
              });
              const color = getBeadColor(
                bead,
                columns,
                colorScheme,
                colorPalette,
              );

              // Get custom style for this specific bead
              const customStyle =
                bead.type === "heaven"
                  ? customStyles?.heavenBeads
                  : customStyles?.earthBeads;

              // Build base props
              const baseProps: BeadComponentProps = {
                bead,
                x: position.x,
                y: position.y,
                size: beadSize,
                shape: beadShape,
                color,
                hideInactiveBeads,
                customStyle,
                onClick: onBeadClick,
                onMouseEnter: onBeadMouseEnter,
                onMouseLeave: onBeadMouseLeave,
                onRef: onBeadRef,
              };

              // Calculate extra props if provided (for animations, etc.)
              const extraProps =
                calculateExtraBeadProps?.(bead, baseProps) || {};

              return (
                <BeadComponent
                  key={`bead-pv${bead.placeValue}-${bead.type}-${bead.position}`}
                  {...baseProps}
                  {...extraProps}
                />
              );
            })}
          </g>
        );
      })}

      {/* Column numbers */}
      {showNumbers &&
        beadConfigs.map((_, colIndex) => {
          const placeValue = columns - 1 - colIndex;
          const columnState = state[placeValue] || {
            heavenActive: false,
            earthActive: 0,
          };
          const digit =
            (columnState.heavenActive ? 5 : 0) + columnState.earthActive;
          const x = colIndex * rodSpacing + rodSpacing / 2;

          return (
            <text
              key={`number-${colIndex}`}
              x={x}
              y={height - numbersHeight / 2 + 5}
              textAnchor="middle"
              fontSize={customStyles?.numerals?.fontSize || "16px"}
              fontWeight={customStyles?.numerals?.fontWeight || "600"}
              fill={customStyles?.numerals?.color || "rgba(0, 0, 0, 0.8)"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {digit}
            </text>
          );
        })}

      {/* Additional content (overlays, numbers, etc.) */}
      {children}
    </svg>
  );
}

export default AbacusSVGRenderer;
