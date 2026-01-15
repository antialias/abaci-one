"use client";

import { useTheme } from "@/contexts/ThemeContext";
import type { SkillChanges } from "@/lib/curriculum/skill-changes";
import { formatSkillChanges } from "@/lib/curriculum/skill-changes";
import { css } from "../../../styled-system/css";

// ============================================================================
// Types
// ============================================================================

export interface ActiveSessionState {
  id: string;
  completedCount: number;
  totalCount: number;
  createdAt: Date;
  startedAt: Date | null;
  lastActivityAt: Date | null;
  /** Session's original focus description */
  focusDescription: string;
  /** Skill IDs targeted in this session */
  sessionSkillIds: string[];
  /** Computed skill changes since session created */
  skillChanges: SkillChanges | null;
}

interface ActiveSessionBannerProps {
  /** The active session state */
  session: ActiveSessionState;
  /** Callback when user clicks Resume */
  onResume: () => void;
  /** Callback when user clicks Start Fresh */
  onStartFresh: () => void;
  /** Whether resume action is in progress */
  isLoading?: boolean;
  /** Variant for different contexts */
  variant?: "dashboard" | "nav";
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format a relative time string (e.g., "2h ago", "15 min ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

// ============================================================================
// Components
// ============================================================================

/**
 * Full dashboard variant - shows all session details
 */
function DashboardBanner({
  session,
  onResume,
  onStartFresh,
  isLoading,
  isDark,
}: ActiveSessionBannerProps & { isDark: boolean }) {
  const progressPercent = Math.round(
    (session.completedCount / session.totalCount) * 100,
  );
  const formattedChanges = session.skillChanges
    ? formatSkillChanges(session.skillChanges)
    : [];
  const hasChanges = session.skillChanges?.hasChanges ?? false;

  return (
    <div
      data-element="active-session-banner"
      data-variant="dashboard"
      className={css({
        borderRadius: "16px",
        overflow: "hidden",
        border: "2px solid",
        borderColor: isDark ? "blue.500" : "blue.400",
        "@media (max-width: 400px)": {
          borderRadius: "12px",
        },
      })}
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.08) 100%)"
          : "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.05) 100%)",
      }}
    >
      {/* Header */}
      <div
        className={css({
          padding: "1rem 1.25rem",
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
            fontSize: "2rem",
            lineHeight: 1,
            "@media (max-width: 400px)": {
              fontSize: "1.5rem",
            },
          })}
        >
          🔄
        </span>
        <div className={css({ flex: 1, minWidth: 0 })}>
          <p
            className={css({
              fontSize: "1rem",
              fontWeight: "600",
              marginBottom: "0.25rem",
              "@media (max-width: 400px)": {
                fontSize: "0.875rem",
                marginBottom: "0.125rem",
              },
            })}
            style={{ color: isDark ? "#93c5fd" : "#1e40af" }}
          >
            Session in Progress
          </p>
          <p
            className={css({
              fontSize: "0.8125rem",
              "@media (max-width: 400px)": {
                fontSize: "0.75rem",
              },
            })}
            style={{ color: isDark ? "#a1a1aa" : "#71717a" }}
          >
            Started {formatRelativeTime(session.createdAt)}
            {session.lastActivityAt &&
              ` • Last activity ${formatRelativeTime(session.lastActivityAt)}`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div
        className={css({
          padding: "0 1.25rem 0.75rem",
          "@media (max-width: 400px)": {
            padding: "0 0.75rem 0.5rem",
          },
        })}
      >
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          })}
        >
          <div
            className={css({
              flex: 1,
              height: "8px",
              borderRadius: "4px",
              overflow: "hidden",
            })}
            style={{
              background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
            }}
          >
            <div
              className={css({
                height: "100%",
                borderRadius: "4px",
                transition: "width 0.3s ease",
              })}
              style={{
                width: `${progressPercent}%`,
                background: isDark
                  ? "linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)"
                  : "linear-gradient(90deg, #3b82f6 0%, #7c3aed 100%)",
              }}
            />
          </div>
          <span
            className={css({
              fontSize: "0.8125rem",
              fontWeight: "600",
              whiteSpace: "nowrap",
            })}
            style={{ color: isDark ? "#93c5fd" : "#2563eb" }}
          >
            {session.completedCount}/{session.totalCount}
          </span>
        </div>
      </div>

      {/* Focus description */}
      <div
        className={css({
          padding: "0 1.25rem 0.75rem",
          "@media (max-width: 400px)": {
            padding: "0 0.75rem 0.5rem",
          },
        })}
      >
        <p
          className={css({
            fontSize: "0.8125rem",
            "@media (max-width: 400px)": {
              fontSize: "0.75rem",
            },
          })}
          style={{ color: isDark ? "#d4d4d8" : "#52525b" }}
        >
          📋 Focus:{" "}
          <strong style={{ color: isDark ? "#c4b5fd" : "#6b21a8" }}>
            {session.focusDescription}
          </strong>
        </p>
      </div>

      {/* Skill changes */}
      {hasChanges && formattedChanges.length > 0 && (
        <div
          className={css({
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid",
            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
            "@media (max-width: 400px)": {
              padding: "0.5rem 0.75rem",
            },
          })}
        >
          <p
            className={css({
              fontSize: "0.75rem",
              fontWeight: "600",
              marginBottom: "0.375rem",
              "@media (max-width: 400px)": {
                fontSize: "0.6875rem",
              },
            })}
            style={{ color: isDark ? "#fbbf24" : "#b45309" }}
          >
            ⚠️ Changes since session started:
          </p>
          <ul
            className={css({
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            })}
          >
            {formattedChanges.map((change, i) => (
              <li
                key={i}
                className={css({
                  fontSize: "0.75rem",
                  "@media (max-width: 400px)": {
                    fontSize: "0.6875rem",
                  },
                })}
                style={{ color: isDark ? "#d4d4d8" : "#52525b" }}
              >
                {change}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div
        className={css({
          display: "flex",
          flexDirection: "column",
          gap: 0,
        })}
      >
        {/* Primary: Resume Session */}
        <button
          type="button"
          data-action="resume-session"
          onClick={onResume}
          disabled={isLoading}
          className={css({
            width: "100%",
            padding: "1rem",
            fontSize: "1.0625rem",
            fontWeight: "bold",
            color: "white",
            border: "none",
            borderRadius: 0,
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
              padding: "0.875rem",
              fontSize: "1rem",
            },
          })}
          style={{
            background: isLoading
              ? "#9ca3af"
              : "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
            boxShadow: isLoading
              ? "none"
              : "inset 0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          {isLoading ? "Loading..." : "🎯 Resume Session →"}
        </button>

        {/* Secondary: Start Fresh */}
        <button
          type="button"
          data-action="start-fresh"
          onClick={onStartFresh}
          disabled={isLoading}
          className={css({
            width: "100%",
            padding: "0.75rem",
            fontSize: "0.875rem",
            fontWeight: "500",
            border: "none",
            borderRadius: 0,
            cursor: isLoading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            _hover: {
              textDecoration: isLoading ? "none" : "underline",
            },
            "@media (max-width: 400px)": {
              padding: "0.625rem",
              fontSize: "0.8125rem",
            },
          })}
          style={{
            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
            color: isDark ? "#a1a1aa" : "#71717a",
          }}
        >
          Start fresh
        </button>
      </div>
    </div>
  );
}

/**
 * Compact nav variant - single line for navigation bar
 */
function NavBanner({
  session,
  onResume,
  isLoading,
  isDark,
}: ActiveSessionBannerProps & { isDark: boolean }) {
  return (
    <div
      data-element="active-session-banner"
      data-variant="nav"
      className={css({
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.375rem 0.5rem",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: isDark ? "blue.600" : "blue.300",
      })}
      style={{
        background: isDark
          ? "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.1) 100%)"
          : "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.06) 100%)",
      }}
    >
      <span className={css({ fontSize: "1rem", lineHeight: 1 })}>🔄</span>
      <span
        className={css({
          fontSize: "0.8125rem",
          fontWeight: "500",
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        })}
        style={{ color: isDark ? "#93c5fd" : "#1e40af" }}
      >
        Session in progress ({session.completedCount}/{session.totalCount})
      </span>
      <button
        type="button"
        data-action="resume-session-nav"
        onClick={onResume}
        disabled={isLoading}
        className={css({
          padding: "0.25rem 0.625rem",
          fontSize: "0.75rem",
          fontWeight: "bold",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: isLoading ? "not-allowed" : "pointer",
          transition: "all 0.2s ease",
          flexShrink: 0,
          _hover: {
            filter: isLoading ? "none" : "brightness(1.1)",
          },
        })}
        style={{
          background: isLoading
            ? "#9ca3af"
            : "linear-gradient(135deg, #3b82f6 0%, #7c3aed 100%)",
        }}
      >
        {isLoading ? "..." : "Resume →"}
      </button>
    </div>
  );
}

// ============================================================================
// Main Export
// ============================================================================

export function ActiveSessionBanner({
  session,
  onResume,
  onStartFresh,
  isLoading = false,
  variant = "dashboard",
}: ActiveSessionBannerProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  if (variant === "nav") {
    return (
      <NavBanner
        session={session}
        onResume={onResume}
        onStartFresh={onStartFresh}
        isLoading={isLoading}
        isDark={isDark}
      />
    );
  }

  return (
    <DashboardBanner
      session={session}
      onResume={onResume}
      onStartFresh={onStartFresh}
      isLoading={isLoading}
      isDark={isDark}
    />
  );
}

export default ActiveSessionBanner;
