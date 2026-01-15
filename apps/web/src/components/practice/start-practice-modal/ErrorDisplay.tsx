"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { css } from "../../../../styled-system/css";
import { useStartPracticeModal } from "../StartPracticeModalContext";

export function ErrorDisplay() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { displayError, isNoSkillsError } = useStartPracticeModal();

  if (!displayError) {
    return null;
  }

  return (
    <div
      data-element="error-display"
      data-error-type={isNoSkillsError ? "no-skills" : "generic"}
      className={css({
        padding: "0.75rem",
        borderRadius: "8px",
        textAlign: "center",
      })}
      style={{
        background: isNoSkillsError
          ? isDark
            ? "rgba(251, 191, 36, 0.12)"
            : "rgba(251, 191, 36, 0.08)"
          : isDark
            ? "rgba(239, 68, 68, 0.12)"
            : "rgba(239, 68, 68, 0.08)",
        border: `1px solid ${
          isNoSkillsError
            ? isDark
              ? "rgba(251, 191, 36, 0.25)"
              : "rgba(251, 191, 36, 0.15)"
            : isDark
              ? "rgba(239, 68, 68, 0.25)"
              : "rgba(239, 68, 68, 0.15)"
        }`,
      }}
    >
      {isNoSkillsError ? (
        <>
          <p
            className={css({
              fontSize: "0.875rem",
              marginBottom: "0.5rem",
            })}
            style={{ color: isDark ? "#fcd34d" : "#b45309" }}
          >
            ⚠️ No skills enabled
          </p>
          <p
            className={css({ fontSize: "0.75rem" })}
            style={{ color: isDark ? "#d4d4d4" : "#525252" }}
          >
            Please enable at least one skill in the skill selector before
            starting a session.
          </p>
        </>
      ) : (
        <p
          className={css({ fontSize: "0.875rem" })}
          style={{ color: isDark ? "#fca5a5" : "#dc2626" }}
        >
          {displayError.message || "Something went wrong. Please try again."}
        </p>
      )}
    </div>
  );
}
