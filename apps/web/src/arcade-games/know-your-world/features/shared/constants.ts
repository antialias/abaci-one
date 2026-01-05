/**
 * Shared constants for Know Your World feature modules
 *
 * Centralizes magic numbers and configuration values that
 * are used across multiple features.
 */

import type { SafeZoneMargins } from "./types";

// ============================================================================
// Precision Mode Constants
// ============================================================================

/**
 * Screen pixel ratio threshold that triggers precision mode recommendation.
 * When the magnifier shows ≥20 screen pixels per map pixel, precision mode
 * becomes necessary for accurate selection.
 */
export const PRECISION_MODE_THRESHOLD = 20;

// ============================================================================
// Zoom Constants
// ============================================================================

/**
 * Maximum zoom level for the magnifier.
 * Allows zooming in on tiny regions like Gibraltar (0.08px).
 */
export const MAX_ZOOM = 1000;

/**
 * Zoom level above which the magnifier shows gold styling.
 * Indicates high magnification where precision may be needed.
 */
export const HIGH_ZOOM_THRESHOLD = 100;

/**
 * Minimum zoom level (1:1 with map)
 */
export const MIN_ZOOM = 1;

// ============================================================================
// Safe Zone Constants
// ============================================================================

/**
 * Safe zone margins - areas reserved for floating UI elements.
 * These define where findable regions should remain visible.
 */
export const SAFE_ZONE_MARGINS: SafeZoneMargins = {
  /** Space for nav (~150px) + floating prompt (~140px with name input + controls row) */
  top: 290,
  /** Controls now in floating prompt, no right margin needed */
  right: 0,
  /** Error banner can overlap map */
  bottom: 0,
  /** Progress at top-left is small, doesn't need full-height margin */
  left: 0,
};

/**
 * Navigation bar height offset for button positioning
 */
export const NAV_HEIGHT_OFFSET = 150;

// ============================================================================
// Animation Constants
// ============================================================================

/**
 * Duration in ms for laser effect after all letters confirmed
 */
export const LASER_EFFECT_DURATION = 750;

/**
 * Duration in ms for name attention animation
 */
export const NAME_ATTENTION_DURATION = 3000;

/**
 * Auto-exit expanded magnifier when zoom drops below this threshold
 */
export const AUTO_EXIT_ZOOM_THRESHOLD = 1.5;

// ============================================================================
// Detection Constants
// ============================================================================

/**
 * Detection box size in pixels for region hit testing
 */
export const DETECTION_BOX_SIZE = 50;

/**
 * Threshold distance for dismissing magnifier after drag
 */
export const DRAG_DISMISS_THRESHOLD = 20;

// ============================================================================
// Debug Flags
// ============================================================================

/**
 * Show technical info in magnifier (gated by isVisualDebugEnabled at runtime)
 */
export const SHOW_MAGNIFIER_DEBUG_INFO = true;

/**
 * Show bounding boxes with importance scores (gated by isVisualDebugEnabled)
 */
export const SHOW_DEBUG_BOUNDING_BOXES = true;

/**
 * Show safe zone rectangles (gated by isVisualDebugEnabled)
 */
export const SHOW_SAFE_ZONE_DEBUG = true;
