/**
 * Music Module for Know Your World
 *
 * Provides ambient background music using Strudel.
 */

export { useMusicEngine, type MusicEngine } from "./useMusicEngine";
export { MusicProvider, useMusic, useMusicOptional } from "./MusicContext";
export { MusicControls } from "./MusicControls";
export { MusicControlPanel } from "./MusicControlPanel";
export { MusicControlModal } from "./MusicControlModal";
export {
  continentalPresets,
  getPreset,
  getPresetIds,
  getPresetForRegion,
  getPresetIdForRegion,
  getHintForRegion,
  hasHintForRegion,
  type ContinentalPreset,
  type RegionMusicHint,
} from "./presets";
