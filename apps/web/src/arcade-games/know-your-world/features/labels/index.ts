/**
 * Labels feature module
 *
 * This module handles all label-related functionality for the Know Your World game:
 * - D3 force simulation for label positioning
 * - Label rendering (regular and small region labels with arrows)
 * - Cursor proximity fading
 * - Viewport calculations for SVG coordinate conversion
 */

// Components
export { LabelLayer } from './LabelLayer'
export type { LabelLayerProps } from './LabelLayer'

// Hooks
export { useD3ForceLabels } from './useD3ForceLabels'
export type {
  GuessHistoryItem,
  UseD3ForceLabelsParams,
  UseD3ForceLabelsReturn,
} from './useD3ForceLabels'

// Utilities
export {
  calculateLabelOpacity,
  getArrowStartPoint,
  getRenderedViewport,
  LABEL_FADE_RADIUS,
  LABEL_MIN_OPACITY,
} from './labelUtils'

// Types
export type {
  ForceTuningConfig,
  PlayerMetadata,
  RegionLabelPosition,
  RenderedViewport,
  SmallRegionLabelPosition,
} from './types'
