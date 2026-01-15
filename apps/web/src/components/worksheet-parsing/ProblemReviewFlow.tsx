"use client";

/**
 * ProblemReviewFlow - Container component for the one-problem-at-a-time review experience
 *
 * Coordinates:
 * - ProblemReviewCard for the main review UI
 * - ReviewMiniMap for spatial context
 * - Navigation between problems
 * - Correction submission and progress tracking
 */

import { type ReactNode, useState, useCallback, useMemo } from "react";
import { css } from "../../../styled-system/css";
import type {
  ParsedProblem,
  WorksheetParsingResult,
  ReviewProgress,
} from "@/lib/worksheet-parsing";
import type { ProblemCorrection } from "./EditableProblemRow";
import { ProblemReviewCard } from "./ProblemReviewCard";
import { ReviewMiniMap } from "./ReviewMiniMap";

export interface ProblemReviewFlowProps {
  /** Full worksheet image URL */
  worksheetImageUrl: string;
  /** Parsing result with all problems */
  parsingResult: WorksheetParsingResult;
  /** Current review progress */
  reviewProgress: ReviewProgress | null;
  /** Callback when a problem is approved */
  onApproveProblem: (problemIndex: number) => Promise<void>;
  /** Callback when a problem is corrected */
  onCorrectProblem: (
    problemIndex: number,
    correction: ProblemCorrection,
  ) => Promise<void>;
  /** Callback when a problem is flagged */
  onFlagProblem: (problemIndex: number) => Promise<void>;
  /** Callback when review is complete */
  onReviewComplete: () => void;
  /** Callback to close the review flow */
  onClose: () => void;
  /** Dark mode */
  isDark?: boolean;
}

/**
 * Filter problems to show only those needing review (pending status)
 * Returns indices of problems that need review, in order
 */
function getProblemsNeedingReview(problems: ParsedProblem[]): number[] {
  return problems
    .map((p, i) => ({ problem: p, index: i }))
    .filter(({ problem }) => problem.reviewStatus === "pending")
    .map(({ index }) => index);
}

/**
 * Get summary stats for the review progress
 */
function getReviewStats(problems: ParsedProblem[]): {
  total: number;
  pending: number;
  approved: number;
  corrected: number;
  flagged: number;
} {
  const stats = {
    total: problems.length,
    pending: 0,
    approved: 0,
    corrected: 0,
    flagged: 0,
  };
  for (const p of problems) {
    switch (p.reviewStatus) {
      case "pending":
        stats.pending++;
        break;
      case "approved":
        stats.approved++;
        break;
      case "corrected":
        stats.corrected++;
        break;
      case "flagged":
        stats.flagged++;
        break;
    }
  }
  return stats;
}

export function ProblemReviewFlow({
  worksheetImageUrl,
  parsingResult,
  reviewProgress,
  onApproveProblem,
  onCorrectProblem,
  onFlagProblem,
  onReviewComplete,
  onClose,
  isDark = true,
}: ProblemReviewFlowProps): ReactNode {
  const problems = parsingResult.problems;

  // Get the indices of problems that need review
  const problemsNeedingReview = useMemo(
    () => getProblemsNeedingReview(problems),
    [problems],
  );

  // Current position in the review queue (index into problemsNeedingReview)
  const [queuePosition, setQueuePosition] = useState(0);

  // Actual problem index (into the full problems array)
  const currentProblemIndex = problemsNeedingReview[queuePosition] ?? 0;

  // For viewing the mini-map, we might select any problem
  const [selectedMapIndex, setSelectedMapIndex] = useState<number | null>(null);

  // The problem we're actually showing (either from queue or map selection)
  const displayedIndex = selectedMapIndex ?? currentProblemIndex;
  const currentProblem = problems[displayedIndex];

  const [isSaving, setIsSaving] = useState(false);

  const stats = useMemo(() => getReviewStats(problems), [problems]);

  // Handle approve - move to next problem
  const handleApprove = useCallback(async () => {
    setIsSaving(true);
    try {
      await onApproveProblem(displayedIndex);

      // If we were viewing via map, go back to queue
      if (selectedMapIndex !== null) {
        setSelectedMapIndex(null);
      } else {
        // Advance queue position (or stay if we're at the end and will recalculate)
        if (queuePosition < problemsNeedingReview.length - 1) {
          setQueuePosition(queuePosition + 1);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    displayedIndex,
    selectedMapIndex,
    queuePosition,
    problemsNeedingReview.length,
    onApproveProblem,
  ]);

  // Handle correction
  const handleCorrection = useCallback(
    async (correction: ProblemCorrection) => {
      setIsSaving(true);
      try {
        await onCorrectProblem(displayedIndex, correction);

        // Move to next problem
        if (selectedMapIndex !== null) {
          setSelectedMapIndex(null);
        } else if (queuePosition < problemsNeedingReview.length - 1) {
          setQueuePosition(queuePosition + 1);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [
      displayedIndex,
      selectedMapIndex,
      queuePosition,
      problemsNeedingReview.length,
      onCorrectProblem,
    ],
  );

  // Handle flag
  const handleFlag = useCallback(async () => {
    setIsSaving(true);
    try {
      await onFlagProblem(displayedIndex);

      // Move to next problem
      if (selectedMapIndex !== null) {
        setSelectedMapIndex(null);
      } else if (queuePosition < problemsNeedingReview.length - 1) {
        setQueuePosition(queuePosition + 1);
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    displayedIndex,
    selectedMapIndex,
    queuePosition,
    problemsNeedingReview.length,
    onFlagProblem,
  ]);

  // Navigate to next problem in queue
  const handleNext = useCallback(() => {
    if (selectedMapIndex !== null) {
      // If viewing from map, find next in full list
      if (selectedMapIndex < problems.length - 1) {
        setSelectedMapIndex(selectedMapIndex + 1);
      }
    } else if (queuePosition < problemsNeedingReview.length - 1) {
      setQueuePosition(queuePosition + 1);
    }
  }, [
    selectedMapIndex,
    queuePosition,
    problemsNeedingReview.length,
    problems.length,
  ]);

  // Navigate to previous problem
  const handlePrev = useCallback(() => {
    if (selectedMapIndex !== null) {
      if (selectedMapIndex > 0) {
        setSelectedMapIndex(selectedMapIndex - 1);
      }
    } else if (queuePosition > 0) {
      setQueuePosition(queuePosition - 1);
    }
  }, [selectedMapIndex, queuePosition]);

  // Jump to a specific problem from the mini-map
  const handleSelectFromMap = useCallback((index: number) => {
    setSelectedMapIndex(index);
  }, []);

  // Check if review is complete
  const isReviewComplete =
    problemsNeedingReview.length === 0 || stats.pending === 0;

  // Show completion screen if done
  if (isReviewComplete) {
    return (
      <div
        data-component="problem-review-flow"
        data-state="complete"
        className={css({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          padding: 6,
          minHeight: "400px",
          backgroundColor: isDark ? "gray.800" : "white",
          borderRadius: "xl",
        })}
      >
        <div className={css({ fontSize: "4xl" })}>🎉</div>
        <h2
          className={css({
            fontSize: "xl",
            fontWeight: "bold",
            color: isDark ? "white" : "gray.900",
          })}
        >
          Review Complete!
        </h2>
        <p
          className={css({
            color: isDark ? "gray.400" : "gray.600",
            textAlign: "center",
          })}
        >
          All {stats.total} problems have been reviewed.
        </p>

        {/* Stats summary */}
        <div
          className={css({
            display: "flex",
            gap: 4,
            marginTop: 2,
          })}
        >
          {stats.approved > 0 && (
            <div className={css({ textAlign: "center" })}>
              <div
                className={css({
                  fontSize: "lg",
                  fontWeight: "bold",
                  color: "green.400",
                })}
              >
                {stats.approved}
              </div>
              <div
                className={css({
                  fontSize: "xs",
                  color: isDark ? "gray.500" : "gray.500",
                })}
              >
                Approved
              </div>
            </div>
          )}
          {stats.corrected > 0 && (
            <div className={css({ textAlign: "center" })}>
              <div
                className={css({
                  fontSize: "lg",
                  fontWeight: "bold",
                  color: "purple.400",
                })}
              >
                {stats.corrected}
              </div>
              <div
                className={css({
                  fontSize: "xs",
                  color: isDark ? "gray.500" : "gray.500",
                })}
              >
                Corrected
              </div>
            </div>
          )}
          {stats.flagged > 0 && (
            <div className={css({ textAlign: "center" })}>
              <div
                className={css({
                  fontSize: "lg",
                  fontWeight: "bold",
                  color: "orange.400",
                })}
              >
                {stats.flagged}
              </div>
              <div
                className={css({
                  fontSize: "xs",
                  color: isDark ? "gray.500" : "gray.500",
                })}
              >
                Flagged
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onReviewComplete}
          className={css({
            marginTop: 4,
            px: 6,
            py: 3,
            fontSize: "md",
            fontWeight: "bold",
            backgroundColor: "green.600",
            color: "white",
            border: "none",
            borderRadius: "lg",
            cursor: "pointer",
            _hover: { backgroundColor: "green.700" },
          })}
        >
          Finish & Create Session
        </button>
      </div>
    );
  }

  return (
    <div
      data-component="problem-review-flow"
      data-state="reviewing"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: 4,
        height: "100%",
      })}
    >
      {/* Header with progress and close button */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 2,
        })}
      >
        <div className={css({ display: "flex", alignItems: "center", gap: 3 })}>
          <button
            type="button"
            onClick={onClose}
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1,
              fontSize: "sm",
              backgroundColor: "transparent",
              color: isDark ? "gray.400" : "gray.600",
              border: "none",
              borderRadius: "md",
              cursor: "pointer",
              _hover: { backgroundColor: isDark ? "gray.700" : "gray.100" },
            })}
          >
            ← Back
          </button>

          <div
            className={css({
              fontSize: "sm",
              color: isDark ? "gray.400" : "gray.600",
            })}
          >
            {selectedMapIndex !== null ? (
              <span>
                Viewing problem {selectedMapIndex + 1} of {problems.length}
              </span>
            ) : (
              <span>
                Reviewing {queuePosition + 1} of {problemsNeedingReview.length}{" "}
                flagged
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className={css({
          height: "4px",
          backgroundColor: isDark ? "gray.700" : "gray.200",
          borderRadius: "full",
          overflow: "hidden",
        })}
      >
        <div
          className={css({
            height: "100%",
            backgroundColor: "green.500",
            transition: "width 0.3s ease",
          })}
          style={{
            width: `${((stats.total - stats.pending) / stats.total) * 100}%`,
          }}
        />
      </div>

      {/* Mini-map - always visible for spatial context */}
      <ReviewMiniMap
        worksheetImageUrl={worksheetImageUrl}
        problems={problems}
        currentIndex={displayedIndex}
        onSelectProblem={handleSelectFromMap}
        isDark={isDark}
        compact
      />

      {/* Main review card */}
      {currentProblem && (
        <ProblemReviewCard
          problem={currentProblem}
          index={displayedIndex}
          totalProblems={problems.length}
          worksheetImageUrl={worksheetImageUrl}
          onSubmitCorrection={handleCorrection}
          onApprove={handleApprove}
          onFlag={handleFlag}
          onNext={handleNext}
          onPrev={handlePrev}
          isSaving={isSaving}
          isDark={isDark}
        />
      )}

      {/* Skip to complete button when viewing already-reviewed problem */}
      {selectedMapIndex !== null && (
        <button
          type="button"
          onClick={() => setSelectedMapIndex(null)}
          className={css({
            alignSelf: "center",
            px: 4,
            py: 2,
            fontSize: "sm",
            backgroundColor: isDark ? "gray.700" : "gray.200",
            color: isDark ? "gray.300" : "gray.700",
            border: "none",
            borderRadius: "lg",
            cursor: "pointer",
            _hover: { backgroundColor: isDark ? "gray.600" : "gray.300" },
          })}
        >
          Return to Review Queue
        </button>
      )}
    </div>
  );
}

export default ProblemReviewFlow;
