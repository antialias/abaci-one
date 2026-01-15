"use client";

/**
 * ParsingProgressOverlay - Overlay on photo tile during worksheet parsing
 *
 * Shows:
 * - Semi-transparent dark background
 * - Spinner animation
 * - Progress message with problem count
 * - Cancel button
 * - Toggle to show/hide reasoning panel
 */

import { css } from "../../../styled-system/css";

export interface ParsingProgressOverlayProps {
  /** Progress message to display */
  progressMessage: string | null;
  /** Number of completed problems (for count display) */
  completedCount: number;
  /** Total expected problems (for count display, 0 if unknown) */
  totalCount?: number;
  /** Whether the reasoning panel is expanded */
  isPanelExpanded: boolean;
  /** Toggle reasoning panel visibility */
  onTogglePanel: () => void;
  /** Cancel parsing */
  onCancel: () => void;
  /** Whether there is reasoning text to show */
  hasReasoningText: boolean;
}

export function ParsingProgressOverlay({
  progressMessage,
  completedCount,
  totalCount = 0,
  isPanelExpanded,
  onTogglePanel,
  onCancel,
  hasReasoningText,
}: ParsingProgressOverlayProps) {
  // Build progress text
  const progressText =
    completedCount > 0
      ? totalCount > 0
        ? `${completedCount}/${totalCount} problems`
        : `${completedCount} problems found`
      : progressMessage || "Analyzing...";

  return (
    <div
      data-component="parsing-progress-overlay"
      className={css({
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        borderRadius: "12px",
        zIndex: 10,
        gap: "0.75rem",
        padding: "1rem",
      })}
    >
      {/* Spinner */}
      <div
        className={css({
          width: "32px",
          height: "32px",
          border: "3px solid rgba(255, 255, 255, 0.3)",
          borderTopColor: "white",
          borderRadius: "full",
          animation: "spin 1s linear infinite",
        })}
      />

      {/* Progress text */}
      <div
        className={css({
          color: "white",
          fontSize: "0.875rem",
          fontWeight: "medium",
          textAlign: "center",
          lineHeight: "1.4",
        })}
      >
        {progressText}
      </div>

      {/* Action buttons */}
      <div
        className={css({
          display: "flex",
          gap: "0.5rem",
          marginTop: "0.25rem",
        })}
      >
        {/* Cancel button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className={css({
            minWidth: "44px",
            minHeight: "32px",
            paddingX: "0.75rem",
            paddingY: "0.375rem",
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            color: "white",
            fontSize: "0.75rem",
            fontWeight: "medium",
            borderRadius: "6px",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            cursor: "pointer",
            transition: "background-color 0.15s",
            _hover: {
              backgroundColor: "rgba(255, 255, 255, 0.25)",
            },
            _active: {
              backgroundColor: "rgba(255, 255, 255, 0.3)",
            },
          })}
        >
          Cancel
        </button>

        {/* Show/Hide thinking toggle */}
        {hasReasoningText && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePanel();
            }}
            className={css({
              minWidth: "44px",
              minHeight: "32px",
              paddingX: "0.75rem",
              paddingY: "0.375rem",
              backgroundColor: isPanelExpanded
                ? "rgba(59, 130, 246, 0.5)"
                : "rgba(255, 255, 255, 0.15)",
              color: "white",
              fontSize: "0.75rem",
              fontWeight: "medium",
              borderRadius: "6px",
              border: "1px solid",
              borderColor: isPanelExpanded
                ? "rgba(59, 130, 246, 0.7)"
                : "rgba(255, 255, 255, 0.25)",
              cursor: "pointer",
              transition: "background-color 0.15s, border-color 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              _hover: {
                backgroundColor: isPanelExpanded
                  ? "rgba(59, 130, 246, 0.6)"
                  : "rgba(255, 255, 255, 0.25)",
              },
            })}
          >
            <span
              className={css({
                transition: "transform 0.2s",
                transform: isPanelExpanded ? "rotate(180deg)" : "rotate(0deg)",
              })}
            >
              ▼
            </span>
            {isPanelExpanded ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );
}
