"use client";

import { useCallback, useEffect, useMemo } from "react";
import { Z_INDEX } from "@/constants/zIndex";
import { css } from "../../../styled-system/css";

export interface DebugContentModalProps {
  /** Modal title */
  title: string;
  /** Content to display (raw text) */
  content: string;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Content type for syntax highlighting */
  contentType?: "text" | "json" | "markdown";
}

/**
 * Simple JSON syntax highlighter using regex
 * Returns HTML with spans for different token types
 */
function highlightJson(json: string): string {
  // Escape HTML entities first
  const escaped = json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Apply syntax highlighting
  return (
    escaped
      // Strings (including property names in quotes)
      .replace(
        /"([^"\\]|\\.)*"/g,
        (match) => `<span class="json-string">${match}</span>`,
      )
      // Numbers
      .replace(
        /\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g,
        '<span class="json-number">$1</span>',
      )
      // Booleans and null
      .replace(/\b(true|false|null)\b/g, '<span class="json-literal">$1</span>')
  );
}

/**
 * DebugContentModal - Fullscreen modal for viewing raw debug content
 *
 * Shows the original text content with syntax highlighting for JSON.
 * Does NOT render markdown - shows the raw text as-is.
 */
export function DebugContentModal({
  title,
  content,
  isOpen,
  onClose,
  contentType = "text",
}: DebugContentModalProps) {
  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // Memoize highlighted content
  const highlightedContent = useMemo(() => {
    if (contentType === "json") {
      return highlightJson(content);
    }
    // For text/markdown, just escape HTML
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }, [content, contentType]);

  if (!isOpen) return null;

  return (
    <div
      data-component="debug-content-modal"
      className={css({
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        display: "flex",
        flexDirection: "column",
        zIndex: Z_INDEX.MODAL + 10, // Above other modals
        padding: 4,
      })}
      onClick={handleBackdropClick}
    >
      {/* Header */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 4,
          borderBottom: "1px solid",
          borderColor: "gray.600",
          backgroundColor: "gray.800",
          borderRadius: "lg lg 0 0",
          flexShrink: 0,
        })}
      >
        <h2
          className={css({
            fontSize: "lg",
            fontWeight: "semibold",
            color: "white",
          })}
        >
          {title}
        </h2>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 3,
          })}
        >
          <span
            className={css({
              fontSize: "sm",
              color: "gray.400",
              fontFamily: "mono",
            })}
          >
            {content.length.toLocaleString()} chars
          </span>
          <button
            type="button"
            onClick={onClose}
            className={css({
              padding: 2,
              borderRadius: "md",
              backgroundColor: "gray.700",
              color: "gray.300",
              border: "none",
              cursor: "pointer",
              fontSize: "lg",
              lineHeight: 1,
              _hover: {
                backgroundColor: "gray.600",
                color: "white",
              },
            })}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content - Raw text display */}
      <div
        className={css({
          flex: 1,
          overflow: "auto",
          backgroundColor: "#1a1a2e", // Dark blue-ish background for code
          borderRadius: "0 0 lg lg",
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <pre
          className={css({
            margin: 0,
            padding: 4,
            fontFamily: "mono",
            fontSize: "sm",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "#e0e0e0", // Light gray text
            // JSON syntax highlighting colors
            "& .json-string": {
              color: "#a8e6a3", // Light green for strings
            },
            "& .json-number": {
              color: "#f4a460", // Orange for numbers
            },
            "& .json-literal": {
              color: "#87ceeb", // Light blue for true/false/null
            },
          })}
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
        />
      </div>

      {/* Footer hint */}
      <div
        className={css({
          textAlign: "center",
          padding: 2,
          fontSize: "xs",
          color: "gray.500",
        })}
      >
        Press Esc to close
      </div>
    </div>
  );
}
