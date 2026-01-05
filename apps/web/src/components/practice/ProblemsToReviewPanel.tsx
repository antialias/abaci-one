"use client";

import type { SlotResult } from "@/db/schema/session-plans";
import type { SkillBktResult } from "@/lib/curriculum/bkt";
import { css } from "../../../styled-system/css";
import {
  calculateAutoPauseInfo,
  formatMs,
  getAutoPauseExplanation,
} from "./autoPauseCalculator";
import { ProblemToReview } from "./ProblemToReview";
import type { ProblemNeedingAttention } from "./sessionSummaryUtils";

export interface ProblemsToReviewPanelProps {
  /** Problems that need attention */
  problems: ProblemNeedingAttention[];
  /** All session results (for auto-pause calculation) */
  results: SlotResult[];
  /** BKT skill mastery data for annotation */
  skillMasteries: Record<string, SkillBktResult>;
  /** Total problems in the session */
  totalProblems: number;
  /** Dark mode */
  isDark: boolean;
}

/**
 * ProblemsToReviewPanel - Shows problems that need attention with timing info
 *
 * Features:
 * - Auto-pause timing summary section
 * - All problems needing attention (no limit)
 * - ProblemToReview cards with annotations
 * - "All correct" celebration when no problems need attention
 */
export function ProblemsToReviewPanel({
  problems,
  results,
  skillMasteries,
  totalProblems,
  isDark,
}: ProblemsToReviewPanelProps) {
  // Calculate auto-pause info for timing summary
  const autoPauseInfo = calculateAutoPauseInfo(results);

  return (
    <div
      data-component="problems-to-review-panel"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      })}
    >
      {/* Auto-Pause Timing Summary */}
      <section
        data-section="auto-pause-summary"
        className={css({
          padding: "1rem",
          borderRadius: "8px",
          backgroundColor: isDark ? "gray.800" : "gray.50",
          border: "1px solid",
          borderColor: isDark ? "gray.700" : "gray.200",
        })}
      >
        <h3
          className={css({
            fontSize: "1rem",
            fontWeight: "bold",
            color: isDark ? "gray.200" : "gray.700",
            marginBottom: "0.5rem",
          })}
        >
          Response Timing
        </h3>
        <div
          className={css({
            display: "grid",
            gap: "0.5rem",
            fontSize: "0.875rem",
          })}
        >
          <div
            className={css({
              display: "flex",
              justifyContent: "space-between",
            })}
          >
            <span className={css({ color: isDark ? "gray.400" : "gray.600" })}>
              Auto-pause threshold:
            </span>
            <span
              className={css({
                fontWeight: "bold",
                color: isDark ? "gray.200" : "gray.800",
              })}
            >
              {formatMs(autoPauseInfo.threshold)}
            </span>
          </div>
          <div
            className={css({
              fontSize: "0.75rem",
              color: isDark ? "gray.500" : "gray.500",
              fontStyle: "italic",
            })}
          >
            {getAutoPauseExplanation(autoPauseInfo.stats)}
          </div>
          {autoPauseInfo.stats.sampleCount > 0 && (
            <div
              className={css({
                display: "flex",
                gap: "1rem",
                marginTop: "0.25rem",
                fontSize: "0.75rem",
                color: isDark ? "gray.400" : "gray.500",
              })}
            >
              <span>Mean: {formatMs(autoPauseInfo.stats.meanMs)}</span>
              <span>Std Dev: {formatMs(autoPauseInfo.stats.stdDevMs)}</span>
              <span>Samples: {autoPauseInfo.stats.sampleCount}</span>
            </div>
          )}
        </div>
      </section>

      {/* Problems Worth Attention */}
      {problems.length > 0 ? (
        <section
          data-section="problems-to-review"
          className={css({
            padding: "1rem",
            borderRadius: "12px",
            backgroundColor: isDark ? "gray.800" : "white",
            border: "1px solid",
            borderColor: isDark ? "gray.700" : "gray.200",
          })}
        >
          <h3
            className={css({
              fontSize: "1rem",
              fontWeight: "bold",
              color: isDark ? "gray.200" : "gray.700",
              marginBottom: "0.5rem",
            })}
          >
            Problems to Review
          </h3>
          <p
            className={css({
              fontSize: "0.75rem",
              color: isDark ? "gray.400" : "gray.500",
              marginBottom: "1rem",
            })}
          >
            {problems.length} of {totalProblems} problems need attention
          </p>
          <div
            className={css({
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            })}
          >
            {problems.map((problem) => {
              // Get all results before this problem for auto-pause calculation
              const resultsBeforeThis = results.slice(
                0,
                results.findIndex(
                  (r) =>
                    r.partNumber === problem.result.partNumber &&
                    r.slotIndex === problem.result.slotIndex,
                ),
              );

              return (
                <ProblemToReview
                  key={`${problem.part.partNumber}-${problem.slot.index}`}
                  problem={problem}
                  allResultsBeforeThis={resultsBeforeThis}
                  skillMasteries={skillMasteries}
                  isDark={isDark}
                />
              );
            })}
          </div>
        </section>
      ) : (
        <div
          data-section="all-correct"
          className={css({
            padding: "1.5rem",
            borderRadius: "12px",
            backgroundColor: isDark ? "green.900/30" : "green.50",
            border: "1px solid",
            borderColor: isDark ? "green.700" : "green.200",
            textAlign: "center",
          })}
        >
          <span
            className={css({
              fontSize: "2rem",
              display: "block",
              marginBottom: "0.5rem",
            })}
          >
            🎉
          </span>
          <h3
            className={css({
              fontSize: "1rem",
              fontWeight: "bold",
              color: isDark ? "green.300" : "green.700",
            })}
          >
            Perfect! All problems answered correctly.
          </h3>
        </div>
      )}
    </div>
  );
}

export default ProblemsToReviewPanel;
