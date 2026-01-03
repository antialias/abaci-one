"use client";

import { useMemo, useState } from "react";
import type { ObservedResult } from "@/hooks/useSessionObserver";
import { css } from "../../../styled-system/css";
import { formatMs } from "./autoPauseCalculator";
import { CompactLinearProblem } from "./CompactProblemDisplay";
import { getPurposeColors, getPurposeConfig } from "./purposeExplanations";

interface LiveResultsPanelProps {
  /** Accumulated results from the session */
  results: ObservedResult[];
  /** Total problems in the session */
  totalProblems: number;
  /** Whether dark mode */
  isDark: boolean;
  /** Callback to expand to full report view */
  onExpandFullReport?: () => void;
}

/**
 * Observed Result Item - expandable card like ProblemToReview
 *
 * Shows problem in collapsed mode, expands to show full details when clicked.
 * Similar pattern to ProblemToReview but adapted for ObservedResult data.
 */
function ObservedResultItem({
  result,
  isDark,
}: {
  result: ObservedResult;
  isDark: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const studentAnswerNum = parseInt(result.studentAnswer, 10);
  const purposeConfig = getPurposeConfig(result.purpose);
  const purposeColors = getPurposeColors(result.purpose, isDark);
  const isIncorrect = !result.isCorrect;

  return (
    <div
      data-component="observed-result-item"
      data-problem-number={result.problemNumber}
      data-correct={result.isCorrect}
      className={css({
        display: "flex",
        flexDirection: "column",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: isIncorrect
          ? isDark
            ? "red.700"
            : "red.200"
          : isDark
            ? "green.700"
            : "green.200",
        backgroundColor: isIncorrect
          ? isDark
            ? "red.900/30"
            : "red.50"
          : isDark
            ? "green.900/30"
            : "green.50",
        overflow: "hidden",
      })}
    >
      {/* Header row - clickable to expand/collapse */}
      <button
        type="button"
        data-element="result-header"
        onClick={() => setIsExpanded(!isExpanded)}
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.375rem 0.625rem",
          backgroundColor: isDark ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.02)",
          border: "none",
          borderBottom: isExpanded ? "1px solid" : "none",
          borderColor: isDark ? "gray.700/50" : "gray.200/50",
          width: "100%",
          cursor: "pointer",
          textAlign: "left",
          _hover: {
            backgroundColor: isDark ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.04)",
          },
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flex: 1,
          })}
        >
          {/* Problem number */}
          <span
            className={css({
              fontSize: "0.625rem",
              fontWeight: "bold",
              color: isDark ? "gray.500" : "gray.400",
              minWidth: "1.25rem",
            })}
          >
            #{result.problemNumber}
          </span>

          {/* Status indicator */}
          <span
            className={css({
              fontSize: "0.75rem",
              fontWeight: "bold",
              color: result.isCorrect
                ? isDark
                  ? "green.400"
                  : "green.600"
                : isDark
                  ? "red.400"
                  : "red.600",
            })}
          >
            {result.isCorrect ? "✓" : "✗"}
          </span>

          {/* Compact problem display */}
          <div className={css({ flex: 1 })}>
            <CompactLinearProblem
              terms={result.terms}
              answer={result.answer}
              studentAnswer={
                Number.isNaN(studentAnswerNum) ? undefined : studentAnswerNum
              }
              isCorrect={result.isCorrect}
              isDark={isDark}
            />
          </div>
        </div>

        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          })}
        >
          {/* Purpose emoji badge */}
          <span
            className={css({
              padding: "0.125rem 0.375rem",
              borderRadius: "4px",
              fontSize: "0.5625rem",
              fontWeight: "500",
              backgroundColor: purposeColors.background,
              color: purposeColors.text,
            })}
          >
            {purposeConfig.emoji}
          </span>

          {/* Expand/collapse indicator */}
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "1rem",
              height: "1rem",
              fontSize: "0.5rem",
              color: isDark ? "gray.400" : "gray.500",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.25s ease-out",
            })}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Expanded details with smooth animation */}
      <div
        data-element="expanded-details-wrapper"
        className={css({
          display: "grid",
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.25s ease-out",
        })}
      >
        <div
          data-element="expanded-details"
          className={css({
            overflow: "hidden",
          })}
        >
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "0.5rem 0.625rem",
              opacity: isExpanded ? 1 : 0,
              transition: "opacity 0.2s ease-out",
            })}
          >
            {/* Full problem display */}
            <div
              className={css({
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "1rem",
                fontWeight: "bold",
                textAlign: "center",
                padding: "0.5rem",
                borderRadius: "6px",
                backgroundColor: result.isCorrect
                  ? isDark
                    ? "green.900/50"
                    : "green.100"
                  : isDark
                    ? "red.900/50"
                    : "red.100",
              })}
            >
              <span
                className={css({ color: isDark ? "gray.200" : "gray.800" })}
              >
                {result.terms
                  .map((t, i) =>
                    i === 0
                      ? String(t)
                      : t < 0
                        ? ` − ${Math.abs(t)}`
                        : ` + ${t}`,
                  )
                  .join("")}{" "}
                ={" "}
              </span>
              <span
                className={css({
                  color: result.isCorrect
                    ? isDark
                      ? "green.300"
                      : "green.700"
                    : isDark
                      ? "red.300"
                      : "red.700",
                })}
              >
                {result.answer}
              </span>
            </div>

            {/* If incorrect, show student's answer */}
            {!result.isCorrect && (
              <div
                className={css({
                  padding: "0.375rem",
                  borderRadius: "6px",
                  backgroundColor: isDark ? "red.900/40" : "red.50",
                  textAlign: "center",
                  fontSize: "0.75rem",
                  color: isDark ? "red.300" : "red.700",
                })}
              >
                Student answered: <strong>{result.studentAnswer}</strong>
              </div>
            )}

            {/* Purpose explanation */}
            <div
              className={css({
                display: "flex",
                flexDirection: "column",
                gap: "0.125rem",
              })}
            >
              <span
                className={css({
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "0.125rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.625rem",
                  fontWeight: "500",
                  backgroundColor: purposeColors.background,
                  color: purposeColors.text,
                  width: "fit-content",
                })}
              >
                {purposeConfig.emoji} {purposeConfig.shortLabel}
              </span>
              <span
                className={css({
                  fontSize: "0.625rem",
                  color: isDark ? "gray.400" : "gray.500",
                  fontStyle: "italic",
                })}
              >
                {purposeConfig.shortExplanation}
              </span>
            </div>

            {/* Response time */}
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.6875rem",
                color: isDark ? "gray.400" : "gray.500",
              })}
            >
              <span>Response time:</span>
              <span
                className={css({
                  fontWeight: "bold",
                  color: isDark ? "gray.200" : "gray.800",
                })}
              >
                {formatMs(result.responseTimeMs)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * LiveResultsPanel - Shows real-time accumulated results during session observation
 *
 * Always shows:
 * - Summary stats (progress, accuracy, incorrect count)
 * - Problem list (toggle between incorrect only and all)
 * - "Full Report" button to expand to comprehensive view
 */
export function LiveResultsPanel({
  results,
  totalProblems,
  isDark,
  onExpandFullReport,
}: LiveResultsPanelProps) {
  const [showAllProblems, setShowAllProblems] = useState(false);

  // Compute stats
  const stats = useMemo(() => {
    const correct = results.filter((r) => r.isCorrect).length;
    const incorrect = results.filter((r) => !r.isCorrect).length;
    const completed = results.length;
    const accuracy = completed > 0 ? correct / completed : 0;
    return { correct, incorrect, completed, accuracy };
  }, [results]);

  // Get incorrect results
  const incorrectResults = useMemo(
    () => results.filter((r) => !r.isCorrect),
    [results],
  );

  // No results yet - show placeholder
  if (results.length === 0) {
    return (
      <div
        data-component="live-results-panel"
        data-state="empty"
        className={css({
          borderRadius: "8px",
          border: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
          backgroundColor: isDark ? "gray.800" : "white",
          padding: "0.75rem",
          textAlign: "center",
        })}
      >
        <p
          className={css({
            fontSize: "0.75rem",
            color: isDark ? "gray.500" : "gray.400",
          })}
        >
          Waiting for results...
        </p>
      </div>
    );
  }

  return (
    <div
      data-component="live-results-panel"
      className={css({
        borderRadius: "8px",
        border: "1px solid",
        borderColor: isDark ? "gray.700" : "gray.200",
        backgroundColor: isDark ? "gray.800" : "white",
        overflow: "hidden",
      })}
    >
      {/* Summary stats header */}
      <div
        data-element="stats-header"
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 0.75rem",
          borderBottom: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
          backgroundColor: isDark ? "gray.850" : "gray.50",
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          })}
        >
          {/* Progress */}
          <span
            className={css({
              fontSize: "0.75rem",
              fontWeight: "bold",
              color: isDark ? "gray.300" : "gray.600",
            })}
          >
            {stats.completed}/{totalProblems}
          </span>

          {/* Accuracy */}
          <span
            className={css({
              fontSize: "0.75rem",
              fontWeight: "bold",
              color:
                stats.accuracy >= 0.8
                  ? isDark
                    ? "green.400"
                    : "green.600"
                  : stats.accuracy >= 0.6
                    ? isDark
                      ? "yellow.400"
                      : "yellow.600"
                    : isDark
                      ? "red.400"
                      : "red.600",
            })}
          >
            {Math.round(stats.accuracy * 100)}%
          </span>

          {/* Incorrect count badge */}
          {stats.incorrect > 0 && (
            <span
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "0.125rem 0.375rem",
                borderRadius: "9999px",
                backgroundColor: isDark ? "red.900/50" : "red.100",
                fontSize: "0.6875rem",
                fontWeight: "bold",
                color: isDark ? "red.300" : "red.700",
              })}
            >
              <span>✗</span>
              <span>{stats.incorrect}</span>
            </span>
          )}
        </div>

        {/* Full Report button */}
        {onExpandFullReport && (
          <button
            type="button"
            data-action="expand-full-report"
            onClick={onExpandFullReport}
            className={css({
              fontSize: "0.625rem",
              fontWeight: "bold",
              color: isDark ? "blue.400" : "blue.600",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.125rem 0.25rem",
              borderRadius: "4px",
              _hover: {
                backgroundColor: isDark ? "blue.900/30" : "blue.50",
              },
            })}
          >
            Full Report →
          </button>
        )}
      </div>

      {/* Problem list content */}
      <div
        data-element="results-content"
        className={css({
          padding: "0.75rem",
        })}
      >
        {/* Section header with toggle */}
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          })}
        >
          <span
            className={css({
              fontSize: "0.6875rem",
              fontWeight: "bold",
              color: isDark ? "gray.400" : "gray.600",
            })}
          >
            {showAllProblems ? "All Problems" : "Incorrect"}
            {!showAllProblems && stats.incorrect > 0 && ` (${stats.incorrect})`}
          </span>

          {/* Toggle between incorrect only and all */}
          <button
            type="button"
            onClick={() => setShowAllProblems(!showAllProblems)}
            className={css({
              fontSize: "0.625rem",
              color: isDark ? "blue.400" : "blue.600",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              _hover: { color: isDark ? "blue.300" : "blue.700" },
            })}
          >
            {showAllProblems ? "Incorrect only" : "Show all"}
          </button>
        </div>

        {/* Results list */}
        <div
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
            maxHeight: "250px",
            overflowY: "auto",
          })}
        >
          {(showAllProblems ? results : incorrectResults).length === 0 ? (
            <div
              className={css({
                textAlign: "center",
                padding: "0.75rem",
                fontSize: "0.6875rem",
                color: isDark ? "gray.500" : "gray.400",
              })}
            >
              {showAllProblems
                ? "No problems completed yet"
                : "No incorrect problems yet"}
            </div>
          ) : (
            (showAllProblems ? results : incorrectResults).map((result) => (
              <ObservedResultItem
                key={result.problemNumber}
                result={result}
                isDark={isDark}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveResultsPanel;
