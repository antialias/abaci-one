/**
 * Attempt History Panel Component
 *
 * Shows all attempts (original + retries) for a problem slot.
 * Allows teachers/parents to:
 * - Mark incorrect attempts as correct (typo fix)
 * - Exclude attempts from progress tracking
 */

"use client";

import { useState } from "react";
import type { SlotResult } from "@/db/schema/session-plans";
import { css } from "../../../styled-system/css";

/**
 * Result with its global index in the plan.results array
 */
export interface ResultWithGlobalIndex {
  result: SlotResult;
  globalIndex: number;
}

export interface AttemptHistoryPanelProps {
  /** All results for this slot (original + retries) with their global indices */
  results: ResultWithGlobalIndex[];
  /** The correct answer for this problem */
  correctAnswer: number;
  /** Dark mode */
  isDark: boolean;
  /** Student ID for API calls */
  studentId: string;
  /** Plan ID for API calls */
  planId: string;
  /** Callback when a result is edited */
  onResultEdited?: () => void;
}

/**
 * Get attempt label based on epoch number
 */
function getAttemptLabel(epochNumber: number | undefined): string {
  if (epochNumber === undefined || epochNumber === 0) return "Original";
  if (epochNumber === 1) return "Retry 1";
  if (epochNumber === 2) return "Retry 2";
  return `Retry ${epochNumber}`;
}

/**
 * Format response time for display
 */
function formatTime(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

/**
 * Get mastery weight display
 */
function getMasteryWeightDisplay(
  isCorrect: boolean,
  epochNumber: number | undefined,
  isExcluded: boolean,
): { value: string; color: string } {
  if (isExcluded) {
    return { value: "0 (excluded)", color: "gray" };
  }
  if (!isCorrect) {
    return { value: "0", color: "red" };
  }
  const epoch = epochNumber ?? 0;
  const weight = 1.0 / 2 ** epoch;
  const percent = Math.round(weight * 100);
  return { value: `${weight} (${percent}%)`, color: "green" };
}

export function AttemptHistoryPanel({
  results,
  correctAnswer,
  isDark,
  studentId,
  planId,
  onResultEdited,
}: AttemptHistoryPanelProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sort results by epochNumber
  const sortedResults = [...results].sort(
    (a, b) => (a.result.epochNumber ?? 0) - (b.result.epochNumber ?? 0),
  );

  const handleMarkCorrect = async (resultIndex: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/curriculum/${studentId}/sessions/plans/${planId}/results/${resultIndex}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_correct" }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to mark as correct");
      }
      onResultEdited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
      setEditingIndex(null);
    }
  };

  const handleExclude = async (resultIndex: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/curriculum/${studentId}/sessions/plans/${planId}/results/${resultIndex}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "exclude" }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to exclude");
      }
      onResultEdited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
      setEditingIndex(null);
    }
  };

  const handleInclude = async (resultIndex: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/curriculum/${studentId}/sessions/plans/${planId}/results/${resultIndex}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "include" }),
        },
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to include");
      }
      onResultEdited?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
      setEditingIndex(null);
    }
  };

  if (results.length === 0) {
    return null;
  }

  return (
    <div
      data-component="attempt-history-panel"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        padding: "1rem",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
        backgroundColor: isDark ? "gray.800/50" : "gray.50",
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          paddingBottom: "0.5rem",
          borderBottom: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
        })}
      >
        <span
          className={css({
            fontSize: "0.875rem",
            fontWeight: "bold",
            color: isDark ? "gray.200" : "gray.800",
          })}
        >
          Attempt History
        </span>
        <span
          className={css({
            fontSize: "0.75rem",
            color: isDark ? "gray.400" : "gray.500",
          })}
        >
          ({results.length} attempt{results.length !== 1 ? "s" : ""})
        </span>
      </div>

      {/* Error display */}
      {error && (
        <div
          className={css({
            padding: "0.5rem",
            borderRadius: "4px",
            backgroundColor: isDark ? "red.900/50" : "red.50",
            color: isDark ? "red.300" : "red.700",
            fontSize: "0.75rem",
          })}
        >
          {error}
        </div>
      )}

      {/* Attempts list */}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        })}
      >
        {sortedResults.map((item, idx) => {
          const { result, globalIndex } = item;
          const isExcluded = result.source === "teacher-excluded";
          const masteryWeight = getMasteryWeightDisplay(
            result.isCorrect,
            result.epochNumber,
            isExcluded,
          );
          const isEditing = editingIndex === globalIndex;

          return (
            <div
              key={idx}
              data-element="attempt-row"
              data-epoch={result.epochNumber ?? 0}
              data-correct={result.isCorrect}
              data-excluded={isExcluded || undefined}
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
                padding: "0.75rem",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: isExcluded
                  ? isDark
                    ? "gray.600"
                    : "gray.300"
                  : result.isCorrect
                    ? isDark
                      ? "green.700"
                      : "green.200"
                    : isDark
                      ? "red.700"
                      : "red.200",
                backgroundColor: isExcluded
                  ? isDark
                    ? "gray.800/30"
                    : "gray.100/50"
                  : result.isCorrect
                    ? isDark
                      ? "green.900/30"
                      : "green.50"
                    : isDark
                      ? "red.900/30"
                      : "red.50",
                opacity: isExcluded ? 0.7 : 1,
              })}
            >
              {/* Attempt header */}
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                })}
              >
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  })}
                >
                  {/* Attempt label */}
                  <span
                    className={css({
                      fontSize: "0.75rem",
                      fontWeight: "bold",
                      color: isDark ? "gray.300" : "gray.700",
                    })}
                  >
                    {getAttemptLabel(result.epochNumber)}
                  </span>

                  {/* Status badge */}
                  {isExcluded ? (
                    <span
                      className={css({
                        padding: "0.125rem 0.375rem",
                        borderRadius: "4px",
                        fontSize: "0.625rem",
                        fontWeight: "bold",
                        backgroundColor: isDark ? "gray.700" : "gray.200",
                        color: isDark ? "gray.400" : "gray.600",
                      })}
                    >
                      EXCLUDED
                    </span>
                  ) : result.isCorrect ? (
                    <span
                      className={css({
                        padding: "0.125rem 0.375rem",
                        borderRadius: "4px",
                        fontSize: "0.625rem",
                        fontWeight: "bold",
                        backgroundColor: isDark ? "green.800" : "green.100",
                        color: isDark ? "green.300" : "green.700",
                      })}
                    >
                      CORRECT
                    </span>
                  ) : (
                    <span
                      className={css({
                        padding: "0.125rem 0.375rem",
                        borderRadius: "4px",
                        fontSize: "0.625rem",
                        fontWeight: "bold",
                        backgroundColor: isDark ? "red.800" : "red.100",
                        color: isDark ? "red.300" : "red.700",
                      })}
                    >
                      INCORRECT
                    </span>
                  )}
                </div>

                {/* Response time */}
                <span
                  className={css({
                    fontSize: "0.75rem",
                    color: isDark ? "gray.400" : "gray.500",
                  })}
                >
                  {formatTime(result.responseTimeMs)}
                </span>
              </div>

              {/* Answer details */}
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  fontSize: "0.875rem",
                })}
              >
                <span
                  className={css({ color: isDark ? "gray.400" : "gray.500" })}
                >
                  Answered:
                </span>
                <span
                  className={css({
                    fontFamily: "var(--font-mono, monospace)",
                    fontWeight: "bold",
                    color: result.isCorrect
                      ? isDark
                        ? "green.300"
                        : "green.700"
                      : isDark
                        ? "red.300"
                        : "red.700",
                  })}
                >
                  {result.studentAnswer}
                </span>
                {!result.isCorrect && (
                  <>
                    <span
                      className={css({
                        color: isDark ? "gray.500" : "gray.400",
                      })}
                    >
                      (correct: {correctAnswer})
                    </span>
                  </>
                )}
              </div>

              {/* Mastery weight info */}
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.75rem",
                  color: isDark ? "gray.400" : "gray.500",
                })}
              >
                <span>Mastery weight:</span>
                <span
                  className={css({
                    fontWeight: "bold",
                    color: isDark
                      ? `${masteryWeight.color}.400`
                      : `${masteryWeight.color}.600`,
                  })}
                >
                  {masteryWeight.value}
                </span>
                {result.hadHelp && (
                  <span
                    className={css({
                      padding: "0.125rem 0.375rem",
                      borderRadius: "4px",
                      fontSize: "0.625rem",
                      backgroundColor: isDark ? "yellow.900" : "yellow.100",
                      color: isDark ? "yellow.300" : "yellow.700",
                    })}
                  >
                    Used help
                  </span>
                )}
              </div>

              {/* Edit buttons */}
              <div
                className={css({
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginTop: "0.25rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px dashed",
                  borderColor: isDark ? "gray.700" : "gray.300",
                })}
              >
                {/* Mark Correct button - only show for incorrect attempts */}
                {!result.isCorrect && !isExcluded && (
                  <button
                    type="button"
                    onClick={() => handleMarkCorrect(globalIndex)}
                    disabled={isLoading}
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.375rem 0.625rem",
                      borderRadius: "4px",
                      border: "1px solid",
                      borderColor: isDark ? "green.600" : "green.400",
                      backgroundColor: isDark ? "green.900/50" : "green.50",
                      color: isDark ? "green.300" : "green.700",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      cursor: isLoading ? "wait" : "pointer",
                      opacity: isLoading ? 0.5 : 1,
                      _hover: {
                        backgroundColor: isDark ? "green.800/70" : "green.100",
                      },
                    })}
                  >
                    Mark Correct
                  </button>
                )}

                {/* Exclude/Include button */}
                {isExcluded ? (
                  <button
                    type="button"
                    onClick={() => handleInclude(globalIndex)}
                    disabled={isLoading}
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.375rem 0.625rem",
                      borderRadius: "4px",
                      border: "1px solid",
                      borderColor: isDark ? "blue.600" : "blue.400",
                      backgroundColor: isDark ? "blue.900/50" : "blue.50",
                      color: isDark ? "blue.300" : "blue.700",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      cursor: isLoading ? "wait" : "pointer",
                      opacity: isLoading ? 0.5 : 1,
                      _hover: {
                        backgroundColor: isDark ? "blue.800/70" : "blue.100",
                      },
                    })}
                  >
                    Include in Tracking
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleExclude(globalIndex)}
                    disabled={isLoading}
                    className={css({
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.375rem 0.625rem",
                      borderRadius: "4px",
                      border: "1px solid",
                      borderColor: isDark ? "gray.600" : "gray.400",
                      backgroundColor: isDark ? "gray.800/50" : "gray.100",
                      color: isDark ? "gray.300" : "gray.600",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      cursor: isLoading ? "wait" : "pointer",
                      opacity: isLoading ? 0.5 : 1,
                      _hover: {
                        backgroundColor: isDark ? "gray.700/70" : "gray.200",
                      },
                    })}
                  >
                    Exclude from Tracking
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
