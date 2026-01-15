"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { css } from "../../../../styled-system/css";
import { Z_INDEX } from "@/constants/zIndex";
import type {
  UseSyncStatusResult,
  SyncHistoryEntry,
} from "../hooks/useSyncStatus";

export interface NavSyncIndicatorProps {
  /** Sync status from useSyncStatus hook */
  sync: UseSyncStatusResult;
}

/**
 * Compact sync indicator for the navigation bar.
 *
 * Shows sync status with a dropdown for actions and history.
 * States: Loading, Unavailable, In Sync (minimal), New Available, Syncing, Error
 */
export function NavSyncIndicator({ sync }: NavSyncIndicatorProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded]);

  const handleSyncClick = useCallback(() => {
    sync.startSync();
  }, [sync]);

  // Determine visual state
  const getIndicatorState = () => {
    if (sync.isLoading) return "loading";
    if (!sync.isAvailable) return "unavailable";
    if (sync.isSyncing) return "syncing";
    if (sync.progress.phase === "error") return "error";
    if (sync.progress.phase === "complete") return "complete";
    if (sync.hasNewData) return "new-available";
    return "in-sync";
  };

  const state = getIndicatorState();

  // Get last sync time for minimal display
  const lastSync = sync.history[0];
  const lastSyncTime = lastSync
    ? formatTimeAgo(new Date(lastSync.startedAt))
    : null;

  return (
    <div
      ref={containerRef}
      data-component="nav-sync-indicator"
      data-state={state}
      className={css({
        position: "relative",
      })}
    >
      {/* Compact button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        disabled={state === "loading"}
        data-action="toggle-sync-dropdown"
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          bg: "transparent",
          border: "1px solid",
          borderColor:
            state === "new-available"
              ? "blue.600"
              : state === "syncing"
                ? "blue.700"
                : state === "error"
                  ? "orange.600"
                  : "gray.700",
          borderRadius: "lg",
          cursor: state === "loading" ? "wait" : "pointer",
          fontSize: "sm",
          fontWeight: "medium",
          color:
            state === "new-available"
              ? "blue.300"
              : state === "syncing"
                ? "blue.300"
                : state === "error"
                  ? "orange.300"
                  : "gray.400",
          transition: "all 0.15s ease",
          _hover:
            state !== "loading"
              ? {
                  bg: "gray.800",
                  borderColor:
                    state === "new-available"
                      ? "blue.500"
                      : state === "syncing"
                        ? "blue.600"
                        : state === "error"
                          ? "orange.500"
                          : "gray.600",
                }
              : {},
        })}
      >
        {/* Icon */}
        <span
          data-element="sync-icon"
          className={css({
            fontSize: "sm",
            animation: state === "syncing" ? "spin 1s linear infinite" : "none",
          })}
        >
          {state === "loading" && "⏳"}
          {state === "unavailable" && "☁️"}
          {state === "syncing" && "🔄"}
          {state === "complete" && "✅"}
          {state === "error" && "⚠️"}
          {state === "new-available" && "☁️"}
          {state === "in-sync" && "✓"}
        </span>

        {/* Label/Badge */}
        {state === "loading" && (
          <span className={css({ display: { base: "none", md: "inline" } })}>
            Checking...
          </span>
        )}
        {state === "unavailable" && (
          <span className={css({ display: { base: "none", md: "inline" } })}>
            Offline
          </span>
        )}
        {state === "syncing" && (
          <span className={css({ display: { base: "none", md: "inline" } })}>
            {sync.progress.filesTransferred
              ? `${sync.progress.filesTransferred} files`
              : "Syncing..."}
          </span>
        )}
        {state === "complete" && (
          <span className={css({ display: { base: "none", md: "inline" } })}>
            Done!
          </span>
        )}
        {state === "error" && (
          <span className={css({ display: { base: "none", md: "inline" } })}>
            Error
          </span>
        )}
        {state === "new-available" && (
          <>
            <span
              data-element="sync-badge"
              className={css({
                px: 1.5,
                py: 0.5,
                bg: "blue.600",
                color: "white",
                borderRadius: "full",
                fontSize: "xs",
                fontWeight: "bold",
                minWidth: "20px",
                textAlign: "center",
              })}
            >
              {sync.newCount}
            </span>
            <span className={css({ display: { base: "none", lg: "inline" } })}>
              new
            </span>
          </>
        )}
        {state === "in-sync" && lastSyncTime && (
          <span className={css({ display: { base: "none", md: "inline" } })}>
            {lastSyncTime}
          </span>
        )}

        {/* Dropdown arrow */}
        <span
          className={css({
            fontSize: "10px",
            opacity: 0.6,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            display: { base: "none", sm: "block" },
          })}
        >
          ▼
        </span>
      </button>

      {/* Dropdown */}
      {expanded && (
        <div
          data-element="sync-dropdown"
          className={css({
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: "300px",
            bg: "gray.850",
            border: "1px solid",
            borderColor: "gray.700",
            borderRadius: "lg",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
            overflow: "hidden",
          })}
          style={{ zIndex: Z_INDEX.DROPDOWN }}
        >
          {/* Header */}
          <div
            data-element="dropdown-header"
            className={css({
              px: 4,
              py: 3,
              borderBottom: "1px solid",
              borderColor: "gray.700",
            })}
          >
            <div
              className={css({
                fontSize: "sm",
                fontWeight: "bold",
                color: "gray.100",
              })}
            >
              Sync from Production
            </div>
          </div>

          {/* Status section */}
          <div
            data-element="dropdown-status"
            className={css({
              px: 4,
              py: 3,
              borderBottom: "1px solid",
              borderColor: "gray.700",
            })}
          >
            {state === "unavailable" && (
              <div className={css({ color: "gray.400", fontSize: "sm" })}>
                <span className={css({ mr: 2 })}>☁️</span>
                Cannot reach production server
              </div>
            )}

            {state === "syncing" && (
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                })}
              >
                <div className={css({ color: "blue.300", fontSize: "sm" })}>
                  <span
                    className={css({
                      mr: 2,
                      display: "inline-block",
                      animation: "spin 1s linear infinite",
                    })}
                  >
                    🔄
                  </span>
                  {sync.progress.message || "Syncing..."}
                </div>
                {sync.progress.filesTransferred !== undefined && (
                  <div className={css({ color: "gray.400", fontSize: "xs" })}>
                    {sync.progress.filesTransferred} files transferred
                  </div>
                )}
              </div>
            )}

            {state === "complete" && (
              <div className={css({ color: "green.400", fontSize: "sm" })}>
                <span className={css({ mr: 2 })}>✅</span>
                Sync complete!
              </div>
            )}

            {state === "error" && (
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                })}
              >
                <div className={css({ color: "orange.400", fontSize: "sm" })}>
                  <span className={css({ mr: 2 })}>⚠️</span>
                  {sync.progress.message || "Sync failed"}
                </div>
                <button
                  type="button"
                  onClick={handleSyncClick}
                  className={css({
                    px: 3,
                    py: 1.5,
                    bg: "orange.600",
                    color: "white",
                    border: "none",
                    borderRadius: "md",
                    fontSize: "sm",
                    fontWeight: "medium",
                    cursor: "pointer",
                    _hover: { bg: "orange.500" },
                  })}
                >
                  Retry
                </button>
              </div>
            )}

            {state === "new-available" && (
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                })}
              >
                <div className={css({ color: "blue.300", fontSize: "sm" })}>
                  <span className={css({ mr: 2 })}>☁️</span>
                  {sync.newCount} new {sync.newCount === 1 ? "item" : "items"}{" "}
                  available
                </div>
                <button
                  type="button"
                  onClick={handleSyncClick}
                  data-action="sync-now"
                  className={css({
                    w: "100%",
                    py: 2,
                    bg: "blue.600",
                    color: "white",
                    border: "none",
                    borderRadius: "md",
                    fontSize: "sm",
                    fontWeight: "bold",
                    cursor: "pointer",
                    _hover: { bg: "blue.500" },
                  })}
                >
                  Sync Now
                </button>
              </div>
            )}

            {state === "in-sync" && (
              <div
                className={css({
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                })}
              >
                <div className={css({ color: "green.400", fontSize: "sm" })}>
                  <span className={css({ mr: 2 })}>✓</span>
                  All synced
                </div>
                {sync.status?.local && sync.status?.remote && (
                  <div className={css({ color: "gray.400", fontSize: "xs" })}>
                    Local:{" "}
                    {sync.status.local.totalImages?.toLocaleString() || 0} •
                    Remote:{" "}
                    {sync.status.remote.totalImages?.toLocaleString() || 0}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* History section */}
          {sync.history.length > 0 && (
            <div data-element="dropdown-history">
              <div
                className={css({
                  px: 4,
                  py: 2,
                  fontSize: "xs",
                  fontWeight: "medium",
                  color: "gray.500",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                })}
              >
                Recent Syncs
              </div>
              <div className={css({ pb: 2 })}>
                {sync.history.map((entry) => (
                  <SyncHistoryRow key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Single row in the sync history
 */
function SyncHistoryRow({ entry }: { entry: SyncHistoryEntry }) {
  const time = new Date(entry.startedAt);
  const isSuccess = entry.status === "success";
  const isFailed = entry.status === "failed";

  return (
    <div
      className={css({
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 4,
        py: 1.5,
        fontSize: "sm",
        _hover: { bg: "gray.800" },
      })}
    >
      {/* Status icon */}
      <span
        className={css({
          flexShrink: 0,
          width: "16px",
          textAlign: "center",
          color: isSuccess ? "green.400" : isFailed ? "red.400" : "gray.500",
        })}
      >
        {isSuccess ? "✓" : isFailed ? "✗" : "○"}
      </span>

      {/* Time */}
      <span
        className={css({
          flexShrink: 0,
          width: "65px",
          color: "gray.400",
          fontSize: "xs",
        })}
        title={time.toLocaleString()}
      >
        {formatTimeAgo(time)}
      </span>

      {/* Details */}
      <span
        className={css({
          flex: 1,
          color: isFailed ? "red.300" : "gray.300",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: "xs",
        })}
        title={isFailed && entry.error ? entry.error : undefined}
      >
        {isFailed ? (
          truncateError(entry.error || "Unknown error")
        ) : (
          <>
            {entry.filesTransferred} file
            {entry.filesTransferred !== 1 ? "s" : ""}
            {entry.durationMs !== null && (
              <span className={css({ color: "gray.500", ml: 1 })}>
                · {formatDuration(entry.durationMs)}
              </span>
            )}
          </>
        )}
      </span>
    </div>
  );
}

/**
 * Format a date as relative time (e.g., "2h ago", "Yesterday")
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.round(secs % 60);
  return `${mins}m ${remainingSecs}s`;
}

/**
 * Truncate error message for display
 */
function truncateError(error: string): string {
  if (error.includes("Cannot connect")) return "Connection failed";
  if (error.includes("SSH")) return "SSH error";
  if (error.includes("rsync")) return "Sync error";
  if (error.includes("timeout")) return "Timeout";
  if (error.length > 25) return error.substring(0, 22) + "...";
  return error;
}
