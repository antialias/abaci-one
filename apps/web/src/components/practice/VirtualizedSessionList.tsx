"use client";

/**
 * Virtualized session history list with infinite scroll
 *
 * Uses @tanstack/react-virtual for virtualization to efficiently render
 * large numbers of sessions. Automatically loads more sessions as the
 * user scrolls near the bottom.
 *
 * Supports showing an "in progress" session at the top of the list.
 */

import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PracticeSession } from "@/db/schema/practice-sessions";
import type { SessionPlan } from "@/db/schema/session-plans";
import { useLiveSessionTimeEstimate } from "@/hooks/useLiveSessionTimeEstimate";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { api } from "@/lib/queryClient";
import { css } from "../../../styled-system/css";
import { SessionPhotoGallery } from "./SessionPhotoGallery";

// ============================================================================
// Types
// ============================================================================

interface VirtualizedSessionListProps {
  studentId: string;
  isDark: boolean;
  /** Height of the scrollable container */
  height?: number | string;
  /** Active session (in progress) to show at the top */
  activeSession?: SessionPlan | null;
  /** Callback when user clicks on the active session */
  onOpenActiveSession?: () => void;
}

// ============================================================================
// Shared Session Card Components
// ============================================================================

/**
 * Status badge - shows session state (completed accuracy or in progress)
 */
function StatusBadge({
  variant,
  correct,
  total,
  isDark,
}: {
  variant: "completed" | "in-progress";
  correct?: number;
  total?: number;
  isDark: boolean;
}) {
  if (variant === "in-progress") {
    return (
      <span
        data-element="status-badge"
        data-status="in-progress"
        className={css({
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          padding: "0.25rem 0.5rem",
          borderRadius: "4px",
          fontSize: "0.75rem",
          fontWeight: "medium",
          backgroundColor: isDark ? "blue.900" : "blue.100",
          color: isDark ? "blue.300" : "blue.700",
        })}
      >
        <span
          className={css({
            width: "0.5rem",
            height: "0.5rem",
            borderRadius: "50%",
            backgroundColor: isDark ? "green.400" : "green.500",
            animation: "pulse 2s ease-in-out infinite",
          })}
        />
        In Progress
      </span>
    );
  }

  // Completed - show accuracy badge with same format as active session
  const accuracy = total && total > 0 ? (correct ?? 0) / total : 0;
  const isHighAccuracy = accuracy >= 0.8;

  return (
    <span
      data-element="status-badge"
      data-status="completed"
      className={css({
        padding: "0.25rem 0.5rem",
        borderRadius: "4px",
        fontSize: "0.75rem",
        fontWeight: "medium",
        backgroundColor: isHighAccuracy
          ? isDark
            ? "green.900"
            : "green.100"
          : isDark
            ? "yellow.900"
            : "yellow.100",
        color: isHighAccuracy
          ? isDark
            ? "green.300"
            : "green.700"
          : isDark
            ? "yellow.300"
            : "yellow.700",
      })}
    >
      {correct}/{total} · {Math.round(accuracy * 100)}%
    </span>
  );
}

/**
 * Progress bar background for active sessions
 * Positioned absolutely as a subtle full-height background indicator
 */
function ProgressBarBackground({
  completed,
  total,
  isDark,
}: {
  completed: number;
  total: number;
  isDark: boolean;
}) {
  const progress = total > 0 ? completed / total : 0;

  return (
    <div
      data-element="progress-bar-background"
      className={css({
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        borderRadius: "6px",
        pointerEvents: "none",
      })}
    >
      {/* Progress fill - visible but not overwhelming */}
      <div
        className={css({
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          backgroundColor: isDark
            ? "rgba(34, 197, 94, 0.25)"
            : "rgba(34, 197, 94, 0.20)",
          transition: "width 0.3s ease",
        })}
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
      {/* Progress edge indicator - vertical line at progress point */}
      {progress > 0 && progress < 1 && (
        <div
          className={css({
            position: "absolute",
            top: 0,
            bottom: 0,
            width: "2px",
            backgroundColor: isDark
              ? "rgba(74, 222, 128, 0.6)"
              : "rgba(22, 163, 74, 0.5)",
            transition: "left 0.3s ease",
          })}
          style={{ left: `${Math.round(progress * 100)}%` }}
        />
      )}
    </div>
  );
}

/**
 * Stats row - shows session metrics
 */
function StatsRow({
  children,
  isDark,
}: {
  children: ReactNode;
  isDark: boolean;
}) {
  return (
    <div
      data-element="stats-row"
      className={css({
        fontSize: "0.75rem",
        color: isDark ? "gray.400" : "gray.600",
        display: "flex",
        gap: "1rem",
        marginTop: "0.5rem",
      })}
    >
      {children}
    </div>
  );
}

/**
 * Stat item for the stats row
 */
function StatItem({
  children,
  highlight,
  isDark,
}: {
  children: ReactNode;
  highlight?: boolean;
  isDark: boolean;
}) {
  return (
    <span
      className={css({
        color: highlight ? (isDark ? "blue.300" : "blue.600") : undefined,
        fontWeight: highlight ? "medium" : undefined,
      })}
    >
      {children}
    </span>
  );
}

/**
 * Header row - date/time on left, status badge on right
 */
function SessionHeader({
  date,
  statusBadge,
  isDark,
}: {
  date: string;
  statusBadge: ReactNode;
  isDark: boolean;
}) {
  return (
    <div
      data-element="session-header"
      className={css({
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      })}
    >
      <span
        className={css({
          fontWeight: "bold",
          color: isDark ? "gray.100" : "gray.900",
        })}
      >
        {date}
      </span>
      {statusBadge}
    </div>
  );
}

// ============================================================================
// Completed Session Item
// ============================================================================

function SessionItem({
  session,
  studentId,
  isDark,
  photoCount = 0,
  onViewPhotos,
}: {
  session: PracticeSession;
  studentId: string;
  isDark: boolean;
  /** Number of photos attached to this session */
  photoCount?: number;
  /** Callback when user clicks to view photos */
  onViewPhotos?: () => void;
}) {
  const accuracy =
    session.problemsAttempted > 0
      ? session.problemsCorrect / session.problemsAttempted
      : 0;
  const displayDate = new Date(
    session.completedAt || session.startedAt,
  ).toLocaleDateString();
  const durationMinutes = Math.round((session.totalTimeMs || 0) / 60000);
  const isOfflineSession = session.problemsAttempted === 0;

  return (
    <div
      data-element="session-history-item"
      data-session-id={session.id}
      className={css({
        display: "flex",
        width: "100%",
        padding: "1rem",
        borderRadius: "8px",
        textAlign: "left",
        transition: "all 0.15s ease",
        border: "1px solid",
        backgroundColor: isDark ? "gray.700" : "white",
        borderColor: isDark ? "gray.600" : "gray.200",
        gap: "0.75rem",
      })}
    >
      {/* Main content - clickable link */}
      <Link
        href={`/practice/${studentId}/session/${session.id}`}
        className={css({
          flex: 1,
          textDecoration: "none",
          cursor: "pointer",
          _hover: {
            '& [data-element="session-date"]': {
              color: isDark ? "blue.300" : "blue.600",
            },
          },
        })}
      >
        <SessionHeader
          date={displayDate}
          statusBadge={
            isOfflineSession ? (
              <span
                className={css({
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  fontWeight: "medium",
                  backgroundColor: isDark ? "purple.900" : "purple.100",
                  color: isDark ? "purple.300" : "purple.700",
                })}
              >
                Offline Practice
              </span>
            ) : (
              <StatusBadge
                variant="completed"
                correct={session.problemsCorrect}
                total={session.problemsAttempted}
                isDark={isDark}
              />
            )
          }
          isDark={isDark}
        />
        <StatsRow isDark={isDark}>
          {isOfflineSession ? (
            <StatItem isDark={isDark}>Logged offline</StatItem>
          ) : (
            <StatItem isDark={isDark}>{durationMinutes} min</StatItem>
          )}
        </StatsRow>
      </Link>

      {/* Photo indicator button */}
      {photoCount > 0 && onViewPhotos && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onViewPhotos();
          }}
          data-action="view-photos"
          className={css({
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
            px: 2,
            py: 1,
            bg: isDark ? "gray.600" : "gray.100",
            color: isDark ? "gray.200" : "gray.600",
            borderRadius: "md",
            fontSize: "sm",
            cursor: "pointer",
            transition: "all 0.15s",
            alignSelf: "center",
            _hover: {
              bg: isDark ? "gray.500" : "gray.200",
              color: isDark ? "white" : "gray.800",
            },
          })}
        >
          <span>📷</span>
          <span>{photoCount}</span>
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Active Session Item (In Progress)
// ============================================================================

/**
 * Format elapsed time as human-readable duration (e.g., "2m", "1h 30m")
 */
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) return `${hours}h`;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format idle time as human-readable string with "ago" suffix
 */
function formatIdleTime(idleMs: number): string {
  const elapsed = formatElapsedTime(idleMs);
  if (elapsed === "just now") return "Just now";
  return `${elapsed} ago`;
}

/**
 * Hook to track idle time since last activity, updating every second
 */
function useIdleTime(lastActivityTime: Date | null): number {
  const [idleMs, setIdleMs] = useState(() =>
    lastActivityTime ? Date.now() - lastActivityTime.getTime() : 0,
  );

  useEffect(() => {
    if (!lastActivityTime) return;

    // Update immediately
    setIdleMs(Date.now() - lastActivityTime.getTime());

    // Update every second
    const interval = setInterval(() => {
      setIdleMs(Date.now() - lastActivityTime.getTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [lastActivityTime]);

  return idleMs;
}

function ActiveSessionItem({
  session,
  isDark,
  onClick,
}: {
  session: SessionPlan;
  isDark: boolean;
  onClick: () => void;
}) {
  // Use live time estimation hook with WebSocket subscription
  const timeEstimate = useLiveSessionTimeEstimate({
    sessionId: session.id,
    initialResults: session.results ?? [],
    initialParts: session.parts ?? [],
    enabled: true,
  });

  const {
    totalProblems,
    completedProblems,
    accuracy,
    estimatedTimeRemainingFormatted,
    isLive,
    lastActivityAt,
  } = timeEstimate;

  // Get session start time (memoize to avoid creating new Date objects on every render)
  const sessionStartTime = useMemo(
    () =>
      session.startedAt
        ? new Date(session.startedAt)
        : new Date(session.createdAt),
    [session.startedAt, session.createdAt],
  );

  // Get last activity time from initial results (memoized)
  const lastActivityTimeFromResults = useMemo(() => {
    if (session.results && session.results.length > 0) {
      return new Date(session.results[session.results.length - 1].timestamp);
    }
    return sessionStartTime;
  }, [session.results, sessionStartTime]);

  // Prefer live data when available, fall back to initial data
  const lastActivityTime =
    isLive && lastActivityAt ? lastActivityAt : lastActivityTimeFromResults;

  const idleMs = useIdleTime(lastActivityTime);
  const elapsedMs = useIdleTime(sessionStartTime);

  return (
    <button
      type="button"
      data-element="active-session-item"
      data-session-id={session.id}
      onClick={onClick}
      className={css({
        display: "block",
        width: "100%",
        padding: "1rem",
        borderRadius: "8px",
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.15s ease",
        border: "none",
        backgroundColor: isDark
          ? "rgba(30, 58, 138, 0.5)"
          : "rgba(219, 234, 254, 1)",
        boxShadow: isDark
          ? "inset 0 0 0 1px var(--colors-blue-500)"
          : "inset 0 0 0 1px var(--colors-blue-300)",
        position: "relative",
        overflow: "hidden",
        _hover: {
          backgroundColor: isDark
            ? "rgba(30, 58, 138, 0.7)"
            : "rgba(191, 219, 254, 1)",
          boxShadow: isDark
            ? "inset 0 0 0 1px var(--colors-blue-400), 0 2px 8px rgba(0,0,0,0.1)"
            : "inset 0 0 0 1px var(--colors-blue-400), 0 2px 8px rgba(0,0,0,0.1)",
          transform: "translateY(-1px)",
        },
      })}
    >
      {/* Progress bar as subtle background */}
      <ProgressBarBackground
        completed={completedProblems}
        total={totalProblems}
        isDark={isDark}
      />

      {/* Corner ribbon - "In Progress" indicator */}
      <div
        data-element="in-progress-ribbon"
        className={css({
          position: "absolute",
          top: 0,
          left: 0,
          overflow: "hidden",
          width: "5rem",
          height: "5rem",
          pointerEvents: "none",
          zIndex: 2,
        })}
      >
        <div
          className={css({
            position: "absolute",
            top: "0.125rem",
            left: "-2.125rem",
            width: "6rem",
            transform: "rotate(-45deg)",
            backgroundColor: isDark ? "green.600" : "green.500",
            color: "white",
            fontSize: "0.5rem",
            fontWeight: "bold",
            textAlign: "center",
            padding: "0.125rem 0",
            textTransform: "uppercase",
            letterSpacing: "0.025em",
            lineHeight: "1.2",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          })}
        >
          In
          <br />
          Progress
        </div>
      </div>

      {/* Content - positioned above the progress background */}
      <div className={css({ position: "relative", zIndex: 1 })}>
        {/* Header: Idle time (left) | Stats badge (right) */}
        <div
          data-element="active-session-header"
          className={css({
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          })}
        >
          {/* Left: Idle time since last activity */}
          <span
            className={css({
              color: isDark ? "gray.300" : "gray.600",
              fontSize: "0.75rem",
            })}
          >
            {formatElapsedTime(idleMs)} since last activity
          </span>

          {/* Right: Stats badge */}
          <span
            className={css({
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: "medium",
              backgroundColor: isDark
                ? "rgba(30, 64, 175, 0.6)"
                : "rgba(191, 219, 254, 1)",
              color: isDark ? "blue.200" : "blue.800",
            })}
          >
            {completedProblems}/{totalProblems}
            {completedProblems > 0 && ` · ${Math.round(accuracy * 100)}%`}
          </span>
        </div>

        {/* Footer: Session duration and estimated time remaining */}
        <StatsRow isDark={isDark}>
          <StatItem isDark={isDark}>
            Started {formatIdleTime(elapsedMs)}
          </StatItem>
          <StatItem isDark={isDark}>
            {estimatedTimeRemainingFormatted} left
          </StatItem>
        </StatsRow>
      </div>
    </button>
  );
}

// ============================================================================
// Loading Indicator
// ============================================================================

function LoadingIndicator({ isDark }: { isDark: boolean }) {
  return (
    <div
      data-element="loading-more"
      className={css({
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        color: isDark ? "gray.400" : "gray.500",
        fontSize: "0.875rem",
      })}
    >
      <span
        className={css({
          display: "inline-block",
          width: "1rem",
          height: "1rem",
          border: "2px solid currentColor",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          marginRight: "0.5rem",
        })}
      />
      Loading more sessions...
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function VirtualizedSessionList({
  studentId,
  isDark,
  height = 500,
  activeSession,
  onOpenActiveSession,
}: VirtualizedSessionListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const hasActiveSession =
    activeSession != null && activeSession.completedAt == null;

  // State for photo gallery
  const [gallerySessionId, setGallerySessionId] = useState<string | null>(null);

  const {
    sessions,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isLoading,
    isError,
    totalLoaded,
  } = useSessionHistory(studentId, { pageSize: 20 });

  // Fetch attachment counts for all sessions
  const { data: attachmentData } = useQuery({
    queryKey: ["attachments", studentId],
    queryFn: async () => {
      const res = await api(`curriculum/${studentId}/attachments`);
      if (!res.ok) throw new Error("Failed to fetch attachments");
      return res.json() as Promise<{ sessionCounts: Record<string, number> }>;
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  const sessionPhotoCounts = attachmentData?.sessionCounts ?? {};

  // Debug logging
  console.log(
    `[VirtualizedSessionList] studentId=${studentId}, totalLoaded=${totalLoaded}, hasNextPage=${hasNextPage}, isLoading=${isLoading}, isFetchingNextPage=${isFetchingNextPage}`,
  );

  // Virtualizer configuration
  // +1 for active session at top (if any), +1 for loading indicator at bottom (if any)
  const activeSessionOffset = hasActiveSession ? 1 : 0;
  const rowVirtualizer = useVirtualizer({
    count: activeSessionOffset + sessions.length + (hasNextPage ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 90, // All items are same height now
    overscan: 5, // Render 5 extra items above/below viewport
  });

  // Load more when scrolling near the bottom
  const handleScroll = useCallback(() => {
    if (!parentRef.current || isFetchingNextPage || !hasNextPage) return;

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    const scrollRemaining = scrollHeight - scrollTop - clientHeight;

    // Trigger load when within 200px of bottom
    if (scrollRemaining < 200) {
      console.log(
        `[VirtualizedSessionList] Near bottom, fetching next page. scrollRemaining=${scrollRemaining}`,
      );
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Attach scroll listener
  useEffect(() => {
    const element = parentRef.current;
    if (!element) return;

    element.addEventListener("scroll", handleScroll);
    return () => element.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Initial loading state
  if (isLoading) {
    return (
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: typeof height === "number" ? `${height}px` : height,
          color: isDark ? "gray.400" : "gray.500",
        })}
      >
        <LoadingIndicator isDark={isDark} />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div
        className={css({
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: typeof height === "number" ? `${height}px` : height,
          color: isDark ? "red.400" : "red.600",
        })}
      >
        Failed to load session history
      </div>
    );
  }

  // Empty state (only if no active session either)
  if (sessions.length === 0 && !hasActiveSession) {
    return (
      <p
        className={css({
          color: isDark ? "gray.500" : "gray.500",
          fontStyle: "italic",
          textAlign: "center",
          padding: "2rem",
        })}
      >
        No sessions recorded yet. Start practicing!
      </p>
    );
  }

  return (
    <div
      ref={parentRef}
      data-element="virtualized-session-list"
      className={css({
        height: typeof height === "number" ? `${height}px` : height,
        overflow: "auto",
        contain: "strict",
      })}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          // Determine what to render based on index
          const isActiveSessionRow =
            hasActiveSession && virtualItem.index === 0;
          const sessionIndex = virtualItem.index - activeSessionOffset;
          const isLoadingRow = sessionIndex === sessions.length;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className={css({ paddingBottom: "0.75rem" })}>
                {isActiveSessionRow && activeSession ? (
                  <ActiveSessionItem
                    session={activeSession}
                    isDark={isDark}
                    onClick={onOpenActiveSession ?? (() => {})}
                  />
                ) : isLoadingRow ? (
                  <LoadingIndicator isDark={isDark} />
                ) : (
                  <SessionItem
                    session={sessions[sessionIndex]}
                    studentId={studentId}
                    isDark={isDark}
                    photoCount={
                      sessionPhotoCounts[sessions[sessionIndex].id] ?? 0
                    }
                    onViewPhotos={() =>
                      setGallerySessionId(sessions[sessionIndex].id)
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Photo Gallery Modal */}
      {gallerySessionId && (
        <SessionPhotoGallery
          playerId={studentId}
          sessionId={gallerySessionId}
          isOpen={true}
          onClose={() => setGallerySessionId(null)}
        />
      )}
    </div>
  );
}
