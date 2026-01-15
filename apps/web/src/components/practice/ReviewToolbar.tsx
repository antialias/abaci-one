"use client";

/**
 * ReviewToolbar - Toolbar for the worksheet review mode
 *
 * Contains:
 * - Back button to exit review
 * - Status badges (problem count, confidence)
 * - List/Focus mode toggle
 * - Re-parse controls
 * - Approve & Create Session button
 * - Close button
 */

import type { ReactNode } from "react";
import { css } from "../../../styled-system/css";
import type {
  WorksheetParsingResult,
  ParsedProblem,
} from "@/lib/worksheet-parsing";

export interface ReviewToolbarProps {
  /** Parsed problems */
  problems: ParsedProblem[];
  /** Parsing result with metadata */
  parsingResult: WorksheetParsingResult;
  /** Whether session has been created */
  sessionCreated: boolean;
  /** Current review sub-mode */
  reviewSubMode: "list" | "focus";
  /** Callback to change review sub-mode */
  onReviewSubModeChange: (mode: "list" | "focus") => void;
  /** Whether showing reparse preview */
  showReparsePreview: boolean;
  /** Number of problems selected for reparse */
  selectedForReparseCount: number;
  /** Whether parsing is enabled */
  canParse: boolean;
  /** Whether a parse is in progress */
  isParsing: boolean;
  /** Whether a reparse is in progress */
  isReparsing: boolean;
  /** Whether approval is in progress */
  isApproving: boolean;
  /** Whether can approve */
  canApprove: boolean;
  /** Callback for back button */
  onBack: () => void;
  /** Callback for reparse button click */
  onReparseClick: () => void;
  /** Callback to cancel reparse preview */
  onCancelReparsePreview: () => void;
  /** Callback to cancel parsing in progress */
  onCancelParsing: () => void;
  /** Callback for approve button */
  onApprove: () => void;
  /** Callback for close button */
  onClose: () => void;
}

export function ReviewToolbar({
  problems,
  parsingResult,
  sessionCreated,
  reviewSubMode,
  onReviewSubModeChange,
  showReparsePreview,
  selectedForReparseCount,
  canParse,
  isParsing,
  isReparsing,
  isApproving,
  canApprove,
  onBack,
  onReparseClick,
  onCancelReparsePreview,
  onCancelParsing,
  onApprove,
  onClose,
}: ReviewToolbarProps): ReactNode {
  const isProcessing = isParsing || isReparsing;

  return (
    <div
      data-element="review-toolbar"
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 3,
        borderBottom: "1px solid",
        borderColor: "gray.700",
        backgroundColor: "gray.800",
      })}
    >
      <div className={css({ display: "flex", alignItems: "center", gap: 3 })}>
        {/* Back button */}
        <button
          type="button"
          data-action="back-to-view"
          onClick={onBack}
          className={css({
            px: 3,
            py: 2,
            display: "flex",
            alignItems: "center",
            gap: 2,
            fontSize: "sm",
            fontWeight: "medium",
            color: "white",
            backgroundColor: "gray.700",
            border: "none",
            borderRadius: "lg",
            cursor: "pointer",
            _hover: { backgroundColor: "gray.600" },
          })}
        >
          ← Back
        </button>

        {/* Status badges */}
        <div
          data-element="review-status"
          className={css({
            px: 3,
            py: 1,
            fontSize: "sm",
            fontWeight: "medium",
            borderRadius: "md",
            backgroundColor:
              parsingResult.needsReview || parsingResult.overallConfidence < 0.8
                ? "yellow.500"
                : "green.500",
            color:
              parsingResult.needsReview || parsingResult.overallConfidence < 0.8
                ? "yellow.900"
                : "white",
          })}
        >
          {problems.length} problems •{" "}
          {Math.round((parsingResult.overallConfidence ?? 0) * 100)}% confidence
          {parsingResult.needsReview && " • Needs Review"}
        </div>

        {/* Review mode toggle - only show when not in pre-flight mode */}
        {!showReparsePreview && !sessionCreated && (
          <div
            data-element="review-mode-toggle"
            className={css({
              display: "flex",
              borderRadius: "lg",
              overflow: "hidden",
              border: "1px solid",
              borderColor: "gray.600",
            })}
          >
            <button
              type="button"
              data-action="review-list-mode"
              onClick={() => onReviewSubModeChange("list")}
              className={css({
                px: 3,
                py: 1.5,
                fontSize: "sm",
                fontWeight: "medium",
                color: reviewSubMode === "list" ? "white" : "gray.400",
                backgroundColor:
                  reviewSubMode === "list" ? "purple.600" : "transparent",
                border: "none",
                cursor: "pointer",
                _hover: {
                  backgroundColor:
                    reviewSubMode === "list" ? "purple.600" : "gray.700",
                },
              })}
            >
              List
            </button>
            <button
              type="button"
              data-action="review-focus-mode"
              onClick={() => onReviewSubModeChange("focus")}
              className={css({
                px: 3,
                py: 1.5,
                fontSize: "sm",
                fontWeight: "medium",
                color: reviewSubMode === "focus" ? "white" : "gray.400",
                backgroundColor:
                  reviewSubMode === "focus" ? "purple.600" : "transparent",
                border: "none",
                borderLeft: "1px solid",
                borderColor: "gray.600",
                cursor: "pointer",
                _hover: {
                  backgroundColor:
                    reviewSubMode === "focus" ? "purple.600" : "gray.700",
                },
              })}
            >
              Focus
            </button>
          </div>
        )}
      </div>

      <div className={css({ display: "flex", alignItems: "center", gap: 2 })}>
        {/* Re-parse button - handles full flow: select → preview → confirm */}
        {canParse && !sessionCreated && (
          <button
            type="button"
            data-action={
              showReparsePreview
                ? "confirm-reparse"
                : selectedForReparseCount > 0
                  ? "reparse-selected"
                  : "reparse-with-hints"
            }
            onClick={onReparseClick}
            disabled={isProcessing}
            className={css({
              px: 3,
              py: 2,
              fontSize: "sm",
              fontWeight: "medium",
              color: "white",
              backgroundColor: showReparsePreview ? "green.600" : "orange.600",
              border: "none",
              borderRadius: "lg",
              cursor: "pointer",
              _hover: {
                backgroundColor: showReparsePreview
                  ? "green.700"
                  : "orange.700",
              },
              _disabled: { opacity: 0.5, cursor: "wait" },
            })}
          >
            {isProcessing
              ? "⏳ Re-parsing..."
              : showReparsePreview
                ? `✓ Confirm Re-parse (${selectedForReparseCount})`
                : selectedForReparseCount > 0
                  ? `🔄 Re-parse (${selectedForReparseCount} selected)`
                  : "🔄 Re-parse"}
          </button>
        )}
        {/* Cancel button for preview mode - only when NOT already re-parsing */}
        {showReparsePreview && !isReparsing && (
          <button
            type="button"
            data-action="cancel-reparse-preview"
            onClick={onCancelReparsePreview}
            className={css({
              px: 3,
              py: 2,
              fontSize: "sm",
              color: "gray.300",
              backgroundColor: "transparent",
              border: "none",
              borderRadius: "lg",
              cursor: "pointer",
              _hover: { backgroundColor: "gray.700" },
            })}
          >
            Cancel
          </button>
        )}
        {/* Cancel button for re-parsing in progress */}
        {isReparsing && (
          <button
            type="button"
            data-action="cancel-reparse"
            onClick={onCancelParsing}
            className={css({
              px: 3,
              py: 2,
              fontSize: "sm",
              color: "red.300",
              backgroundColor: "transparent",
              border: "1px solid",
              borderColor: "red.500",
              borderRadius: "lg",
              cursor: "pointer",
              _hover: { backgroundColor: "red.900" },
            })}
          >
            ✕ Cancel
          </button>
        )}

        {/* Approve button */}
        {canApprove && !sessionCreated && (
          <button
            type="button"
            data-action="approve-and-create-session"
            onClick={onApprove}
            disabled={isApproving}
            className={css({
              px: 4,
              py: 2,
              fontSize: "sm",
              fontWeight: "medium",
              color: "white",
              backgroundColor: "green.600",
              border: "none",
              borderRadius: "lg",
              cursor: "pointer",
              _hover: { backgroundColor: "green.700" },
              _disabled: { opacity: 0.5, cursor: "wait" },
            })}
          >
            {isApproving ? "Creating Session..." : "✓ Approve & Create Session"}
          </button>
        )}

        {/* Close button */}
        <button
          type="button"
          data-action="close-review"
          onClick={onClose}
          className={css({
            width: "40px",
            height: "40px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            color: "gray.400",
            backgroundColor: "transparent",
            border: "none",
            borderRadius: "50%",
            cursor: "pointer",
            _hover: { backgroundColor: "gray.700", color: "white" },
          })}
          aria-label="Close"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default ReviewToolbar;
