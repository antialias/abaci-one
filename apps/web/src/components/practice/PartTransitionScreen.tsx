"use client";

/**
 * PartTransitionScreen - Full-screen transition between practice session parts
 *
 * Shows a kid-friendly message about the upcoming part type change,
 * especially important for telling kids to put away their abacus
 * when transitioning from abacus to visualization mode.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import type { SessionPartType } from "@/db/schema/session-plans";
import { css } from "../../../styled-system/css";
import {
  selectTransitionMessage,
  requiresAbacusPutAway,
  requiresAbacusPickUp,
} from "./partTransitionMessages";

// ============================================================================
// Constants
// ============================================================================

/** Default countdown duration in milliseconds */
export const TRANSITION_COUNTDOWN_MS = 7000;

/** Update interval for countdown display */
const COUNTDOWN_UPDATE_INTERVAL_MS = 100;

// ============================================================================
// Types
// ============================================================================

export interface PartTransitionScreenProps {
  /** Whether the transition screen is visible */
  isVisible: boolean;
  /** The part type we're transitioning FROM (null if session start) */
  previousPartType: SessionPartType | null;
  /** The part type we're transitioning TO */
  nextPartType: SessionPartType;
  /** Countdown duration in ms */
  countdownMs?: number;
  /** Timestamp when countdown started (for sync) */
  countdownStartTime: number;
  /** Student info for display */
  student: {
    name: string;
    emoji: string;
    color: string;
  };
  /** Called when transition completes (countdown or skip) */
  onComplete: () => void;
  /** Optional seed for message selection (e.g., session ID hash) */
  messageSeed?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPartTypeEmoji(type: SessionPartType): string {
  switch (type) {
    case "abacus":
      return "🧮";
    case "visualization":
      return "🧠";
    case "linear":
      return "✏️";
  }
}

function getPartTypeLabel(type: SessionPartType): string {
  switch (type) {
    case "abacus":
      return "Abacus";
    case "visualization":
      return "Visualization";
    case "linear":
      return "Equations";
  }
}

// ============================================================================
// Component
// ============================================================================

export function PartTransitionScreen({
  isVisible,
  previousPartType,
  nextPartType,
  countdownMs = TRANSITION_COUNTDOWN_MS,
  countdownStartTime,
  student,
  onComplete,
  messageSeed,
}: PartTransitionScreenProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Track elapsed time for countdown
  const [elapsedMs, setElapsedMs] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const hasCompletedRef = useRef(false);

  // Select message once when transition starts
  const message = useMemo(() => {
    return selectTransitionMessage(previousPartType, nextPartType, messageSeed);
  }, [previousPartType, nextPartType, messageSeed]);

  // Check if abacus action is needed
  const showAbacusPutAway = requiresAbacusPutAway(
    previousPartType,
    nextPartType,
  );
  const showAbacusPickUp = requiresAbacusPickUp(previousPartType, nextPartType);

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

  return (
    <div
      data-component="part-transition-screen"
      data-previous-part={previousPartType ?? "start"}
      data-next-part={nextPartType}
      className={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: isDark ? "rgba(0, 0, 0, 0.9)" : "rgba(0, 0, 0, 0.75)",
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
        data-element="transition-content"
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          padding: "2rem",
          maxWidth: "420px",
          width: "100%",
          backgroundColor: isDark ? "gray.800" : "white",
          borderRadius: "24px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
        })}
      >
        {/* Student avatar */}
        <div
          data-element="student-avatar"
          className={css({
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.25rem",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          })}
          style={{ backgroundColor: student.color }}
        >
          {student.emoji}
        </div>

        {/* Message */}
        <div
          data-element="transition-message"
          className={css({
            textAlign: "center",
          })}
        >
          <h2
            className={css({
              fontSize: "1.75rem",
              fontWeight: "bold",
              color: isDark ? "gray.100" : "gray.800",
              marginBottom: "0.5rem",
            })}
          >
            {message.headline}
          </h2>
          {message.subtitle && (
            <p
              className={css({
                fontSize: "1.125rem",
                color: isDark ? "gray.400" : "gray.600",
              })}
            >
              {message.subtitle}
            </p>
          )}
        </div>

        {/* Part type indicator */}
        <div
          data-element="part-indicator"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.75rem 1.25rem",
            backgroundColor: isDark ? "gray.700" : "gray.100",
            borderRadius: "12px",
          })}
        >
          {previousPartType && (
            <>
              <span
                className={css({
                  fontSize: "1.5rem",
                  opacity: 0.5,
                })}
              >
                {getPartTypeEmoji(previousPartType)}
              </span>
              <span
                className={css({
                  color: isDark ? "gray.500" : "gray.400",
                  fontSize: "1.25rem",
                })}
              >
                →
              </span>
            </>
          )}
          <span
            className={css({
              fontSize: "1.5rem",
            })}
          >
            {getPartTypeEmoji(nextPartType)}
          </span>
          <span
            className={css({
              fontSize: "1rem",
              fontWeight: "600",
              color: isDark ? "gray.200" : "gray.700",
            })}
          >
            {getPartTypeLabel(nextPartType)}
          </span>
        </div>

        {/* Abacus action reminder */}
        {(showAbacusPutAway || showAbacusPickUp) && (
          <div
            data-element="abacus-action"
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.625rem 1rem",
              backgroundColor: showAbacusPutAway
                ? isDark
                  ? "amber.900/50"
                  : "amber.100"
                : isDark
                  ? "green.900/50"
                  : "green.100",
              borderRadius: "8px",
              fontSize: "0.9375rem",
              color: showAbacusPutAway
                ? isDark
                  ? "amber.200"
                  : "amber.800"
                : isDark
                  ? "green.200"
                  : "green.800",
            })}
          >
            <span>{showAbacusPutAway ? "📦" : "🧮"}</span>
            <span>
              {showAbacusPutAway
                ? "Put your abacus aside"
                : "Get your abacus ready"}
            </span>
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
          })}
        >
          {/* Circular countdown */}
          <div
            className={css({
              width: "80px",
              height: "80px",
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
                fontSize: "1.5rem",
                fontWeight: "bold",
                fontFamily: "var(--font-mono, monospace)",
                color: countdownColor,
              })}
            >
              {remainingSeconds}
            </div>
          </div>

          {/* Skip button */}
          <button
            data-action="skip-transition"
            onClick={handleSkip}
            className={css({
              padding: "0.625rem 1.5rem",
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
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default PartTransitionScreen;
