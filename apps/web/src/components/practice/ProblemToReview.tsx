/**
 * Problem To Review Component
 *
 * A unified problem summary component with progressive disclosure.
 * Shows a single problem representation that can be expanded to reveal
 * skill annotations, purpose explanation, and timing details.
 *
 * Key features:
 * - Single problem representation (never duplicated between collapsed/expanded)
 * - In collapsed mode: shows problem + weak skills (up to 3, ordered by BKT severity)
 * - In expanded mode: annotates the SAME problem with skill breakdown per term
 * - Part type indicator (🧮 Abacus, 🧠 Visualize, 💭 Mental)
 * - Purpose explanation (focus, reinforce, review, challenge)
 * - Attention reason badges (incorrect, slow, help-used)
 */

"use client";

import { useState } from "react";
import { css } from "../../../styled-system/css";
import type { SkillBktResult } from "@/lib/curriculum/bkt";
import { AnnotatedProblem } from "./AnnotatedProblem";
import { calculateAutoPauseInfo, formatMs } from "./autoPauseCalculator";
import { getPurposeColors, getPurposeConfig } from "./purposeExplanations";
import {
  type AttentionReason,
  getPartTypeLabel,
  type ProblemNeedingAttention,
} from "./sessionSummaryUtils";
import { getWeakSkillsForProblem } from "./weakSkillUtils";
import { WeakSkillsSummary } from "./WeakSkillsSummary";

export interface ProblemToReviewProps {
  /** The problem that needs attention */
  problem: ProblemNeedingAttention;
  /** All results up to this problem (for auto-pause calculation) */
  allResultsBeforeThis: import("@/db/schema/session-plans").SlotResult[];
  /** BKT mastery data for skills */
  skillMasteries?: Map<string, SkillBktResult> | Record<string, SkillBktResult>;
  /** Dark mode */
  isDark: boolean;
}

/**
 * Get emoji for part type
 */
function getPartTypeEmoji(type: string): string {
  switch (type) {
    case "abacus":
      return "🧮";
    case "visualization":
      return "🧠";
    case "linear":
      return "💭";
    default:
      return "📝";
  }
}

/**
 * Attention reason badge
 */
function ReasonBadge({
  reason,
  isDark,
}: {
  reason: AttentionReason;
  isDark: boolean;
}) {
  const config = {
    incorrect: { label: "Incorrect", color: "red", emoji: "❌" },
    slow: { label: "Slow", color: "yellow", emoji: "⏱️" },
    "help-used": { label: "Help used", color: "orange", emoji: "💡" },
  }[reason];

  return (
    <span
      data-reason={reason}
      className={css({
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.5rem",
        borderRadius: "9999px",
        fontSize: "0.6875rem",
        fontWeight: "500",
        backgroundColor: isDark ? `${config.color}.900` : `${config.color}.100`,
        color: isDark ? `${config.color}.300` : `${config.color}.700`,
      })}
    >
      {config.emoji} {config.label}
    </span>
  );
}

/**
 * Purpose badge with explanation (shown in expanded mode)
 */
function PurposeBadge({
  purpose,
  isDark,
  showExplanation,
}: {
  purpose: string;
  isDark: boolean;
  showExplanation?: boolean;
}) {
  const config = getPurposeConfig(
    purpose as "focus" | "reinforce" | "review" | "challenge",
  );
  const colors = getPurposeColors(
    purpose as "focus" | "reinforce" | "review" | "challenge",
    isDark,
  );

  return (
    <div
      data-element="purpose-badge"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      })}
    >
      <span
        className={css({
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          padding: "0.125rem 0.5rem",
          borderRadius: "4px",
          fontSize: "0.6875rem",
          fontWeight: "500",
          backgroundColor: colors.background,
          color: colors.text,
          width: "fit-content",
        })}
      >
        {config.emoji} {config.shortLabel}
      </span>
      {showExplanation && (
        <span
          className={css({
            fontSize: "0.6875rem",
            color: isDark ? "gray.400" : "gray.500",
            fontStyle: "italic",
            lineHeight: 1.3,
          })}
        >
          {config.shortExplanation}
        </span>
      )}
    </div>
  );
}

export function ProblemToReview({
  problem,
  allResultsBeforeThis,
  skillMasteries,
  isDark,
}: ProblemToReviewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { result, slot, part, problemNumber, reasons } = problem;
  const { problem: generatedProblem } = slot;
  const isIncorrect = !result.isCorrect;

  // Calculate auto-pause stats for timing info
  const autoPauseInfo = calculateAutoPauseInfo(allResultsBeforeThis);

  // Get weak skills for this problem based on BKT
  const weakSkillsResult = getWeakSkillsForProblem(
    result.skillsExercised,
    skillMasteries ?? {},
    3, // Max display in collapsed mode
  );

  if (!generatedProblem) return null;

  return (
    <div
      data-component="problem-to-review"
      data-problem-number={problemNumber}
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
            ? "yellow.700"
            : "yellow.200",
        backgroundColor: isIncorrect
          ? isDark
            ? "red.900/30"
            : "red.50"
          : isDark
            ? "yellow.900/30"
            : "yellow.50",
        overflow: "hidden",
      })}
    >
      {/* Header row with problem number, part type, reasons, and toggle */}
      <button
        type="button"
        data-element="problem-header"
        onClick={() => setIsExpanded(!isExpanded)}
        className={css({
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.5rem 1rem",
          backgroundColor: isDark ? "rgba(0,0,0,0.1)" : "rgba(0,0,0,0.02)",
          border: "none",
          borderBottom: "1px solid",
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
          })}
        >
          {/* Problem number */}
          <span
            className={css({
              fontWeight: "bold",
              fontSize: "0.875rem",
              color: isDark ? "gray.300" : "gray.700",
            })}
          >
            #{problemNumber}
          </span>

          {/* Part type indicator */}
          <span
            data-element="part-type"
            className={css({
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              padding: "0.125rem 0.375rem",
              borderRadius: "4px",
              fontSize: "0.625rem",
              fontWeight: "500",
              backgroundColor: isDark ? "gray.700" : "gray.100",
              color: isDark ? "gray.300" : "gray.600",
            })}
          >
            {getPartTypeEmoji(part.type)} {getPartTypeLabel(part.type)}
          </span>
        </div>

        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          })}
        >
          {/* Reason badges */}
          <div
            className={css({
              display: "flex",
              gap: "0.375rem",
              flexWrap: "wrap",
            })}
          >
            {reasons.map((reason) => (
              <ReasonBadge key={reason} reason={reason} isDark={isDark} />
            ))}
          </div>

          {/* Expand/collapse indicator */}
          <span
            className={css({
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "1.25rem",
              height: "1.25rem",
              fontSize: "0.625rem",
              color: isDark ? "gray.400" : "gray.500",
              transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.25s ease-out",
            })}
          >
            ▼
          </span>
        </div>
      </button>

      {/* Main content: single problem representation */}
      <div
        data-element="problem-content"
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
        })}
      >
        {/* The problem - uses AnnotatedProblem for unified collapsed/expanded display */}
        <div
          className={css({
            display: "flex",
            alignItems: "flex-start",
            gap: "1rem",
          })}
        >
          {/* Problem display - always vertical, annotated when expanded */}
          <AnnotatedProblem
            terms={generatedProblem.terms}
            answer={generatedProblem.answer}
            studentAnswer={result.studentAnswer}
            isCorrect={result.isCorrect}
            trace={generatedProblem.generationTrace}
            skillMasteries={skillMasteries}
            expanded={isExpanded}
            isDark={isDark}
          />

          {/* Collapsed mode: show weak skills summary next to problem */}
          {weakSkillsResult.weakSkills.length > 0 && (
            <div
              className={css({
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                paddingTop: "0.25rem",
                opacity: isExpanded ? 0 : 1,
                transform: isExpanded ? "translateX(-8px)" : "translateX(0)",
                transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
                pointerEvents: isExpanded ? "none" : "auto",
              })}
            >
              <span
                className={css({
                  fontSize: "0.625rem",
                  fontWeight: "600",
                  color: isDark ? "gray.400" : "gray.500",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                })}
              >
                Weak Skills
              </span>
              <WeakSkillsSummary
                weakSkills={weakSkillsResult}
                isDark={isDark}
              />
            </div>
          )}
        </div>

        {/* Expanded mode: additional details with smooth animation */}
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
                gap: "0.75rem",
                paddingTop: "0.5rem",
                borderTop: "1px solid",
                borderColor: isDark ? "gray.700" : "gray.200",
                opacity: isExpanded ? 1 : 0,
                transition: "opacity 0.2s ease-out",
              })}
            >
              {/* Purpose explanation */}
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                })}
              >
                <span
                  className={css({
                    fontSize: "0.6875rem",
                    fontWeight: "600",
                    color: isDark ? "gray.400" : "gray.500",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  })}
                >
                  Purpose
                </span>
                <PurposeBadge
                  purpose={slot.purpose}
                  isDark={isDark}
                  showExplanation
                />
              </div>

              {/* Timing info */}
              <div
                className={css({
                  display: "flex",
                  gap: "1rem",
                  fontSize: "0.75rem",
                  color: isDark ? "gray.400" : "gray.500",
                })}
              >
                <span>Response time: {formatMs(result.responseTimeMs)}</span>
                {result.usedOnScreenAbacus && (
                  <span
                    className={css({
                      color: isDark ? "blue.400" : "blue.600",
                    })}
                  >
                    🧮 Used on-screen abacus
                  </span>
                )}
                {result.hadHelp && (
                  <span
                    className={css({
                      color: isDark ? "orange.400" : "orange.600",
                    })}
                  >
                    💡 Used help
                  </span>
                )}
              </div>

              {/* Threshold comparison for slow responses */}
              {reasons.includes("slow") && autoPauseInfo.threshold > 0 && (
                <span
                  className={css({
                    fontSize: "0.6875rem",
                    fontStyle: "italic",
                    color: isDark ? "yellow.400" : "yellow.600",
                  })}
                >
                  ⏱️ Response time exceeded auto-pause threshold of{" "}
                  {formatMs(autoPauseInfo.threshold)}
                </span>
              )}

              {/* Weak skills full list (if more than shown in collapsed) */}
              {weakSkillsResult.weakSkills.length > 0 && (
                <div
                  className={css({
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                  })}
                >
                  <span
                    className={css({
                      fontSize: "0.6875rem",
                      fontWeight: "600",
                      color: isDark ? "gray.400" : "gray.500",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    })}
                  >
                    Weak Skills ({weakSkillsResult.weakSkills.length})
                  </span>
                  <WeakSkillsSummary
                    weakSkills={weakSkillsResult}
                    expanded
                    isDark={isDark}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProblemToReview;
