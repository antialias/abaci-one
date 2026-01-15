"use client";

import { css } from "../../../../../../styled-system/css";
import type { ModelType } from "../wizard/types";
import type { SyncStatus, SyncProgress } from "./types";
import { SyncHistoryIndicator } from "../SyncHistoryIndicator";

export interface DataPanelHeaderProps {
  /** Model type */
  modelType: ModelType;
  /** Total item count */
  totalCount: number;
  /** Data quality label */
  dataQuality: string;
  /** Sync status (optional) */
  syncStatus?: SyncStatus | null;
  /** Sync progress (optional) */
  syncProgress?: SyncProgress;
  /** Handler to start sync */
  onStartSync?: () => void;
  /** Handler to cancel sync */
  onCancelSync?: () => void;
  /** Trigger for sync history refresh */
  syncHistoryRefreshTrigger?: number;
}

const MODEL_CONFIG = {
  "boundary-detector": {
    icon: "🎯",
    title: "Boundary Training Data",
    itemLabel: "frames",
  },
  "column-classifier": {
    icon: "🔢",
    title: "Column Classifier Data",
    itemLabel: "images",
  },
} as const;

/**
 * Shared header component for data panels.
 * Shows model info, count, quality, and optional sync controls.
 */
export function DataPanelHeader({
  modelType,
  totalCount,
  dataQuality,
  syncStatus,
  syncProgress,
  onStartSync,
  onCancelSync,
  syncHistoryRefreshTrigger = 0,
}: DataPanelHeaderProps) {
  const config = MODEL_CONFIG[modelType];
  const isSyncing =
    syncProgress?.phase === "connecting" || syncProgress?.phase === "syncing";
  const hasNewOnRemote = (syncStatus?.newOnRemote ?? 0) > 0;

  return (
    <div
      data-element="data-panel-header"
      className={css({
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: { base: 3, lg: 5 },
        py: 3,
        borderBottom: "1px solid",
        borderColor: "gray.800",
        bg: "gray.850",
      })}
    >
      {/* Title group */}
      <div
        data-element="header-title-group"
        className={css({ display: "flex", alignItems: "center", gap: 3 })}
      >
        <span data-element="header-icon" className={css({ fontSize: "xl" })}>
          {config.icon}
        </span>
        <div data-element="header-text">
          <h2
            data-element="header-title"
            className={css({
              fontSize: "lg",
              fontWeight: "bold",
              color: "gray.100",
            })}
          >
            {config.title}
          </h2>
          <div
            data-element="header-subtitle"
            className={css({ fontSize: "sm", color: "gray.500" })}
          >
            {totalCount.toLocaleString()} {config.itemLabel} • {dataQuality}{" "}
            quality
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        data-element="header-actions"
        className={css({ display: "flex", alignItems: "center", gap: 3 })}
      >
        {/* Sync history indicator */}
        {syncStatus?.available && (
          <SyncHistoryIndicator
            modelType={modelType}
            refreshTrigger={syncHistoryRefreshTrigger}
          />
        )}

        {/* Sync button */}
        {syncStatus?.available && onStartSync && onCancelSync && (
          <button
            type="button"
            data-action="sync"
            data-status={
              isSyncing ? "syncing" : hasNewOnRemote ? "has-new" : "in-sync"
            }
            onClick={isSyncing ? onCancelSync : onStartSync}
            disabled={!hasNewOnRemote && !isSyncing}
            className={css({
              display: "flex",
              alignItems: "center",
              gap: 2,
              px: 3,
              py: 2,
              bg: isSyncing
                ? "blue.800"
                : hasNewOnRemote
                  ? "blue.600"
                  : "gray.700",
              color: hasNewOnRemote || isSyncing ? "white" : "gray.500",
              borderRadius: "lg",
              border: "none",
              cursor: hasNewOnRemote || isSyncing ? "pointer" : "not-allowed",
              fontSize: "sm",
              fontWeight: "medium",
              _hover: hasNewOnRemote ? { bg: "blue.500" } : {},
            })}
          >
            {isSyncing ? (
              <>
                <span
                  className={css({
                    animation: "spin 1s linear infinite",
                  })}
                >
                  🔄
                </span>
                <span
                  className={css({
                    display: { base: "none", md: "inline" },
                  })}
                >
                  {syncProgress?.message}
                </span>
              </>
            ) : hasNewOnRemote ? (
              <>
                <span>☁️</span>
                <span
                  className={css({
                    display: { base: "none", md: "inline" },
                  })}
                >
                  Sync {syncStatus.newOnRemote} new
                </span>
              </>
            ) : (
              <>
                <span>✓</span>
                <span
                  className={css({
                    display: { base: "none", md: "inline" },
                  })}
                >
                  In sync
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
