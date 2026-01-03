"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { useSpringValue } from "@react-spring/web";
import { useState, useEffect } from "react";
import type { SessionMode } from "@/lib/curriculum/session-mode";
import { css } from "../../../styled-system/css";
import { MorphingBanner } from "./MorphingBanner";

// =============================================================================
// Mock Data
// =============================================================================

const mockProgressionMode: SessionMode = {
  type: "progression",
  nextSkill: {
    skillId: "heaven.5",
    displayName: "+5 (Heaven Bead)",
    pKnown: 0,
  },
  phase: {
    id: "level1-phase2",
    name: "Heaven Bead",
    primarySkillId: "heaven.5",
  } as any,
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: "Ready to learn +5 (Heaven Bead)",
};

const mockRemediationMode: SessionMode = {
  type: "remediation",
  weakSkills: [
    { skillId: "add.3", displayName: "+3", pKnown: 0.45 },
    { skillId: "add.4", displayName: "+4", pKnown: 0.52 },
  ],
  focusDescription: "Strengthening +3, +4",
  blockedPromotion: undefined,
};

const mockMaintenanceMode: SessionMode = {
  type: "maintenance",
  skillCount: 12,
  focusDescription: "All 12 skills mastered",
};

// =============================================================================
// Interactive Demo with Scrubber
// =============================================================================

interface ScrubberDemoProps {
  sessionMode: SessionMode;
  darkMode?: boolean;
}

function ScrubberDemo({ sessionMode, darkMode = false }: ScrubberDemoProps) {
  // Single unified scrubber: 0 = celebration, 0.5 = banner, 1 = nav
  const [unifiedProgress, setUnifiedProgress] = useState(0);

  // Map unified progress to two separate progress values:
  // 0.0 - 0.5: celebrationProgress goes 0→1, layoutProgress stays 0
  // 0.5 - 1.0: celebrationProgress stays 1, layoutProgress goes 0→1
  const celebrationValue = Math.min(1, unifiedProgress * 2);
  const layoutValue = Math.max(0, (unifiedProgress - 0.5) * 2);

  // Spring values
  const layoutProgress = useSpringValue(layoutValue);
  const celebrationProgress = useSpringValue(celebrationValue);
  const containerWidth = useSpringValue(400);
  const containerHeight = useSpringValue(140);

  // Update springs when scrubber changes
  useEffect(() => {
    layoutProgress.set(layoutValue);
    celebrationProgress.set(celebrationValue);

    // Adjust container size based on layout
    // Celebration/Banner: 400x140, Nav: 300x48
    containerWidth.set(lerp(400, 300, layoutValue));
    containerHeight.set(lerp(140, 48, layoutValue));
  }, [
    layoutValue,
    celebrationValue,
    layoutProgress,
    celebrationProgress,
    containerWidth,
    containerHeight,
  ]);

  // Get state label
  const getStateLabel = () => {
    if (unifiedProgress < 0.25) return "Celebration";
    if (unifiedProgress < 0.5) return "Celebration → Banner";
    if (unifiedProgress < 0.75) return "Banner → Nav";
    return "Nav";
  };

  return (
    <div
      className={css({
        padding: "2rem",
        backgroundColor: darkMode ? "#1a1a2e" : "gray.50",
        minHeight: "400px",
      })}
    >
      {/* Scrubber Controls */}
      <div
        className={css({
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: darkMode ? "gray.800" : "white",
          borderRadius: "8px",
          border: "1px solid",
          borderColor: darkMode ? "gray.700" : "gray.200",
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "0.5rem",
          })}
        >
          <label
            className={css({
              fontSize: "0.875rem",
              fontWeight: 600,
              color: darkMode ? "gray.300" : "gray.700",
              minWidth: "80px",
            })}
          >
            Progress:
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={unifiedProgress}
            onChange={(e) => setUnifiedProgress(Number(e.target.value))}
            className={css({ flex: 1 })}
          />
          <span
            className={css({
              fontSize: "0.875rem",
              fontWeight: 600,
              color: darkMode ? "gray.300" : "gray.700",
              minWidth: "50px",
              textAlign: "right",
            })}
          >
            {(unifiedProgress * 100).toFixed(0)}%
          </span>
        </div>

        {/* State indicator */}
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: darkMode ? "gray.500" : "gray.500",
          })}
        >
          <span>Celebration</span>
          <span>Banner</span>
          <span>Nav</span>
        </div>

        {/* Current state label */}
        <div
          className={css({
            marginTop: "0.5rem",
            textAlign: "center",
            fontSize: "1rem",
            fontWeight: 700,
            color: darkMode ? "yellow.300" : "yellow.600",
          })}
        >
          {getStateLabel()}
        </div>

        {/* Debug values */}
        <div
          className={css({
            marginTop: "0.5rem",
            fontSize: "0.75rem",
            color: darkMode ? "gray.500" : "gray.400",
            fontFamily: "monospace",
          })}
        >
          celebrationProgress: {celebrationValue.toFixed(2)} | layoutProgress:{" "}
          {layoutValue.toFixed(2)}
        </div>
      </div>

      {/* Banner preview container */}
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "2rem",
          backgroundColor: darkMode ? "gray.900" : "gray.100",
          borderRadius: "12px",
          minHeight: "200px",
        })}
      >
        <div
          style={{
            width: lerp(400, 300, layoutValue),
            height: lerp(140, 48, layoutValue),
            transition: "width 0.1s, height 0.1s",
          }}
        >
          <MorphingBanner
            sessionMode={sessionMode}
            onAction={() => alert("Action clicked!")}
            isLoading={false}
            isDark={darkMode}
            layoutProgress={layoutProgress}
            celebrationProgress={celebrationProgress}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
          />
        </div>
      </div>

      {/* Quick jump buttons */}
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          gap: "0.5rem",
          marginTop: "1rem",
        })}
      >
        {[
          { label: "Celebration", value: 0 },
          { label: "Banner", value: 0.5 },
          { label: "Nav", value: 1 },
        ].map(({ label, value }) => (
          <button
            key={label}
            type="button"
            onClick={() => setUnifiedProgress(value)}
            className={css({
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: unifiedProgress === value ? "bold" : "normal",
              backgroundColor:
                unifiedProgress === value
                  ? "blue.500"
                  : darkMode
                    ? "gray.700"
                    : "gray.200",
              color:
                unifiedProgress === value
                  ? "white"
                  : darkMode
                    ? "gray.300"
                    : "gray.700",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            })}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Helper
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// =============================================================================
// Two-Axis Demo (Independent Control)
// =============================================================================

function TwoAxisDemo({ sessionMode, darkMode = false }: ScrubberDemoProps) {
  const [celebrationValue, setCelebrationValue] = useState(0);
  const [layoutValue, setLayoutValue] = useState(0);

  const layoutProgress = useSpringValue(layoutValue);
  const celebrationProgress = useSpringValue(celebrationValue);
  const containerWidth = useSpringValue(400);
  const containerHeight = useSpringValue(140);

  useEffect(() => {
    layoutProgress.set(layoutValue);
    celebrationProgress.set(celebrationValue);
    containerWidth.set(lerp(400, 300, layoutValue));
    containerHeight.set(lerp(140, 48, layoutValue));
  }, [
    layoutValue,
    celebrationValue,
    layoutProgress,
    celebrationProgress,
    containerWidth,
    containerHeight,
  ]);

  return (
    <div
      className={css({
        padding: "2rem",
        backgroundColor: darkMode ? "#1a1a2e" : "gray.50",
        minHeight: "500px",
      })}
    >
      {/* Controls */}
      <div
        className={css({
          marginBottom: "2rem",
          padding: "1rem",
          backgroundColor: darkMode ? "gray.800" : "white",
          borderRadius: "8px",
          border: "1px solid",
          borderColor: darkMode ? "gray.700" : "gray.200",
        })}
      >
        {/* Celebration Progress */}
        <div className={css({ marginBottom: "1rem" })}>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            })}
          >
            <label
              className={css({
                fontSize: "0.875rem",
                fontWeight: 600,
                color: darkMode ? "gray.300" : "gray.700",
                minWidth: "140px",
              })}
            >
              Celebration:
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={celebrationValue}
              onChange={(e) => setCelebrationValue(Number(e.target.value))}
              className={css({ flex: 1 })}
            />
            <span
              className={css({
                fontSize: "0.875rem",
                color: darkMode ? "gray.400" : "gray.600",
                minWidth: "100px",
              })}
            >
              {celebrationValue === 0
                ? "Celebration"
                : celebrationValue === 1
                  ? "Normal"
                  : "Winding down"}
            </span>
          </div>
        </div>

        {/* Layout Progress */}
        <div>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            })}
          >
            <label
              className={css({
                fontSize: "0.875rem",
                fontWeight: 600,
                color: darkMode ? "gray.300" : "gray.700",
                minWidth: "140px",
              })}
            >
              Layout:
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={layoutValue}
              onChange={(e) => setLayoutValue(Number(e.target.value))}
              className={css({ flex: 1 })}
            />
            <span
              className={css({
                fontSize: "0.875rem",
                color: darkMode ? "gray.400" : "gray.600",
                minWidth: "100px",
              })}
            >
              {layoutValue === 0
                ? "Full Banner"
                : layoutValue === 1
                  ? "Compact Nav"
                  : "Transitioning"}
            </span>
          </div>
        </div>
      </div>

      {/* Banner preview */}
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "2rem",
          backgroundColor: darkMode ? "gray.900" : "gray.100",
          borderRadius: "12px",
          minHeight: "200px",
        })}
      >
        <div
          style={{
            width: lerp(400, 300, layoutValue),
            height: lerp(140, 48, layoutValue),
            transition: "width 0.1s, height 0.1s",
          }}
        >
          <MorphingBanner
            sessionMode={sessionMode}
            onAction={() => alert("Action clicked!")}
            isLoading={false}
            isDark={darkMode}
            layoutProgress={layoutProgress}
            celebrationProgress={celebrationProgress}
            containerWidth={containerWidth}
            containerHeight={containerHeight}
          />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Story Configuration
// =============================================================================

const meta: Meta<typeof ScrubberDemo> = {
  title: "Practice/MorphingBanner",
  component: ScrubberDemo,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: `
The MorphingBanner is a unified banner component that smoothly morphs through three states:

1. **Celebration** (progress 0-25%): Golden glow, shimmer effect, large text, celebratory styling
2. **Normal Banner** (progress 25-75%): Session mode colors (green/amber/blue), full-width button
3. **Compact Nav** (progress 75-100%): Condensed layout, small button on right

The component accepts two progress values:
- \`celebrationProgress\`: Controls the celebration → normal transition (time-based)
- \`layoutProgress\`: Controls the banner → nav transition (slot-based)

Both can animate simultaneously for complex transitions like "celebrating while navigating away".
        `,
      },
    },
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ScrubberDemo>;

// =============================================================================
// Stories
// =============================================================================

export const UnifiedScrubber: Story = {
  name: "Unified Scrubber (Full Continuum)",
  render: () => <ScrubberDemo sessionMode={mockProgressionMode} />,
};

export const TwoAxisControl: Story = {
  name: "Two-Axis Control (Independent)",
  render: () => <TwoAxisDemo sessionMode={mockProgressionMode} />,
};

export const DarkMode: Story = {
  render: () => <ScrubberDemo sessionMode={mockProgressionMode} darkMode />,
};

export const RemediationMode: Story = {
  render: () => <ScrubberDemo sessionMode={mockRemediationMode} />,
};

export const MaintenanceMode: Story = {
  render: () => <ScrubberDemo sessionMode={mockMaintenanceMode} />,
};

export const TwoAxisDarkMode: Story = {
  name: "Two-Axis Control (Dark Mode)",
  render: () => <TwoAxisDemo sessionMode={mockProgressionMode} darkMode />,
};
