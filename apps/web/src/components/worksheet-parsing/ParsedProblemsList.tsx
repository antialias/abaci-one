"use client";

/**
 * ParsedProblemsList - Displays extracted problems from worksheet parsing
 *
 * Shows a compact list of parsed problems with:
 * - Problem number and terms (e.g., "45 + 27")
 * - Student answer with correct/incorrect indicator
 * - Low confidence highlighting
 * - Needs review badge
 */

import { css } from "../../../styled-system/css";
import type {
  ParsedProblem,
  WorksheetParsingResult,
} from "@/lib/worksheet-parsing";

export interface ParsedProblemsListProps {
  /** The parsed result from worksheet parsing */
  result: WorksheetParsingResult;
  /** Whether to use dark mode styling */
  isDark: boolean;
  /** Optional callback when a problem is clicked (for highlighting on image) */
  onProblemClick?: (problem: ParsedProblem) => void;
  /** Currently selected problem index (for highlighting) */
  selectedProblemIndex?: number | null;
  /** Threshold below which confidence is considered "low" */
  lowConfidenceThreshold?: number;
}

/**
 * Format terms into a readable string like "45 + 27 - 12"
 */
function formatTerms(terms: number[]): string {
  if (terms.length === 0) return "";
  if (terms.length === 1) return terms[0].toString();

  return terms
    .map((term, i) => {
      if (i === 0) return term.toString();
      if (term >= 0) return `+ ${term}`;
      return `- ${Math.abs(term)}`;
    })
    .join(" ");
}

/**
 * Get the minimum confidence for a problem (either terms or student answer)
 */
function getMinConfidence(problem: ParsedProblem): number {
  // If student answer is null, only consider terms confidence
  if (problem.studentAnswer === null) {
    return problem.termsConfidence;
  }
  return Math.min(problem.termsConfidence, problem.studentAnswerConfidence);
}

export function ParsedProblemsList({
  result,
  isDark,
  onProblemClick,
  selectedProblemIndex,
  lowConfidenceThreshold = 0.7,
}: ParsedProblemsListProps) {
  const { problems, needsReview, overallConfidence } = result;

  // Calculate summary stats
  const totalProblems = problems.length;
  const answeredProblems = problems.filter(
    (p) => p.studentAnswer !== null,
  ).length;
  const correctProblems = problems.filter(
    (p) => p.studentAnswer !== null && p.studentAnswer === p.correctAnswer,
  ).length;
  const lowConfidenceCount = problems.filter(
    (p) => getMinConfidence(p) < lowConfidenceThreshold,
  ).length;

  return (
    <div
      data-component="parsed-problems-list"
      className={css({
        borderRadius: "12px",
        border: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
        backgroundColor: isDark ? "gray.800" : "white",
        overflow: "hidden",
      })}
    >
      {/* Header with summary */}
      <div
        data-element="header"
        className={css({
          padding: "0.75rem 1rem",
          backgroundColor: isDark ? "gray.750" : "gray.50",
          borderBottom: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
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
            gap: "0.75rem",
          })}
        >
          <span
            className={css({
              fontSize: "0.875rem",
              fontWeight: "bold",
              color: isDark ? "white" : "gray.800",
            })}
          >
            {totalProblems} Problems
          </span>
          {answeredProblems > 0 && (
            <span
              className={css({
                fontSize: "0.75rem",
                color: isDark ? "gray.400" : "gray.600",
              })}
            >
              {correctProblems}/{answeredProblems} correct
            </span>
          )}
        </div>
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          })}
        >
          {/* Needs review badge */}
          {needsReview && (
            <span
              data-element="needs-review-badge"
              className={css({
                px: 2,
                py: 0.5,
                fontSize: "0.6875rem",
                fontWeight: "600",
                borderRadius: "full",
                backgroundColor: "yellow.100",
                color: "yellow.800",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              })}
            >
              <span>⚠️</span> Needs Review
            </span>
          )}
          {/* Low confidence count */}
          {lowConfidenceCount > 0 && !needsReview && (
            <span
              className={css({
                px: 2,
                py: 0.5,
                fontSize: "0.6875rem",
                fontWeight: "500",
                borderRadius: "full",
                backgroundColor: isDark ? "yellow.900/30" : "yellow.50",
                color: isDark ? "yellow.400" : "yellow.700",
              })}
            >
              {lowConfidenceCount} low confidence
            </span>
          )}
          {/* Confidence indicator */}
          <span
            className={css({
              fontSize: "0.6875rem",
              color:
                overallConfidence >= 0.9
                  ? isDark
                    ? "green.400"
                    : "green.600"
                  : overallConfidence >= 0.7
                    ? isDark
                      ? "yellow.400"
                      : "yellow.600"
                    : isDark
                      ? "red.400"
                      : "red.600",
            })}
          >
            {Math.round(overallConfidence * 100)}% confidence
          </span>
        </div>
      </div>

      {/* Problems list */}
      <div
        data-element="problems-list"
        className={css({
          maxHeight: "300px",
          overflowY: "auto",
        })}
      >
        {problems.map((problem, index) => {
          const isCorrect =
            problem.studentAnswer !== null &&
            problem.studentAnswer === problem.correctAnswer;
          const isIncorrect =
            problem.studentAnswer !== null &&
            problem.studentAnswer !== problem.correctAnswer;
          const isLowConfidence =
            getMinConfidence(problem) < lowConfidenceThreshold;
          const isSelected = selectedProblemIndex === index;

          return (
            <button
              key={problem.problemNumber}
              type="button"
              data-element="problem-row"
              data-problem-number={problem.problemNumber}
              data-is-correct={isCorrect}
              data-is-low-confidence={isLowConfidence}
              onClick={() => onProblemClick?.(problem)}
              className={css({
                width: "100%",
                display: "flex",
                alignItems: "center",
                padding: "0.5rem 1rem",
                gap: "0.75rem",
                borderBottom: "1px solid",
                borderColor: isDark ? "gray.700" : "gray.100",
                backgroundColor: isSelected
                  ? isDark
                    ? "blue.900/30"
                    : "blue.50"
                  : isLowConfidence
                    ? isDark
                      ? "yellow.900/20"
                      : "yellow.50"
                    : "transparent",
                cursor: onProblemClick ? "pointer" : "default",
                transition: "background-color 0.15s",
                border: "none",
                textAlign: "left",
                _hover: {
                  backgroundColor: isSelected
                    ? isDark
                      ? "blue.900/40"
                      : "blue.100"
                    : isDark
                      ? "gray.750"
                      : "gray.50",
                },
                _last: {
                  borderBottom: "none",
                },
              })}
            >
              {/* Problem number */}
              <span
                className={css({
                  minWidth: "24px",
                  fontSize: "0.75rem",
                  fontWeight: "600",
                  color: isDark ? "gray.500" : "gray.400",
                })}
              >
                #{problem.problemNumber}
              </span>

              {/* Terms */}
              <span
                className={css({
                  flex: 1,
                  fontSize: "0.875rem",
                  fontFamily: "monospace",
                  color: isDark ? "gray.200" : "gray.700",
                })}
              >
                {formatTerms(problem.terms)}
              </span>

              {/* Equals sign and answer */}
              <span
                className={css({
                  fontSize: "0.875rem",
                  color: isDark ? "gray.400" : "gray.500",
                })}
              >
                =
              </span>

              {/* Student answer */}
              <span
                className={css({
                  minWidth: "48px",
                  fontSize: "0.875rem",
                  fontFamily: "monospace",
                  fontWeight: "500",
                  textAlign: "right",
                  color:
                    problem.studentAnswer === null
                      ? isDark
                        ? "gray.500"
                        : "gray.400"
                      : isCorrect
                        ? isDark
                          ? "green.400"
                          : "green.600"
                        : isDark
                          ? "red.400"
                          : "red.600",
                })}
              >
                {problem.studentAnswer ?? "—"}
              </span>

              {/* Correct/incorrect indicator */}
              <span
                className={css({
                  width: "20px",
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                })}
              >
                {isCorrect && (
                  <span className={css({ color: "green.500" })}>✓</span>
                )}
                {isIncorrect && (
                  <span className={css({ color: "red.500" })}>✗</span>
                )}
                {problem.studentAnswer === null && (
                  <span
                    className={css({ color: isDark ? "gray.600" : "gray.300" })}
                  >
                    —
                  </span>
                )}
              </span>

              {/* Low confidence indicator */}
              {isLowConfidence && (
                <span
                  className={css({
                    fontSize: "0.6875rem",
                    color: isDark ? "yellow.400" : "yellow.600",
                  })}
                  title={`${Math.round(getMinConfidence(problem) * 100)}% confidence`}
                >
                  ⚠️
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Warnings section if any */}
      {result.warnings.length > 0 && (
        <div
          data-element="warnings"
          className={css({
            padding: "0.75rem 1rem",
            backgroundColor: isDark ? "yellow.900/20" : "yellow.50",
            borderTop: "1px solid",
            borderColor: isDark ? "yellow.800/30" : "yellow.200",
          })}
        >
          <div
            className={css({
              fontSize: "0.75rem",
              fontWeight: "600",
              color: isDark ? "yellow.400" : "yellow.700",
              marginBottom: "0.25rem",
            })}
          >
            Warnings:
          </div>
          <ul
            className={css({
              margin: 0,
              padding: 0,
              listStyle: "none",
            })}
          >
            {result.warnings.map((warning, i) => (
              <li
                key={i}
                className={css({
                  fontSize: "0.6875rem",
                  color: isDark ? "yellow.300" : "yellow.800",
                  paddingLeft: "0.75rem",
                  position: "relative",
                  _before: {
                    content: '"•"',
                    position: "absolute",
                    left: 0,
                  },
                })}
              >
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ParsedProblemsList;
