"use client";

import { useState } from "react";
import { css } from "../../../../../styled-system/css";
import { DistributionHeatmap } from "./DistributionHeatmap";
import { TrainingDataCapture } from "./TrainingDataCapture";
import type { SamplesData } from "./wizard/types";

// Quality configuration matching the training wizard
const QUALITY_CONFIG: Record<
  SamplesData["dataQuality"],
  { color: string; bgColor: string; label: string; dots: number }
> = {
  none: { color: "gray.400", bgColor: "gray.800", label: "No Data", dots: 0 },
  insufficient: {
    color: "red.400",
    bgColor: "red.900/50",
    label: "Insufficient",
    dots: 1,
  },
  minimal: {
    color: "yellow.400",
    bgColor: "yellow.900/50",
    label: "Minimal",
    dots: 2,
  },
  good: { color: "green.400", bgColor: "green.900/50", label: "Good", dots: 3 },
  excellent: {
    color: "green.300",
    bgColor: "green.900/50",
    label: "Excellent",
    dots: 4,
  },
};

interface SyncStatus {
  available: boolean;
  remote?: { host: string; totalImages: number };
  local?: { totalImages: number };
  needsSync?: boolean;
  newOnRemote?: number;
  newOnLocal?: number;
  excludedByDeletion?: number;
  error?: string;
}

interface SyncProgress {
  phase: "idle" | "connecting" | "syncing" | "complete" | "error";
  message: string;
  filesTransferred?: number;
  bytesTransferred?: number;
}

interface DataHealthPanelProps {
  // Data stats
  imageCount: number;
  digitCounts: Record<number, number>;
  samples: SamplesData | null;

  // Sync state
  syncStatus: SyncStatus | null;
  syncProgress: SyncProgress;
  syncChecking: boolean;
  onStartSync: () => void;
  onCancelSync: () => void;

  // Capture
  onCaptureComplete: () => void;

  // Layout mode
  mode?: "sidebar" | "compact";
}

type ExpandedSection = "sync" | "capture" | null;

/**
 * Sidebar panel showing data health stats and acquisition options.
 *
 * Desktop: Full sidebar with expandable sync/capture sections
 * Mobile: Use mode="compact" for header bar rendering
 */
export function DataHealthPanel({
  imageCount,
  digitCounts,
  samples,
  syncStatus,
  syncProgress,
  syncChecking,
  onStartSync,
  onCancelSync,
  onCaptureComplete,
  mode = "sidebar",
}: DataHealthPanelProps) {
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  const quality = samples?.dataQuality ?? "none";
  const qualityConfig = QUALITY_CONFIG[quality];
  const syncAvailable = syncStatus?.available ?? false;
  const hasNewOnRemote = (syncStatus?.newOnRemote ?? 0) > 0;
  const isSyncing =
    syncProgress.phase === "connecting" || syncProgress.phase === "syncing";

  const toggleSection = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // COMPACT MODE (for mobile header)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (mode === "compact") {
    return (
      <div
        data-component="data-health-panel"
        data-mode="compact"
        className={css({
          display: "flex",
          alignItems: "center",
          gap: 3,
          px: 3,
          py: 2,
          bg: "gray.850",
          borderBottom: "1px solid",
          borderColor: "gray.800",
        })}
      >
        {/* Image count + quality badge */}
        <div className={css({ display: "flex", alignItems: "center", gap: 2 })}>
          <span
            className={css({
              fontSize: "sm",
              fontWeight: "bold",
              color: "gray.100",
            })}
          >
            {imageCount}
          </span>
          <span className={css({ fontSize: "xs", color: "gray.500" })}>
            images
          </span>
          <span className={css({ color: "gray.600" })}>•</span>
          <QualityBadge quality={quality} compact />
        </div>

        {/* Distribution heatmap */}
        <div className={css({ flex: 1, overflow: "hidden" })}>
          <DistributionHeatmap digitCounts={digitCounts} compact />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SIDEBAR MODE (desktop)
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div
      data-component="data-health-panel"
      data-mode="sidebar"
      className={css({
        display: "flex",
        flexDirection: "column",
        height: "100%",
        bg: "gray.850",
      })}
    >
      {/* ─────────────────────────────────────────────────────────────────────────
          DATA HEALTH SECTION
          ───────────────────────────────────────────────────────────────────────── */}
      <div
        className={css({
          p: 4,
          borderBottom: "1px solid",
          borderColor: "gray.800",
        })}
      >
        <div
          className={css({
            fontSize: "xs",
            fontWeight: "semibold",
            color: "gray.500",
            textTransform: "uppercase",
            letterSpacing: "wide",
            mb: 3,
          })}
        >
          📊 Data Health
        </div>

        {/* Image count */}
        <div className={css({ mb: 3 })}>
          <div
            className={css({
              fontSize: "3xl",
              fontWeight: "bold",
              color: "gray.100",
            })}
          >
            {imageCount.toLocaleString()}
          </div>
          <div className={css({ fontSize: "sm", color: "gray.500" })}>
            training images
          </div>
        </div>

        {/* Quality badge */}
        <div className={css({ mb: 4 })}>
          <QualityBadge quality={quality} />
        </div>

        {/* Distribution */}
        <div>
          <div className={css({ fontSize: "xs", color: "gray.500", mb: 2 })}>
            Distribution by digit
          </div>
          <DistributionHeatmap digitCounts={digitCounts} />
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          GET MORE DATA SECTION
          ───────────────────────────────────────────────────────────────────────── */}
      <div className={css({ flex: 1, overflow: "auto" })}>
        <div className={css({ p: 4 })}>
          <div
            className={css({
              fontSize: "xs",
              fontWeight: "semibold",
              color: "gray.500",
              textTransform: "uppercase",
              letterSpacing: "wide",
              mb: 3,
            })}
          >
            ➕ Get More Data
          </div>

          {/* Sync section */}
          {syncAvailable && (
            <div className={css({ mb: 2 })}>
              <button
                type="button"
                onClick={() => !isSyncing && toggleSection("sync")}
                disabled={isSyncing}
                className={css({
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 3,
                  bg:
                    expandedSection === "sync" || isSyncing
                      ? "blue.900/30"
                      : "gray.800",
                  color: "gray.200",
                  borderRadius: "lg",
                  border: "1px solid",
                  borderColor:
                    expandedSection === "sync" || isSyncing
                      ? "blue.700"
                      : "gray.700",
                  cursor: isSyncing ? "default" : "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  _hover: isSyncing
                    ? {}
                    : { bg: "gray.750", borderColor: "gray.600" },
                })}
              >
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  })}
                >
                  <span>{isSyncing ? "🔄" : "☁️"}</span>
                  <span className={css({ fontWeight: "medium" })}>
                    {isSyncing ? "Syncing..." : "Sync from Production"}
                  </span>
                </div>
                {hasNewOnRemote && !isSyncing && (
                  <span
                    className={css({
                      px: 2,
                      py: 0.5,
                      bg: "green.600",
                      color: "white",
                      borderRadius: "full",
                      fontSize: "xs",
                      fontWeight: "bold",
                    })}
                  >
                    {syncStatus?.newOnRemote} new
                  </span>
                )}
                {!isSyncing && (
                  <span
                    className={css({
                      color: "gray.500",
                      fontSize: "lg",
                      transform:
                        expandedSection === "sync"
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                    })}
                  >
                    ▾
                  </span>
                )}
              </button>

              {/* Sync expanded content */}
              {(expandedSection === "sync" || isSyncing) && (
                <SyncContent
                  syncStatus={syncStatus}
                  syncProgress={syncProgress}
                  onStartSync={onStartSync}
                  onCancelSync={onCancelSync}
                />
              )}
            </div>
          )}

          {/* Capture section */}
          {!isSyncing && (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("capture")}
                className={css({
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 3,
                  bg:
                    expandedSection === "capture"
                      ? "purple.900/30"
                      : "gray.800",
                  color: "gray.200",
                  borderRadius: "lg",
                  border: "1px solid",
                  borderColor:
                    expandedSection === "capture" ? "purple.700" : "gray.700",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  _hover: { bg: "gray.750", borderColor: "gray.600" },
                })}
              >
                <div
                  className={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  })}
                >
                  <span>📸</span>
                  <span className={css({ fontWeight: "medium" })}>
                    Capture New
                  </span>
                </div>
                <span
                  className={css({
                    color: "gray.500",
                    fontSize: "lg",
                    transform:
                      expandedSection === "capture"
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  })}
                >
                  ▾
                </span>
              </button>

              {/* Capture expanded content */}
              {expandedSection === "capture" && (
                <div
                  className={css({
                    mt: 2,
                    p: 3,
                    bg: "gray.800/50",
                    borderRadius: "lg",
                    border: "1px solid",
                    borderColor: "gray.700",
                  })}
                >
                  <TrainingDataCapture onSamplesCollected={onCaptureComplete} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════════

/** Quality badge with dots indicator */
function QualityBadge({
  quality,
  compact = false,
}: {
  quality: SamplesData["dataQuality"];
  compact?: boolean;
}) {
  const config = QUALITY_CONFIG[quality];

  return (
    <div
      className={css({
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 1 : 2,
        px: compact ? 2 : 3,
        py: compact ? 0.5 : 1,
        bg: config.bgColor,
        borderRadius: "full",
        border: "1px solid",
        borderColor: `${config.color}/30`,
      })}
    >
      {/* Dots */}
      <div className={css({ display: "flex", gap: "2px" })}>
        {[1, 2, 3, 4].map((dot) => (
          <div
            key={dot}
            className={css({
              width: compact ? "4px" : "6px",
              height: compact ? "4px" : "6px",
              borderRadius: "full",
              bg: dot <= config.dots ? config.color : "gray.600",
              transition: "background 0.2s ease",
            })}
          />
        ))}
      </div>
      {/* Label */}
      <span
        className={css({
          fontSize: compact ? "2xs" : "xs",
          fontWeight: "semibold",
          color: config.color,
        })}
      >
        {config.label}
      </span>
    </div>
  );
}

/** Sync expanded content */
function SyncContent({
  syncStatus,
  syncProgress,
  onStartSync,
  onCancelSync,
}: {
  syncStatus: SyncStatus | null;
  syncProgress: SyncProgress;
  onStartSync: () => void;
  onCancelSync: () => void;
}) {
  const isSyncing =
    syncProgress.phase === "connecting" || syncProgress.phase === "syncing";
  const isComplete = syncProgress.phase === "complete";
  const isError = syncProgress.phase === "error";
  const hasNewOnRemote = (syncStatus?.newOnRemote ?? 0) > 0;

  return (
    <div
      className={css({
        mt: 2,
        p: 3,
        bg: "gray.800/50",
        borderRadius: "lg",
        border: "1px solid",
        borderColor: "gray.700",
      })}
    >
      {isSyncing ? (
        <>
          <div
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 2,
              mb: 2,
            })}
          >
            <span className={css({ animation: "spin 1s linear infinite" })}>
              🔄
            </span>
            <span className={css({ fontSize: "sm", color: "gray.300" })}>
              {syncProgress.message}
            </span>
          </div>
          {syncProgress.filesTransferred !== undefined &&
            syncProgress.filesTransferred > 0 && (
              <div
                className={css({ fontSize: "xs", color: "gray.500", mb: 3 })}
              >
                {syncProgress.filesTransferred} files transferred
              </div>
            )}
          <button
            type="button"
            onClick={onCancelSync}
            className={css({
              py: 1.5,
              px: 3,
              bg: "transparent",
              color: "gray.400",
              borderRadius: "md",
              border: "1px solid",
              borderColor: "gray.600",
              cursor: "pointer",
              fontSize: "sm",
              _hover: { borderColor: "gray.500", color: "gray.300" },
            })}
          >
            Cancel
          </button>
        </>
      ) : isComplete ? (
        <div
          className={css({
            display: "flex",
            alignItems: "center",
            gap: 2,
            color: "green.400",
            fontSize: "sm",
          })}
        >
          <span>✅</span>
          <span>{syncProgress.message}</span>
        </div>
      ) : (
        <>
          <div className={css({ fontSize: "sm", color: "gray.400", mb: 2 })}>
            <strong className={css({ color: "blue.400" })}>
              {syncStatus?.remote?.totalImages?.toLocaleString() ?? 0}
            </strong>{" "}
            images on {syncStatus?.remote?.host ?? "production"}
          </div>

          {(syncStatus?.excludedByDeletion ?? 0) > 0 && (
            <div
              className={css({
                fontSize: "xs",
                color: "gray.500",
                mb: 2,
                display: "flex",
                alignItems: "center",
                gap: 1,
              })}
            >
              <span>🚫</span>
              <span>
                {syncStatus?.excludedByDeletion} excluded (previously deleted)
              </span>
            </div>
          )}

          {isError && (
            <div className={css({ color: "red.400", fontSize: "sm", mb: 2 })}>
              {syncProgress.message}
            </div>
          )}

          <button
            type="button"
            onClick={onStartSync}
            disabled={!hasNewOnRemote}
            className={css({
              py: 2,
              px: 4,
              bg: hasNewOnRemote ? "blue.600" : "gray.700",
              color: hasNewOnRemote ? "white" : "gray.500",
              borderRadius: "lg",
              border: "none",
              cursor: hasNewOnRemote ? "pointer" : "not-allowed",
              fontWeight: "medium",
              fontSize: "sm",
              width: "100%",
              _hover: hasNewOnRemote ? { bg: "blue.500" } : {},
            })}
          >
            {hasNewOnRemote
              ? `Download ${syncStatus?.newOnRemote} Images`
              : "Already in sync ✓"}
          </button>
        </>
      )}
    </div>
  );
}

export default DataHealthPanel;
