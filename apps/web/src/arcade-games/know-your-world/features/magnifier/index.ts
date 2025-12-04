/**
 * Magnifier Feature Module
 *
 * This module handles magnifier-related functionality for the Know Your World game:
 * - Magnifier crosshair visualization
 * - Pixel grid for precision mode feedback
 * - Dimension calculations
 * - Zoom state management
 * - Touch interactions (pan, pinch-to-zoom)
 *
 * ## State Management
 *
 * Magnifier display state (visibility, opacity, expansion) is now managed by the
 * interaction state machine in `features/interaction/useInteractionStateMachine.ts`.
 * Child components can access this state via `MagnifierContext.interaction`.
 *
 * ## Usage
 *
 * ```tsx
 * import {
 *   useMagnifierTouchHandlers,
 *   useMagnifierZoom,
 *   MagnifierCrosshair,
 *   MagnifierPixelGrid,
 *   MagnifierProvider,
 * } from '../features/magnifier'
 *
 * function MapRenderer() {
 *   const interaction = useInteractionStateMachine()
 *   const zoom = useMagnifierZoom({ ... })
 *
 *   // Magnifier visibility and state from state machine
 *   const showMagnifier = interaction.showMagnifier
 *   const magnifierOpacity = interaction.magnifierOpacity
 *
 *   return (
 *     <MagnifierProvider value={magnifierContextValue}>
 *       <MagnifierOverlayWithHandlers ... />
 *     </MagnifierProvider>
 *   )
 * }
 * ```
 */

// ============================================================================
// State Management Hooks
// ============================================================================

export type {
  EmpiricalScaleResult,
  UseEmpiricalScaleReturn,
} from './useEmpiricalScale'
export { useEmpiricalScale } from './useEmpiricalScale'
// Note: useMagnifierState has been removed - magnifier state is now managed by
// the interaction state machine in features/interaction/useInteractionStateMachine.ts
export type {
  MagnifierStyleInputs,
  MagnifierStyleResult,
} from './useMagnifierStyle'
export { useMagnifierStyle } from './useMagnifierStyle'
export type {
  UseMagnifierTouchHandlersOptions,
  UseMagnifierTouchHandlersReturn,
} from './useMagnifierTouchHandlers'
export { useMagnifierTouchHandlers } from './useMagnifierTouchHandlers'

// ============================================================================
// Components
// ============================================================================

export type { MagnifierControlsProps } from './MagnifierControls'
export { MagnifierControls } from './MagnifierControls'
export type { MagnifierCrosshairProps } from './MagnifierCrosshair'
export { MagnifierCrosshair } from './MagnifierCrosshair'
export type { MagnifierOverlayProps } from './MagnifierOverlay'
export { MagnifierOverlay } from './MagnifierOverlay'
export type { MagnifierOverlayWithHandlersProps } from './MagnifierOverlayWithHandlers'
export { MagnifierOverlayWithHandlers } from './MagnifierOverlayWithHandlers'
export type { MagnifierPixelGridProps } from './MagnifierPixelGrid'
export { MagnifierPixelGrid } from './MagnifierPixelGrid'
export type {
  FlashProgress,
  MagnifierRegionsProps,
  MapRegion,
  RegionState,
} from './MagnifierRegions'
export { MagnifierRegions } from './MagnifierRegions'
export type { ZoomLinesOverlayProps } from './ZoomLinesOverlay'
export { ZoomLinesOverlay } from './ZoomLinesOverlay'

// ============================================================================
// Context
// ============================================================================

export type {
  MagnifierContextValue,
  MagnifierProviderProps,
  MagnifierSpring,
  ParsedViewBox,
  PrecisionCalculations,
  SafeZoneMargins,
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
