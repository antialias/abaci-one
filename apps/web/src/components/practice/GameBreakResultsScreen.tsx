"use client";

/**
 * GameBreakResultsScreen - Interstitial screen showing game results after a game break
 *
 * Displays the game results before returning to practice, giving kids a moment
 * to see how they did in the game. Uses a similar pattern to PartTransitionScreen
 * with a countdown timer and skip button.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import type { GameResultsReport } from "@/lib/arcade/game-sdk/types";
import { css } from "../../../styled-system/css";

// ============================================================================
// Constants
// ============================================================================

/** Default countdown duration in milliseconds */
export const RESULTS_COUNTDOWN_MS = 5000;

// ============================================================================
// Types
// ============================================================================

export interface GameBreakResultsScreenProps {
  /** Whether the results screen is visible */
  isVisible: boolean;
  /** The game results to display */
  results: GameResultsReport;
  /** Student info for display */
  student: {
    name: string;
    emoji: string;
  };
  /** Optional countdown duration in ms (default 5000) */
  countdownMs?: number;
  /** Called when the results screen completes (countdown or skip) */
  onComplete: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get background color based on result theme
 */
function getThemeColors(
  theme: GameResultsReport["resultTheme"],
  isDark: boolean,
): { bg: string; border: string; text: string } {
  switch (theme) {
    case "success":
      return {
        bg: isDark ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.1)",
        border: isDark ? "rgba(34, 197, 94, 0.4)" : "rgba(34, 197, 94, 0.5)",
        text: isDark ? "#86efac" : "#16a34a",
      };
    case "good":
      return {
        bg: isDark ? "rgba(59, 130, 246, 0.15)" : "rgba(59, 130, 246, 0.1)",
        border: isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(59, 130, 246, 0.5)",
        text: isDark ? "#93c5fd" : "#2563eb",
      };
    case "needs-practice":
      return {
        bg: isDark ? "rgba(234, 179, 8, 0.15)" : "rgba(234, 179, 8, 0.1)",
        border: isDark ? "rgba(234, 179, 8, 0.4)" : "rgba(234, 179, 8, 0.5)",
        text: isDark ? "#fde047" : "#ca8a04",
      };
    default:
      return {
        bg: isDark ? "rgba(156, 163, 175, 0.15)" : "rgba(156, 163, 175, 0.1)",
        border: isDark
          ? "rgba(156, 163, 175, 0.3)"
          : "rgba(156, 163, 175, 0.4)",
        text: isDark ? "#d1d5db" : "#4b5563",
      };
  }
}

// ============================================================================
// Component
// ============================================================================

export function GameBreakResultsScreen({
  isVisible,
  results,
  student,
  countdownMs = RESULTS_COUNTDOWN_MS,
  onComplete,
}: GameBreakResultsScreenProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Track countdown state
  const [countdownStartTime] = useState(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (!hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  }, [onComplete]);

  // Countdown timer using requestAnimationFrame for smooth updates
  useEffect(() => {
    if (!isVisible) {
      hasCompletedRef.current = false;
      setElapsedMs(0);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const elapsed = now - countdownStartTime;
      setElapsedMs(elapsed);

      if (elapsed >= countdownMs) {
        // Countdown complete
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onComplete();
        }
      } else {
        // Continue updating
        animationFrameRef.current = requestAnimationFrame(updateCountdown);
      }
    };

    animationFrameRef.current = requestAnimationFrame(updateCountdown);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisible, countdownStartTime, countdownMs, onComplete]);

  if (!isVisible) return null;

  // Calculate countdown values
  const remainingMs = Math.max(0, countdownMs - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const percentRemaining = (remainingMs / countdownMs) * 100;

  // SVG parameters for countdown circle
  const viewBoxSize = 100;
  const center = viewBoxSize / 2;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentRemaining / 100);

  // Color based on time remaining
  const countdownColor =
    percentRemaining > 50
      ? isDark
        ? "#22c55e"
        : "#16a34a"
      : isDark
        ? "#eab308"
        : "#ca8a04";

  // Theme colors for the header
  const themeColors = getThemeColors(results.resultTheme, isDark);

  // Filter highlighted stats
  const highlightedStats =
    results.customStats?.filter((s) => s.highlight) ?? [];
  const regularStats = results.customStats?.filter((s) => !s.highlight) ?? [];

  return (
    <div
      data-component="game-break-results-screen"
      data-game={results.gameName}
      data-theme={results.resultTheme}
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
      {/* Main content card */}
      <div
        data-element="results-content"
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.25rem",
          padding: "1.5rem 2rem",
          maxWidth: "420px",
          width: "100%",
          backgroundColor: isDark ? "gray.800" : "white",
          borderRadius: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
        })}
      >
        {/* Game icon and headline */}
        <div
          data-element="header"
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
            width: "100%",
            padding: "1rem",
            borderRadius: "16px",
          })}
          style={{
            backgroundColor: themeColors.bg,
            border: `2px solid ${themeColors.border}`,
          }}
        >
          {/* Game icon */}
          <span
            className={css({
              fontSize: "3rem",
            })}
          >
            {results.gameIcon}
          </span>

          {/* Headline */}
          <div className={css({ textAlign: "center" })}>
            <h2
              className={css({
                fontSize: "1.5rem",
                fontWeight: "bold",
                marginBottom: "0.25rem",
              })}
              style={{ color: themeColors.text }}
            >
              {results.headline ?? "Game Complete!"}
            </h2>
            {results.subheadline && (
              <p
                className={css({
                  fontSize: "0.9375rem",
                  color: isDark ? "gray.400" : "gray.600",
                })}
              >
                {results.subheadline}
              </p>
            )}
          </div>
        </div>

        {/* Player info (single player or winner) */}
        {results.playerResults.length === 1 && (
          <div
            data-element="player-result"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "1rem",
              color: isDark ? "gray.300" : "gray.600",
            })}
          >
            <span>{results.playerResults[0].playerEmoji}</span>
            <span>{results.playerResults[0].playerName}</span>
            {results.playerResults[0].score !== undefined && (
              <span
                className={css({
                  fontWeight: "600",
                  color: isDark ? "gray.200" : "gray.700",
                })}
              >
                - {results.playerResults[0].score} points
              </span>
            )}
          </div>
        )}

        {/* Highlighted stats */}
        {highlightedStats.length > 0 && (
          <div
            data-element="highlighted-stats"
            className={css({
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
              width: "100%",
            })}
          >
            {highlightedStats.map((stat, idx) => (
              <div
                key={idx}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 0.875rem",
                  backgroundColor: isDark ? "gray.700" : "gray.100",
                  borderRadius: "10px",
                  fontSize: "1rem",
                })}
              >
                {stat.icon && <span>{stat.icon}</span>}
                <span
                  className={css({
                    color: isDark ? "gray.400" : "gray.500",
                    fontSize: "0.875rem",
                  })}
                >
                  {stat.label}:
                </span>
                <span
                  className={css({
                    fontWeight: "600",
                    color: isDark ? "gray.100" : "gray.800",
                  })}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Regular stats grid */}
        {regularStats.length > 0 && (
          <div
            data-element="stats-grid"
            className={css({
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.5rem 1rem",
              width: "100%",
              padding: "0.5rem",
            })}
          >
            {regularStats.map((stat, idx) => (
              <div
                key={idx}
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  fontSize: "0.875rem",
                })}
              >
                {stat.icon && (
                  <span className={css({ fontSize: "0.875rem", opacity: 0.8 })}>
                    {stat.icon}
                  </span>
                )}
                <span
                  className={css({
                    color: isDark ? "gray.400" : "gray.500",
                  })}
                >
                  {stat.label}:
                </span>
                <span
                  className={css({
                    fontWeight: "500",
                    color: isDark ? "gray.200" : "gray.700",
                  })}
                >
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Completion info */}
        {results.itemsCompleted !== undefined &&
          results.itemsTotal !== undefined && (
            <div
              data-element="completion"
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.9375rem",
                color: isDark ? "gray.300" : "gray.600",
              })}
            >
              <span>Completed:</span>
              <span
                className={css({
                  fontWeight: "600",
                  color: isDark ? "gray.100" : "gray.800",
                })}
              >
                {results.itemsCompleted}/{results.itemsTotal}
              </span>
              {results.completionPercent !== undefined && (
                <span
                  className={css({ color: isDark ? "gray.400" : "gray.500" })}
                >
                  ({results.completionPercent}%)
                </span>
              )}
            </div>
          )}

        {/* Countdown timer */}
        <div
          data-element="countdown"
          className={css({
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
            marginTop: "0.5rem",
          })}
        >
          {/* Circular countdown */}
          <div
            className={css({
              width: "70px",
              height: "70px",
              position: "relative",
            })}
          >
            <svg
              viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
              className={css({
                width: "100%",
                height: "100%",
                transform: "rotate(-90deg)",
              })}
            >
              {/* Background circle */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}
                strokeWidth="8"
              />
              {/* Progress arc */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={countdownColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={css({
                  transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease",
                })}
              />
            </svg>
            {/* Seconds in center */}
            <div
              className={css({
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: "1.25rem",
                fontWeight: "bold",
                fontFamily: "var(--font-mono, monospace)",
                color: countdownColor,
              })}
            >
              {remainingSeconds}
            </div>
          </div>

          {/* Continue button */}
          <button
            data-action="continue-to-practice"
            onClick={handleSkip}
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
              _active: {
                transform: "scale(0.98)",
              },
            })}
          >
            Back to Practice
          </button>
        </div>
      </div>
    </div>
  );
}

export default GameBreakResultsScreen;
