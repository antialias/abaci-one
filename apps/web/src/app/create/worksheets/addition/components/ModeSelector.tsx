"use client";

import { css } from "../../../../../../styled-system/css";

interface ModeSelectorProps {
  currentMode: "smart" | "manual";
  onChange: (mode: "smart" | "manual") => void;
  isDark?: boolean;
}

/**
 * Mode selector for worksheet generation
 * Allows switching between Smart Difficulty and Manual Control modes
 */
export function ModeSelector({
  currentMode,
  onChange,
  isDark = false,
}: ModeSelectorProps) {
  return (
    <div
      data-component="mode-selector"
      className={css({
        marginBottom: "1.5rem",
        padding: "1rem",
        backgroundColor: isDark ? "gray.700" : "gray.50",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: isDark ? "gray.600" : "gray.200",
      })}
    >
      <h3
        className={css({
          fontSize: "0.875rem",
          fontWeight: "600",
          color: isDark ? "gray.200" : "gray.700",
          marginBottom: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        })}
      >
        Worksheet Mode
      </h3>

      <div
        data-element="mode-buttons"
        className={css({
          display: "flex",
          gap: "0.75rem",
        })}
      >
        {/* Smart Difficulty Mode Button */}
        <button
          type="button"
          data-action="select-smart-mode"
          data-selected={currentMode === "smart"}
          onClick={() => onChange("smart")}
          className={css({
            flex: 1,
            padding: "1rem",
            borderRadius: "6px",
            border: "2px solid",
            borderColor:
              currentMode === "smart"
                ? "blue.500"
                : isDark
                  ? "gray.500"
                  : "gray.300",
            backgroundColor:
              currentMode === "smart"
                ? "blue.50"
                : isDark
                  ? "gray.600"
                  : "white",
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "left",
            _hover: {
              borderColor: "blue.400",
              backgroundColor: "blue.50",
            },
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            })}
          >
            <span
              className={css({
                fontSize: "1.25rem",
              })}
            >
              🎯
            </span>
            <span
              className={css({
                fontSize: "0.875rem",
                fontWeight: "600",
                color:
                  currentMode === "smart"
                    ? "blue.700"
                    : isDark
                      ? "gray.200"
                      : "gray.700",
              })}
            >
              Smart Difficulty
            </span>
          </div>
          <p
            className={css({
              fontSize: "0.75rem",
              color:
                currentMode === "smart"
                  ? "blue.600"
                  : isDark
                    ? "gray.400"
                    : "gray.600",
              lineHeight: "1.4",
            })}
          >
            Research-backed progressive difficulty with adaptive scaffolding per
            problem
          </p>
        </button>

        {/* Manual Control Mode Button */}
        <button
          type="button"
          data-action="select-manual-mode"
          data-selected={currentMode === "manual"}
          onClick={() => onChange("manual")}
          className={css({
            flex: 1,
            padding: "1rem",
            borderRadius: "6px",
            border: "2px solid",
            borderColor:
              currentMode === "manual"
                ? "blue.500"
                : isDark
                  ? "gray.500"
                  : "gray.300",
            backgroundColor:
              currentMode === "manual"
                ? "blue.50"
                : isDark
                  ? "gray.600"
                  : "white",
            cursor: "pointer",
            transition: "all 0.2s",
            textAlign: "left",
            _hover: {
              borderColor: "blue.400",
              backgroundColor: "blue.50",
            },
          })}
        >
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.5rem",
            })}
          >
            <span
              className={css({
                fontSize: "1.25rem",
              })}
            >
              🎛️
            </span>
            <span
              className={css({
                fontSize: "0.875rem",
                fontWeight: "600",
                color:
                  currentMode === "manual"
                    ? "blue.700"
                    : isDark
                      ? "gray.200"
                      : "gray.700",
              })}
            >
              Manual Control
            </span>
          </div>
          <p
            className={css({
              fontSize: "0.75rem",
              color:
                currentMode === "manual"
                  ? "blue.600"
                  : isDark
                    ? "gray.400"
                    : "gray.600",
              lineHeight: "1.4",
            })}
          >
            Full control over display options with uniform scaffolding across
            all problems
          </p>
        </button>
      </div>
    </div>
  );
}
