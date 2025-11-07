export { default as AbacusReact } from "./AbacusReact";
export type {
  AbacusConfig,
  BeadConfig,
  AbacusDimensions,
  AbacusCustomStyles,
  BeadStyle,
  ColumnPostStyle,
  ReckoningBarStyle,
  NumeralStyle,
  ValidPlaceValues,
  BeadHighlight,
  StepBeadHighlight,
  BeadClickEvent,
  AbacusCallbacks,
  AbacusOverlay,
} from "./AbacusReact";

export {
  useAbacusConfig,
  useAbacusDisplay,
  getDefaultAbacusConfig,
  AbacusDisplayProvider,
} from "./AbacusContext";
export type {
  ColorScheme,
  BeadShape,
  ColorPalette,
  AbacusDisplayConfig,
  AbacusDisplayContextType,
} from "./AbacusContext";

export { StandaloneBead } from "./StandaloneBead";
export type { StandaloneBeadProps } from "./StandaloneBead";

export { AbacusStatic } from "./AbacusStatic";
export type { AbacusStaticConfig } from "./AbacusStatic";

export { ABACUS_THEMES } from "./AbacusThemes";
export type { AbacusThemeName } from "./AbacusThemes";

export {
  numberToAbacusState,
  abacusStateToNumber,
  calculateBeadChanges,
  calculateBeadDiff,
  calculateBeadDiffFromValues,
  validateAbacusValue,
  areStatesEqual,
  calculateAbacusDimensions,
  calculateStandardDimensions, // NEW: Shared layout calculator
  calculateBeadPosition, // NEW: Bead position calculator
  calculateBeadDimensions, // NEW: Calculate exact bead dimensions by shape
  calculateActiveBeadsBounds, // NEW: Calculate bounding box for active beads
  calculateAbacusCrop, // NEW: Calculate crop parameters with padding
} from "./AbacusUtils";
export type {
  BeadState,
  AbacusState,
  BeadDiffResult,
  BeadDiffOutput,
  PlaceValueBasedBead,
  AbacusLayoutDimensions, // NEW: Complete layout dimensions type
  BeadPositionConfig, // NEW: Bead config for position calculation
  CropPadding, // NEW: Padding config for cropping
  BoundingBox, // NEW: Bounding box type
  CropResult, // NEW: Complete crop calculation result
} from "./AbacusUtils";

export { useAbacusDiff, useAbacusState } from "./AbacusHooks";
