"use client";

/**
 * LLMDebugPanel - Debug panel showing LLM metadata for parsed worksheets
 *
 * Shows:
 * - Provider and model info
 * - Token usage
 * - Buttons to view prompt, response, and schema
 */

import type { ReactNode } from "react";
import { css } from "../../../styled-system/css";
import type { LLMMetadata } from "./PhotoViewerEditor";

export interface LLMDebugPanelProps {
  /** LLM metadata */
  llm: LLMMetadata;
  /** Callback to open debug content in modal */
  onViewContent: (
    title: string,
    content: string,
    contentType: "text" | "json",
  ) => void;
}

export function LLMDebugPanel({
  llm,
  onViewContent,
}: LLMDebugPanelProps): ReactNode {
  return (
    <div
      data-element="debug-panel"
      className={css({
        borderTop: "1px solid",
        borderColor: "gray.700",
        padding: 3,
        backgroundColor: "gray.900",
      })}
    >
      <h3
        className={css({
          fontSize: "xs",
          fontWeight: "semibold",
          color: "gray.500",
          textTransform: "uppercase",
          letterSpacing: "wide",
          marginBottom: 2,
        })}
      >
        LLM Debug Info
      </h3>
      <div
        className={css({
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 1,
          fontSize: "xs",
          fontFamily: "mono",
        })}
      >
        <span className={css({ color: "gray.500" })}>Provider:</span>
        <span className={css({ color: "gray.300" })}>
          {llm.provider ?? "unknown"}
        </span>

        <span className={css({ color: "gray.500" })}>Model:</span>
        <span className={css({ color: "gray.300" })}>
          {llm.model ?? "unknown"}
        </span>

        <span className={css({ color: "gray.500" })}>Image:</span>
        <span className={css({ color: "gray.300" })}>
          {llm.imageSource ?? "cropped"} ✓
        </span>

        <span className={css({ color: "gray.500" })}>Attempts:</span>
        <span className={css({ color: "gray.300" })}>{llm.attempts ?? 1}</span>

        <span className={css({ color: "gray.500" })}>Tokens:</span>
        <span className={css({ color: "gray.300" })}>
          {llm.usage?.totalTokens ?? "?"} ({llm.usage?.promptTokens ?? "?"} in /{" "}
          {llm.usage?.completionTokens ?? "?"} out)
        </span>
      </div>

      {/* Debug content buttons */}
      <div
        className={css({
          display: "flex",
          gap: 2,
          marginTop: 2,
          borderTop: "1px solid",
          borderColor: "gray.800",
          paddingTop: 2,
        })}
      >
        {llm.promptUsed && (
          <button
            type="button"
            onClick={() => onViewContent("LLM Prompt", llm.promptUsed!, "text")}
            className={css({
              fontSize: "xs",
              color: "gray.400",
              backgroundColor: "gray.800",
              border: "none",
              borderRadius: "sm",
              padding: "0.25rem 0.5rem",
              cursor: "pointer",
              _hover: { backgroundColor: "gray.700", color: "white" },
            })}
          >
            View Prompt ({llm.promptUsed.length.toLocaleString()} chars)
          </button>
        )}
        {llm.rawResponse && (
          <button
            type="button"
            onClick={() =>
              onViewContent("Raw LLM Response", llm.rawResponse!, "json")
            }
            className={css({
              fontSize: "xs",
              color: "gray.400",
              backgroundColor: "gray.800",
              border: "none",
              borderRadius: "sm",
              padding: "0.25rem 0.5rem",
              cursor: "pointer",
              _hover: { backgroundColor: "gray.700", color: "white" },
            })}
          >
            View Response ({llm.rawResponse.length.toLocaleString()} chars)
          </button>
        )}
        {llm.jsonSchema && (
          <button
            type="button"
            onClick={() =>
              onViewContent(
                "JSON Schema (with field descriptions)",
                llm.jsonSchema!,
                "json",
              )
            }
            className={css({
              fontSize: "xs",
              color: "gray.400",
              backgroundColor: "gray.800",
              border: "none",
              borderRadius: "sm",
              padding: "0.25rem 0.5rem",
              cursor: "pointer",
              _hover: { backgroundColor: "gray.700", color: "white" },
            })}
          >
            View Schema ({llm.jsonSchema.length.toLocaleString()} chars)
          </button>
        )}
      </div>
    </div>
  );
}

export default LLMDebugPanel;
