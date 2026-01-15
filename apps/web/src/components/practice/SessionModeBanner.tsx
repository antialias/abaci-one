"use client";

import { useTheme } from "@/contexts/ThemeContext";
import type {
  MaintenanceMode,
  ProgressionMode,
  RemediationMode,
  SessionMode,
} from "@/lib/curriculum/session-mode";
import { css } from "../../../styled-system/css";
import { CelebrationProgressionBanner } from "./CelebrationProgressionBanner";

// ============================================================================
// Types
// ============================================================================

interface SessionModeBannerProps {
  /** The session mode to display */
  sessionMode: SessionMode;
  /** Callback when user clicks the action button */
  onAction: () => void;
  /** Whether an action is in progress */
  isLoading?: boolean;
  /** Variant for different contexts */
  variant?: "dashboard" | "modal";
}

// ============================================================================
// Sub-components for each mode
// ============================================================================

interface RemediationBannerProps {
  mode: RemediationMode;
  onAction: () => void;
  isLoading: boolean;
  variant: "dashboard" | "modal";
  isDark: boolean;
}

function RemediationBanner({
  mode,
  onAction,
  isLoading,
  variant,
  isDark,
}: RemediationBannerProps) {
  const weakSkillNames = mode.weakSkills.slice(0, 3).map((s) => s.displayName);
  const hasBlockedPromotion = !!mode.blockedPromotion;

  // Calculate progress if we have blocked promotion
  // Progress is based on how close the weakest skill is to the threshold (0.5)
  const weakestPKnown = mode.weakSkills[0]?.pKnown ?? 0;
  const progressPercent = Math.round((weakestPKnown / 0.5) * 100);

  return (
    <div
      data-element="session-mode-banner"
      data-mode="remediation"
      data-variant={variant}
      className={css({
        borderRadius: variant === "modal" ? "12px" : "16px",
        overflow: "hidden",
        border: "2px solid",
        borderColor: isDark ? "amber.600" : "amber.400",
        "@media (max-width: 400px)": {
          borderRadius: "12px",
        },
      })}
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.08) 100%)"
          : "linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(217, 119, 6, 0.05) 100%)",
      }}
    >
      {/* Info section */}
      <div
        className={css({
          padding: variant === "modal" ? "0.875rem 1rem" : "1rem 1.25rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-start",
          "@media (max-width: 400px)": {
            padding: "0.75rem",
            gap: "0.5rem",
          },
        })}
      >
        <span
          className={css({
            fontSize: variant === "modal" ? "1.5rem" : "2rem",
            lineHeight: 1,
            "@media (max-width: 400px)": {
              fontSize: "1.25rem",
            },
          })}
        >
          {hasBlockedPromotion ? "🔒" : "💪"}
        </span>
        <div className={css({ flex: 1, minWidth: 0 })}>
          <p
            className={css({
              fontSize: variant === "modal" ? "0.9375rem" : "1rem",
              fontWeight: "600",
              marginBottom: "0.25rem",
              "@media (max-width: 400px)": {
                fontSize: "0.875rem",
                marginBottom: "0.125rem",
              },
            })}
            style={{ color: isDark ? "#fcd34d" : "#b45309" }}
          >
            {hasBlockedPromotion ? "Almost there!" : "Strengthening skills"}
          </p>
          <p
            className={css({
              fontSize: variant === "modal" ? "0.8125rem" : "0.875rem",
              marginBottom: hasBlockedPromotion ? "0.5rem" : "0",
              "@media (max-width: 400px)": {
                fontSize: "0.75rem",
              },
            })}
            style={{ color: isDark ? "#d4d4d4" : "#525252" }}
          >
            {hasBlockedPromotion ? (
              <>
                Strengthen{" "}
                <strong style={{ color: isDark ? "#fbbf24" : "#d97706" }}>
                  {weakSkillNames.join(" and ")}
                </strong>{" "}
                to unlock{" "}
                <strong style={{ color: isDark ? "#86efac" : "#166534" }}>
                  {mode.blockedPromotion!.nextSkill.displayName}
                </strong>
              </>
            ) : (
              <>
                Targeting:{" "}
                <strong style={{ color: isDark ? "#fbbf24" : "#d97706" }}>
                  {weakSkillNames.join(", ")}
                </strong>
              </>
            )}
          </p>

          {/* Progress bar for blocked promotion */}
          {hasBlockedPromotion && (
            <div
              className={css({
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              })}
            >
              <div
                className={css({
                  flex: 1,
                  height: "6px",
                  borderRadius: "3px",
                  overflow: "hidden",
                })}
                style={{
                  background: isDark
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(0,0,0,0.1)",
                }}
              >
                <div
                  className={css({
                    height: "100%",
                    borderRadius: "3px",
                    transition: "width 0.3s ease",
                  })}
                  style={{
                    width: `${progressPercent}%`,
                    background: isDark
                      ? "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)"
                      : "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
                  }}
                />
              </div>
              <span
                className={css({
                  fontSize: "0.6875rem",
                  fontWeight: "600",
                })}
                style={{ color: isDark ? "#fbbf24" : "#d97706" }}
              >
                {progressPercent}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action button */}
      <button
        type="button"
        data-action="start-remediation"
        onClick={onAction}
        disabled={isLoading}
        className={css({
          width: "100%",
          padding: variant === "modal" ? "0.875rem" : "1rem",
          fontSize: variant === "modal" ? "1rem" : "1.0625rem",
          fontWeight: "bold",
          color: "white",
          border: "none",
          borderRadius: "0",
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          _hover: {
            filter: isLoading ? "none" : "brightness(1.05)",
          },
          "@media (max-width: 400px)": {
            padding: "0.75rem",
            fontSize: "0.9375rem",
          },
        })}
        style={{
          background: isLoading
            ? "#9ca3af"
            : "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
          boxShadow: isLoading
            ? "none"
            : "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {isLoading ? "Starting..." : "Practice Now →"}
      </button>
    </div>
  );
}

interface ProgressionBannerProps {
  mode: ProgressionMode;
  onAction: () => void;
  isLoading: boolean;
  variant: "dashboard" | "modal";
  isDark: boolean;
}

function ProgressionBanner({
  mode,
  onAction,
  isLoading,
  variant,
  isDark,
}: ProgressionBannerProps) {
  return (
    <div
      data-element="session-mode-banner"
      data-mode="progression"
      data-variant={variant}
      className={css({
        borderRadius: variant === "modal" ? "12px" : "16px",
        overflow: "hidden",
        border: "2px solid",
        borderColor: isDark ? "green.500" : "green.400",
        "@media (max-width: 400px)": {
          borderRadius: "12px",
        },
      })}
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(59, 130, 246, 0.08) 100%)"
          : "linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(59, 130, 246, 0.04) 100%)",
      }}
    >
      {/* Info section */}
      <div
        className={css({
          padding: variant === "modal" ? "0.875rem 1rem" : "1rem 1.25rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          "@media (max-width: 400px)": {
            padding: "0.75rem",
            gap: "0.5rem",
          },
        })}
      >
        <span
          className={css({
            fontSize: variant === "modal" ? "1.5rem" : "2rem",
            lineHeight: 1,
            "@media (max-width: 400px)": {
              fontSize: "1.25rem",
            },
          })}
        >
          🌟
        </span>
        <div className={css({ flex: 1, minWidth: 0 })}>
          <p
            className={css({
              fontSize: variant === "modal" ? "0.9375rem" : "1rem",
              fontWeight: "600",
              "@media (max-width: 400px)": {
                fontSize: "0.875rem",
              },
            })}
            style={{ color: isDark ? "#86efac" : "#166534" }}
          >
            {mode.tutorialRequired
              ? "You've unlocked: "
              : "Ready to practice: "}
            <strong>{mode.nextSkill.displayName}</strong>
          </p>
          <p
            className={css({
              fontSize: variant === "modal" ? "0.75rem" : "0.8125rem",
              marginTop: "0.125rem",
              "@media (max-width: 400px)": {
                fontSize: "0.6875rem",
              },
            })}
            style={{ color: isDark ? "#a1a1aa" : "#6b7280" }}
          >
            {mode.tutorialRequired
              ? "Start with a quick tutorial"
              : "Continue building mastery"}
          </p>
        </div>
      </div>

      {/* Action button */}
      <button
        type="button"
        data-action="start-progression"
        onClick={onAction}
        disabled={isLoading}
        className={css({
          width: "100%",
          padding: variant === "modal" ? "0.875rem" : "1rem",
          fontSize: variant === "modal" ? "1rem" : "1.0625rem",
          fontWeight: "bold",
          color: "white",
          border: "none",
          borderRadius: "0",
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          _hover: {
            filter: isLoading ? "none" : "brightness(1.05)",
          },
          "@media (max-width: 400px)": {
            padding: "0.75rem",
            fontSize: "0.9375rem",
            gap: "0.375rem",
          },
        })}
        style={{
          background: isLoading
            ? "#9ca3af"
            : "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
          boxShadow: isLoading
            ? "none"
            : "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {isLoading ? (
          "Starting..."
        ) : mode.tutorialRequired ? (
          <>
            <span>🎓</span>
            <span>Begin Tutorial</span>
            <span>→</span>
          </>
        ) : (
          "Let's Go! →"
        )}
      </button>
    </div>
  );
}

interface MaintenanceBannerProps {
  mode: MaintenanceMode;
  onAction: () => void;
  isLoading: boolean;
  variant: "dashboard" | "modal";
  isDark: boolean;
}

function MaintenanceBanner({
  mode,
  onAction,
  isLoading,
  variant,
  isDark,
}: MaintenanceBannerProps) {
  return (
    <div
      data-element="session-mode-banner"
      data-mode="maintenance"
      data-variant={variant}
      className={css({
        borderRadius: variant === "modal" ? "12px" : "16px",
        overflow: "hidden",
        border: "2px solid",
        borderColor: isDark ? "blue.500" : "blue.400",
        "@media (max-width: 400px)": {
          borderRadius: "12px",
        },
      })}
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)"
          : "linear-gradient(135deg, rgba(59, 130, 246, 0.06) 0%, rgba(139, 92, 246, 0.04) 100%)",
      }}
    >
      {/* Info section */}
      <div
        className={css({
          padding: variant === "modal" ? "0.875rem 1rem" : "1rem 1.25rem",
          display: "flex",
          gap: "0.75rem",
          alignItems: "center",
          "@media (max-width: 400px)": {
            padding: "0.75rem",
            gap: "0.5rem",
          },
        })}
      >
        <span
          className={css({
            fontSize: variant === "modal" ? "1.5rem" : "2rem",
            lineHeight: 1,
            "@media (max-width: 400px)": {
              fontSize: "1.25rem",
            },
          })}
        >
          ✨
        </span>
        <div className={css({ flex: 1, minWidth: 0 })}>
          <p
            className={css({
              fontSize: variant === "modal" ? "0.9375rem" : "1rem",
              fontWeight: "600",
              "@media (max-width: 400px)": {
                fontSize: "0.875rem",
              },
            })}
            style={{ color: isDark ? "#93c5fd" : "#1d4ed8" }}
          >
            All skills strong!
          </p>
          <p
            className={css({
              fontSize: variant === "modal" ? "0.75rem" : "0.8125rem",
              marginTop: "0.125rem",
              "@media (max-width: 400px)": {
                fontSize: "0.6875rem",
              },
            })}
            style={{ color: isDark ? "#a1a1aa" : "#6b7280" }}
          >
            Keep practicing to maintain mastery ({mode.skillCount} skills)
          </p>
        </div>
      </div>

      {/* Action button */}
      <button
        type="button"
        data-action="start-maintenance"
        onClick={onAction}
        disabled={isLoading}
        className={css({
          width: "100%",
          padding: variant === "modal" ? "0.875rem" : "1rem",
          fontSize: variant === "modal" ? "1rem" : "1.0625rem",
          fontWeight: "bold",
          color: "white",
          border: "none",
          borderRadius: "0",
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          _hover: {
            filter: isLoading ? "none" : "brightness(1.05)",
          },
          "@media (max-width: 400px)": {
            padding: "0.75rem",
            fontSize: "0.9375rem",
          },
        })}
        style={{
          background: isLoading
            ? "#9ca3af"
            : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          boxShadow: isLoading
            ? "none"
            : "inset 0 1px 0 rgba(255,255,255,0.15)",
        }}
      >
        {isLoading ? "Starting..." : "Practice →"}
      </button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * SessionModeBanner - Unified banner for all session modes
 *
 * Displays the appropriate banner based on the session mode:
 * - Remediation: Shows weak skills + blocked promotion (if any)
 * - Progression: Shows next skill to learn + tutorial CTA
 * - Maintenance: Shows all-strong message
 *
 * Used in both the Dashboard and StartPracticeModal.
 */
export function SessionModeBanner({
  sessionMode,
  onAction,
  isLoading = false,
  variant = "dashboard",
}: SessionModeBannerProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  switch (sessionMode.type) {
    case "remediation":
      return (
        <RemediationBanner
          mode={sessionMode}
          onAction={onAction}
          isLoading={isLoading}
          variant={variant}
          isDark={isDark}
        />
      );
    case "progression":
      // Use celebration banner for tutorial-required skills (unlocked new skill)
      // This will show confetti + animate down to normal banner over ~60 seconds
      if (sessionMode.tutorialRequired) {
        return (
          <CelebrationProgressionBanner
            mode={sessionMode}
            onAction={onAction}
            isLoading={isLoading}
            variant={variant}
            isDark={isDark}
          />
        );
      }
      return (
        <ProgressionBanner
          mode={sessionMode}
          onAction={onAction}
          isLoading={isLoading}
          variant={variant}
          isDark={isDark}
        />
      );
    case "maintenance":
      return (
        <MaintenanceBanner
          mode={sessionMode}
          onAction={onAction}
          isLoading={isLoading}
          variant={variant}
          isDark={isDark}
        />
      );
  }
}

export default SessionModeBanner;
