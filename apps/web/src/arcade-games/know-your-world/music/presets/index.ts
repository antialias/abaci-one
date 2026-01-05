/**
 * Music Presets Module
 *
 * Exports continental presets, region mapping, and hyper-local hints.
 */

export {
  continentalPresets,
  getPreset,
  getPresetIds,
  type ContinentalPreset,
} from './continental'
export { getPresetForRegion, getPresetIdForRegion } from './regionMapping'
export {
  worldHints,
  usaHints,
  getHintForRegion,
  hasHintForRegion,
  type RegionMusicHint,
} from './hyperLocal'
