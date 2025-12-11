/**
 * Pure type definitions for abacus - NO React dependencies
 * These types can be safely imported in server components
 */

// Utility types for better type safety
export type ValidPlaceValues = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type EarthBeadPosition = 0 | 1 | 2 | 3;

// Place-value based bead specification (new API)
export interface PlaceValueBead {
  placeValue: ValidPlaceValues; // 0=ones, 1=tens, 2=hundreds, etc.
  beadType: "heaven" | "earth";
  position?: EarthBeadPosition; // for earth beads, 0-3
}

// Legacy column-index based bead specification
export interface ColumnIndexBead {
  columnIndex: number; // array index (0=leftmost)
  beadType: "heaven" | "earth";
  position?: EarthBeadPosition; // for earth beads, 0-3
}

// Union type for bead highlights
export type BeadHighlight = PlaceValueBead | ColumnIndexBead;

// Enhanced bead highlight with step progression and direction indicators
export interface StepBeadHighlight extends PlaceValueBead {
  stepIndex: number; // Which instruction step this bead belongs to
  direction: "up" | "down" | "activate" | "deactivate"; // Movement direction
  order?: number; // Order within the step (for multiple beads per step)
}

// Type-safe conversion utilities
export namespace PlaceValueUtils {
  export function toColumnIndex(
    placeValue: ValidPlaceValues,
    totalColumns: number,
  ): number {
    const result = totalColumns - 1 - placeValue;
    if (result < 0 || result >= totalColumns) {
      throw new Error(
        `Place value ${placeValue} is out of range for ${totalColumns} columns`,
      );
    }
    return result;
  }

  export function fromColumnIndex(
    columnIndex: number,
    totalColumns: number,
  ): ValidPlaceValues {
    const result = totalColumns - 1 - columnIndex;
    if (result < 0 || result > 9) {
      throw new Error(
        `Column index ${columnIndex} maps to invalid place value ${result}`,
      );
    }
    return result as ValidPlaceValues;
  }

  // Convert any bead highlight to PlaceValueBead format
  export function toPlaceValueBead(
    bead: BeadHighlight,
    totalColumns: number,
  ): PlaceValueBead {
    if ("placeValue" in bead) {
      return bead as PlaceValueBead;
    }
    return {
      placeValue: fromColumnIndex(bead.columnIndex, totalColumns),
      beadType: bead.beadType,
      position: bead.position,
    };
  }
}

/**
 * Represents the state of beads in a single column
 */
export interface BeadState {
  heavenActive: boolean;
  earthActive: number; // 0-4
}

/**
 * Represents the complete state of an abacus
 * Key is the place value (0 = ones, 1 = tens, etc.)
 */
export interface AbacusState {
  [placeValue: number]: BeadState;
}

/**
 * Bead highlight with place value (for calculations)
 */
export interface PlaceValueBasedBead {
  placeValue: ValidPlaceValues;
  beadType: "heaven" | "earth";
  position?: 0 | 1 | 2 | 3;
}

/**
 * Result of a bead diff calculation
 */
export interface BeadDiffResult {
  placeValue: ValidPlaceValues;
  beadType: "heaven" | "earth";
  position?: number;
  direction: "activate" | "deactivate";
  order: number; // Order of operations for animations
}

/**
 * Output of calculateBeadDiff function
 */
export interface BeadDiffOutput {
  changes: BeadDiffResult[];
  highlights: PlaceValueBasedBead[];
  hasChanges: boolean;
  summary: string;
}

/**
 * Complete layout dimensions for abacus rendering
 * Used by both static and dynamic rendering to ensure identical layouts
 */
export interface AbacusLayoutDimensions {
  // SVG canvas size
  width: number;
  height: number;

  // Bead and spacing
  beadSize: number;
  rodSpacing: number; // Same as columnSpacing
  rodWidth: number;
  barThickness: number;

  // Gaps and positioning
  heavenEarthGap: number; // Gap between heaven and earth sections (where bar sits)
  activeGap: number; // Gap between active beads and reckoning bar
  inactiveGap: number; // Gap between inactive beads and active beads/bar
  adjacentSpacing: number; // Minimal spacing for adjacent beads of same type

  // Key Y positions (absolute coordinates)
  barY: number; // Y position of reckoning bar
  heavenY: number; // Y position where inactive heaven beads rest
  earthY: number; // Y position where inactive earth beads rest

  // Padding and extras
  padding: number;
  labelHeight: number;
  numbersHeight: number;

  // Derived values
  totalColumns: number;
}

/**
 * Simplified bead config for position calculation
 * (Compatible with BeadConfig from AbacusReact)
 */
export interface BeadPositionConfig {
  type: "heaven" | "earth";
  active: boolean;
  position: number; // 0 for heaven, 0-3 for earth
  placeValue: number;
}

/**
 * Column state needed for earth bead positioning
 * (Required to calculate inactive earth bead positions correctly)
 */
export interface ColumnStateForPositioning {
  earthActive: number; // Number of active earth beads (0-4)
}

/**
 * Padding configuration for cropping
 */
export interface CropPadding {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

/**
 * Bounding box for crop area
 */
export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

/**
 * Complete crop calculation result
 */
export interface CropResult extends BoundingBox {
  viewBox: string; // SVG viewBox attribute value
  scaledWidth: number; // Width after scaling to fit target
  scaledHeight: number; // Height after scaling to fit target
}

/**
 * Place state for internal column tracking
 */
export interface PlaceState {
  columnIndex: number;
  placeValue: ValidPlaceValues;
  heavenBeadActive: boolean;
  activeEarthBeads: number;
}

export type PlaceStatesMap = Map<ValidPlaceValues, PlaceState>;
