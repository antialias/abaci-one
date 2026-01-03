/**
 * Precision Mode Hook
 *
 * Unified hook that consolidates precision mode logic:
 * - Device capability detection
 * - Pointer lock management
 * - Threshold calculations
 * - Zoom capping decisions
 *
 * This hook combines the lower-level hooks (usePointerLock, useCanUsePrecisionMode)
 * with screen pixel ratio calculations to provide a single interface for
 * precision mode functionality.
 */

"use client";

import { useMemo, useCallback } from "react";

import { useCanUsePrecisionMode } from "../../hooks/useDeviceCapabilities";
import { usePointerLock } from "../../hooks/usePointerLock";
import {
  calculateMaxZoomAtThreshold,
  calculateScreenPixelRatio,
  isAboveThreshold,
} from "../../utils/screenPixelRatio";
import { parseViewBox } from "../shared/viewportUtils";
import { PRECISION_MODE_THRESHOLD } from "../shared/constants";

import type { UsePrecisionModeOptions, UsePrecisionModeReturn } from "./types";

// ============================================================================
// Constants
// ============================================================================

/** Default magnifier width as fraction of container */
const MAGNIFIER_WIDTH_FRACTION = 0.5;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing precision mode state and calculations.
 *
 * Precision mode is activated when the user clicks to acquire pointer lock
 * at high zoom levels. This allows fine-grained cursor control by capturing
 * relative mouse movements instead of absolute positions.
 *
 * @param options - Configuration options
 * @returns Precision mode state and controls
 *
 * @example
 * ```tsx
 * function MagnifierOverlay() {
 *   const precision = usePrecisionMode({
 *     containerRef,
 *     svgRef,
 *     viewBox: mapData.viewBox,
 *     currentZoom: zoom.current,
 *   })
 *
 *   // Use precision.shouldCapZoom to limit zoom
 *   // Use precision.isAtThreshold to show indicator
 *   // Use precision.requestPrecisionMode onClick
 * }
 * ```
 */
export function usePrecisionMode(
  options: UsePrecisionModeOptions,
): UsePrecisionModeReturn {
  const {
    containerRef,
    svgRef,
    viewBox,
    currentZoom,
    onActivate,
    onDeactivate,
  } = options;

  // -------------------------------------------------------------------------
  // Device Capability Detection
  // -------------------------------------------------------------------------
  const canUsePrecisionMode = useCanUsePrecisionMode();

  // -------------------------------------------------------------------------
  // Pointer Lock State
  // -------------------------------------------------------------------------
  const { pointerLocked, requestPointerLock, exitPointerLock } = usePointerLock(
    {
      containerRef,
      canUsePrecisionMode,
      onLockAcquired: onActivate,
      onLockReleased: onDeactivate,
    },
  );

  // -------------------------------------------------------------------------
  // Viewport Calculations
  // -------------------------------------------------------------------------
  const viewBoxComponents = useMemo(() => parseViewBox(viewBox), [viewBox]);

  // -------------------------------------------------------------------------
  // Screen Pixel Ratio Calculations
  // -------------------------------------------------------------------------
  const screenPixelRatio = useMemo(() => {
    const container = containerRef.current;
    const svg = svgRef.current;

    if (!container || !svg) {
      return 0;
    }

    const containerRect = container.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const magnifierWidth = containerRect.width * MAGNIFIER_WIDTH_FRACTION;

    return calculateScreenPixelRatio({
      magnifierWidth,
      viewBoxWidth: viewBoxComponents.width,
      svgWidth: svgRect.width,
      zoom: currentZoom,
    });
  }, [containerRef, svgRef, viewBoxComponents.width, currentZoom]);

  // -------------------------------------------------------------------------
  // Threshold Detection
  // -------------------------------------------------------------------------
  const isAtThreshold = useMemo(
    () => isAboveThreshold(screenPixelRatio, PRECISION_MODE_THRESHOLD),
    [screenPixelRatio],
  );

  // -------------------------------------------------------------------------
  // Max Zoom at Threshold
  // -------------------------------------------------------------------------
  const maxZoomAtThreshold = useMemo(() => {
    const container = containerRef.current;
    const svg = svgRef.current;

    if (!container || !svg) {
      return Infinity;
    }

    const containerRect = container.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const magnifierWidth = containerRect.width * MAGNIFIER_WIDTH_FRACTION;

    return calculateMaxZoomAtThreshold(
      PRECISION_MODE_THRESHOLD,
      magnifierWidth,
      svgRect.width,
    );
  }, [containerRef, svgRef]);

  // -------------------------------------------------------------------------
  // Zoom Capping Decision
  // -------------------------------------------------------------------------
  // Cap zoom when:
  // 1. At threshold (would exceed ratio)
  // 2. Precision mode is available (device supports it)
  // 3. Not currently in precision mode (user hasn't activated it)
  const shouldCapZoom = useMemo(
    () => isAtThreshold && canUsePrecisionMode && !pointerLocked,
    [isAtThreshold, canUsePrecisionMode, pointerLocked],
  );

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const requestPrecisionMode = useCallback(() => {
    if (canUsePrecisionMode && isAtThreshold) {
      requestPointerLock();
    }
  }, [canUsePrecisionMode, isAtThreshold, requestPointerLock]);

  const exitPrecisionMode = useCallback(() => {
    exitPointerLock();
  }, [exitPointerLock]);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
  return {
    // State
    pointerLocked,
    canUsePrecisionMode,
    isAtThreshold,
    screenPixelRatio,

    // Actions
    requestPrecisionMode,
    exitPrecisionMode,

    // For magnifier integration
    shouldCapZoom,
    maxZoomAtThreshold,
  };
}
