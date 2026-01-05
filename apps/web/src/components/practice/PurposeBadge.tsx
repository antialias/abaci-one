"use client";

import { useTheme } from "@/contexts/ThemeContext";
import type { ProblemSlot } from "@/db/schema/session-plans";
import { Tooltip, TooltipProvider } from "../ui/Tooltip";
import { css } from "../../../styled-system/css";

type Purpose = "focus" | "reinforce" | "review" | "challenge";

/**
 * Minimal complexity data for tooltip display
 * Used when full slot isn't available (e.g., in session observer)
 */
export interface ComplexityData {
  /** Complexity bounds from slot constraints */
  bounds?: { min?: number; max?: number };
  /** Total complexity cost from generation trace */
  totalCost?: number;
  /** Number of steps (for per-term average) */
  stepCount?: number;
  /** Pre-formatted target skill name */
  targetSkillName?: string;
}

interface PurposeBadgeProps {
  /** The purpose type */
  purpose: Purpose;
  /** Optional slot for detailed tooltip (when available) */
  slot?: ProblemSlot;
  /** Optional simplified complexity data (alternative to slot, for observers) */
  complexity?: ComplexityData;
}

/**
 * Extract the primary skill from constraints for display
 */
function extractTargetSkillName(slot: ProblemSlot): string | null {
  const targetSkills = slot.constraints?.targetSkills;
  if (!targetSkills) return null;

  // Look for specific skill in targetSkills
  for (const [category, skills] of Object.entries(targetSkills)) {
    if (skills && typeof skills === "object") {
      const skillKeys = Object.keys(skills);
      if (skillKeys.length === 1) {
        // Single skill - this is a targeted reinforce/review
        return formatSkillName(category, skillKeys[0]);
      }
    }
  }
  return null;
}

/**
 * Format a skill ID into a human-readable name
 */
function formatSkillName(category: string, skillKey: string): string {
  // Categories: basic, fiveComplements, tenComplements
  if (category === "basic") {
    // Format "+3" or "-5" into "add 3" or "subtract 5"
    if (skillKey.startsWith("+")) {
      return `add ${skillKey.slice(1)}`;
    }
    if (skillKey.startsWith("-")) {
      return `subtract ${skillKey.slice(1)}`;
    }
    return skillKey;
  }

  if (category === "fiveComplements") {
    // Format "4=5-1" into "5-complement for 4"
    const match = skillKey.match(/^(\d+)=/);
    if (match) {
      return `5-complement for ${match[1]}`;
    }
    return skillKey;
  }

  if (category === "tenComplements") {
    // Format "9=10-1" into "10-complement for 9"
    const match = skillKey.match(/^(\d+)=/);
    if (match) {
      return `10-complement for ${match[1]}`;
    }
    return skillKey;
  }

  return `${category}: ${skillKey}`;
}

/**
 * Complexity section for purpose tooltip - shows complexity bounds and actual costs
 * Accepts either a full slot or simplified complexity data
 */
function ComplexitySection({
  slot,
  complexity,
  showBounds = true,
}: {
  slot?: ProblemSlot;
  complexity?: ComplexityData;
  showBounds?: boolean;
}) {
  // Extract data from slot or use simplified complexity data
  const bounds = slot?.complexityBounds ?? complexity?.bounds;
  const totalCost =
    slot?.problem?.generationTrace?.totalComplexityCost ??
    complexity?.totalCost;
  const stepCount =
    slot?.problem?.generationTrace?.steps?.length ?? complexity?.stepCount;

  const hasBounds =
    bounds && (bounds.min !== undefined || bounds.max !== undefined);
  const hasCost = totalCost !== undefined && !Number.isNaN(totalCost);

  // Don't render anything if no complexity data
  if (!hasBounds && !hasCost) {
    return null;
  }

  const sectionStyles = {
    container: css({
      marginTop: "0.5rem",
      padding: "0.5rem",
      backgroundColor: "gray.800",
      borderRadius: "6px",
      fontSize: "0.8125rem",
    }),
    header: css({
      display: "flex",
      alignItems: "center",
      gap: "0.25rem",
      color: "gray.400",
      fontWeight: "500",
      marginBottom: "0.375rem",
    }),
    row: css({
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      color: "gray.300",
      paddingY: "0.125rem",
    }),
    value: css({
      fontFamily: "mono",
      color: "white",
    }),
    boundsLabel: css({
      color: "gray.500",
      fontSize: "0.75rem",
    }),
  };

  // Format bounds string
  let boundsText = "";
  if (bounds?.min !== undefined && bounds?.max !== undefined) {
    boundsText = `${bounds.min} – ${bounds.max}`;
  } else if (bounds?.min !== undefined) {
    boundsText = `≥${bounds.min}`;
  } else if (bounds?.max !== undefined) {
    boundsText = `≤${bounds.max}`;
  }

  return (
    <div className={sectionStyles.container} data-element="complexity-section">
      <div className={sectionStyles.header}>
        <span>📊</span>
        <span>Complexity</span>
      </div>
      {showBounds && hasBounds && (
        <div className={sectionStyles.row}>
          <span className={sectionStyles.boundsLabel}>Required range:</span>
          <span className={sectionStyles.value}>{boundsText}</span>
        </div>
      )}
      {hasCost && (
        <div className={sectionStyles.row}>
          <span>Total cost:</span>
          <span className={sectionStyles.value}>{totalCost}</span>
        </div>
      )}
      {hasCost && stepCount && stepCount > 0 && (
        <div className={sectionStyles.row}>
          <span>Per term (avg):</span>
          <span className={sectionStyles.value}>
            {(totalCost! / stepCount).toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}

const tooltipStyles = {
  container: css({
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  }),
  header: css({
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontWeight: "bold",
    fontSize: "0.9375rem",
  }),
  emoji: css({
    fontSize: "1.125rem",
  }),
  description: css({
    color: "gray.300",
    lineHeight: "1.5",
  }),
  detail: css({
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.5rem",
    backgroundColor: "gray.800",
    borderRadius: "6px",
    fontSize: "0.8125rem",
  }),
  detailLabel: css({
    color: "gray.400",
    fontWeight: "500",
  }),
  detailValue: css({
    color: "white",
    fontFamily: "mono",
  }),
};

const purposeInfo: Record<
  Purpose,
  { emoji: string; title: string; description: string }
> = {
  focus: {
    emoji: "🎯",
    title: "Focus Practice",
    description:
      "Building mastery of your current curriculum skills. These problems are at the heart of what you're learning right now.",
  },
  reinforce: {
    emoji: "💪",
    title: "Reinforcement",
    description:
      "Extra practice for skills identified as needing more work. These problems target areas where mastery is still developing.",
  },
  review: {
    emoji: "🔄",
    title: "Spaced Review",
    description:
      "Keeping mastered skills fresh through spaced repetition. Regular review prevents forgetting and strengthens long-term memory.",
  },
  challenge: {
    emoji: "⭐",
    title: "Challenge",
    description:
      "Harder problems that require complement techniques for every term. These push your skills and build deeper fluency.",
  },
};

/**
 * Purpose tooltip content - rich explanatory content for each purpose
 */
function PurposeTooltipContent({
  purpose,
  slot,
  complexity,
}: {
  purpose: Purpose;
  slot?: ProblemSlot;
  complexity?: ComplexityData;
}) {
  const info = purposeInfo[purpose];
  // Get skill name from slot or from simplified complexity data
  const skillName = slot
    ? extractTargetSkillName(slot)
    : (complexity?.targetSkillName ?? null);

  return (
    <div className={tooltipStyles.container}>
      <div className={tooltipStyles.header}>
        <span className={tooltipStyles.emoji}>{info.emoji}</span>
        <span>{info.title}</span>
      </div>
      <p className={tooltipStyles.description}>{info.description}</p>

      {/* Purpose-specific details */}
      {purpose === "focus" && (
        <div className={tooltipStyles.detail}>
          <span className={tooltipStyles.detailLabel}>Distribution:</span>
          <span className={tooltipStyles.detailValue}>60% of session</span>
        </div>
      )}

      {purpose === "reinforce" && skillName && (
        <div className={tooltipStyles.detail}>
          <span className={tooltipStyles.detailLabel}>Targeting:</span>
          <span className={tooltipStyles.detailValue}>{skillName}</span>
        </div>
      )}

      {purpose === "review" && (
        <>
          {skillName && (
            <div className={tooltipStyles.detail}>
              <span className={tooltipStyles.detailLabel}>Reviewing:</span>
              <span className={tooltipStyles.detailValue}>{skillName}</span>
            </div>
          )}
          <div className={tooltipStyles.detail}>
            <span className={tooltipStyles.detailLabel}>Schedule:</span>
            <span className={tooltipStyles.detailValue}>
              Mastered: 14 days • Practicing: 7 days
            </span>
          </div>
        </>
      )}

      {purpose === "challenge" && (
        <div className={tooltipStyles.detail}>
          <span className={tooltipStyles.detailLabel}>Requirement:</span>
          <span className={tooltipStyles.detailValue}>
            Every term uses complements
          </span>
        </div>
      )}

      {/* Complexity section when slot or complexity data is available */}
      {(slot || complexity) && (
        <ComplexitySection slot={slot} complexity={complexity} />
      )}
    </div>
  );
}

/**
 * Shared purpose badge component with tooltip
 *
 * Shows the slot's purpose (focus/reinforce/review/challenge) with
 * appropriate styling and a tooltip explaining what the purpose means.
 *
 * Used by both the student's ActiveSession and the teacher's SessionObserverModal.
 */
export function PurposeBadge({ purpose, slot, complexity }: PurposeBadgeProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const badgeStyles = css({
    position: "relative",
    padding: "0.25rem 0.75rem",
    borderRadius: "20px",
    fontSize: "0.75rem",
    fontWeight: "bold",
    textTransform: "uppercase",
    cursor: "help",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    _hover: {
      transform: "scale(1.05)",
      boxShadow: "sm",
    },
    backgroundColor:
      purpose === "focus"
        ? isDark
          ? "blue.900"
          : "blue.100"
        : purpose === "reinforce"
          ? isDark
            ? "orange.900"
            : "orange.100"
          : purpose === "review"
            ? isDark
              ? "green.900"
              : "green.100"
            : isDark
              ? "purple.900"
              : "purple.100",
    color:
      purpose === "focus"
        ? isDark
          ? "blue.200"
          : "blue.700"
        : purpose === "reinforce"
          ? isDark
            ? "orange.200"
            : "orange.700"
          : purpose === "review"
            ? isDark
              ? "green.200"
              : "green.700"
            : isDark
              ? "purple.200"
              : "purple.700",
  });

  return (
    <TooltipProvider>
      <Tooltip
        content={
          <PurposeTooltipContent
            purpose={purpose}
            slot={slot}
            complexity={complexity}
          />
        }
        side="bottom"
        delayDuration={300}
      >
        <div
          data-element="problem-purpose"
          data-purpose={purpose}
          className={badgeStyles}
        >
          {purpose}
        </div>
      </Tooltip>
    </TooltipProvider>
  );
}
