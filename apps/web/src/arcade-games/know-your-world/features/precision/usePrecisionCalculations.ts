/**
 * Precision Calculations Hook
 *
 * Pure calculation hook for precision mode threshold detection.
 * Unlike usePrecisionMode, this hook does NOT manage pointer lock state -
 * it receives pointerLocked as an input, avoiding circular dependencies.
 *
 * Dependency flow (no cycles):
 * ```
 * useCanUsePrecisionMode() → canUsePrecisionMode
 *          ↓
 * usePointerLock({ canUsePrecisionMode }) → pointerLocked
 *          ↓
 * useMagnifierZoom({ pointerLocked }) → currentZoom
 *          ↓
 * usePrecisionCalculations({ currentZoom, pointerLocked }) → isAtThreshold, shouldCapZoom
 * ```
 */

"use client";

import type { RefObject } from "react";
import { useMemo } from "react";

import { useCanUsePrecisionMode } from "../../hooks/useDeviceCapabilities";
import {
  calculateMaxZoomAtThreshold,
  calculateScreenPixelRatio,
  isAboveThreshold,
} from "../../utils/screenPixelRatio";
import { PRECISION_MODE_THRESHOLD } from "../shared/constants";
import { parseViewBox } from "../shared/viewportUtils";

// ============================================================================
// Types
// ============================================================================

export interface UsePrecisionCalculationsOptions {
  /** Container element ref for dimension calculations */
  containerRef: RefObject<HTMLDivElement | null>;
  /** SVG element ref for viewport calculations */
  svgRef: RefObject<SVGSVGElement | null>;
  /** SVG viewBox string */
  viewBox: string;
  /** Current zoom level (from useMagnifierZoom) */
  currentZoom: number;
  /** Whether pointer lock is active (from usePointerLock) */
  pointerLocked: boolean;
}

export interface UsePrecisionCalculationsReturn {
  /** Whether device supports precision mode (pointer lock + fine pointer) */
  canUsePrecisionMode: boolean;
  /** Whether current zoom is at or above threshold (precision recommended) */
  isAtThreshold: boolean;
  /** Current screen pixel ratio */
  screenPixelRatio: number;
  /** Whether zoom should be capped (at threshold but not in precision mode) */
  shouldCapZoom: boolean;
  /** Maximum zoom level that keeps screen pixel ratio at threshold */
  maxZoomAtThreshold: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Default magnifier width as fraction of container */
const MAGNIFIER_WIDTH_FRACTION = 0.5;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for precision mode threshold calculations.
 *
 * This is a pure calculation hook - it receives state as inputs and
 * computes derived values. It does not manage pointer lock state.
 *
 * Use this hook AFTER usePointerLock and useMagnifierZoom in your
 * component to get threshold status and capping decisions.
 *
 * @param options - Configuration options
 * @returns Precision calculation results
 *
 * @example
 * ```tsx
 * // In MapRenderer, after existing hooks:
 * const { pointerLocked } = usePointerLock({ containerRef, canUsePrecisionMode })
 * const { targetZoom, getCurrentZoom } = useMagnifierZoom({ pointerLocked, ... })
 *
 * const precision = usePrecisionCalculations({
 *   containerRef,
 *   svgRef,
 *   viewBox: mapData.viewBox,
 *   currentZoom: getCurrentZoom(),
 *   pointerLocked,
 * })
 *
 * // Use precision.isAtThreshold for UI indicators
 * // Use precision.shouldCapZoom for zoom limiting decisions
 * ```
 */
export function usePrecisionCalculations(
  options: UsePrecisionCalculationsOptions,
): UsePrecisionCalculationsReturn {
  const { containerRef, svgRef, viewBox, currentZoom, pointerLocked } = options;

  // -------------------------------------------------------------------------
  // Device Capability Detection
  // -------------------------------------------------------------------------
  const canUsePrecisionMode = useCanUsePrecisionMode();

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
  // Return
  // -------------------------------------------------------------------------
  return {
    canUsePrecisionMode,
    isAtThreshold,
    screenPixelRatio,
    shouldCapZoom,
    maxZoomAtThreshold,
  };
}
