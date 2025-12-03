/**
 * Shared feature module
 *
 * Provides common types, constants, utilities, and context
 * used across Know Your World feature modules.
 */

// Types
export type {
  CrosshairStyle,
  CursorPosition,
  Dimensions,
  FlashProgress,
  GameStateSlice,
  HeatColors,
  HotColdFeedbackType,
  MapRegion,
  PlayerMetadata,
  RegionWithBounds,
  SafeZoneMargins,
  SharedRefs,
  SVGBoundingBox,
  SVGPosition,
  ViewBoxComponents,
  ViewportInfo,
} from './types'

// Constants
export {
  AUTO_EXIT_ZOOM_THRESHOLD,
  DETECTION_BOX_SIZE,
  DRAG_DISMISS_THRESHOLD,
  HIGH_ZOOM_THRESHOLD,
  LASER_EFFECT_DURATION,
  MAX_ZOOM,
  MIN_ZOOM,
  NAME_ATTENTION_DURATION,
  NAV_HEIGHT_OFFSET,
  PRECISION_MODE_THRESHOLD,
  SAFE_ZONE_MARGINS,
  SHOW_DEBUG_BOUNDING_BOXES,
  SHOW_MAGNIFIER_DEBUG_INFO,
  SHOW_SAFE_ZONE_DEBUG,
} from './constants'

// Viewport utilities
export {
  getLeftoverDimensions,
  getRenderedViewport,
  getViewportFromRefs,
  parseViewBox,
  screenToSVG,
  svgToScreen,
} from './viewportUtils'

// Context
export {
  MapRendererProvider,
  useMapRendererContext,
  useMapRendererContextSafe,
} from './MapRendererContext'
export type { MapRendererContextValue, MapRendererProviderProps } from './MapRendererContext'
