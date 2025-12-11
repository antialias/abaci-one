/**
 * Server Component compatible exports
 * This entry point only exports components and utilities that work without "use client"
 *
 * Import from '@soroban/abacus-react/static' to use these in server components
 * or in code that will be bundled for server-side execution.
 */

// Static React components (no hooks, no animations)
export { AbacusStatic } from "./AbacusStatic";
export type { AbacusStaticConfig } from "./AbacusStatic";
export { AbacusStaticBead } from "./AbacusStaticBead";
export type { StaticBeadProps } from "./AbacusStaticBead";

// Pure types (no React dependencies)
export type {
  ValidPlaceValues,
  EarthBeadPosition,
  PlaceValueBead,
  ColumnIndexBead,
  BeadHighlight,
  StepBeadHighlight,
  BeadState,
  AbacusState,
  PlaceValueBasedBead,
  BeadDiffResult,
  BeadDiffOutput,
  AbacusLayoutDimensions,
  BeadPositionConfig,
  ColumnStateForPositioning,
  CropPadding,
  BoundingBox,
  CropResult,
  PlaceState,
  PlaceStatesMap,
} from "./types";

// PlaceValueUtils namespace for type-safe conversions
export { PlaceValueUtils } from "./types";

// Pure utility functions (no React dependencies)
export {
  numberToAbacusState,
  abacusStateToNumber,
  calculateBeadChanges,
  calculateBeadDiff,
  calculateBeadDiffFromValues,
  validateAbacusValue,
  areStatesEqual,
  calculateAbacusDimensions,
  calculateStandardDimensions,
  calculateBeadPosition,
  calculateBeadDimensions,
  calculateActiveBeadsBounds,
  calculateAbacusCrop,
} from "./AbacusUtils";
