"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { css } from "../../../../styled-system/css";
import { useStartPracticeModal } from "../StartPracticeModalContext";

export function RemediationCTA() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const {
    sessionMode,
    showRemediationCta,
    showTutorialGate,
    isStarting,
    handleStart,
  } = useStartPracticeModal();

  // Only show for remediation mode and when tutorial gate is not active
  if (
    !showRemediationCta ||
    showTutorialGate ||
    sessionMode.type !== "remediation"
  ) {
    return null;
  }

  const { weakSkills } = sessionMode;

  return (
    <div
      data-element="remediation-cta"
      className={css({
        borderRadius: "12px",
        overflow: "hidden",
      })}
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(234, 88, 12, 0.08) 100%)"
          : "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(234, 88, 12, 0.05) 100%)",
        border: `2px solid ${isDark ? "rgba(245, 158, 11, 0.25)" : "rgba(245, 158, 11, 0.2)"}`,
      }}
    >
      {/* Info section */}
      <div
        className={css({
          padding: "0.875rem 1rem",
          display: "flex",
          gap: "0.625rem",
          alignItems: "flex-start",
        })}
      >
        <span className={css({ fontSize: "1.5rem", lineHeight: 1 })}>💪</span>
        <div className={css({ flex: 1 })}>
          <p
            className={css({
              fontSize: "0.875rem",
              fontWeight: "600",
            })}
            style={{ color: isDark ? "#fcd34d" : "#b45309" }}
          >
            Time to build strength!
          </p>
          <p
            className={css({
              fontSize: "0.75rem",
              marginTop: "0.125rem",
            })}
            style={{ color: isDark ? "#a1a1aa" : "#6b7280" }}
          >
            Focusing on {weakSkills.length} skill
            {weakSkills.length > 1 ? "s" : ""} that need practice
          </p>
          {/* Weak skills badges */}
          <div
            className={css({
              display: "flex",
              flexWrap: "wrap",
              gap: "0.25rem",
              marginTop: "0.5rem",
            })}
          >
            {weakSkills.slice(0, 4).map((skill) => (
              <span
                key={skill.skillId}
                data-skill={skill.skillId}
                className={css({
                  fontSize: "0.625rem",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "4px",
                })}
                style={{
                  backgroundColor: isDark
                    ? "rgba(245, 158, 11, 0.2)"
                    : "rgba(245, 158, 11, 0.15)",
                  color: isDark ? "#fcd34d" : "#92400e",
                }}
              >
                {skill.displayName}{" "}
                <span style={{ opacity: 0.7 }}>
                  ({Math.round(skill.pKnown * 100)}%)
                </span>
              </span>
            ))}
            {weakSkills.length > 4 && (
              <span
                className={css({
                  fontSize: "0.625rem",
                  padding: "0.125rem 0.375rem",
                })}
                style={{ color: isDark ? "#a1a1aa" : "#6b7280" }}
              >
                +{weakSkills.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Integrated start button */}
      <button
        type="button"
        data-action="start-focus-practice"
        data-status={isStarting ? "starting" : "ready"}
        onClick={handleStart}
        disabled={isStarting}
        className={css({
          width: "100%",
          padding: "0.875rem",
          fontSize: "1rem",
          fontWeight: "bold",
          color: "white",
          border: "none",
          borderRadius: "0 0 10px 10px",
          cursor: isStarting ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          _hover: {
            filter: isStarting ? "none" : "brightness(1.05)",
          },
        })}
        style={{
          background: isStarting
            ? "#9ca3af"
            : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          boxShadow: isStarting
            ? "none"
            : "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {isStarting ? (
          "Starting..."
        ) : (
          <>
            <span>💪</span>
            <span>Start Focus Practice</span>
            <span>→</span>
          </>
        )}
      </button>
    </div>
  );
}
