"use client";

import { useTheme } from "@/contexts/ThemeContext";
import type { SessionPart, SessionPlan } from "@/db/schema/session-plans";
import { css } from "../../../styled-system/css";

function getPartTypeLabel(type: SessionPart["type"]): string {
  switch (type) {
    case "abacus":
      return "Use Abacus";
    case "visualization":
      return "Mental Math (Visualization)";
    case "linear":
      return "Mental Math (Linear)";
  }
}

function getPartTypeEmoji(type: SessionPart["type"]): string {
  switch (type) {
    case "abacus":
      return "🧮";
    case "visualization":
      return "🧠";
    case "linear":
      return "💭";
  }
}

export interface ContinueSessionCardProps {
  studentName: string;
  studentEmoji: string;
  studentColor: string;
  session: SessionPlan;
  onContinue: () => void;
  onStartFresh: () => void;
}

/**
 * Card shown when a student has an active session in progress.
 * Displays progress and options to continue or start fresh.
 */
export function ContinueSessionCard({
  studentName,
  studentEmoji,
  studentColor,
  session,
  onContinue,
  onStartFresh,
}: ContinueSessionCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Calculate progress
  const completedProblems = session.results.length;
  const totalProblems = session.parts.reduce(
    (sum, part) => sum + part.slots.length,
    0,
  );
  const progressPercent =
    totalProblems > 0
      ? Math.round((completedProblems / totalProblems) * 100)
      : 0;

  const currentPart = session.parts[session.currentPartIndex];

  return (
    <div
      data-component="continue-session-card"
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        padding: "2rem",
        maxWidth: "500px",
        margin: "0 auto",
        backgroundColor: isDark ? "gray.800" : "white",
        borderRadius: "16px",
        boxShadow: "lg",
      })}
    >
      {/* Avatar and greeting */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexDirection: "column",
        })}
      >
        <div
          className={css({
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.5rem",
          })}
          style={{ backgroundColor: studentColor }}
        >
          {studentEmoji}
        </div>
        <h2
          className={css({
            fontSize: "1.5rem",
            fontWeight: "bold",
            color: isDark ? "gray.100" : "gray.800",
            textAlign: "center",
          })}
        >
          Welcome back, {studentName}!
        </h2>
      </div>

      {/* Progress summary */}
      <div className={css({ width: "100%", textAlign: "center" })}>
        <p
          className={css({
            fontSize: "1.125rem",
            color: isDark ? "gray.300" : "gray.600",
            marginBottom: "0.75rem",
          })}
        >
          You're on problem <strong>{completedProblems + 1}</strong> of{" "}
          <strong>{totalProblems}</strong>
        </p>

        {/* Progress bar */}
        <div
          className={css({
            width: "100%",
            height: "12px",
            backgroundColor: isDark ? "gray.700" : "gray.200",
            borderRadius: "6px",
            overflow: "hidden",
            marginBottom: "0.75rem",
          })}
        >
          <div
            className={css({
              height: "100%",
              backgroundColor: isDark ? "green.400" : "green.500",
              borderRadius: "6px",
              transition: "width 0.3s ease",
            })}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Current part indicator */}
        {currentPart && (
          <p
            className={css({
              fontSize: "0.875rem",
              color: isDark ? "gray.400" : "gray.500",
            })}
          >
            {getPartTypeEmoji(currentPart.type)} Part{" "}
            {session.currentPartIndex + 1}: {getPartTypeLabel(currentPart.type)}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
        })}
      >
        <button
          type="button"
          data-action="continue-session"
          onClick={onContinue}
          className={css({
            padding: "1rem",
            fontSize: "1.125rem",
            fontWeight: "bold",
            color: "white",
            backgroundColor: "green.500",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            _hover: { backgroundColor: "green.600" },
          })}
        >
          Continue Session
        </button>

        <button
          type="button"
          data-action="start-fresh"
          onClick={onStartFresh}
          className={css({
            padding: "0.75rem",
            fontSize: "0.875rem",
            color: isDark ? "gray.300" : "gray.600",
            backgroundColor: "transparent",
            borderRadius: "8px",
            border: "1px solid",
            borderColor: isDark ? "gray.600" : "gray.300",
            cursor: "pointer",
            _hover: {
              backgroundColor: isDark ? "gray.700" : "gray.100",
            },
          })}
        >
          Start Fresh (abandon current session)
        </button>
      </div>
    </div>
  );
}
