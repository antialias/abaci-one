/**
 * Weak Skills Summary Component
 *
 * Displays skills that need attention, ordered by BKT severity.
 * Supports both collapsed (compact) and expanded (with percentages) modes.
 */

"use client";

import { css } from "../../../styled-system/css";
import type { WeakSkillInfo, WeakSkillsForProblem } from "./weakSkillUtils";
import { isLikelyCause } from "./weakSkillUtils";

export interface WeakSkillsSummaryProps {
  /** Weak skills analysis result from getWeakSkillsForProblem */
  weakSkills: WeakSkillsForProblem;
  /** Whether to show expanded view with mastery percentages */
  expanded?: boolean;
  /** Dark mode */
  isDark: boolean;
}

/**
 * Single skill badge for collapsed view
 */
function SkillBadge({
  skill,
  isDark,
  showPercentage = false,
}: {
  skill: WeakSkillInfo;
  isDark: boolean;
  showPercentage?: boolean;
}) {
  const likelyCause = isLikelyCause(skill);

  return (
    <span
      data-element="skill-badge"
      data-skill-id={skill.skillId}
      data-likely-cause={likelyCause}
      className={css({
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.375rem",
        borderRadius: "4px",
        fontSize: "0.6875rem",
        fontWeight: "500",
        backgroundColor: likelyCause
          ? isDark
            ? "red.900/60"
            : "red.100"
          : isDark
            ? "yellow.900/60"
            : "yellow.100",
        color: likelyCause
          ? isDark
            ? "red.300"
            : "red.700"
          : isDark
            ? "yellow.300"
            : "yellow.700",
      })}
    >
      {likelyCause && (
        <span
          className={css({ fontSize: "0.625rem" })}
          aria-label="Likely cause of error"
        >
          ⚠️
        </span>
      )}
      <span>{skill.displayLabel}</span>
      {showPercentage && (
        <span
          className={css({
            opacity: 0.8,
            fontSize: "0.625rem",
          })}
        >
          ({skill.masteryPercent}%)
        </span>
      )}
    </span>
  );
}

/**
 * Collapsed view - inline skill badges with "+N more" indicator
 */
function CollapsedView({
  weakSkills,
  isDark,
}: {
  weakSkills: WeakSkillsForProblem;
  isDark: boolean;
}) {
  if (weakSkills.displaySkills.length === 0) {
    return null;
  }

  return (
    <div
      data-element="weak-skills-collapsed"
      className={css({
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.375rem",
      })}
    >
      {weakSkills.displaySkills.map((skill) => (
        <SkillBadge key={skill.skillId} skill={skill} isDark={isDark} />
      ))}
      {weakSkills.hiddenCount > 0 && (
        <span
          data-element="more-indicator"
          className={css({
            fontSize: "0.6875rem",
            color: isDark ? "gray.400" : "gray.500",
            fontStyle: "italic",
          })}
        >
          +{weakSkills.hiddenCount} more
        </span>
      )}
    </div>
  );
}

/**
 * Expanded view - full skill list with mastery percentages
 */
function ExpandedView({
  weakSkills,
  isDark,
}: {
  weakSkills: WeakSkillsForProblem;
  isDark: boolean;
}) {
  if (weakSkills.weakSkills.length === 0) {
    return (
      <span
        data-element="no-weak-skills"
        className={css({
          fontSize: "0.75rem",
          color: isDark ? "gray.400" : "gray.500",
          fontStyle: "italic",
        })}
      >
        All skills in good standing
      </span>
    );
  }

  return (
    <div
      data-element="weak-skills-expanded"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      })}
    >
      <div
        className={css({
          display: "flex",
          alignItems: "center",
          gap: "0.25rem",
          marginBottom: "0.25rem",
        })}
      >
        <span
          className={css({
            fontSize: "0.625rem",
          })}
        >
          ⚠️
        </span>
        <span
          className={css({
            fontSize: "0.75rem",
            fontWeight: "600",
            color: isDark ? "yellow.300" : "yellow.700",
          })}
        >
          Weak Skills:
        </span>
      </div>
      <div
        className={css({
          display: "flex",
          flexWrap: "wrap",
          gap: "0.375rem",
        })}
      >
        {weakSkills.weakSkills.map((skill) => (
          <SkillBadge
            key={skill.skillId}
            skill={skill}
            isDark={isDark}
            showPercentage
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Weak Skills Summary - shows skills that need attention
 *
 * In collapsed mode: shows up to 3 skills inline with "+N more"
 * In expanded mode: shows all skills with mastery percentages
 */
export function WeakSkillsSummary({
  weakSkills,
  expanded = false,
  isDark,
}: WeakSkillsSummaryProps) {
  if (weakSkills.weakSkills.length === 0 && !expanded) {
    // Nothing to show in collapsed mode if no weak skills
    return null;
  }

  return (
    <div
      data-component="weak-skills-summary"
      data-mode={expanded ? "expanded" : "collapsed"}
    >
      {expanded ? (
        <ExpandedView weakSkills={weakSkills} isDark={isDark} />
      ) : (
        <CollapsedView weakSkills={weakSkills} isDark={isDark} />
      )}
    </div>
  );
}

export default WeakSkillsSummary;
