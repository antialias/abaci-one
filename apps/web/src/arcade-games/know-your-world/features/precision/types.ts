/**
 * Precision Mode Types
 *
 * Types for the precision mode feature, which enables fine-grained
 * cursor control when the magnifier zoom exceeds a threshold.
 */

import type { RefObject } from "react";

// ============================================================================
// Hook Options
// ============================================================================

/**
 * Options for usePrecisionMode hook
 */
export interface UsePrecisionModeOptions {
  /** Container element ref for pointer lock */
  containerRef: RefObject<HTMLDivElement>;
  /** SVG element ref for viewport calculations */
  svgRef: RefObject<SVGSVGElement>;
  /** SVG viewBox string */
  viewBox: string;
  /** Current zoom level */
  currentZoom: number;
  /** Callback when precision mode is activated */
  onActivate?: () => void;
  /** Callback when precision mode is deactivated */
  onDeactivate?: () => void;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for usePrecisionMode hook
 */
export interface UsePrecisionModeReturn {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  /** Whether pointer lock is currently active */
  pointerLocked: boolean;
  /** Whether device supports precision mode (pointer lock + fine pointer) */
  canUsePrecisionMode: boolean;
  /** Whether current zoom is at or above threshold (precision recommended) */
  isAtThreshold: boolean;
  /** Current screen pixel ratio */
  screenPixelRatio: number;

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  /** Request pointer lock to activate precision mode */
  requestPrecisionMode: () => void;
  /** Exit pointer lock to deactivate precision mode */
  exitPrecisionMode: () => void;

  // -------------------------------------------------------------------------
  // For Magnifier Integration
  // -------------------------------------------------------------------------
  /** Whether zoom should be capped (at threshold but not in precision mode) */
  shouldCapZoom: boolean;
  /** Maximum zoom level that keeps screen pixel ratio at threshold */
  maxZoomAtThreshold: number;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for PrecisionModeIndicator component
 */
export interface PrecisionModeIndicatorProps {
  /** Whether precision mode is at threshold */
  isAtThreshold: boolean;
  /** Whether precision mode is available */
  canUsePrecisionMode: boolean;
  /** Whether pointer lock is active */
  pointerLocked: boolean;
  /** Request precision mode */
  onRequestPrecisionMode: () => void;
  /** Whether to show the indicator */
  show: boolean;
  /** Optional position offset from container */
  offsetTop?: number;
}

// ============================================================================
// Threshold Status
// ============================================================================

/**
 * Precision mode threshold status for visual indicators
 */
export type ThresholdStatus =
  /** Below threshold, normal operation */
  | "normal"
  /** At threshold, precision mode recommended */
  | "at-threshold"
  /** At threshold, precision mode active */
  | "precision-active";
