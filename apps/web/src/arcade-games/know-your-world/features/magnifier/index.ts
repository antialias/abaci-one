/**
 * Magnifier Feature Module
 *
 * This module handles magnifier-related functionality for the Know Your World game:
 * - Magnifier crosshair visualization
 * - Pixel grid for precision mode feedback
 * - Dimension calculations
 * - Zoom state management
 * - Touch interactions (pan, pinch-to-zoom)
 * - State management (visibility, expansion)
 *
 * ## Usage
 *
 * ```tsx
 * import {
 *   useMagnifierState,
 *   useMagnifierTouch,
 *   useMagnifierZoom,
 *   MagnifierCrosshair,
 *   MagnifierPixelGrid,
 * } from '../features/magnifier'
 *
 * function MapRenderer() {
 *   const magnifier = useMagnifierState()
 *   const zoom = useMagnifierZoom({ ... })
 *   const touch = useMagnifierTouch({
 *     magnifierState: magnifier,
 *     getCurrentZoom: zoom.getCurrentZoom,
 *     setZoom: zoom.setTargetZoom,
 *     ...
 *   })
 *
 *   return (
 *     <div {...touch.handlers}>
 *       <MagnifierCrosshair ... />
 *       <MagnifierPixelGrid ... />
 *     </div>
 *   )
 * }
 * ```
 */

// ============================================================================
// State Management Hooks
// ============================================================================

export type {
  UseMagnifierStateOptions,
  UseMagnifierStateReturn,
} from './useMagnifierState'
export { useMagnifierState } from './useMagnifierState'
export type {
  MagnifierStyleInputs,
  MagnifierStyleResult,
} from './useMagnifierStyle'
export { useMagnifierStyle } from './useMagnifierStyle'
export type {
  PanInfo,
  PinchInfo,
  TapInfo,
  TouchPosition,
  UseMagnifierTouchOptions,
  UseMagnifierTouchReturn,
} from './useMagnifierTouch'
export { useMagnifierTouch } from './useMagnifierTouch'

// ============================================================================
// Components
// ============================================================================

export type { MagnifierControlsProps } from './MagnifierControls'
export { MagnifierControls } from './MagnifierControls'
export type { MagnifierCrosshairProps } from './MagnifierCrosshair'
export { MagnifierCrosshair } from './MagnifierCrosshair'
export type { MagnifierPixelGridProps } from './MagnifierPixelGrid'
export { MagnifierPixelGrid } from './MagnifierPixelGrid'
export type {
  FlashProgress,
  MagnifierRegionsProps,
  MapRegion,
  RegionState,
} from './MagnifierRegions'
export { MagnifierRegions } from './MagnifierRegions'

// ============================================================================
// Context
// ============================================================================

export type {
  MagnifierContextValue,
  MagnifierProviderProps,
} from './MagnifierContext'
export {
  MagnifierProvider,
  useMagnifierContext,
  useMagnifierContextSafe,
} from './MagnifierContext'

// ============================================================================
// Types
// ============================================================================

export type {
  CrosshairStyle,
  DebugBoundingBox,
  HeatColors,
  // MagnifierRegionsProps is exported from MagnifierRegions.tsx with improved structure
  ViewportInfo,
} from './types'

// ============================================================================
// Panning Math Utilities
// ============================================================================

export type {
  MagnifierInfo,
  RenderedViewport,
  TouchMultiplierResult,
  ViewportInfo as PanningViewportInfo,
} from './panningMath'
export {
  applyPanDelta,
  calculateMagnifierScale,
  calculateTouchMultiplier,
  calculateViewportScale,
  clampToSvgBounds,
  cursorToSvgCoordinates,
  parseViewBoxDimensions,
} from './panningMath'

// ============================================================================
// Re-exports from Original Locations
// ============================================================================

export type {
  UseMagnifierZoomOptions,
  UseMagnifierZoomReturn,
} from '../../hooks/useMagnifierZoom'

// Zoom hook (will eventually move into this module)
export { useMagnifierZoom } from '../../hooks/useMagnifierZoom'
// Utilities (backward compatibility)
export {
  getAdjustedMagnifiedDimensions,
  getMagnifierDimensions,
  MAGNIFIER_SIZE_LARGE,
  MAGNIFIER_SIZE_SMALL,
} from '../../utils/magnifierDimensions'
