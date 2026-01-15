"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalibrationGrid, StoredCalibration } from "@/types/vision";
import { CALIBRATION_STORAGE_KEY } from "@/types/vision";

export interface UseCameraCalibrationReturn {
  /** Whether a valid calibration exists */
  isCalibrated: boolean;
  /** Current calibration grid */
  calibration: CalibrationGrid | null;
  /** Whether currently in calibration mode */
  isCalibrating: boolean;

  /** Start interactive calibration mode */
  startCalibration: () => void;
  /** Update calibration during drag */
  updateCalibration: (partial: Partial<CalibrationGrid>) => void;
  /** Finish and save calibration */
  finishCalibration: () => void;
  /** Cancel calibration without saving */
  cancelCalibration: () => void;
  /** Reset/clear saved calibration */
  resetCalibration: () => void;
  /** Load calibration from localStorage */
  loadCalibration: (deviceId?: string) => CalibrationGrid | null;
  /** Create default calibration for given dimensions */
  createDefaultCalibration: (
    videoWidth: number,
    videoHeight: number,
    columnCount: number,
  ) => CalibrationGrid;
  /** Set the current device ID for saving calibration */
  setDeviceId: (deviceId: string) => void;
}

/**
 * Hook for managing camera calibration with localStorage persistence
 */
export function useCameraCalibration(): UseCameraCalibrationReturn {
  const [calibration, setCalibration] = useState<CalibrationGrid | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  const isCalibrated = calibration !== null;

  /**
   * Create a default calibration grid centered in the video
   */
  const createDefaultCalibration = useCallback(
    (
      videoWidth: number,
      videoHeight: number,
      columnCount: number,
    ): CalibrationGrid => {
      // Default to center 60% of video
      const roiWidth = videoWidth * 0.6;
      const roiHeight = videoHeight * 0.7;
      const roiX = (videoWidth - roiWidth) / 2;
      const roiY = (videoHeight - roiHeight) / 2;

      // Create evenly-spaced column dividers
      const columnDividers: number[] = [];
      for (let i = 1; i < columnCount; i++) {
        columnDividers.push(i / columnCount);
      }

      return {
        roi: {
          x: roiX,
          y: roiY,
          width: roiWidth,
          height: roiHeight,
        },
        columnCount,
        columnDividers,
        rotation: 0,
      };
    },
    [],
  );

  /**
   * Load calibration from localStorage for a specific device
   */
  const loadCalibration = useCallback(
    (deviceId?: string): CalibrationGrid | null => {
      try {
        const stored = localStorage.getItem(CALIBRATION_STORAGE_KEY);
        if (!stored) return null;

        const data = JSON.parse(stored) as StoredCalibration;
        if (data.version !== 1) return null;

        // If deviceId specified, only use if it matches
        if (deviceId && data.deviceId !== deviceId) {
          return null;
        }

        return data.grid;
      } catch {
        return null;
      }
    },
    [],
  );

  /**
   * Save calibration to localStorage
   */
  const saveCalibration = useCallback(
    (grid: CalibrationGrid, deviceId: string) => {
      const stored: StoredCalibration = {
        version: 1,
        grid,
        createdAt: new Date().toISOString(),
        deviceId,
      };
      localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(stored));
    },
    [],
  );

  /**
   * Start calibration mode
   */
  const startCalibration = useCallback(() => {
    setIsCalibrating(true);
  }, []);

  /**
   * Update calibration during interactive adjustment
   * Can also set a complete new calibration if none exists
   */
  const updateCalibration = useCallback((partial: Partial<CalibrationGrid>) => {
    setCalibration((prev) => {
      // If we have a complete grid (has all required fields), use it directly
      if (
        "roi" in partial &&
        "columnCount" in partial &&
        "columnDividers" in partial
      ) {
        return partial as CalibrationGrid;
      }
      // Otherwise merge with existing
      if (!prev) return prev;
      return { ...prev, ...partial };
    });
  }, []);

  /**
   * Finish calibration and save
   */
  const finishCalibration = useCallback(() => {
    if (calibration && currentDeviceId) {
      saveCalibration(calibration, currentDeviceId);
    }
    setIsCalibrating(false);
  }, [calibration, currentDeviceId, saveCalibration]);

  /**
   * Cancel calibration without saving
   */
  const cancelCalibration = useCallback(() => {
    // Reload saved calibration
    const saved = loadCalibration(currentDeviceId ?? undefined);
    setCalibration(saved);
    setIsCalibrating(false);
  }, [currentDeviceId, loadCalibration]);

  /**
   * Reset/clear saved calibration
   */
  const resetCalibration = useCallback(() => {
    localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    setCalibration(null);
    setIsCalibrating(false);
  }, []);

  /**
   * Initialize calibration with device ID and optionally load from storage
   */
  const initializeCalibration = useCallback(
    (
      deviceId: string,
      videoWidth: number,
      videoHeight: number,
      columnCount: number,
    ) => {
      setCurrentDeviceId(deviceId);

      // Try to load saved calibration
      const saved = loadCalibration(deviceId);
      if (saved) {
        setCalibration(saved);
      } else {
        // Create default calibration
        setCalibration(
          createDefaultCalibration(videoWidth, videoHeight, columnCount),
        );
      }
    },
    [loadCalibration, createDefaultCalibration],
  );

  /**
   * Set the device ID for saving calibration
   */
  const setDeviceId = useCallback((deviceId: string) => {
    setCurrentDeviceId(deviceId);
  }, []);

  return {
    isCalibrated,
    calibration,
    isCalibrating,
    startCalibration,
    updateCalibration,
    finishCalibration,
    cancelCalibration,
    resetCalibration,
    loadCalibration,
    createDefaultCalibration,
    setDeviceId,
  };
}
