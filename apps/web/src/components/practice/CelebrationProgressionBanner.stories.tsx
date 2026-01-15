import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import type { ProgressionMode } from "@/lib/curriculum/session-mode";
import { css } from "../../../styled-system/css";
import { CelebrationProgressionBanner } from "./CelebrationProgressionBanner";

// =============================================================================
// Mock Data
// =============================================================================

const mockProgressionMode: ProgressionMode = {
  type: "progression",
  nextSkill: {
    skillId: "add-5-complement-3",
    displayName: "+5 − 3",
    pKnown: 0,
  },
  phase: {
    id: "L1.add.+5-3.five",
    levelId: 1,
    operation: "addition",
    targetNumber: 2,
    usesFiveComplement: true,
    usesTenComplement: false,
    name: "Five-Complement Addition",
    description: "Learn to add using five-complement technique",
    primarySkillId: "add-5-complement-3",
    order: 5,
  },
  tutorialRequired: true,
  skipCount: 0,
  focusDescription: "Learning: +5 − 3",
};

// =============================================================================
// Helper to clear localStorage for fresh celebrations
// =============================================================================

function clearCelebrationState() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("skill-celebration-state");
  }
}

// =============================================================================
// Wrapper Components for Stories
// =============================================================================

interface StoryWrapperProps {
  children: React.ReactNode;
  isDark?: boolean;
}

function StoryWrapper({ children, isDark = false }: StoryWrapperProps) {
  return (
    <div
      className={css({
        padding: "2rem",
        minHeight: "300px",
        maxWidth: "500px",
        margin: "0 auto",
      })}
      style={{
        backgroundColor: isDark ? "#1a1a2e" : "#f5f5f5",
        borderRadius: "12px",
      }}
      data-theme={isDark ? "dark" : "light"}
    >
      {children}
    </div>
  );
}

// Interactive component with speed control
function InteractiveCelebration({
  isDark = false,
  initialSpeed = 1,
}: {
  isDark?: boolean;
  initialSpeed?: number;
}) {
  const [speed, setSpeed] = useState(initialSpeed);
  const [key, setKey] = useState(0);

  const handleReset = () => {
    clearCelebrationState();
    setKey((k) => k + 1); // Force remount
  };

  return (
    <StoryWrapper isDark={isDark}>
      <div className={css({ marginBottom: "1rem" })}>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "0.75rem",
            flexWrap: "wrap",
          })}
        >
          <label
            className={css({ fontSize: "0.875rem", fontWeight: "600" })}
            style={{ color: isDark ? "#e5e7eb" : "#374151" }}
          >
            Speed: {speed}x
          </label>
          <input
            type="range"
            min="1"
            max="120"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className={css({ flex: 1, minWidth: "100px" })}
          />
          <button
            type="button"
            onClick={handleReset}
            className={css({
              padding: "0.5rem 1rem",
              fontSize: "0.75rem",
              fontWeight: "bold",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            })}
            style={{
              backgroundColor: isDark ? "#374151" : "#e5e7eb",
              color: isDark ? "#e5e7eb" : "#374151",
            }}
          >
            🔄 Reset Celebration
          </button>
        </div>
        <p
          className={css({ fontSize: "0.75rem", fontStyle: "italic" })}
          style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
        >
          At {speed}x, the full 60-second transition takes{" "}
          {Math.round(60 / speed)} seconds
        </p>
      </div>
      <CelebrationProgressionBanner
        key={key}
        mode={mockProgressionMode}
        onAction={() => console.log("Action clicked")}
        isLoading={false}
        variant="dashboard"
        isDark={isDark}
        speedMultiplier={speed}
        disableConfetti={speed > 10} // Disable confetti at high speeds
      />
    </StoryWrapper>
  );
}

// Static progress snapshot component
function ProgressSnapshot({
  progress,
  isDark = false,
  variant = "dashboard",
}: {
  progress: number;
  isDark?: boolean;
  variant?: "dashboard" | "modal";
}) {
  return (
    <StoryWrapper isDark={isDark}>
      <div
        className={css({ marginBottom: "0.75rem", textAlign: "center" })}
        style={{ color: isDark ? "#e5e7eb" : "#374151" }}
      >
        <span className={css({ fontSize: "0.875rem", fontWeight: "600" })}>
          Progress: {Math.round(progress * 100)}%
        </span>
        <span
          className={css({
            fontSize: "0.75rem",
            marginLeft: "0.5rem",
            opacity: 0.7,
          })}
        >
          (
          {progress === 0
            ? "Full celebration"
            : progress === 1
              ? "Normal banner"
              : "Transitioning"}
          )
        </span>
      </div>
      <CelebrationProgressionBanner
        mode={mockProgressionMode}
        onAction={() => console.log("Action clicked")}
        isLoading={false}
        variant={variant}
        isDark={isDark}
        forceProgress={progress}
        disableConfetti
      />
    </StoryWrapper>
  );
}

// All progress states in a grid
function ProgressGrid({ isDark = false }: { isDark?: boolean }) {
  const progressSteps = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1];

  return (
    <div
      className={css({
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
        gap: "1.5rem",
        padding: "1rem",
      })}
      style={{ backgroundColor: isDark ? "#111827" : "#e5e7eb" }}
    >
      {progressSteps.map((progress) => (
        <ProgressSnapshot key={progress} progress={progress} isDark={isDark} />
      ))}
    </div>
  );
}

// =============================================================================
// Meta
// =============================================================================

const meta: Meta<typeof CelebrationProgressionBanner> = {
  title: "Practice/CelebrationProgressionBanner",
  component: CelebrationProgressionBanner,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof CelebrationProgressionBanner>;

// =============================================================================
// Stories
// =============================================================================

/**
 * Interactive celebration with speed control.
 * Use the slider to speed up the transition (1x = real-time, 60x = 1 second total).
 * Click "Reset Celebration" to restart from the beginning.
 */
export const Interactive: Story = {
  render: () => <InteractiveCelebration initialSpeed={10} />,
};

/**
 * Same as Interactive but in dark mode
 */
export const InteractiveDark: Story = {
  render: () => <InteractiveCelebration isDark initialSpeed={10} />,
};

/**
 * Full celebration state (progress = 0%)
 * This is what shows immediately after unlocking a skill.
 */
export const FullCelebration: Story = {
  render: () => <ProgressSnapshot progress={0} />,
};

/**
 * 25% through the transition
 */
export const Progress25: Story = {
  render: () => <ProgressSnapshot progress={0.25} />,
};

/**
 * Halfway through the transition (50%)
 */
export const Progress50: Story = {
  render: () => <ProgressSnapshot progress={0.5} />,
};

/**
 * 75% through the transition
 */
export const Progress75: Story = {
  render: () => <ProgressSnapshot progress={0.75} />,
};

/**
 * Fully transitioned to normal banner (progress = 100%)
 */
export const FullyNormal: Story = {
  render: () => <ProgressSnapshot progress={1} />,
};

/**
 * All progress states side by side for comparison
 */
export const ProgressComparison: Story = {
  render: () => <ProgressGrid />,
};

/**
 * All progress states in dark mode
 */
export const ProgressComparisonDark: Story = {
  render: () => <ProgressGrid isDark />,
};

/**
 * Modal variant at full celebration
 */
export const ModalVariantCelebration: Story = {
  render: () => <ProgressSnapshot progress={0} variant="modal" />,
};

/**
 * Modal variant at 50% progress
 */
export const ModalVariantMidway: Story = {
  render: () => <ProgressSnapshot progress={0.5} variant="modal" />,
};

/**
 * Modal variant fully transitioned
 */
export const ModalVariantNormal: Story = {
  render: () => <ProgressSnapshot progress={1} variant="modal" />,
};

/**
 * Dark mode full celebration
 */
export const DarkModeCelebration: Story = {
  render: () => <ProgressSnapshot progress={0} isDark />,
};

/**
 * Dark mode 50% progress
 */
export const DarkModeMidway: Story = {
  render: () => <ProgressSnapshot progress={0.5} isDark />,
};

/**
 * Dark mode fully normal
 */
export const DarkModeNormal: Story = {
  render: () => <ProgressSnapshot progress={1} isDark />,
};

/**
 * Tiny increments to see the subtle early changes
 */
export const SubtleEarlyTransition: Story = {
  render: () => {
    const earlySteps = [0, 0.02, 0.05, 0.08, 0.1, 0.15];
    return (
      <div className={css({ padding: "1rem" })}>
        <h3
          className={css({
            fontSize: "1rem",
            fontWeight: "bold",
            marginBottom: "1rem",
            textAlign: "center",
          })}
        >
          Early transition (0-15%) - Should be nearly imperceptible
        </h3>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1rem",
          })}
        >
          {earlySteps.map((progress) => (
            <ProgressSnapshot key={progress} progress={progress} />
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Late transition to see the rapid changes at the end
 */
export const RapidLateTransition: Story = {
  render: () => {
    const lateSteps = [0.7, 0.8, 0.85, 0.9, 0.95, 1];
    return (
      <div className={css({ padding: "1rem" })}>
        <h3
          className={css({
            fontSize: "1rem",
            fontWeight: "bold",
            marginBottom: "1rem",
            textAlign: "center",
          })}
        >
          Late transition (70-100%) - More noticeable changes
        </h3>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "1rem",
          })}
        >
          {lateSteps.map((progress) => (
            <ProgressSnapshot key={progress} progress={progress} />
          ))}
        </div>
      </div>
    );
  },
};

/**
 * Test with confetti enabled (will fire once on load)
 */
export const WithConfetti: Story = {
  render: () => {
    // Clear state on mount to ensure confetti fires
    useEffect(() => {
      clearCelebrationState();
    }, []);

    return (
      <StoryWrapper>
        <p
          className={css({
            fontSize: "0.75rem",
            marginBottom: "1rem",
            textAlign: "center",
            color: "gray.600",
          })}
        >
          Confetti should fire once when this story loads
        </p>
        <CelebrationProgressionBanner
          mode={mockProgressionMode}
          onAction={() => console.log("Action clicked")}
          isLoading={false}
          variant="dashboard"
          isDark={false}
          speedMultiplier={30} // Fast transition to see the full effect quickly
        />
      </StoryWrapper>
    );
  },
};

// =============================================================================
// Progress Scrubber Story
// =============================================================================

const PROGRESS_LABELS: { value: number; label: string; description: string }[] =
  [
    {
      value: 0,
      label: "0%",
      description:
        "Full celebration - golden glow, large emoji, wide button margins",
    },
    { value: 0.05, label: "5%", description: "Barely perceptible change" },
    { value: 0.1, label: "10%", description: "Still very celebratory" },
    {
      value: 0.2,
      label: "20%",
      description: "Subtle reduction in glow, button expanding",
    },
    {
      value: 0.3,
      label: "30%",
      description: "Emoji shrinking, colors shifting",
    },
    { value: 0.4, label: "40%", description: "Colors shifting toward green" },
    {
      value: 0.5,
      label: "50%",
      description: "Halfway - moderate size and glow",
    },
    { value: 0.6, label: "60%", description: "Wiggle diminishing" },
    { value: 0.7, label: "70%", description: "Button nearly full width" },
    { value: 0.8, label: "80%", description: "Mostly normal appearance" },
    { value: 0.9, label: "90%", description: "Nearly complete" },
    { value: 0.95, label: "95%", description: "Final touches" },
    { value: 1, label: "100%", description: "Fully normal banner" },
  ];

function ProgressScrubber({ isDark = false }: { isDark?: boolean }) {
  const [progress, setProgress] = useState(0);

  // Find the closest label for current progress
  const closestLabel = PROGRESS_LABELS.reduce((prev, curr) =>
    Math.abs(curr.value - progress) < Math.abs(prev.value - progress)
      ? curr
      : prev,
  );

  // Find exact match or null
  const exactLabel = PROGRESS_LABELS.find(
    (l) => Math.abs(l.value - progress) < 0.001,
  );

  return (
    <div
      className={css({ padding: "1.5rem", minHeight: "500px" })}
      style={{ backgroundColor: isDark ? "#111827" : "#f3f4f6" }}
      data-theme={isDark ? "dark" : "light"}
    >
      {/* Header */}
      <div
        className={css({
          maxWidth: "600px",
          margin: "0 auto 1.5rem",
          textAlign: "center",
        })}
      >
        <h2
          className={css({
            fontSize: "1.25rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
          })}
          style={{ color: isDark ? "#f3f4f6" : "#111827" }}
        >
          Progress Scrubber
        </h2>
        <p
          className={css({ fontSize: "0.875rem" })}
          style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
        >
          Drag the slider to see the transition at any point
        </p>
      </div>

      {/* Current progress display */}
      <div
        className={css({
          maxWidth: "600px",
          margin: "0 auto 1rem",
          padding: "1rem",
          borderRadius: "8px",
          textAlign: "center",
        })}
        style={{
          backgroundColor: isDark ? "#1f2937" : "#ffffff",
          border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
        }}
      >
        <div
          className={css({
            fontSize: "2rem",
            fontWeight: "bold",
            fontFamily: "monospace",
            marginBottom: "0.25rem",
          })}
          style={{ color: isDark ? "#60a5fa" : "#2563eb" }}
        >
          {(progress * 100).toFixed(1)}%
        </div>
        <div
          className={css({ fontSize: "0.875rem", fontWeight: "500" })}
          style={{ color: isDark ? "#d1d5db" : "#374151" }}
        >
          {exactLabel?.description || closestLabel.description}
        </div>
      </div>

      {/* Slider */}
      <div
        className={css({
          maxWidth: "600px",
          margin: "0 auto 1rem",
        })}
      >
        <input
          type="range"
          min="0"
          max="100"
          step="0.5"
          value={progress * 100}
          onChange={(e) => setProgress(Number(e.target.value) / 100)}
          className={css({
            width: "100%",
            height: "8px",
            borderRadius: "4px",
            cursor: "pointer",
          })}
        />

        {/* Tick marks with labels */}
        <div
          className={css({
            display: "flex",
            justifyContent: "space-between",
            marginTop: "0.5rem",
            position: "relative",
            height: "20px",
          })}
        >
          {PROGRESS_LABELS.filter((l) =>
            [0, 0.25, 0.5, 0.7, 1].includes(l.value),
          ).map((label) => (
            <button
              key={label.value}
              type="button"
              onClick={() => setProgress(label.value)}
              className={css({
                fontSize: "0.6875rem",
                fontWeight: "600",
                cursor: "pointer",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "none",
                transition: "all 0.15s ease",
              })}
              style={{
                position: "absolute",
                left: `${label.value * 100}%`,
                transform: "translateX(-50%)",
                backgroundColor:
                  Math.abs(progress - label.value) < 0.02
                    ? isDark
                      ? "#3b82f6"
                      : "#2563eb"
                    : isDark
                      ? "#374151"
                      : "#e5e7eb",
                color:
                  Math.abs(progress - label.value) < 0.02
                    ? "#ffffff"
                    : isDark
                      ? "#9ca3af"
                      : "#6b7280",
              }}
            >
              {label.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preset buttons */}
      <div
        className={css({
          maxWidth: "600px",
          margin: "0 auto 1.5rem",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem",
          justifyContent: "center",
        })}
      >
        {PROGRESS_LABELS.map((label) => (
          <button
            key={label.value}
            type="button"
            onClick={() => setProgress(label.value)}
            className={css({
              fontSize: "0.75rem",
              padding: "0.375rem 0.75rem",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
              fontWeight: "500",
              transition: "all 0.15s ease",
            })}
            style={{
              backgroundColor:
                Math.abs(progress - label.value) < 0.001
                  ? isDark
                    ? "#3b82f6"
                    : "#2563eb"
                  : isDark
                    ? "#374151"
                    : "#e5e7eb",
              color:
                Math.abs(progress - label.value) < 0.001
                  ? "#ffffff"
                  : isDark
                    ? "#d1d5db"
                    : "#374151",
            }}
          >
            {label.label}
          </button>
        ))}
      </div>

      {/* Banner preview */}
      <div className={css({ maxWidth: "500px", margin: "0 auto" })}>
        <CelebrationProgressionBanner
          mode={mockProgressionMode}
          onAction={() => console.log("Action clicked")}
          isLoading={false}
          variant="dashboard"
          isDark={isDark}
          forceProgress={progress}
          disableConfetti
        />
      </div>

      {/* Properties being interpolated at this progress */}
      <div
        className={css({
          maxWidth: "600px",
          margin: "1.5rem auto 0",
          padding: "1rem",
          borderRadius: "8px",
          fontSize: "0.75rem",
          fontFamily: "monospace",
        })}
        style={{
          backgroundColor: isDark ? "#1f2937" : "#ffffff",
          border: `1px solid ${isDark ? "#374151" : "#e5e7eb"}`,
          color: isDark ? "#9ca3af" : "#6b7280",
        }}
      >
        <div className={css({ fontWeight: "bold", marginBottom: "0.5rem" })}>
          Key values at {(progress * 100).toFixed(0)}%:
        </div>
        <div
          className={css({
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.25rem",
          })}
        >
          <span>Emoji size:</span>
          <span style={{ color: isDark ? "#fbbf24" : "#d97706" }}>
            {Math.round(64 - 32 * progress)}px
          </span>
          <span>Emoji wiggle:</span>
          <span style={{ color: isDark ? "#34d399" : "#059669" }}>
            ±{(3 * (1 - progress)).toFixed(1)}°
          </span>
          <span>Title size:</span>
          <span>{Math.round(28 - 12 * progress)}px</span>
          <span>Border width:</span>
          <span>{(3 - progress).toFixed(1)}px</span>
          <span>Button margin X:</span>
          <span>{Math.round(80 - 80 * progress)}px</span>
          <span>Button radius:</span>
          <span>{Math.round(12 - 12 * progress)}px</span>
          <span>Shimmer:</span>
          <span>
            {progress < 0.5 ? "visible" : progress < 1 ? "fading" : "hidden"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Interactive progress scrubber with labeled positions.
 * Click preset buttons or drag slider to jump to specific progress values.
 * Use the percentage labels when discussing specific transition states.
 */
export const Scrubber: Story = {
  render: () => <ProgressScrubber />,
};

/**
 * Same scrubber in dark mode
 */
export const ScrubberDark: Story = {
  render: () => <ProgressScrubber isDark />,
};
