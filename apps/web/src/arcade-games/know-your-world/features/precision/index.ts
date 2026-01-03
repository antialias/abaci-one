/**
 * Precision Mode Feature Module
 *
 * Provides precision mode functionality for fine-grained cursor control
 * at high magnification levels. When the screen pixel ratio exceeds a
 * threshold, precision mode allows the user to click and activate
 * pointer lock for accurate region selection.
 *
 * ## Key Concepts
 *
 * - **Screen Pixel Ratio**: How many screen pixels the magnifier "jumps"
 *   when the mouse moves one pixel on the main map. High ratios make
 *   selection difficult without precision mode.
 *
 * - **Threshold**: When screen pixel ratio >= 20, precision mode is
 *   recommended. The magnifier shows a gold scrim and "Click to activate
 *   precision mode" message.
 *
 * - **Pointer Lock**: Browser API that hides the cursor and captures
 *   relative mouse movements. This allows the cursor position to be
 *   interpolated for smooth, precise control.
 *
 * ## Usage
 *
 * ```tsx
 * import {
 *   usePrecisionMode,
 *   PrecisionModeScrim,
 *   getPrecisionModeFilter,
 * } from '../features/precision'
 *
 * function MagnifierOverlay() {
 *   const precision = usePrecisionMode({
 *     containerRef,
 *     svgRef,
 *     viewBox,
 *     currentZoom,
 *   })
 *
 *   return (
 *     <div
 *       style={{ filter: getPrecisionModeFilter(precision) }}
 *       onClick={precision.requestPrecisionMode}
 *     >
 *       <MapContent />
 *       <PrecisionModeScrim
 *         show={precision.isAtThreshold && !precision.pointerLocked}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */

// Types
export type {
  PrecisionModeFilterProps,
  PrecisionModeScrimProps,
  PrecisionModeStatusLabelOptions,
} from "./PrecisionModeIndicator";
// Components
// Utilities
export {
  getPrecisionModeFilter,
  getPrecisionModeStatusLabel,
  PrecisionModeScrim,
} from "./PrecisionModeIndicator";
export type {
  PrecisionModeIndicatorProps,
  ThresholdStatus,
  UsePrecisionModeOptions,
  UsePrecisionModeReturn,
} from "./types";
export {
  type UsePrecisionCalculationsOptions,
  type UsePrecisionCalculationsReturn,
  usePrecisionCalculations,
} from "./usePrecisionCalculations";
// Hooks
export { usePrecisionMode } from "./usePrecisionMode";
