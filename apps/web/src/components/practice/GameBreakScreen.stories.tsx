"use client";

import type { Meta, StoryObj } from "@storybook/react";
import { css } from "../../../styled-system/css";

/**
 * Stories for GameBreakScreen game selection and playing phases.
 *
 * NOTE: The game break timer, progress bar, and "Back to Practice" button
 * are now rendered in PracticeSubNav (not in GameBreakScreen).
 *
 * See PracticeSubNav stories for:
 * - Timer display (minutes:seconds)
 * - Progress bar shrinking animation
 * - Color transitions (green → yellow → red)
 * - "Back to Practice" button
 *
 * These stories show:
 * - Game selection screen (initializing, selecting phases)
 * - Mock game content area (playing phase)
 */

// Meta configuration
const meta: Meta = {
  title: "Practice/GameBreakScreen",
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj;

const mockStudent = {
  id: "student-sonia",
  name: "Sonia",
  emoji: "🌟",
  color: "#a855f7",
};

const mockGames = [
  { name: "matching", displayName: "Matching", icon: "🎴" },
  { name: "complement-race", displayName: "Complement Race", icon: "🏎️" },
  { name: "memory-quiz", displayName: "Memory Quiz", icon: "🧠" },
];

interface GameSelectionScreenProps {
  student: typeof mockStudent;
  phase: "initializing" | "selecting";
  remainingMs: number;
  maxDurationMs: number;
  isDark?: boolean;
  onSelectGame?: (gameName: string) => void;
  onSkip?: () => void;
}

/**
 * Game selection screen - shown before playing
 */
function GameSelectionScreen({
  student,
  phase,
  remainingMs,
  maxDurationMs,
  isDark = false,
  onSelectGame,
  onSkip,
}: GameSelectionScreenProps) {
  const remainingMinutes = Math.floor(remainingMs / 60000);
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
  const percentRemaining = (remainingMs / maxDurationMs) * 100;

  return (
    <div
      data-component="game-break-screen"
      data-phase={phase}
      className={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isDark ? "rgba(0, 0, 0, 0.95)" : "rgba(0, 0, 0, 0.85)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1.5rem",
      })}
    >
      <div
        data-element="game-break-content"
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          padding: "2rem",
          maxWidth: "480px",
          width: "100%",
          backgroundColor: isDark ? "gray.800" : "white",
          borderRadius: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
        })}
      >
        <div
          data-element="header"
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          })}
        >
          <div
            data-element="student-badge"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            })}
          >
            <span
              className={css({
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
              })}
              style={{ backgroundColor: student.color }}
            >
              {student.emoji}
            </span>
            <span
              className={css({
                fontWeight: "600",
                fontSize: "1rem",
                color: isDark ? "gray.200" : "gray.700",
              })}
            >
              {student.name}
            </span>
          </div>

          <div
            data-element="timer"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.375rem 0.75rem",
              borderRadius: "8px",
            })}
            style={{
              backgroundColor:
                percentRemaining > 30
                  ? isDark
                    ? "rgba(34, 197, 94, 0.2)"
                    : "rgba(34, 197, 94, 0.1)"
                  : isDark
                    ? "rgba(234, 179, 8, 0.2)"
                    : "rgba(234, 179, 8, 0.1)",
            }}
          >
            <span className={css({ fontSize: "1rem" })}>⏱️</span>
            <span
              className={css({
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: "600",
                fontSize: "1rem",
              })}
              style={{
                color:
                  percentRemaining > 30
                    ? isDark
                      ? "#86efac"
                      : "#16a34a"
                    : isDark
                      ? "#fde047"
                      : "#ca8a04",
              }}
            >
              {remainingMinutes}:{remainingSeconds.toString().padStart(2, "0")}
            </span>
          </div>
        </div>

        <div
          data-element="title-section"
          className={css({ textAlign: "center" })}
        >
          <h2
            className={css({
              fontSize: "1.75rem",
              fontWeight: "bold",
              color: isDark ? "gray.100" : "gray.800",
              marginBottom: "0.25rem",
            })}
          >
            🎮 Game Break!
          </h2>
          <p
            className={css({
              fontSize: "1rem",
              color: isDark ? "gray.400" : "gray.600",
            })}
          >
            {phase === "initializing" ? "Setting up..." : "Pick a game to play"}
          </p>
        </div>

        {phase === "initializing" && (
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
            })}
          >
            <span
              className={css({
                fontSize: "1rem",
                color: isDark ? "gray.400" : "gray.500",
              })}
            >
              Creating game room...
            </span>
          </div>
        )}

        {phase === "selecting" && (
          <div
            data-element="game-grid"
            className={css({
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.75rem",
              width: "100%",
            })}
          >
            {mockGames.map((game) => (
              <button
                key={game.name}
                type="button"
                data-game={game.name}
                onClick={() => onSelectGame?.(game.name)}
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "1rem",
                  borderRadius: "12px",
                  border: "2px solid",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  _hover: {
                    transform: "translateY(-2px)",
                  },
                })}
                style={{
                  borderColor: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.08)",
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.05)"
                    : "rgba(0,0,0,0.02)",
                }}
              >
                <span className={css({ fontSize: "2rem" })}>{game.icon}</span>
                <span
                  className={css({
                    fontSize: "0.75rem",
                    fontWeight: "600",
                    color: isDark ? "gray.300" : "gray.600",
                    textAlign: "center",
                  })}
                >
                  {game.displayName}
                </span>
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          data-action="skip-break"
          onClick={onSkip}
          className={css({
            padding: "0.75rem 1.5rem",
            fontSize: "1rem",
            fontWeight: "600",
            color: isDark ? "gray.300" : "gray.600",
            backgroundColor: isDark ? "gray.700" : "gray.200",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            _hover: {
              backgroundColor: isDark ? "gray.600" : "gray.300",
            },
          })}
        >
          Back to Practice →
        </button>
      </div>
    </div>
  );
}

/**
 * Mock game content - shown during playing phase
 * Note: In production, the timer is in PracticeSubNav, not a header here
 */
function MockGameContent({ isDark = false }: { isDark?: boolean }) {
  return (
    <div
      data-component="game-break-screen"
      data-phase="playing"
      className={css({
        width: "100%",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: isDark ? "gray.800" : "white",
        gap: "1rem",
      })}
    >
      <div className={css({ fontSize: "4rem" })}>🎮</div>
      <div
        className={css({
          fontSize: "1.5rem",
          fontWeight: "bold",
          color: isDark ? "gray.200" : "gray.700",
        })}
      >
        Game Content Area
      </div>
      <div
        className={css({
          fontSize: "0.875rem",
          color: isDark ? "gray.400" : "gray.500",
          textAlign: "center",
          maxWidth: "300px",
        })}
      >
        The game break timer is displayed in PracticeSubNav (the sub-navigation
        bar above).
      </div>
      <div
        className={css({
          marginTop: "1rem",
          padding: "0.75rem 1rem",
          backgroundColor: isDark ? "blue.900/50" : "blue.50",
          borderRadius: "8px",
          fontSize: "0.75rem",
          color: isDark ? "blue.200" : "blue.700",
        })}
      >
        See &quot;Practice/PracticeSubNav&quot; stories for timer UI
      </div>
    </div>
  );
}

const maxDurationMs = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Game Selection Phase Stories
// =============================================================================

export const InitializingPhase: Story = {
  name: "Phase: Initializing",
  render: () => (
    <GameSelectionScreen
      student={mockStudent}
      phase="initializing"
      remainingMs={maxDurationMs}
      maxDurationMs={maxDurationMs}
    />
  ),
};

export const SelectingPhase: Story = {
  name: "Phase: Selecting Game",
  render: () => (
    <GameSelectionScreen
      student={mockStudent}
      phase="selecting"
      remainingMs={maxDurationMs}
      maxDurationMs={maxDurationMs}
      onSelectGame={(name) => alert(`Selected: ${name}`)}
    />
  ),
};

export const SelectingPhaseHalfTime: Story = {
  name: "Phase: Selecting (50% Time)",
  render: () => (
    <GameSelectionScreen
      student={mockStudent}
      phase="selecting"
      remainingMs={maxDurationMs * 0.5}
      maxDurationMs={maxDurationMs}
    />
  ),
};

export const SelectingPhaseLowTime: Story = {
  name: "Phase: Selecting (20% Time - Red)",
  render: () => (
    <GameSelectionScreen
      student={mockStudent}
      phase="selecting"
      remainingMs={maxDurationMs * 0.2}
      maxDurationMs={maxDurationMs}
    />
  ),
};

// =============================================================================
// Playing Phase Stories
// =============================================================================

export const PlayingPhase: Story = {
  name: "Phase: Playing (Game Content)",
  render: () => <MockGameContent />,
};

export const PlayingPhaseDark: Story = {
  name: "Phase: Playing (Dark Mode)",
  render: () => <MockGameContent isDark />,
};

// =============================================================================
// Dark Mode Selection Stories
// =============================================================================

export const DarkModeInitializing: Story = {
  name: "Dark Mode: Initializing",
  render: () => (
    <GameSelectionScreen
      student={mockStudent}
      phase="initializing"
      remainingMs={maxDurationMs}
      maxDurationMs={maxDurationMs}
      isDark
    />
  ),
};

export const DarkModeSelecting: Story = {
  name: "Dark Mode: Selecting",
  render: () => (
    <GameSelectionScreen
      student={mockStudent}
      phase="selecting"
      remainingMs={maxDurationMs * 0.7}
      maxDurationMs={maxDurationMs}
      isDark
    />
  ),
};

// =============================================================================
// Different Students
// =============================================================================

export const DifferentStudent: Story = {
  name: "Different Student (Marcus)",
  render: () => (
    <GameSelectionScreen
      student={{
        id: "student-marcus",
        name: "Marcus",
        emoji: "🚀",
        color: "#3b82f6",
      }}
      phase="selecting"
      remainingMs={maxDurationMs * 0.8}
      maxDurationMs={maxDurationMs}
    />
  ),
};

export const LongStudentName: Story = {
  name: "Long Student Name",
  render: () => (
    <GameSelectionScreen
      student={{
        id: "student-alexandra",
        name: "Alexandra Katherine",
        emoji: "🌺",
        color: "#ec4899",
      }}
      phase="selecting"
      remainingMs={maxDurationMs * 0.9}
      maxDurationMs={maxDurationMs}
    />
  ),
};
