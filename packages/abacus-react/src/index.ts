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
} from "./AbacusUtils";
export type {
  BeadState,
  AbacusState,
  BeadDiffResult,
  BeadDiffOutput,
  PlaceValueBasedBead,
} from "./AbacusUtils";

export { useAbacusDiff, useAbacusState } from "./AbacusHooks";
