"use client";

import { useState } from "react";
import { css } from "@styled/css";
import {
  DIFFICULTY_PROFILES,
  DIFFICULTY_PROGRESSION,
  calculateRegroupingIntensity,
  calculateScaffoldingLevel,
  REGROUPING_PROGRESSION,
  SCAFFOLDING_PROGRESSION,
  findNearestValidState,
  getProfileFromConfig,
} from "../../difficultyProfiles";
import type { DisplayRules } from "../../displayRules";

export interface PlotPoint {
  id: string;
  label: string;
  pAnyStart: number;
  pAllStart: number;
  displayRules: DisplayRules;
}

export interface DifficultyPlot2DProps {
  /** Current regrouping config */
  pAnyStart: number;
  pAllStart: number;
  /** Current display rules */
  displayRules: DisplayRules;
  /** Callback when user clicks a point on the plot */
  onChange: (config: {
    pAnyStart: number;
    pAllStart: number;
    displayRules: DisplayRules;
    matchedProfile: string;
  }) => void;
  /** Whether to show the plot in dark mode */
  isDark?: boolean;
  /** Custom points to plot (instead of default difficulty presets) */
  customPoints?: PlotPoint[];
}

/**
 * Interactive 2D plot for difficulty configuration
 * Shows regrouping intensity (x-axis) vs scaffolding level (y-axis)
 * Allows users to click to select a difficulty configuration
 */
export function DifficultyPlot2D({
  pAnyStart,
  pAllStart,
  displayRules,
  onChange,
  isDark = false,
  customPoints,
}: DifficultyPlot2DProps) {
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [hoveredSkill, setHoveredSkill] = useState<PlotPoint | null>(null);

  // Use custom points if provided, otherwise use default presets
  const pointsToPlot = customPoints ?? null;

  // Make responsive - use container width with max size
  const maxSize = 500;
  const width = maxSize;
  const height = maxSize;
  const padding = 40;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;

  const currentReg = calculateRegroupingIntensity(pAnyStart, pAllStart);
  const currentScaf = calculateScaffoldingLevel(displayRules, currentReg);

  // Convert 0-10 scale to SVG coordinates
  const toX = (val: number) => padding + (val / 10) * graphWidth;
  const toY = (val: number) => height - padding - (val / 10) * graphHeight;

  // Convert SVG coordinates to 0-10 scale
  const fromX = (x: number) =>
    Math.max(0, Math.min(10, ((x - padding) / graphWidth) * 10));
  const fromY = (y: number) =>
    Math.max(0, Math.min(10, ((height - padding - y) / graphHeight) * 10));

  // Helper to calculate valid target from mouse position
  const calculateValidTarget = (
    clientX: number,
    clientY: number,
    svg: SVGSVGElement,
  ) => {
    const rect = svg.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Convert to difficulty space (0-10)
    const regroupingIntensity = fromX(x);
    const scaffoldingLevel = fromY(y);

    // Check if we're near a preset (within snap threshold)
    const snapThreshold = 1.0; // 1.0 units in 0-10 scale
    let nearestPreset: {
      distance: number;
      pAnyStart: number;
      pAllStart: number;
      displayRules: DisplayRules;
      id: string;
    } | null = null;

    // If custom points provided, snap to those instead of default presets
    if (pointsToPlot) {
      for (const point of pointsToPlot) {
        const presetReg = calculateRegroupingIntensity(
          point.pAnyStart,
          point.pAllStart,
        );
        const presetScaf = calculateScaffoldingLevel(
          point.displayRules,
          presetReg,
        );

        // Calculate Euclidean distance
        const distance = Math.sqrt(
          (regroupingIntensity - presetReg) ** 2 +
            (scaffoldingLevel - presetScaf) ** 2,
        );

        if (distance <= snapThreshold) {
          if (!nearestPreset || distance < nearestPreset.distance) {
            nearestPreset = {
              distance,
              pAnyStart: point.pAnyStart,
              pAllStart: point.pAllStart,
              displayRules: point.displayRules,
              id: point.id,
            };
          }
        }
      }
    } else {
      // Use default difficulty profiles
      for (const profileName of DIFFICULTY_PROGRESSION) {
        const p = DIFFICULTY_PROFILES[profileName];
        const presetReg = calculateRegroupingIntensity(
          p.regrouping.pAnyStart,
          p.regrouping.pAllStart,
        );
        const presetScaf = calculateScaffoldingLevel(p.displayRules, presetReg);

        // Calculate Euclidean distance
        const distance = Math.sqrt(
          (regroupingIntensity - presetReg) ** 2 +
            (scaffoldingLevel - presetScaf) ** 2,
        );

        if (distance <= snapThreshold) {
          if (!nearestPreset || distance < nearestPreset.distance) {
            nearestPreset = {
              distance,
              pAnyStart: p.regrouping.pAnyStart,
              pAllStart: p.regrouping.pAllStart,
              displayRules: p.displayRules,
              id: p.name,
            };
          }
        }
      }
    }

    // If we found a nearby preset, snap to it
    if (nearestPreset) {
      return {
        newRegrouping: {
          pAnyStart: nearestPreset.pAnyStart,
          pAllStart: nearestPreset.pAllStart,
        },
        newDisplayRules: nearestPreset.displayRules,
        matchedProfile: nearestPreset.id,
        reg: calculateRegroupingIntensity(
          nearestPreset.pAnyStart,
          nearestPreset.pAllStart,
        ),
        scaf: calculateScaffoldingLevel(
          nearestPreset.displayRules,
          calculateRegroupingIntensity(
            nearestPreset.pAnyStart,
            nearestPreset.pAllStart,
          ),
        ),
      };
    }

    // No preset nearby, use normal progression indices
    const regroupingIdx = Math.round(
      (regroupingIntensity / 10) * (REGROUPING_PROGRESSION.length - 1),
    );
    const scaffoldingIdx = Math.round(
      ((10 - scaffoldingLevel) / 10) * (SCAFFOLDING_PROGRESSION.length - 1),
    );

    // Find nearest valid state (applies pedagogical constraints)
    const validState = findNearestValidState(regroupingIdx, scaffoldingIdx);

    // Get actual values from progressions
    const newRegrouping = REGROUPING_PROGRESSION[validState.regroupingIdx];
    const newDisplayRules = SCAFFOLDING_PROGRESSION[validState.scaffoldingIdx];

    // Calculate display coordinates
    const reg = calculateRegroupingIntensity(
      newRegrouping.pAnyStart,
      newRegrouping.pAllStart,
    );
    const scaf = calculateScaffoldingLevel(newDisplayRules, reg);

    // Check if this matches a preset
    const matchedProfile = getProfileFromConfig(
      newRegrouping.pAllStart,
      newRegrouping.pAnyStart,
      newDisplayRules,
    );

    return {
      newRegrouping,
      newDisplayRules,
      matchedProfile,
      reg,
      scaf,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    // Don't show hover preview if we're already hovering over a skill
    if (hoveredSkill) {
      setHoverPoint(null);
      return;
    }

    const svg = e.currentTarget;
    const target = calculateValidTarget(e.clientX, e.clientY, svg);
    setHoverPoint({ x: target.reg, y: target.scaf });
  };

  const handleMouseLeave = () => {
    setHoverPoint(null);
    setHoveredSkill(null);
  };

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const target = calculateValidTarget(e.clientX, e.clientY, svg);

    // Call onChange with new configuration
    onChange({
      pAnyStart: target.newRegrouping.pAnyStart,
      pAllStart: target.newRegrouping.pAllStart,
      displayRules: target.newDisplayRules,
      matchedProfile: target.matchedProfile,
    });
  };

  return (
    <div
      data-component="difficulty-plot-2d"
      className={css({
        position: "relative",
        w: "full",
        display: "flex",
        justifyContent: "center",
        bg: isDark ? "gray.900" : "white",
        rounded: "lg",
        p: "4",
        border: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
      })}
    >
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={css({
          maxWidth: `${maxSize}px`,
          cursor: "crosshair",
          userSelect: "none",
        })}
      >
        {/* Grid lines */}
        {[0, 2, 4, 6, 8, 10].map((val) => (
          <g key={`grid-${val}`}>
            <line
              x1={toX(val)}
              y1={padding}
              x2={toX(val)}
              y2={height - padding}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
            <line
              x1={padding}
              y1={toY(val)}
              x2={width - padding}
              y2={toY(val)}
              stroke="#e5e7eb"
              strokeWidth="1"
              strokeDasharray="3,3"
            />
          </g>
        ))}

        {/* Axes */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="#374151"
          strokeWidth="2"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          stroke="#374151"
          strokeWidth="2"
        />

        {/* Axis labels */}
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize="13"
          fontWeight="500"
          fill="#4b5563"
        >
          Regrouping Intensity →
        </text>
        <text
          x={15}
          y={height / 2}
          textAnchor="middle"
          fontSize="13"
          fontWeight="500"
          fill="#4b5563"
          transform={`rotate(-90, 15, ${height / 2})`}
        >
          Scaffolding (more help) →
        </text>

        {/* Preset points or custom skill points */}
        {pointsToPlot ? (
          <>
            {/* Custom points (other skills in mastery progression) */}
            {/* First, render directional edges connecting skills in order */}
            {pointsToPlot.map((point, index) => {
              if (index === pointsToPlot.length - 1) return null; // Skip last point (no edge after it)

              const nextPoint = pointsToPlot[index + 1];

              const fromReg = calculateRegroupingIntensity(
                point.pAnyStart,
                point.pAllStart,
              );
              const fromScaf = calculateScaffoldingLevel(
                point.displayRules,
                fromReg,
              );
              const toReg = calculateRegroupingIntensity(
                nextPoint.pAnyStart,
                nextPoint.pAllStart,
              );
              const toScaf = calculateScaffoldingLevel(
                nextPoint.displayRules,
                toReg,
              );

              const fromX = toX(fromReg);
              const fromY = toY(fromScaf);
              const toXPos = toX(toReg);
              const toYPos = toY(toScaf);

              // Calculate arrow head
              const dx = toXPos - fromX;
              const dy = toYPos - fromY;
              const length = Math.sqrt(dx * dx + dy * dy);
              const unitX = dx / length;
              const unitY = dy / length;

              // Shorten line to not overlap with circles (radius 5)
              const startX = fromX + unitX * 8;
              const startY = fromY + unitY * 8;
              const endX = toXPos - unitX * 8;
              const endY = toYPos - unitY * 8;

              // Arrow head
              const arrowSize = 8;
              const arrowAngle = Math.PI / 6; // 30 degrees
              const angle = Math.atan2(dy, dx);

              const arrowPoint1X =
                endX - arrowSize * Math.cos(angle - arrowAngle);
              const arrowPoint1Y =
                endY - arrowSize * Math.sin(angle - arrowAngle);
              const arrowPoint2X =
                endX - arrowSize * Math.cos(angle + arrowAngle);
              const arrowPoint2Y =
                endY - arrowSize * Math.sin(angle + arrowAngle);

              return (
                <g key={`edge-${point.id}-${nextPoint.id}`}>
                  {/* Edge line */}
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke="#a855f7"
                    strokeWidth="2"
                    opacity="0.4"
                    strokeDasharray="4,2"
                  />
                  {/* Arrow head */}
                  <polygon
                    points={`${endX},${endY} ${arrowPoint1X},${arrowPoint1Y} ${arrowPoint2X},${arrowPoint2Y}`}
                    fill="#a855f7"
                    opacity="0.6"
                  />
                </g>
              );
            })}

            {/* Then render the skill points on top of edges */}
            {pointsToPlot.map((point, index) => {
              const reg = calculateRegroupingIntensity(
                point.pAnyStart,
                point.pAllStart,
              );
              const scaf = calculateScaffoldingLevel(point.displayRules, reg);

              return (
                <g
                  key={point.id}
                  onMouseEnter={(e) => {
                    e.stopPropagation();
                    setHoveredSkill(point);
                    setHoverPoint(null);
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation();
                    setHoveredSkill(null);
                  }}
                  onMouseMove={(e) => {
                    e.stopPropagation();
                  }}
                  style={{ cursor: "help" }}
                >
                  {/* Larger invisible circle for easier hovering */}
                  <circle
                    cx={toX(reg)}
                    cy={toY(scaf)}
                    r="15"
                    fill="transparent"
                  />
                  {/* Visible skill circle */}
                  <circle
                    cx={toX(reg)}
                    cy={toY(scaf)}
                    r="10"
                    fill="#9333ea"
                    stroke="#7e22ce"
                    strokeWidth="2"
                    opacity={hoveredSkill?.id === point.id ? 1 : 0.7}
                  />
                  {/* Ordinal number inside circle */}
                  <text
                    x={toX(reg)}
                    y={toY(scaf)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="11"
                    fill="white"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </>
        ) : (
          // Default difficulty presets
          DIFFICULTY_PROGRESSION.map((profileName) => {
            const p = DIFFICULTY_PROFILES[profileName];
            const reg = calculateRegroupingIntensity(
              p.regrouping.pAnyStart,
              p.regrouping.pAllStart,
            );
            const scaf = calculateScaffoldingLevel(p.displayRules, reg);

            return (
              <g key={profileName}>
                <circle
                  cx={toX(reg)}
                  cy={toY(scaf)}
                  r="5"
                  fill="#6366f1"
                  stroke="#4f46e5"
                  strokeWidth="2"
                  opacity="0.7"
                />
                <text
                  x={toX(reg)}
                  y={toY(scaf) - 10}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#4338ca"
                  fontWeight="600"
                >
                  {p.label}
                </text>
              </g>
            );
          })
        )}

        {/* Hover preview - show where click will land */}
        {hoverPoint && (
          <>
            {/* Dashed line from hover to target */}
            <line
              x1={toX(hoverPoint.x)}
              y1={toY(hoverPoint.y)}
              x2={toX(currentReg)}
              y2={toY(currentScaf)}
              stroke="#f59e0b"
              strokeWidth="2"
              strokeDasharray="5,5"
              opacity="0.5"
            />
            {/* Hover target marker */}
            <circle
              cx={toX(hoverPoint.x)}
              cy={toY(hoverPoint.y)}
              r="10"
              fill="#f59e0b"
              stroke="#d97706"
              strokeWidth="3"
              opacity="0.8"
            />
            <circle
              cx={toX(hoverPoint.x)}
              cy={toY(hoverPoint.y)}
              r="4"
              fill="white"
            />
          </>
        )}

        {/* Current position */}
        <circle
          cx={toX(currentReg)}
          cy={toY(currentScaf)}
          r="8"
          fill="#10b981"
          stroke="#059669"
          strokeWidth="3"
        />
        <circle cx={toX(currentReg)} cy={toY(currentScaf)} r="3" fill="white" />
      </svg>

      {/* Hover tooltip for skill information */}
      {hoveredSkill && pointsToPlot && (
        <div
          className={css({
            position: "absolute",
            bottom: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            bg: isDark ? "purple.900" : "purple.50",
            border: "2px solid",
            borderColor: isDark ? "purple.700" : "purple.300",
            borderRadius: "lg",
            px: "4",
            py: "2",
            boxShadow: "lg",
            pointerEvents: "none",
            zIndex: 10,
            maxWidth: "300px",
          })}
        >
          <div
            className={css({
              fontSize: "xs",
              fontWeight: "semibold",
              color: isDark ? "purple.400" : "purple.600",
              textTransform: "uppercase",
              letterSpacing: "wider",
              mb: "1",
            })}
          >
            Skill {pointsToPlot.findIndex((p) => p.id === hoveredSkill.id) + 1}
          </div>
          <div
            className={css({
              fontSize: "sm",
              fontWeight: "semibold",
              color: isDark ? "purple.100" : "purple.900",
            })}
          >
            {hoveredSkill.label}
          </div>
        </div>
      )}

      {/* Legend for custom points */}
      {pointsToPlot && (
        <div
          className={css({
            position: "absolute",
            top: "10px",
            right: "10px",
            bg: isDark ? "gray.800" : "white",
            border: "1px solid",
            borderColor: isDark ? "gray.600" : "gray.300",
            borderRadius: "md",
            px: "3",
            py: "2",
            fontSize: "xs",
            color: isDark ? "gray.300" : "gray.700",
            boxShadow: "sm",
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "2",
              mb: "1",
            })}
          >
            <div
              className={css({
                w: "20px",
                h: "20px",
                borderRadius: "full",
                bg: "#9333ea",
                border: "2px solid #7e22ce",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "10px",
                color: "white",
                fontWeight: "700",
              })}
            >
              #
            </div>
            <span>Skills in progression</span>
          </div>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "2",
            })}
          >
            <div
              className={css({
                w: "20px",
                h: "20px",
                borderRadius: "full",
                bg: "#10b981",
                border: "2px solid #059669",
              })}
            />
            <span>Current configuration</span>
          </div>
          <div
            className={css({
              mt: "2",
              pt: "2",
              borderTop: "1px solid",
              borderColor: isDark ? "gray.600" : "gray.300",
              fontSize: "10px",
              color: isDark ? "gray.400" : "gray.500",
            })}
          >
            Hover skills for details
          </div>
        </div>
      )}
    </div>
  );
}
