"use client";

/**
 * ParsingProgressPanel - Collapsible panel showing AI reasoning text
 *
 * Displays the LLM's thinking process during worksheet parsing.
 * Shows below the photo tile, with smooth expand/collapse animation.
 */

import { useRef, useEffect } from "react";
import { css } from "../../../styled-system/css";

export interface ParsingProgressPanelProps {
  /** Whether the panel is expanded */
  isExpanded: boolean;
  /** The reasoning text from the LLM */
  reasoningText: string;
  /** Current parsing status (from StreamingStatus) */
  status:
    | "idle"
    | "connecting"
    | "reasoning"
    | "processing"
    | "generating"
    | "complete"
    | "error"
    | "cancelled";
  /** Dark mode */
  isDark?: boolean;
}

/**
 * Get status indicator text
 */
function getStatusLabel(status: ParsingProgressPanelProps["status"]): string {
  switch (status) {
    case "connecting":
      return "Connecting...";
    case "reasoning":
      return "AI is thinking...";
    case "generating":
      return "Generating results...";
    case "complete":
      return "Complete";
    case "error":
      return "Error";
    default:
      return "";
  }
}

export function ParsingProgressPanel({
  isExpanded,
  reasoningText,
  status,
  isDark = false,
}: ParsingProgressPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as new text arrives
  useEffect(() => {
    if (isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [reasoningText, isExpanded]);

  const statusLabel = getStatusLabel(status);
  const isActive =
    status === "connecting" ||
    status === "reasoning" ||
    status === "generating";

  if (!isExpanded) {
    return null;
  }

  return (
    <div
      data-component="parsing-progress-panel"
      className={css({
        marginTop: "0.5rem",
        borderRadius: "8px",
        backgroundColor: isDark ? "gray.800" : "gray.50",
        border: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
        overflow: "hidden",
        animation: "fadeIn 0.2s ease-out forwards",
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.5rem 0.75rem",
          backgroundColor: isDark ? "gray.750" : "gray.100",
          borderBottom: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
        })}
      >
        {/* Pulsing dot for active state */}
        {isActive && (
          <span
            className={css({
              width: "8px",
              height: "8px",
              borderRadius: "full",
              backgroundColor: "blue.500",
              animation: "pulseOpacity 1.5s ease-in-out infinite",
            })}
          />
        )}
        {status === "complete" && (
          <span
            className={css({
              width: "8px",
              height: "8px",
              borderRadius: "full",
              backgroundColor: "green.500",
            })}
          />
        )}
        {status === "error" && (
          <span
            className={css({
              width: "8px",
              height: "8px",
              borderRadius: "full",
              backgroundColor: "red.500",
            })}
          />
        )}
        <span
          className={css({
            fontSize: "0.75rem",
            fontWeight: "medium",
            color: isDark ? "gray.300" : "gray.600",
          })}
        >
          {statusLabel}
        </span>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className={css({
          padding: "0.75rem",
          maxHeight: "150px",
          overflowY: "auto",
          // Responsive height
          "@media (min-width: 768px)": {
            maxHeight: "250px",
          },
        })}
      >
        {reasoningText ? (
          <p
            className={css({
              fontSize: "0.8125rem",
              lineHeight: "1.5",
              color: isDark ? "gray.300" : "gray.700",
              fontFamily: "sans-serif",
              whiteSpace: "pre-wrap",
              margin: 0,
            })}
          >
            {reasoningText}
          </p>
        ) : (
          <p
            className={css({
              fontSize: "0.8125rem",
              color: isDark ? "gray.500" : "gray.400",
              fontStyle: "italic",
              margin: 0,
            })}
          >
            Waiting for AI response...
          </p>
        )}
      </div>
    </div>
  );
}
