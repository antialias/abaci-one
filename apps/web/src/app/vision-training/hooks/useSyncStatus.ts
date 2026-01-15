"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelType } from "../train/components/wizard/types";
import type {
  SyncStatus,
  SyncProgress,
} from "../train/components/data-panel/types";

/**
 * Sync history entry from the API
 */
export interface SyncHistoryEntry {
  id: string;
  status: "success" | "failed" | "cancelled";
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  filesTransferred: number;
  tombstonePruned: number | null;
  error: string | null;
}

/**
 * History stats from the API
 */
export interface SyncHistoryStats {
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
  lastSuccessfulSync: {
    id: string;
    startedAt: string;
    filesTransferred: number;
  } | null;
}

/**
 * Result of the useSyncStatus hook
 */
export interface UseSyncStatusResult {
  // Status
  status: SyncStatus | null;
  isLoading: boolean;
  isAvailable: boolean;
  hasNewData: boolean;
  newCount: number;

  // Progress (during sync)
  progress: SyncProgress;
  isSyncing: boolean;

  // History
  history: SyncHistoryEntry[];
  historyStats: SyncHistoryStats | null;
  historyLoading: boolean;

  // Actions
  startSync: () => Promise<void>;
  cancelSync: () => void;
  refreshStatus: () => Promise<void>;
  refreshHistory: () => Promise<void>;
}

// BroadcastChannel for notifying other components when sync completes
export const SYNC_COMPLETE_CHANNEL = "vision-training-sync-complete";

/**
 * Centralized hook for sync state management.
 * Handles status fetching, sync progress, and history.
 */
export function useSyncStatus(modelType: ModelType): UseSyncStatusResult {
  // Status state
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Progress state
  const [progress, setProgress] = useState<SyncProgress>({
    phase: "idle",
    message: "",
  });

  // History state
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [historyStats, setHistoryStats] = useState<SyncHistoryStats | null>(
    null,
  );
  const [historyLoading, setHistoryLoading] = useState(true);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const syncChannelRef = useRef<BroadcastChannel | null>(null);

  // Derived state
  const isAvailable = status?.available ?? false;
  const hasNewData = (status?.newOnRemote ?? 0) > 0;
  const newCount = status?.newOnRemote ?? 0;
  const isSyncing =
    progress.phase === "connecting" || progress.phase === "syncing";

  // Initialize BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel !== "undefined") {
      syncChannelRef.current = new BroadcastChannel(SYNC_COMPLETE_CHANNEL);
    }
    return () => {
      syncChannelRef.current?.close();
    };
  }, []);

  // Fetch sync status
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/vision-training/sync?modelType=${modelType}`,
      );
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error("[useSyncStatus] Failed to fetch status:", error);
    } finally {
      setIsLoading(false);
    }
  }, [modelType]);

  // Fetch sync history
  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch(
        `/api/vision-training/sync/history?modelType=${modelType}&limit=5`,
      );
      if (response.ok) {
        const data = await response.json();
        setHistory(data.history || []);
        setHistoryStats(data.stats || null);
      }
    } catch (error) {
      console.error("[useSyncStatus] Failed to fetch history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [modelType]);

  // Start sync
  const startSync = useCallback(async () => {
    setProgress({
      phase: "connecting",
      message: "Connecting to production...",
    });

    try {
      const response = await fetch(
        `/api/vision-training/sync?modelType=${modelType}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        const error = await response.text();
        setProgress({ phase: "error", message: error || "Sync failed" });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setProgress({ phase: "error", message: "No response body" });
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7);
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSyncEvent(eventType, data);
            } catch {
              // Ignore JSON parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("[useSyncStatus] Sync error:", error);
      setProgress({
        phase: "error",
        message: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }, [modelType]);

  // Handle SSE events during sync
  const handleSyncEvent = useCallback(
    (eventType: string, data: Record<string, unknown>) => {
      switch (eventType) {
        case "status":
          setProgress({
            phase: (data.phase as SyncProgress["phase"]) || "syncing",
            message: (data.message as string) || "",
          });
          break;

        case "progress":
          setProgress((prev) => ({
            ...prev,
            phase: "syncing",
            message: (data.message as string) || prev.message,
            filesTransferred: data.filesTransferred as number | undefined,
            bytesTransferred: data.bytesTransferred as number | undefined,
          }));
          break;

        case "complete":
          setProgress({
            phase: "complete",
            message: "Sync complete!",
            filesTransferred: data.filesTransferred as number | undefined,
          });

          // Broadcast sync complete to other components
          syncChannelRef.current?.postMessage({
            type: "sync-complete",
            modelType,
          });

          // Refresh status and history after completion
          setTimeout(() => {
            refreshStatus();
            refreshHistory();
            // Reset progress after a short delay
            setTimeout(() => {
              setProgress({ phase: "idle", message: "" });
            }, 2000);
          }, 500);
          break;

        case "error":
          setProgress({
            phase: "error",
            message: (data.message as string) || "Sync failed",
          });

          // Refresh history to show failed sync
          setTimeout(() => {
            refreshHistory();
          }, 500);
          break;
      }
    },
    [modelType, refreshStatus, refreshHistory],
  );

  // Cancel sync (abort controller)
  const cancelSync = useCallback(() => {
    abortControllerRef.current?.abort();
    setProgress({ phase: "idle", message: "" });
  }, []);

  // Fetch status and history on mount and when modelType changes
  useEffect(() => {
    setIsLoading(true);
    setHistoryLoading(true);
    setProgress({ phase: "idle", message: "" });

    refreshStatus();
    refreshHistory();
  }, [refreshStatus, refreshHistory]);

  // Optional: Poll for status updates (e.g., when tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isSyncing) {
        refreshStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [refreshStatus, isSyncing]);

  return {
    // Status
    status,
    isLoading,
    isAvailable,
    hasNewData,
    newCount,

    // Progress
    progress,
    isSyncing,

    // History
    history,
    historyStats,
    historyLoading,

    // Actions
    startSync,
    cancelSync,
    refreshStatus,
    refreshHistory,
  };
}
