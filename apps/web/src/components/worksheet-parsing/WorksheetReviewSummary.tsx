"use client";

/**
 * WorksheetReviewSummary - Summary screen for worksheet review workflow
 *
 * Shows:
 * - Worksheet thumbnail
 * - Problem count and confidence summary
 * - Progress bar
 * - Primary action (review flagged problems or approve all)
 * - Poor scan warning when confidence is low
 * - Resume option for in-progress reviews
 */

import { useCallback, useMemo } from "react";
import { css } from "../../../styled-system/css";
import type {
  ReviewProgress,
  ParsedProblem,
  WorksheetParsingResult,
} from "@/lib/worksheet-parsing";

// Thresholds for scan quality assessment
const POOR_SCAN_THRESHOLD = 0.5; // Below this, suggest retaking
const GOOD_SCAN_THRESHOLD = 0.85; // Above this, most problems auto-approved

interface WorksheetReviewSummaryProps {
  /** URL of the worksheet image thumbnail */
  thumbnailUrl: string;
  /** Current review progress (may be null if not started) */
  reviewProgress: ReviewProgress | null;
  /** Parsed problems from the worksheet */
  problems: ParsedProblem[];
  /** Overall parsing result for confidence info */
  parsingResult: WorksheetParsingResult;
  /** Current worksheet index (1-based) for multi-worksheet sessions */
  worksheetIndex?: number;
  /** Total worksheets in session */
  totalWorksheets?: number;
  /** Called when user wants to start/continue review */
  onStartReview: () => void;
  /** Called when user wants to approve all and skip review */
  onApproveAll: () => void;
  /** Called when user wants to retake the photo */
  onRetakePhoto?: () => void;
  /** Called when user wants to remove this worksheet */
  onRemoveWorksheet?: () => void;
  /** Called when user wants to go to next worksheet (for multi-worksheet) */
  onNextWorksheet?: () => void;
  /** Is the approve action in progress */
  isApproving?: boolean;
  /** Is the initialize review action in progress */
  isInitializing?: boolean;
}

export function WorksheetReviewSummary({
  thumbnailUrl,
  reviewProgress,
  problems,
  parsingResult,
  worksheetIndex = 1,
  totalWorksheets = 1,
  onStartReview,
  onApproveAll,
  onRetakePhoto,
  onRemoveWorksheet,
  onNextWorksheet,
  isApproving = false,
  isInitializing = false,
}: WorksheetReviewSummaryProps) {
  // Calculate summary statistics
  const stats = useMemo(() => {
    const total = problems.length;
    const excluded = problems.filter((p) => p.excluded).length;
    const active = total - excluded;

    // Count by confidence
    let highConfidence = 0;
    let lowConfidence = 0;

    for (const p of problems) {
      if (p.excluded) continue;
      const minConf = Math.min(p.termsConfidence, p.studentAnswerConfidence);
      if (minConf >= GOOD_SCAN_THRESHOLD) {
        highConfidence++;
      } else {
        lowConfidence++;
      }
    }

    // If we have review progress, use its counts
    const autoApproved = reviewProgress?.autoApprovedCount ?? highConfidence;
    const needsReview = reviewProgress?.flaggedCount ?? lowConfidence;
    const reviewed = reviewProgress?.manuallyReviewedCount ?? 0;
    const corrected = reviewProgress?.correctedCount ?? 0;

    return {
      total,
      active,
      excluded,
      autoApproved,
      needsReview,
      reviewed,
      corrected,
      overallConfidence: parsingResult.overallConfidence,
    };
  }, [problems, reviewProgress, parsingResult]);

  // Determine scan quality category
  const scanQuality = useMemo(() => {
    if (stats.overallConfidence < POOR_SCAN_THRESHOLD) return "poor";
    if (stats.overallConfidence >= GOOD_SCAN_THRESHOLD) return "good";
    return "medium";
  }, [stats.overallConfidence]);

  // Determine review status
  const reviewStatus = reviewProgress?.status ?? "not_started";
  const isComplete = reviewStatus === "completed";
  const isInProgress = reviewStatus === "in_progress";

  // Determine primary action
  const getPrimaryAction = useCallback(() => {
    if (isComplete) {
      return {
        label: "✓ Create Practice Session",
        onClick: onApproveAll,
        variant: "success" as const,
      };
    }

    if (isInProgress) {
      const remaining = stats.needsReview - stats.reviewed;
      return {
        label: `Continue Review (${remaining} left)`,
        onClick: onStartReview,
        variant: "primary" as const,
      };
    }

    if (stats.needsReview === 0) {
      return {
        label: "✓ Approve All",
        onClick: onApproveAll,
        variant: "success" as const,
      };
    }

    return {
      label: `Check ${stats.needsReview} Problem${stats.needsReview === 1 ? "" : "s"}`,
      onClick: onStartReview,
      variant: "primary" as const,
    };
  }, [isComplete, isInProgress, stats, onStartReview, onApproveAll]);

  const primaryAction = getPrimaryAction();

  return (
    <div
      data-component="worksheet-review-summary"
      className={css({
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "gray.900",
        color: "white",
      })}
    >
      {/* Header with worksheet counter */}
      <div
        data-element="summary-header"
        className={css({
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: 4,
          borderBottom: "1px solid",
          borderColor: "gray.700",
        })}
      >
        <span className={css({ fontSize: "sm", color: "gray.400" })}>
          Worksheet {worksheetIndex} of {totalWorksheets}
        </span>
        {isInProgress && (
          <span
            className={css({
              fontSize: "xs",
              color: "blue.400",
              backgroundColor: "blue.900",
              px: 2,
              py: 1,
              borderRadius: "full",
            })}
          >
            In Progress
          </span>
        )}
      </div>

      {/* Main content area */}
      <div
        className={css({
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 6,
          gap: 6,
          overflow: "auto",
        })}
      >
        {/* Worksheet thumbnail */}
        <div
          data-element="worksheet-thumbnail"
          className={css({
            width: "200px",
            height: "260px",
            borderRadius: "lg",
            overflow: "hidden",
            border: "2px solid",
            borderColor: scanQuality === "poor" ? "red.500" : "gray.600",
            position: "relative",
          })}
        >
          <img
            src={thumbnailUrl}
            alt="Worksheet"
            className={css({
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: scanQuality === "poor" ? 0.6 : 1,
            })}
          />
          {scanQuality === "poor" && (
            <div
              className={css({
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
              })}
            >
              <span className={css({ fontSize: "3xl" })}>⚠️</span>
            </div>
          )}
        </div>

        {/* Problem count */}
        <div
          data-element="problem-summary"
          className={css({
            textAlign: "center",
          })}
        >
          <div
            className={css({
              fontSize: "2xl",
              fontWeight: "bold",
              marginBottom: 1,
            })}
          >
            Found {stats.active} problem{stats.active === 1 ? "" : "s"}
          </div>
          {stats.excluded > 0 && (
            <div className={css({ fontSize: "sm", color: "gray.500" })}>
              ({stats.excluded} excluded)
            </div>
          )}
        </div>

        {/* Confidence bar */}
        <div
          data-element="confidence-bar"
          className={css({
            width: "100%",
            maxWidth: "300px",
          })}
        >
          <div
            className={css({
              height: "8px",
              backgroundColor: "gray.700",
              borderRadius: "full",
              overflow: "hidden",
            })}
          >
            <div
              className={css({
                height: "100%",
                borderRadius: "full",
                transition: "width 0.3s ease",
              })}
              style={{
                width: `${Math.round(stats.overallConfidence * 100)}%`,
                backgroundColor:
                  scanQuality === "poor"
                    ? "var(--colors-red-500)"
                    : scanQuality === "good"
                      ? "var(--colors-green-500)"
                      : "var(--colors-yellow-500)",
              }}
            />
          </div>
          <div
            className={css({
              fontSize: "xs",
              color: "gray.500",
              textAlign: "center",
              marginTop: 1,
            })}
          >
            {Math.round(stats.overallConfidence * 100)}% confidence
          </div>
        </div>

        {/* Status breakdown */}
        <div
          data-element="status-breakdown"
          className={css({
            display: "flex",
            gap: 4,
            justifyContent: "center",
            flexWrap: "wrap",
          })}
        >
          {stats.autoApproved > 0 && (
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: "green.400",
              })}
            >
              <span>✓</span>
              <span>{stats.autoApproved} look right</span>
            </div>
          )}
          {stats.needsReview > 0 && (
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: "yellow.400",
              })}
            >
              <span>⚠</span>
              <span>{stats.needsReview} need review</span>
            </div>
          )}
          {stats.corrected > 0 && (
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: "blue.400",
              })}
            >
              <span>✎</span>
              <span>{stats.corrected} corrected</span>
            </div>
          )}
        </div>

        {/* Poor scan warning */}
        {scanQuality === "poor" && (
          <div
            data-element="poor-scan-warning"
            className={css({
              backgroundColor: "red.900",
              border: "1px solid",
              borderColor: "red.700",
              borderRadius: "lg",
              padding: 4,
              maxWidth: "320px",
              textAlign: "center",
            })}
          >
            <div
              className={css({
                fontWeight: "semibold",
                marginBottom: 2,
                color: "red.300",
              })}
            >
              ⚠️ Hard to Read
            </div>
            <div
              className={css({
                fontSize: "sm",
                color: "red.200",
                marginBottom: 3,
              })}
            >
              This photo is blurry or poorly lit. Consider retaking it for
              better results.
            </div>
            {onRetakePhoto && (
              <button
                type="button"
                onClick={onRetakePhoto}
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 2,
                  px: 4,
                  py: 2,
                  fontSize: "sm",
                  fontWeight: "medium",
                  color: "white",
                  backgroundColor: "red.600",
                  border: "none",
                  borderRadius: "lg",
                  cursor: "pointer",
                  _hover: { backgroundColor: "red.700" },
                })}
              >
                📸 Retake Photo
              </button>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div
        data-element="summary-actions"
        className={css({
          padding: 4,
          borderTop: "1px solid",
          borderColor: "gray.700",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        })}
      >
        {/* Primary action */}
        <button
          type="button"
          data-action={primaryAction.variant}
          onClick={primaryAction.onClick}
          disabled={isApproving || isInitializing}
          className={css({
            width: "100%",
            py: 3,
            px: 4,
            fontSize: "md",
            fontWeight: "semibold",
            color: "white",
            backgroundColor:
              primaryAction.variant === "success" ? "green.600" : "blue.600",
            border: "none",
            borderRadius: "lg",
            cursor: "pointer",
            _hover: {
              backgroundColor:
                primaryAction.variant === "success" ? "green.700" : "blue.700",
            },
            _disabled: {
              opacity: 0.6,
              cursor: "wait",
            },
          })}
        >
          {isApproving || isInitializing
            ? "Processing..."
            : primaryAction.label}
        </button>

        {/* Secondary actions */}
        <div
          className={css({
            display: "flex",
            justifyContent: "center",
            gap: 4,
          })}
        >
          {/* Skip/Approve all shortcut when there are items to review */}
          {stats.needsReview > 0 && !isComplete && (
            <button
              type="button"
              onClick={onApproveAll}
              disabled={isApproving}
              className={css({
                fontSize: "sm",
                color: "gray.400",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                _hover: { color: "gray.200" },
                _disabled: { opacity: 0.5 },
              })}
            >
              Skip & approve all
            </button>
          )}

          {/* Remove worksheet option */}
          {onRemoveWorksheet && (
            <button
              type="button"
              onClick={onRemoveWorksheet}
              className={css({
                fontSize: "sm",
                color: "red.400",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                _hover: { color: "red.300" },
              })}
            >
              Remove
            </button>
          )}
        </div>

        {/* Next worksheet navigation */}
        {totalWorksheets > 1 &&
          worksheetIndex < totalWorksheets &&
          onNextWorksheet && (
            <button
              type="button"
              onClick={onNextWorksheet}
              className={css({
                fontSize: "sm",
                color: "gray.400",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                _hover: { color: "gray.200" },
              })}
            >
              Next worksheet →
            </button>
          )}
      </div>
    </div>
  );
}
