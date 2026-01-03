"use client";

import type {
  ExtendedSkillClassification,
  SkillDistribution,
} from "@/contexts/BktContext";
import { useTheme } from "@/contexts/ThemeContext";
import { css } from "../../../styled-system/css";
import type { StudentWithProgress } from "./StudentSelector";

/** BKT-based mastery classification */
export type BktClassification = "strong" | "developing" | "weak" | null;

/**
 * Current phase information
 * @deprecated Use SkillHealthSummary instead - this is legacy level/phase based
 */
export interface CurrentPhaseInfo {
  phaseId: string;
  levelName: string;
  phaseName: string;
  description: string;
  skillsToMaster: string[];
  masteredSkills: number;
  totalSkills: number;
}

/**
 * BKT-based skill health summary for dashboard display
 * Now uses SkillDistribution for full 5-category support
 */
export interface SkillHealthSummary {
  /** Session mode type for visual treatment */
  mode: "remediation" | "progression" | "maintenance";

  /** Full 5-category skill distribution */
  distribution: SkillDistribution;

  /**
   * @deprecated Use distribution instead - kept for backwards compatibility
   */
  counts: {
    strong: number; // pKnown >= 0.8
    developing: number; // 0.5 <= pKnown < 0.8
    weak: number; // pKnown < 0.5
    total: number;
  };

  /** Mode-specific context */
  context: {
    /** Primary message (e.g., "Focus: Addition +4") */
    headline: string;
    /** Secondary detail (e.g., "2 skills need more practice") */
    detail: string;
  };

  /** For remediation: weakest skill info */
  weakestSkill?: { displayName: string; pKnown: number };

  /** For progression: next skill to learn */
  nextSkill?: { displayName: string; tutorialRequired: boolean };
}

// ============================================================================
// Category Configuration (matches SkillProgressChart)
// ============================================================================

const CLASSIFICATION_CONFIG: Record<
  ExtendedSkillClassification,
  {
    label: string;
    emoji: string;
    color: string;
    bgColor: { light: string; dark: string };
    textColor: { light: string; dark: string };
    hasPattern?: boolean;
    descriptor?: string;
  }
> = {
  strong: {
    label: "Strong",
    emoji: "🟢",
    color: "#22c55e",
    bgColor: { light: "green.100", dark: "green.900" },
    textColor: { light: "green.700", dark: "green.300" },
  },
  stale: {
    label: "Stale",
    emoji: "🌿",
    color: "#84cc16",
    bgColor: { light: "lime.100", dark: "lime.900/50" },
    textColor: { light: "lime.700", dark: "lime.400" },
    hasPattern: true,
    descriptor: "7+ days ago",
  },
  developing: {
    label: "Developing",
    emoji: "🔵",
    color: "#3b82f6",
    bgColor: { light: "blue.100", dark: "blue.900" },
    textColor: { light: "blue.700", dark: "blue.300" },
  },
  weak: {
    label: "Weak",
    emoji: "🔴",
    color: "#f87171",
    bgColor: { light: "red.100", dark: "red.900/50" },
    textColor: { light: "red.700", dark: "red.400" },
    hasPattern: true,
  },
  unassessed: {
    label: "Unassessed",
    emoji: "⚪",
    color: "transparent",
    bgColor: { light: "gray.100", dark: "gray.800" },
    textColor: { light: "gray.500", dark: "gray.500" },
  },
};

// ============================================================================
// Skill Distribution Display Component
// ============================================================================

interface SkillDistributionDisplayProps {
  distribution: SkillDistribution;
  isDark: boolean;
}

/**
 * Displays skill distribution with visual hierarchy matching SkillProgressChart.
 * Groups categories: MASTERED (Strong, Stale), IN PROGRESS (Developing, Weak), NOT STARTED (Unassessed)
 */
function SkillDistributionDisplay({
  distribution,
  isDark,
}: SkillDistributionDisplayProps) {
  // Helper to generate stripe pattern for stale/weak categories
  const getStripePattern = (baseColor: string) => {
    const stripeColor = isDark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.4)";
    return `repeating-linear-gradient(
      135deg,
      transparent,
      transparent 3px,
      ${stripeColor} 3px,
      ${stripeColor} 5px
    ), ${baseColor}`;
  };

  // Render a category badge
  const renderBadge = (
    category: ExtendedSkillClassification,
    count: number,
    showIfZero = false,
  ) => {
    if (count === 0 && !showIfZero) return null;
    const config = CLASSIFICATION_CONFIG[category];
    const bgColor = isDark ? config.bgColor.dark : config.bgColor.light;
    const textColor = isDark ? config.textColor.dark : config.textColor.light;

    return (
      <span
        key={category}
        data-skill-status={category}
        data-count={count}
        className={css({
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.75rem",
          fontWeight: "500",
          color: textColor,
          backgroundColor: config.hasPattern ? undefined : bgColor,
          padding: "0.25rem 0.5rem",
          borderRadius: "6px",
          position: "relative",
          overflow: "hidden",
        })}
        style={
          config.hasPattern
            ? {
                background: getStripePattern(
                  `color-mix(in srgb, ${config.color} ${isDark ? "30%" : "20%"}, transparent)`,
                ),
              }
            : undefined
        }
      >
        <span>{config.emoji}</span>
        <span>
          {count} {config.label}
        </span>
      </span>
    );
  };

  // Check if we have any data in each group
  const hasMastered = distribution.strong > 0 || distribution.stale > 0;
  const hasInProgress = distribution.developing > 0 || distribution.weak > 0;
  const hasUnassessed = distribution.unassessed > 0;

  // If no practicing skills at all, show a simple message
  if (distribution.total === 0) {
    return (
      <p
        className={css({
          fontSize: "0.875rem",
          color: isDark ? "gray.500" : "gray.400",
          marginBottom: "1rem",
          textAlign: "center",
        })}
      >
        No skills being practiced yet
      </p>
    );
  }

  return (
    <div
      data-component="skill-distribution-display"
      className={css({
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        marginBottom: "1rem",
      })}
    >
      {/* Mastered group */}
      {hasMastered && (
        <div
          data-group="mastered"
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          })}
        >
          <span
            className={css({
              fontSize: "0.625rem",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: isDark ? "gray.500" : "gray.400",
            })}
          >
            Mastered
          </span>
          <div
            className={css({
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            })}
          >
            {renderBadge("strong", distribution.strong)}
            {renderBadge("stale", distribution.stale)}
          </div>
        </div>
      )}

      {/* In Progress group */}
      {hasInProgress && (
        <div
          data-group="in-progress"
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          })}
        >
          <span
            className={css({
              fontSize: "0.625rem",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: isDark ? "gray.500" : "gray.400",
            })}
          >
            In Progress
          </span>
          <div
            className={css({
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            })}
          >
            {renderBadge("developing", distribution.developing)}
            {renderBadge("weak", distribution.weak)}
          </div>
        </div>
      )}

      {/* Not Started group */}
      {hasUnassessed && (
        <div
          data-group="not-started"
          className={css({
            display: "flex",
            flexDirection: "column",
            gap: "0.375rem",
          })}
        >
          <span
            className={css({
              fontSize: "0.625rem",
              fontWeight: "600",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: isDark ? "gray.500" : "gray.400",
            })}
          >
            Not Started
          </span>
          <div
            className={css({
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            })}
          >
            {renderBadge("unassessed", distribution.unassessed)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Progress Dashboard Component
// ============================================================================

interface ProgressDashboardProps {
  student: StudentWithProgress;
  /** @deprecated Use skillHealth instead */
  currentPhase?: CurrentPhaseInfo;
  /** BKT-based skill health summary */
  skillHealth?: SkillHealthSummary;
  /** Callback when no active session - start new practice */
  onStartPractice: () => void;
}

// Helper: Compute progress percent based on mode
function computeProgressPercent(health: SkillHealthSummary): number {
  switch (health.mode) {
    case "remediation":
      // Progress toward exiting remediation (weakest skill reaching 0.5)
      if (health.weakestSkill) {
        return Math.min(
          100,
          Math.round((health.weakestSkill.pKnown / 0.5) * 100),
        );
      }
      return 0;
    case "progression":
      // Just starting a new skill
      return 0;
    case "maintenance":
      // Strong skills / total
      if (health.counts.total > 0) {
        return Math.round((health.counts.strong / health.counts.total) * 100);
      }
      return 100;
  }
}

// Helper: Get mode-specific colors
function getModeColors(
  mode: SkillHealthSummary["mode"],
  isDark: boolean,
): { accent: string; bg: string; border: string; progressBar: string } {
  switch (mode) {
    case "remediation":
      return {
        accent: isDark ? "orange.400" : "orange.600",
        bg: isDark ? "gray.800" : "white",
        border: isDark ? "orange.700" : "orange.200",
        progressBar: isDark ? "orange.400" : "orange.500",
      };
    case "progression":
      return {
        accent: isDark ? "blue.400" : "blue.600",
        bg: isDark ? "gray.800" : "white",
        border: isDark ? "blue.700" : "blue.200",
        progressBar: isDark ? "blue.400" : "blue.500",
      };
    case "maintenance":
      return {
        accent: isDark ? "green.400" : "green.600",
        bg: isDark ? "gray.800" : "white",
        border: isDark ? "green.700" : "green.200",
        progressBar: isDark ? "green.400" : "green.500",
      };
  }
}

/**
 * ProgressDashboard - Student's practice home screen
 *
 * Shows after a student is selected. Displays:
 * - Greeting with avatar
 * - Current curriculum position
 * - Progress visualization
 * - Action button (Continue Practice)
 */
export function ProgressDashboard({
  student,
  currentPhase,
  skillHealth,
  onStartPractice,
}: ProgressDashboardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Compute progress percent based on mode
  const progressPercent = skillHealth
    ? computeProgressPercent(skillHealth)
    : currentPhase?.totalSkills && currentPhase.totalSkills > 0
      ? Math.round(
          (currentPhase.masteredSkills / currentPhase.totalSkills) * 100,
        )
      : 0;

  // Mode-specific styling
  const modeColors = skillHealth
    ? getModeColors(skillHealth.mode, isDark)
    : {
        accent: isDark ? "blue.400" : "blue.600",
        bg: isDark ? "gray.800" : "white",
        border: isDark ? "gray.700" : "gray.200",
        progressBar: isDark ? "green.400" : "green.500",
      };

  return (
    <div
      data-component="progress-dashboard"
      className={css({
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.5rem",
        padding: "1.5rem",
        maxWidth: "600px",
        margin: "0 auto",
      })}
    >
      {/* Current level card - BKT-based when skillHealth available */}
      <div
        data-section="current-level"
        data-mode={skillHealth?.mode}
        className={css({
          width: "100%",
          padding: "1.5rem",
          borderRadius: "12px",
          backgroundColor: modeColors.bg,
          boxShadow: "md",
          border: "2px solid",
          borderColor: modeColors.border,
        })}
      >
        {skillHealth ? (
          <>
            {/* BKT-based header */}
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1rem",
              })}
            >
              <div>
                <h2
                  className={css({
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: isDark ? "gray.100" : "gray.800",
                  })}
                >
                  {skillHealth.context.headline}
                </h2>
                <p
                  className={css({
                    fontSize: "1rem",
                    color: isDark ? "gray.400" : "gray.600",
                  })}
                >
                  {skillHealth.context.detail}
                </p>
              </div>
            </div>

            {/* Skill distribution - grouped by mastery level */}
            <SkillDistributionDisplay
              distribution={skillHealth.distribution}
              isDark={isDark}
            />

            {/* Progress bar (mode-specific) */}
            <div
              className={css({
                width: "100%",
                height: "12px",
                backgroundColor: isDark ? "gray.700" : "gray.200",
                borderRadius: "6px",
                overflow: "hidden",
              })}
            >
              <div
                className={css({
                  height: "100%",
                  backgroundColor: modeColors.progressBar,
                  borderRadius: "6px",
                  transition: "width 0.5s ease",
                })}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </>
        ) : currentPhase ? (
          <>
            {/* Legacy phase-based display (fallback) */}
            <div
              className={css({
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "1rem",
              })}
            >
              <div>
                <h2
                  className={css({
                    fontSize: "1.25rem",
                    fontWeight: "bold",
                    color: isDark ? "gray.100" : "gray.800",
                  })}
                >
                  {currentPhase.levelName}
                </h2>
                <p
                  className={css({
                    fontSize: "1rem",
                    color: isDark ? "gray.400" : "gray.600",
                  })}
                >
                  {currentPhase.phaseName}
                </p>
              </div>
              <span
                className={css({
                  fontSize: "0.875rem",
                  fontWeight: "bold",
                  color: isDark ? "blue.400" : "blue.600",
                })}
              >
                {progressPercent}% mastered
              </span>
            </div>

            {/* Progress bar */}
            <div
              className={css({
                width: "100%",
                height: "12px",
                backgroundColor: isDark ? "gray.700" : "gray.200",
                borderRadius: "6px",
                overflow: "hidden",
                marginBottom: "1rem",
              })}
            >
              <div
                className={css({
                  height: "100%",
                  backgroundColor: isDark ? "green.400" : "green.500",
                  borderRadius: "6px",
                  transition: "width 0.5s ease",
                })}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <p
              className={css({
                fontSize: "0.875rem",
                color: isDark ? "gray.400" : "gray.500",
              })}
            >
              {currentPhase.description}
            </p>
          </>
        ) : (
          <p className={css({ color: isDark ? "gray.400" : "gray.500" })}>
            No skill data available
          </p>
        )}
      </div>
    </div>
  );
}

export default ProgressDashboard;
