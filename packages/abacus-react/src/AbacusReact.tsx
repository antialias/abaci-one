"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { useSpring, animated, config, to } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import NumberFlow from "@number-flow/react";
import { useAbacusConfig, getDefaultAbacusConfig } from "./AbacusContext";
import { playBeadSound } from "./soundManager";

// Types
export interface BeadConfig {
  type: "heaven" | "earth";
  value: number;
  active: boolean;
  position: number; // 0-based position within its type group
  placeValue: ValidPlaceValues; // 0=ones, 1=tens, 2=hundreds, etc. - NATIVE place-value architecture!
}

// Comprehensive styling system
export interface BeadStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  cursor?: string;
  className?: string;
}

export interface ColumnPostStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export interface ReckoningBarStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export interface NumeralStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  className?: string;
}

export interface BackgroundGlowStyle {
  fill?: string;
  blur?: number;
  spread?: number;
  opacity?: number;
}

export interface AbacusCustomStyles {
  // Global defaults
  heavenBeads?: BeadStyle;
  earthBeads?: BeadStyle;
  activeBeads?: BeadStyle;
  inactiveBeads?: BeadStyle;
  columnPosts?: ColumnPostStyle;
  reckoningBar?: ReckoningBarStyle;
  numerals?: NumeralStyle;
  numeralContainers?: NumeralStyle;

  // Column-specific overrides (by column index)
  columns?: {
    [columnIndex: number]: {
      heavenBeads?: BeadStyle;
      earthBeads?: BeadStyle;
      activeBeads?: BeadStyle;
      inactiveBeads?: BeadStyle;
      columnPost?: ColumnPostStyle;
      numerals?: NumeralStyle;
      numeralContainer?: NumeralStyle;
      backgroundGlow?: BackgroundGlowStyle;
    };
  };

  // Individual bead overrides (by column and bead position)
  beads?: {
    [columnIndex: number]: {
      heaven?: BeadStyle;
      earth?: {
        [position: number]: BeadStyle; // position 0-3 for earth beads
      };
    };
  };
}

// Branded types to prevent mixing place values and column indices
export type PlaceValue = number & { readonly __brand: "PlaceValue" };
export type ColumnIndex = number & { readonly __brand: "ColumnIndex" };

// Type-safe constructors
export const PlaceValue = (value: number): PlaceValue => {
  if (value < 0) {
    throw new Error(`Place value must be non-negative, got ${value}`);
  }
  return value as PlaceValue;
};

export const ColumnIndex = (value: number): ColumnIndex => {
  if (value < 0) {
    throw new Error(`Column index must be non-negative, got ${value}`);
  }
  return value as ColumnIndex;
};

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

  // Type-safe creation helpers
  export const ones = (): PlaceValueBead["placeValue"] => 0;
  export const tens = (): PlaceValueBead["placeValue"] => 1;
  export const hundreds = (): PlaceValueBead["placeValue"] => 2;
  export const thousands = (): PlaceValueBead["placeValue"] => 3;
}

// Union type for backward compatibility
export type BeadHighlight = PlaceValueBead | ColumnIndexBead;

// Enhanced bead highlight with step progression and direction indicators
export interface StepBeadHighlight extends PlaceValueBead {
  stepIndex: number; // Which instruction step this bead belongs to
  direction: "up" | "down" | "activate" | "deactivate"; // Movement direction
  order?: number; // Order within the step (for multiple beads per step)
}

// Type guards to distinguish between the two APIs
export function isPlaceValueBead(bead: BeadHighlight): bead is PlaceValueBead {
  return "placeValue" in bead;
}

export function isColumnIndexBead(
  bead: BeadHighlight,
): bead is ColumnIndexBead {
  return "columnIndex" in bead;
}

// Event system
export interface BeadClickEvent {
  bead: BeadConfig;
  columnIndex: number;
  beadType: "heaven" | "earth";
  position: number;
  active: boolean;
  value: number;
  event: React.MouseEvent;
}

export interface AbacusCallbacks {
  onBeadClick?: (event: BeadClickEvent) => void;
  onBeadHover?: (event: BeadClickEvent) => void;
  onBeadLeave?: (event: BeadClickEvent) => void;
  onColumnClick?: (columnIndex: number, event: React.MouseEvent) => void;
  onColumnHover?: (columnIndex: number, event: React.MouseEvent) => void;
  onColumnLeave?: (columnIndex: number, event: React.MouseEvent) => void;
  onNumeralClick?: (
    columnIndex: number,
    value: number,
    event: React.MouseEvent,
  ) => void;
  onValueChange?: (newValue: number | bigint) => void;
  onBeadRef?: (bead: BeadConfig, element: SVGElement | null) => void;
  // Legacy callback for backward compatibility
  onClick?: (bead: BeadConfig) => void;
}

// Overlay and injection system
export interface AbacusOverlay {
  id: string;
  type: "tooltip" | "arrow" | "highlight" | "custom";
  target: {
    type: "bead" | "column" | "numeral" | "bar" | "coordinates";
    columnIndex?: number;
    beadType?: "heaven" | "earth";
    beadPosition?: number; // for earth beads
    x?: number; // for coordinate-based positioning
    y?: number;
  };
  content: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  offset?: { x: number; y: number };
  visible?: boolean;
}

export interface AbacusConfig {
  // Basic configuration
  value?: number | bigint;
  columns?: number | "auto";
  showEmptyColumns?: boolean;
  hideInactiveBeads?: boolean;
  beadShape?: "diamond" | "square" | "circle";
  colorScheme?: "monochrome" | "place-value" | "alternating" | "heaven-earth";
  colorPalette?: "default" | "colorblind" | "mnemonic" | "grayscale" | "nature";
  scaleFactor?: number;
  animated?: boolean;
  interactive?: boolean;
  gestures?: boolean;
  showNumbers?: boolean;
  soundEnabled?: boolean;
  soundVolume?: number;

  // Advanced customization
  customStyles?: AbacusCustomStyles;
  callbacks?: AbacusCallbacks;
  overlays?: AbacusOverlay[];

  // Tutorial and accessibility features
  highlightColumns?: number[]; // Highlight specific columns (legacy - array indices)
  highlightBeads?: BeadHighlight[]; // Support both place-value and column-index based highlighting
  stepBeadHighlights?: StepBeadHighlight[]; // Progressive step-based highlighting with directions
  currentStep?: number; // Current step index for progressive highlighting
  showDirectionIndicators?: boolean; // Show direction arrows/indicators on beads
  disabledColumns?: number[]; // Disable interaction on specific columns (legacy - array indices)
  disabledBeads?: BeadHighlight[]; // Support both place-value and column-index based disabling

  // Legacy callbacks for backward compatibility
  onClick?: (bead: BeadConfig) => void;
  onValueChange?: (newValue: number | bigint) => void;
}

export interface AbacusDimensions {
  width: number;
  height: number;
  rodSpacing: number;
  beadSize: number;
  rodWidth: number;
  barThickness: number;
  heavenEarthGap: number;
  activeGap: number;
  inactiveGap: number;
  adjacentSpacing: number;
}

// Hooks
export function useAbacusDimensions(
  columns: number,
  scaleFactor: number = 1,
  showNumbers: boolean = false,
): AbacusDimensions {
  return useMemo(() => {
    // Exact Typst parameters (lines 33-39 in flashcards.typ)
    const rodWidth = 3 * scaleFactor;
    const beadSize = 12 * scaleFactor;
    const adjacentSpacing = 0.5 * scaleFactor; // Minimal spacing for adjacent beads of same type
    const columnSpacing = 25 * scaleFactor; // rod spacing
    const heavenEarthGap = 30 * scaleFactor;
    const barThickness = 2 * scaleFactor;

    // Positioning gaps (lines 169-170 in flashcards.typ)
    const activeGap = 1 * scaleFactor; // Gap between active beads and reckoning bar
    const inactiveGap = 8 * scaleFactor; // Gap between inactive beads and active beads/bar

    // Calculate total dimensions based on Typst logic (line 154-155)
    const totalWidth = columns * columnSpacing;
    const baseHeight =
      heavenEarthGap + 5 * (beadSize + 4 * scaleFactor) + 10 * scaleFactor;

    // Add space for numbers if they are visible
    const numbersSpace = 40 * scaleFactor; // Space for NumberFlow components
    const totalHeight = showNumbers ? baseHeight + numbersSpace : baseHeight;

    return {
      width: totalWidth,
      height: totalHeight,
      rodSpacing: columnSpacing,
      beadSize,
      rodWidth,
      barThickness,
      heavenEarthGap,
      activeGap,
      inactiveGap,
      adjacentSpacing,
    };
  }, [columns, scaleFactor, showNumbers]);
}

// Legacy column state interface (deprecated)
interface ColumnState {
  heavenActive: boolean; // true if heaven bead (value 5) is active
  earthActive: number; // 0-4, number of active earth beads
}

// Native place-value state (no more array indices!)
export interface PlaceState {
  placeValue: ValidPlaceValues;
  heavenActive: boolean;
  earthActive: number; // 0-4, number of active earth beads
}

// State map keyed by place value - this eliminates the indexing nightmare!
export type PlaceStatesMap = Map<ValidPlaceValues, PlaceState>;

/**
 * @deprecated Use useAbacusPlaceStates() instead.
 * This hook uses array-based column indexing which requires totalColumns threading.
 * The new hook uses Map-based place values for cleaner architecture.
 */
export function useAbacusState(
  initialValue: number = 0,
  targetColumns?: number,
) {
  // Initialize state from the initial value
  const initializeFromValue = useCallback(
    (value: number, minColumns?: number): ColumnState[] => {
      if (value === 0) {
        // Special case: for value 0, use minColumns if provided, otherwise single column
        const columnCount = minColumns || 1;
        return Array(columnCount)
          .fill(null)
          .map(() => ({ heavenActive: false, earthActive: 0 }));
      }
      const digits = value.toString().split("").map(Number);
      const result = digits.map((digit) => ({
        heavenActive: digit >= 5,
        earthActive: digit % 5,
      }));

      // Ensure we have at least minColumns if specified
      if (minColumns && result.length < minColumns) {
        const paddingNeeded = minColumns - result.length;
        const padding = Array(paddingNeeded)
          .fill(null)
          .map(() => ({ heavenActive: false, earthActive: 0 }));
        return [...padding, ...result];
      }

      return result;
    },
    [targetColumns],
  );

  const [columnStates, setColumnStates] = useState<ColumnState[]>(() =>
    initializeFromValue(initialValue, targetColumns),
  );

  // Calculate current value from independent column states
  const value = useMemo(() => {
    return columnStates.reduce((total, columnState, index) => {
      const placeValue = Math.pow(10, columnStates.length - index - 1);
      const columnValue =
        (columnState.heavenActive ? 5 : 0) + columnState.earthActive;
      return total + columnValue * placeValue;
    }, 0);
  }, [columnStates]);

  const setValue = useCallback(
    (newValue: number) => {
      setColumnStates(initializeFromValue(newValue, targetColumns));
    },
    [initializeFromValue, targetColumns],
  );

  const getColumnState = useCallback(
    (columnIndex: number): ColumnState => {
      return (
        columnStates[columnIndex] || { heavenActive: false, earthActive: 0 }
      );
    },
    [columnStates],
  );

  const setColumnState = useCallback(
    (columnIndex: number, newState: ColumnState) => {
      setColumnStates((prev) => {
        const newStates = [...prev];
        // Extend array if necessary
        while (newStates.length <= columnIndex) {
          newStates.push({ heavenActive: false, earthActive: 0 });
        }
        newStates[columnIndex] = newState;
        return newStates;
      });
    },
    [],
  );

  const toggleBead = useCallback(
    (bead: BeadConfig) => {
      // Convert place value to column index for this legacy hook
      const placeIndex = columnStates.length - 1 - bead.placeValue;
      const currentState = getColumnState(placeIndex);

      if (bead.type === "heaven") {
        // Toggle heaven bead independently
        setColumnState(placeIndex, {
          ...currentState,
          heavenActive: !currentState.heavenActive,
        });
      } else {
        // Toggle earth bead - affects the number of active earth beads
        if (bead.active) {
          // Deactivate this bead and all higher positioned earth beads
          setColumnState(placeIndex, {
            ...currentState,
            earthActive: Math.min(currentState.earthActive, bead.position),
          });
        } else {
          // Activate this bead and all lower positioned earth beads
          setColumnState(placeIndex, {
            ...currentState,
            earthActive: Math.max(currentState.earthActive, bead.position + 1),
          });
        }
      }
    },
    [getColumnState, setColumnState, columnStates.length],
  );

  return {
    value,
    setValue,
    columnStates,
    getColumnState,
    setColumnState,
    toggleBead,
  };
}

// NEW: Native place-value state management hook (eliminates the column index nightmare!)
export function useAbacusPlaceStates(
  controlledValue: number | bigint = 0,
  maxPlaceValue: ValidPlaceValues = 4,
) {
  // Initialize state from value using place values as keys - NO MORE ARRAY INDICES!
  const initializeFromValue = useCallback(
    (value: number | bigint): PlaceStatesMap => {
      const states = new Map<ValidPlaceValues, PlaceState>();

      // Convert to string to handle both number and bigint
      const valueStr = value.toString();
      const digits = valueStr.split('').map(Number);

      // Always create ALL place values from 0 to maxPlaceValue (to match columns)
      for (let place = 0; place <= maxPlaceValue; place++) {
        // Get digit from right: place 0 = rightmost, place 1 = second from right, etc.
        const digitIndex = digits.length - 1 - place;
        const digit = digitIndex >= 0 ? digits[digitIndex] : 0;

        states.set(place as ValidPlaceValues, {
          placeValue: place as ValidPlaceValues,
          heavenActive: digit >= 5,
          earthActive: digit >= 5 ? digit - 5 : digit,
        });
      }

      return states;
    },
    [maxPlaceValue],
  );

  const [placeStates, setPlaceStates] = useState<PlaceStatesMap>(() =>
    initializeFromValue(controlledValue),
  );

  // Calculate current value from place states - NO MORE INDEX MATH!
  // Use BigInt for numbers that exceed safe integer range (>15 digits)
  const value = useMemo(() => {
    // Check if we need BigInt (maxPlaceValue > 14 means >15 digits)
    const useBigInt = maxPlaceValue > 14;

    if (useBigInt) {
      let total = 0n;
      placeStates.forEach((state) => {
        const placeValueNum = 10n ** BigInt(state.placeValue);
        const digitValue = BigInt((state.heavenActive ? 5 : 0) + state.earthActive);
        total += digitValue * placeValueNum;
      });
      return total;
    } else {
      let total = 0;
      placeStates.forEach((state) => {
        const placeValueNum = Math.pow(10, state.placeValue);
        const digitValue = (state.heavenActive ? 5 : 0) + state.earthActive;
        total += digitValue * placeValueNum;
      });
      return total;
    }
  }, [placeStates, maxPlaceValue]);

  const setValue = useCallback(
    (newValue: number | bigint) => {
      setPlaceStates(initializeFromValue(newValue));
    },
    [initializeFromValue],
  );

  // Update internal state when external controlled value changes
  // Only update if the controlled value is different from our current value
  // This prevents infinite loops while allowing controlled updates
  React.useEffect(() => {
    const currentInternalValue = value;
    if (controlledValue !== currentInternalValue) {
      setPlaceStates(initializeFromValue(controlledValue));
    }
  }, [controlledValue, initializeFromValue, value]);

  // Clean up place states when maxPlaceValue decreases (columns decrease)
  // This prevents stale place values from causing out-of-bounds access
  React.useEffect(() => {
    setPlaceStates((prev) => {
      const newStates = new Map(prev);
      let hasChanges = false;

      // Remove any place values greater than maxPlaceValue
      for (const placeValue of newStates.keys()) {
        if (placeValue > maxPlaceValue) {
          newStates.delete(placeValue);
          hasChanges = true;
        }
      }

      // Add missing place values up to maxPlaceValue
      for (let place = 0; place <= maxPlaceValue; place++) {
        if (!newStates.has(place as ValidPlaceValues)) {
          newStates.set(place as ValidPlaceValues, {
            placeValue: place as ValidPlaceValues,
            heavenActive: false,
            earthActive: 0,
          });
          hasChanges = true;
        }
      }

      return hasChanges ? newStates : prev;
    });
  }, [maxPlaceValue]);

  const getPlaceState = useCallback(
    (placeValue: ValidPlaceValues): PlaceState => {
      return (
        placeStates.get(placeValue) || {
          placeValue,
          heavenActive: false,
          earthActive: 0,
        }
      );
    },
    [placeStates],
  );

  const setPlaceState = useCallback(
    (
      placeValue: ValidPlaceValues,
      newState: Omit<PlaceState, "placeValue">,
    ) => {
      setPlaceStates((prev) => {
        const newStates = new Map(prev);
        newStates.set(placeValue, { placeValue, ...newState });
        return newStates;
      });
    },
    [],
  );

  const toggleBead = useCallback(
    (bead: BeadConfig) => {
      const currentState = getPlaceState(bead.placeValue);

      if (bead.type === "heaven") {
        setPlaceState(bead.placeValue, {
          ...currentState,
          heavenActive: !currentState.heavenActive,
        });
      } else {
        // Earth bead toggle logic - same as legacy but cleaner
        if (bead.active) {
          // Deactivate this bead and all higher positioned earth beads
          setPlaceState(bead.placeValue, {
            ...currentState,
            earthActive: Math.min(currentState.earthActive, bead.position),
          });
        } else {
          // Activate this bead and all lower positioned earth beads
          setPlaceState(bead.placeValue, {
            ...currentState,
            earthActive: Math.max(currentState.earthActive, bead.position + 1),
          });
        }
      }
    },
    [getPlaceState, setPlaceState],
  );

  return {
    value,
    setValue,
    placeStates,
    getPlaceState,
    setPlaceState,
    toggleBead,
  };
}

// Utility functions for customization system
function mergeBeadStyles(
  baseStyle: BeadStyle,
  customStyles?: AbacusCustomStyles,
  columnIndex?: number,
  beadType?: "heaven" | "earth",
  position?: number,
  isActive?: boolean,
): BeadStyle {
  let mergedStyle = { ...baseStyle };

  // Apply global bead type styles
  if (customStyles?.heavenBeads && beadType === "heaven") {
    mergedStyle = { ...mergedStyle, ...customStyles.heavenBeads };
  }
  if (customStyles?.earthBeads && beadType === "earth") {
    mergedStyle = { ...mergedStyle, ...customStyles.earthBeads };
  }

  // Apply active/inactive styles
  if (isActive && customStyles?.activeBeads) {
    mergedStyle = { ...mergedStyle, ...customStyles.activeBeads };
  }
  if (!isActive && customStyles?.inactiveBeads) {
    mergedStyle = { ...mergedStyle, ...customStyles.inactiveBeads };
  }

  // Apply column-specific styles
  if (columnIndex !== undefined && customStyles?.columns?.[columnIndex]) {
    const columnStyles = customStyles.columns[columnIndex];
    if (columnStyles.heavenBeads && beadType === "heaven") {
      mergedStyle = { ...mergedStyle, ...columnStyles.heavenBeads };
    }
    if (columnStyles.earthBeads && beadType === "earth") {
      mergedStyle = { ...mergedStyle, ...columnStyles.earthBeads };
    }
    if (isActive && columnStyles.activeBeads) {
      mergedStyle = { ...mergedStyle, ...columnStyles.activeBeads };
    }
    if (!isActive && columnStyles.inactiveBeads) {
      mergedStyle = { ...mergedStyle, ...columnStyles.inactiveBeads };
    }
  }

  // Apply individual bead styles (highest specificity)
  if (columnIndex !== undefined && customStyles?.beads?.[columnIndex]) {
    const beadStyles = customStyles.beads[columnIndex];
    if (beadType === "heaven" && beadStyles.heaven) {
      mergedStyle = { ...mergedStyle, ...beadStyles.heaven };
    }
    if (
      beadType === "earth" &&
      position !== undefined &&
      beadStyles.earth?.[position]
    ) {
      mergedStyle = { ...mergedStyle, ...beadStyles.earth[position] };
    }
  }

  return mergedStyle;
}

// REMOVED: normalizeBeadHighlight function - no longer needed with place-value architecture!

/**
 * @deprecated Use isBeadHighlightedByPlaceValue() instead.
 * This function requires totalColumns threading which the new architecture eliminates.
 */
function isBeadHighlighted(
  columnIndex: number,
  beadType: "heaven" | "earth",
  position: number | undefined,
  highlightBeads?: BeadHighlight[],
  totalColumns?: number,
): boolean {
  if (!highlightBeads || !totalColumns) return false;

  return highlightBeads.some((highlight) => {
    // Convert column index to place value for pure place-value API
    const targetPlaceValue = totalColumns - 1 - columnIndex;
    if ("placeValue" in highlight) {
      return (
        highlight.placeValue === targetPlaceValue &&
        highlight.beadType === beadType &&
        (highlight.position === undefined || highlight.position === position)
      );
    } else {
      return (
        highlight.columnIndex === columnIndex &&
        highlight.beadType === beadType &&
        (highlight.position === undefined || highlight.position === position)
      );
    }
  });
}

/**
 * @deprecated Use isBeadDisabledByPlaceValue() instead.
 * This function requires totalColumns threading which the new architecture eliminates.
 */
function isBeadDisabled(
  columnIndex: number,
  beadType: "heaven" | "earth",
  position: number | undefined,
  disabledColumns?: number[],
  disabledBeads?: BeadHighlight[],
  totalColumns?: number,
): boolean {
  // Check if entire column is disabled (legacy column index system)
  if (disabledColumns?.includes(columnIndex)) {
    return true;
  }

  // Check if specific bead is disabled
  if (!disabledBeads || !totalColumns) return false;

  return disabledBeads.some((disabled) => {
    // Convert column index to place value for pure place-value API
    const targetPlaceValue = totalColumns - 1 - columnIndex;
    if ("placeValue" in disabled) {
      return (
        disabled.placeValue === targetPlaceValue &&
        disabled.beadType === beadType &&
        (disabled.position === undefined || disabled.position === position)
      );
    } else {
      return (
        disabled.columnIndex === columnIndex &&
        disabled.beadType === beadType &&
        (disabled.position === undefined || disabled.position === position)
      );
    }
  });
}

// NEW: Native place-value highlighting (eliminates totalColumns threading!)
function isBeadHighlightedByPlaceValue(
  bead: BeadConfig,
  highlightBeads?: BeadHighlight[],
): boolean {
  if (!highlightBeads) return false;

  return highlightBeads.some((highlight) => {
    // Direct place value matching - NO MORE CONVERSION NEEDED!
    if ("placeValue" in highlight) {
      return (
        highlight.placeValue === bead.placeValue &&
        highlight.beadType === bead.type &&
        (highlight.position === undefined ||
          highlight.position === bead.position)
      );
    }

    // Legacy columnIndex support - convert to place value for comparison
    if ("columnIndex" in highlight) {
      // We need to know total columns to convert - for now, warn about legacy usage
      console.warn(
        "Legacy columnIndex highlighting detected - migrate to placeValue API for better performance",
      );
      return false; // Cannot properly support without totalColumns threading
    }

    return false;
  });
}

// NEW: Step-based highlighting with progressive revelation
function getBeadStepHighlight(
  bead: BeadConfig,
  stepBeadHighlights?: StepBeadHighlight[],
  currentStep?: number,
): { isHighlighted: boolean; direction?: string; isCurrentStep: boolean } {
  if (!stepBeadHighlights || currentStep === undefined) {
    return { isHighlighted: false, isCurrentStep: false };
  }

  const matchingStepBead = stepBeadHighlights.find((stepBead) => {
    const matches =
      stepBead.placeValue === bead.placeValue &&
      stepBead.beadType === bead.type &&
      (stepBead.position === undefined || stepBead.position === bead.position);

    return matches;
  });

  if (!matchingStepBead) {
    return { isHighlighted: false, isCurrentStep: false };
  }

  const isCurrentStep = matchingStepBead.stepIndex === currentStep;
  const isCompleted = matchingStepBead.stepIndex < currentStep;
  const isHighlighted = isCurrentStep || isCompleted;

  return {
    isHighlighted,
    direction: isCurrentStep ? matchingStepBead.direction : undefined,
    isCurrentStep,
  };
}

// NEW: Native place-value disabling (eliminates totalColumns threading!)
function isBeadDisabledByPlaceValue(
  bead: BeadConfig,
  disabledBeads?: BeadHighlight[],
): boolean {
  if (!disabledBeads) return false;

  return disabledBeads.some((disabled) => {
    // Direct place value matching - NO MORE CONVERSION NEEDED!
    if ("placeValue" in disabled) {
      return (
        disabled.placeValue === bead.placeValue &&
        disabled.beadType === bead.type &&
        (disabled.position === undefined || disabled.position === bead.position)
      );
    }

    // Legacy columnIndex support - convert to place value for comparison
    if ("columnIndex" in disabled) {
      // We need to know total columns to convert - for now, warn about legacy usage
      console.warn(
        "Legacy columnIndex disabling detected - migrate to placeValue API for better performance",
      );
      return false; // Cannot properly support without totalColumns threading
    }

    return false;
  });
}

function calculateOverlayPosition(
  overlay: AbacusOverlay,
  dimensions: AbacusDimensions,
  columnIndex?: number,
  beadPosition?: { x: number; y: number },
): { x: number; y: number } {
  let x = 0;
  let y = 0;

  switch (overlay.target.type) {
    case "coordinates":
      x = overlay.target.x || 0;
      y = overlay.target.y || 0;
      break;

    case "bead":
      if (beadPosition) {
        x = beadPosition.x;
        y = beadPosition.y;
      }
      break;

    case "column":
      if (overlay.target.columnIndex !== undefined) {
        x =
          overlay.target.columnIndex * dimensions.rodSpacing +
          dimensions.rodSpacing / 2;
        y = dimensions.height / 2;
      }
      break;

    case "numeral":
      if (overlay.target.columnIndex !== undefined) {
        x =
          overlay.target.columnIndex * dimensions.rodSpacing +
          dimensions.rodSpacing / 2;
        const baseHeight =
          dimensions.heavenEarthGap + 5 * (dimensions.beadSize + 4) + 10;
        y = baseHeight + 25;
      }
      break;

    case "bar":
      x = dimensions.width / 2;
      y = dimensions.heavenEarthGap;
      break;
  }

  // Apply offset
  if (overlay.offset) {
    x += overlay.offset.x;
    y += overlay.offset.y;
  }

  return { x, y };
}

// Color palettes
const COLOR_PALETTES = {
  default: ["#2E86AB", "#A23B72", "#F18F01", "#6A994E", "#BC4B51"],
  colorblind: ["#0173B2", "#DE8F05", "#CC78BC", "#029E73", "#D55E00"],
  mnemonic: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"],
  grayscale: ["#000000", "#404040", "#808080", "#b0b0b0", "#d0d0d0"],
  nature: ["#4E79A7", "#F28E2C", "#E15759", "#76B7B2", "#59A14F"],
};

// Utility functions
function getBeadColor(
  bead: BeadConfig,
  totalColumns: number,
  colorScheme: string,
  colorPalette: string,
  isHighlighted: boolean = false,
): string {
  const inactiveColor = "rgb(211, 211, 211)"; // Typst uses gray.lighten(70%)
  const highlightColor = "#FFD700"; // Gold color for highlighting

  // If highlighted, return the highlight color regardless of active state
  if (isHighlighted) return highlightColor;

  if (!bead.active) return inactiveColor;

  switch (colorScheme) {
    case "place-value": {
      const colors =
        COLOR_PALETTES[colorPalette as keyof typeof COLOR_PALETTES] ||
        COLOR_PALETTES.default;
      return colors[bead.placeValue % colors.length];
    }
    case "alternating":
      return bead.placeValue % 2 === 0 ? "#1E88E5" : "#43A047";
    case "heaven-earth":
      return bead.type === "heaven" ? "#F18F01" : "#2E86AB"; // Exact Typst colors (lines 228, 265)
    default:
      return "#000000";
  }
}

// Get arrow colors that respect color schemes and accessibility
function getArrowColors(
  bead: BeadConfig,
  direction: string,
  totalColumns: number,
  colorScheme: string,
  colorPalette: string,
): { fill: string; stroke: string } {
  const isActivating = direction === "activate" || direction === "up";

  switch (colorScheme) {
    case "monochrome":
      return isActivating
        ? { fill: "rgba(100, 100, 100, 0.8)", stroke: "rgba(50, 50, 50, 1)" }
        : {
            fill: "rgba(150, 150, 150, 0.8)",
            stroke: "rgba(100, 100, 100, 1)",
          };

    case "grayscale":
      return isActivating
        ? { fill: "rgba(60, 60, 60, 0.8)", stroke: "rgba(30, 30, 30, 1)" }
        : { fill: "rgba(120, 120, 120, 0.8)", stroke: "rgba(80, 80, 80, 1)" };

    case "place-value": {
      const colors =
        COLOR_PALETTES[colorPalette as keyof typeof COLOR_PALETTES] ||
        COLOR_PALETTES.default;
      const baseColor = colors[bead.placeValue % colors.length];

      // Create darker/lighter variants for arrows
      const activateColor = isActivating
        ? baseColor
        : adjustColorBrightness(baseColor, -30);
      const strokeColor = adjustColorBrightness(activateColor, -40);

      return {
        fill: `${activateColor}CC`, // Add alpha
        stroke: strokeColor,
      };
    }

    case "heaven-earth": {
      const baseColor = bead.type === "heaven" ? "#F18F01" : "#2E86AB";
      const activateColor = isActivating
        ? baseColor
        : adjustColorBrightness(baseColor, -30);
      const strokeColor = adjustColorBrightness(activateColor, -40);

      return {
        fill: `${activateColor}CC`,
        stroke: strokeColor,
      };
    }

    case "alternating": {
      const baseColor = bead.placeValue % 2 === 0 ? "#1E88E5" : "#43A047";
      const activateColor = isActivating
        ? baseColor
        : adjustColorBrightness(baseColor, -30);
      const strokeColor = adjustColorBrightness(activateColor, -40);

      return {
        fill: `${activateColor}CC`,
        stroke: strokeColor,
      };
    }

    default:
      // Fallback to original green/red system
      return isActivating
        ? { fill: "rgba(0, 150, 0, 0.8)", stroke: "rgba(0, 100, 0, 1)" }
        : { fill: "rgba(200, 0, 0, 0.8)", stroke: "rgba(150, 0, 0, 1)" };
  }
}

// Helper function to adjust color brightness
function adjustColorBrightness(hex: string, percent: number): string {
  // Remove # if present
  hex = hex.replace("#", "");

  // Parse RGB components
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Adjust brightness
  const newR = Math.max(0, Math.min(255, r + (r * percent) / 100));
  const newG = Math.max(0, Math.min(255, g + (g * percent) / 100));
  const newB = Math.max(0, Math.min(255, b + (b * percent) / 100));

  // Convert back to hex
  return `#${Math.round(newR).toString(16).padStart(2, "0")}${Math.round(newG).toString(16).padStart(2, "0")}${Math.round(newB).toString(16).padStart(2, "0")}`;
}

function calculateBeadStates(
  columnStates: ColumnState[],
  originalLength: number,
): BeadConfig[][] {
  return columnStates.map((columnState, arrayIndex) => {
    const beads: BeadConfig[] = [];
    // Convert array index to place value: leftmost = highest place value
    const placeValue = (columnStates.length -
      1 -
      arrayIndex) as ValidPlaceValues;

    // Heaven bead (value 5) - independent state
    beads.push({
      type: "heaven",
      value: 5,
      active: columnState.heavenActive,
      position: 0,
      placeValue: placeValue,
    });

    // Earth beads (4 beads, each value 1) - independent state
    for (let i = 0; i < 4; i++) {
      beads.push({
        type: "earth",
        value: 1,
        active: i < columnState.earthActive,
        position: i,
        placeValue: placeValue,
      });
    }

    return beads;
  });
}

// NEW: Native place-value bead state calculation (eliminates array index math!)
function calculateBeadStatesFromPlaces(
  placeStates: PlaceStatesMap,
  maxPlaceValue: ValidPlaceValues,
): BeadConfig[][] {
  const columnsList: BeadConfig[][] = [];

  // Convert Map to sorted array by place value (ascending order for correct visual layout)
  // Filter to only include place values that are within the current column count
  const sortedPlaces = Array.from(placeStates.entries())
    .filter(([placeValue]) => placeValue <= maxPlaceValue)
    .sort(([a], [b]) => a - b);

  for (const [placeValue, placeState] of sortedPlaces) {
    const beads: BeadConfig[] = [];

    // Heaven bead (value 5) - independent state
    beads.push({
      type: "heaven",
      value: 5,
      active: placeState.heavenActive,
      position: 0,
      placeValue: placeValue, // Direct place value - no conversion needed!
    });

    // Earth beads (4 beads, each value 1) - independent state
    for (let i = 0; i < 4; i++) {
      beads.push({
        type: "earth",
        value: 1,
        active: i < placeState.earthActive,
        position: i,
        placeValue: placeValue, // Direct place value - no conversion needed!
      });
    }

    columnsList.push(beads);
  }

  // Return in visual order (left-to-right = highest-to-lowest place value)
  return columnsList.reverse();
}

// Calculate numeric value from column states
function calculateValueFromColumnStates(
  columnStates: ColumnState[],
  totalColumns: number,
): number {
  let value = 0;

  columnStates.forEach((columnState, index) => {
    const placeValue = Math.pow(10, totalColumns - 1 - index);
    const columnValue =
      (columnState.heavenActive ? 5 : 0) + columnState.earthActive;
    value += columnValue * placeValue;
  });

  return value;
}

// NEW: Native place-value calculation (eliminates the array index nightmare!)
function calculateValueFromPlaceStates(placeStates: PlaceStatesMap): number | bigint {
  // Determine if we need BigInt based on the largest place value
  const maxPlace = Math.max(...Array.from(placeStates.keys()));
  const useBigInt = maxPlace > 14; // >15 digits

  if (useBigInt) {
    let value = 0n;
    for (const [placeValue, placeState] of placeStates) {
      const digitValue = BigInt((placeState.heavenActive ? 5 : 0) + placeState.earthActive);
      value += digitValue * (10n ** BigInt(placeValue));
    }
    return value;
  } else {
    let value = 0;
    for (const [placeValue, placeState] of placeStates) {
      const digitValue = (placeState.heavenActive ? 5 : 0) + placeState.earthActive;
      value += digitValue * Math.pow(10, placeValue);
    }
    return value;
  }
}

// Components
interface BeadProps {
  bead: BeadConfig;
  x: number;
  y: number;
  size: number;
  shape: "diamond" | "square" | "circle";
  color: string;
  customStyle?: BeadStyle;
  isHighlighted?: boolean;
  isDisabled?: boolean;
  enableAnimation: boolean;
  enableGestures?: boolean;
  hideInactiveBeads?: boolean;
  showDirectionIndicator?: boolean;
  direction?: string;
  isCurrentStep?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  onHover?: (event: React.MouseEvent) => void;
  onLeave?: (event: React.MouseEvent) => void;
  onGestureToggle?: (
    bead: BeadConfig,
    direction: "activate" | "deactivate",
  ) => void;
  onRef?: (element: SVGElement | null) => void;
  heavenEarthGap: number;
  barY: number;
  // Arrow color scheme integration
  colorScheme?: string;
  colorPalette?: string;
  totalColumns?: number;
}

const Bead: React.FC<BeadProps> = ({
  bead,
  x,
  y,
  size,
  shape,
  color,
  customStyle,
  isHighlighted = false,
  isDisabled = false,
  enableAnimation,
  enableGestures = false,
  hideInactiveBeads = false,
  showDirectionIndicator = false,
  direction,
  isCurrentStep = false,
  onClick,
  onHover,
  onLeave,
  onGestureToggle,
  onRef,
  heavenEarthGap,
  barY,
  colorScheme = "monochrome",
  colorPalette = "default",
  totalColumns = 1,
}) => {
  // Detect server-side rendering
  const isServer = typeof window === 'undefined';

  // Use springs only if not on server and animations are enabled
  // Even on server, we must call hooks unconditionally, so we provide static values
  const [{ x: springX, y: springY }, api] = useSpring(() => ({
    x,
    y,
    config: enableAnimation && !isServer ? config.default : { duration: 0 }
  }));

  // Arrow pulse animation for urgency indication
  const [{ arrowPulse }, arrowApi] = useSpring(() => ({
    arrowPulse: 1,
    config: enableAnimation && !isServer ? { tension: 200, friction: 10 } : { duration: 0 },
  }));

  const gestureStateRef = useRef({
    isDragging: false,
    lastDirection: null as "activate" | "deactivate" | null,
    startY: 0,
    threshold: size * 0.3, // Minimum movement to trigger toggle
    hasGestureTriggered: false, // Track if a gesture has triggered to avoid click conflicts
  });

  // Calculate gesture direction based on bead type and position
  const getGestureDirection = useCallback(
    (deltaY: number) => {
      const movement = Math.abs(deltaY);
      if (movement < gestureStateRef.current.threshold) return null;

      if (bead.type === "heaven") {
        // Heaven bead: down toward bar = activate, up away from bar = deactivate
        return deltaY > 0 ? "activate" : "deactivate";
      } else {
        // Earth bead: up toward bar = activate, down away from bar = deactivate
        return deltaY < 0 ? "activate" : "deactivate";
      }
    },
    [bead.type],
  );

  // Directional gesture handler - only on client with gestures enabled
  const bind = (enableGestures && !isServer) ? useDrag(
    ({ event, movement: [, deltaY], first, active }) => {
      if (first) {
        event?.preventDefault();
        gestureStateRef.current.isDragging = true;
        gestureStateRef.current.lastDirection = null;
        gestureStateRef.current.hasGestureTriggered = false;
        return;
      }

      // Only process during active drag, ignore drag end
      if (!active || !gestureStateRef.current.isDragging) {
        if (!active) {
          // Clean up on drag end but don't revert state
          gestureStateRef.current.isDragging = false;
          gestureStateRef.current.lastDirection = null;
          // Reset the gesture trigger flag after a short delay to allow clicks
          setTimeout(() => {
            gestureStateRef.current.hasGestureTriggered = false;
          }, 100);
        }
        return;
      }

      const currentDirection = getGestureDirection(deltaY);

      // Only trigger toggle on direction change or first significant movement
      if (
        currentDirection &&
        currentDirection !== gestureStateRef.current.lastDirection
      ) {
        gestureStateRef.current.lastDirection = currentDirection;
        gestureStateRef.current.hasGestureTriggered = true;
        onGestureToggle?.(bead, currentDirection);
      }
    },
    {
      enabled: enableGestures,
      preventDefault: true,
    },
  ) : () => ({});

  React.useEffect(() => {
    if (enableAnimation) {
      api.start({ x, y, config: { tension: 400, friction: 30, mass: 0.8 } });
    } else {
      api.set({ x, y });
    }
  }, [x, y, enableAnimation, api]);

  // Pulse animation for direction arrows to indicate urgency
  React.useEffect(() => {
    if (showDirectionIndicator && direction && isCurrentStep) {
      const startPulse = () => {
        arrowApi.start({
          from: { arrowPulse: 1 },
          to: async (next) => {
            await next({ arrowPulse: 1.3 });
            await next({ arrowPulse: 1 });
          },
          loop: true,
        });
      };

      const timeoutId = setTimeout(startPulse, 200); // Small delay before starting pulse
      return () => {
        clearTimeout(timeoutId);
        arrowApi.stop();
      };
    } else {
      arrowApi.set({ arrowPulse: 1 });
    }
  }, [showDirectionIndicator, direction, isCurrentStep, arrowApi]);

  const renderShape = () => {
    const halfSize = size / 2;

    switch (shape) {
      case "diamond":
        return (
          <polygon
            points={`${size * 0.7},0 ${size * 1.4},${halfSize} ${size * 0.7},${size} 0,${halfSize}`}
            fill={color}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
      case "square":
        return (
          <rect
            width={size}
            height={size}
            fill={color}
            stroke="#000"
            strokeWidth="0.5"
            rx="1"
          />
        );
      case "circle":
      default:
        return (
          <circle
            cx={halfSize}
            cy={halfSize}
            r={halfSize}
            fill={color}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
    }
  };

  // Use animated.g only if animations are enabled, otherwise use regular g
  const GElement = enableAnimation ? animated.g : 'g';
  const DirectionIndicatorG = (enableAnimation && showDirectionIndicator && direction) ? animated.g : 'g';

  // Calculate correct offset based on shape (matching Typst positioning)
  const getXOffset = () => {
    return shape === "diamond" ? size * 0.7 : size / 2;
  };

  const getYOffset = () => {
    return size / 2; // Y offset is always size/2 for all shapes
  };

  // Calculate static transform for direction indicator
  const getDirectionIndicatorTransform = () => {
    const centerX = shape === "diamond" ? size * 0.7 : size / 2;
    const centerY = size / 2;
    const pulse = enableAnimation ? undefined : 1;
    return `translate(${centerX}, ${centerY}) scale(${pulse})`;
  };

  // Build style object based on animation mode
  const beadStyle: any = enableAnimation
    ? {
        transform: to(
          [springX, springY],
          (sx, sy) =>
            `translate(${sx - getXOffset()}px, ${sy - getYOffset()}px)`,
        ),
        cursor: enableGestures ? "grab" : onClick ? "pointer" : "default",
        touchAction: "none" as const,
        transition: "opacity 0.2s ease-in-out",
      }
    : {
        cursor: enableGestures ? "grab" : onClick ? "pointer" : "default",
        touchAction: "none" as const,
        transition: "opacity 0.2s ease-in-out",
      };

  return (
    <GElement
      ref={onRef}
      {...(enableGestures ? bind() : {})}
      className={`abacus-bead ${bead.active ? "active" : "inactive"} ${hideInactiveBeads && !bead.active ? "hidden-inactive" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={
        onClick
          ? `bead-place-${bead.placeValue}-${bead.type}${bead.type === "earth" ? `-pos-${bead.position}` : ""}`
          : undefined
      }
      transform={
        enableAnimation
          ? undefined
          : `translate(${x - getXOffset()}, ${y - getYOffset()})`
      }
      style={beadStyle}
      onClick={(e) => {
        // Prevent click if a gesture just triggered to avoid double-toggling
        if (enableGestures && gestureStateRef.current.hasGestureTriggered) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }} // Enable click with gesture conflict prevention
    >
      {renderShape()}
      {showDirectionIndicator && direction && (() => {
        const indicatorTransform: any = enableAnimation
          ? to([arrowPulse], (pulse) => {
              const centerX = shape === "diamond" ? size * 0.7 : size / 2;
              const centerY = size / 2;
              return `translate(${centerX}, ${centerY}) scale(${pulse})`;
            })
          : getDirectionIndicatorTransform();

        return (
          <DirectionIndicatorG
            className="direction-indicator"
            style={{ pointerEvents: "none" as const }}
            transform={indicatorTransform}
          >
          {(() => {
            const arrowColors = getArrowColors(
              bead,
              direction,
              totalColumns,
              colorScheme,
              colorPalette,
            );
            const isUpArrow =
              direction === "up" ||
              (direction === "activate" && bead.type === "earth") ||
              (direction === "deactivate" && bead.type === "heaven");

            return isUpArrow ? (
              // Up arrow - centered with color scheme
              <polygon
                points={`${-size * 0.15},${size * 0.05} ${size * 0.15},${size * 0.05} 0,${-size * 0.15}`}
                fill={arrowColors.fill}
                stroke={arrowColors.stroke}
                strokeWidth="1.5"
              />
            ) : (
              // Down arrow - centered with color scheme
              <polygon
                points={`${-size * 0.15},${-size * 0.1} ${size * 0.15},${-size * 0.1} 0,${size * 0.1}`}
                fill={arrowColors.fill}
                stroke={arrowColors.stroke}
                strokeWidth="1.5"
              />
            );
          })()}
          </DirectionIndicatorG>
        );
      })()}
    </GElement>
  );
};

// Main component
export const AbacusReact: React.FC<AbacusConfig> = ({
  value = 0,
  columns = "auto",
  showEmptyColumns = false,
  hideInactiveBeads,
  beadShape,
  colorScheme,
  colorPalette,
  scaleFactor,
  animated,
  interactive,
  gestures,
  showNumbers,
  soundEnabled,
  soundVolume,
  // Advanced customization props
  customStyles,
  callbacks,
  overlays = [],
  highlightColumns = [],
  highlightBeads = [],
  stepBeadHighlights = [],
  currentStep = 0,
  showDirectionIndicators = false,
  disabledColumns = [],
  disabledBeads = [],
  // Legacy callbacks
  onClick,
  onValueChange,
}) => {
  // Try to use context config, fallback to defaults if no context
  let contextConfig;
  try {
    contextConfig = useAbacusConfig();
  } catch {
    // No context provider, use defaults
    contextConfig = getDefaultAbacusConfig();
  }

  // Use props if provided, otherwise fall back to context config
  const finalConfig = {
    hideInactiveBeads: hideInactiveBeads ?? contextConfig.hideInactiveBeads,
    beadShape: beadShape ?? contextConfig.beadShape,
    colorScheme: colorScheme ?? contextConfig.colorScheme,
    colorPalette: colorPalette ?? contextConfig.colorPalette,
    scaleFactor: scaleFactor ?? contextConfig.scaleFactor,
    animated: animated ?? contextConfig.animated,
    interactive: interactive ?? contextConfig.interactive,
    gestures: gestures ?? contextConfig.gestures,
    showNumbers: showNumbers ?? contextConfig.showNumbers,
    soundEnabled: soundEnabled ?? contextConfig.soundEnabled,
    soundVolume: soundVolume ?? contextConfig.soundVolume,
  };
  // Calculate effective columns first, without depending on columnStates
  const effectiveColumns = useMemo(() => {
    if (columns === "auto") {
      const minColumns = Math.max(1, value.toString().length);
      return showEmptyColumns ? minColumns : minColumns;
    }
    return columns;
  }, [columns, value, showEmptyColumns]);

  // Switch to place-value architecture!
  const maxPlaceValue = (effectiveColumns - 1) as ValidPlaceValues;
  const {
    value: currentValue,
    placeStates,
    toggleBead,
    getPlaceState,
    setPlaceState,
  } = useAbacusPlaceStates(value, maxPlaceValue);

  // Legacy compatibility - convert placeStates back to columnStates for components that still need it
  const columnStates = useMemo(() => {
    const states: ColumnState[] = [];
    for (let col = 0; col < effectiveColumns; col++) {
      const placeValue = (effectiveColumns - 1 - col) as ValidPlaceValues;
      const placeState = placeStates.get(placeValue);
      states[col] = placeState
        ? {
            heavenActive: placeState.heavenActive,
            earthActive: placeState.earthActive,
          }
        : { heavenActive: false, earthActive: 0 };
    }
    return states;
  }, [placeStates, effectiveColumns]);

  // Legacy setColumnState for backward compatibility during transition
  const setColumnState = useCallback(
    (columnIndex: number, state: ColumnState) => {
      const placeValue = (effectiveColumns -
        1 -
        columnIndex) as ValidPlaceValues;
      if (placeStates.has(placeValue)) {
        const currentState = placeStates.get(placeValue)!;
        // This would need the place state setter from the hook - simplified for now
        console.warn(
          "setColumnState called - should migrate to place value operations",
        );
      }
    },
    [placeStates, effectiveColumns],
  );

  // Track when changes are from external control vs user interaction
  const isExternalChange = useRef(false);
  const previousControlledValue = useRef(value);

  // Debug prop changes and mark external changes
  React.useEffect(() => {
    // console.log(`🔄 Component received value prop: ${value}, internal value: ${currentValue}`);

    // Mark this as an external change when controlled value prop changes
    if (value !== previousControlledValue.current) {
      isExternalChange.current = true;
    }
  }, [value, currentValue]);

  // Notify about value changes only when user interacts (not external control)
  React.useEffect(() => {
    // Skip callback if this change was from external control
    if (isExternalChange.current) {
      isExternalChange.current = false;
      return;
    }

    // Skip callback if value hasn't actually changed from user interaction
    if (currentValue === previousControlledValue.current) {
      return;
    }

    // This is a user-initiated change, notify parent
    onValueChange?.(currentValue);
  }, [currentValue, onValueChange]);

  // Track controlled value changes
  React.useEffect(() => {
    previousControlledValue.current = value;
  }, [value]);

  const dimensions = useAbacusDimensions(
    effectiveColumns,
    finalConfig.scaleFactor,
    finalConfig.showNumbers,
  );

  // Use new place-value bead calculation!
  const beadStates = useMemo(
    () => calculateBeadStatesFromPlaces(placeStates, maxPlaceValue),
    [placeStates, maxPlaceValue],
  );

  // Layout calculations using exact Typst positioning
  // In Typst, the reckoning bar is positioned at heaven-earth-gap from the top
  const barY = dimensions.heavenEarthGap;

  const handleBeadClick = useCallback(
    (bead: BeadConfig, event?: React.MouseEvent) => {
      // Check if bead is disabled using new place-value system
      const columnIndex = effectiveColumns - 1 - bead.placeValue; // Convert place value to legacy column index for disabled check
      const isDisabled =
        isBeadDisabledByPlaceValue(bead, disabledBeads) ||
        disabledColumns?.includes(columnIndex);

      if (isDisabled) {
        return;
      }

      // Calculate how many beads will change to determine sound intensity
      const currentState = getPlaceState(bead.placeValue);
      let beadMovementCount = 1; // Default for single bead movements

      if (bead.type === "earth") {
        if (bead.active) {
          // Deactivating: count beads from this position to end of active beads
          beadMovementCount = currentState.earthActive - bead.position;
        } else {
          // Activating: count beads from current active count to this position + 1
          beadMovementCount = bead.position + 1 - currentState.earthActive;
        }
      }
      // Heaven bead always moves just 1 bead

      // Create enhanced event object
      const beadClickEvent: BeadClickEvent = {
        bead,
        columnIndex: columnIndex, // Legacy API compatibility
        beadType: bead.type,
        position: bead.position,
        active: bead.active,
        value: bead.value,
        event: event!,
      };

      // Call new callback system
      callbacks?.onBeadClick?.(beadClickEvent);

      // Legacy callback for backward compatibility
      onClick?.(bead);

      // Play sound if enabled with intensity based on bead movement count
      if (finalConfig.soundEnabled) {
        playBeadSound(finalConfig.soundVolume, beadMovementCount);
      }

      // Toggle the bead - NO MORE EFFECTIVECOLUMNS THREADING!
      toggleBead(bead);
    },
    [
      onClick,
      callbacks,
      toggleBead,
      disabledColumns,
      disabledBeads,
      finalConfig.soundEnabled,
      finalConfig.soundVolume,
      getPlaceState,
    ],
  );

  const handleGestureToggle = useCallback(
    (bead: BeadConfig, direction: "activate" | "deactivate") => {
      const currentState = getPlaceState(bead.placeValue);

      // Calculate bead movement count for sound intensity
      let beadMovementCount = 1;
      if (bead.type === "earth") {
        if (direction === "activate") {
          beadMovementCount = Math.max(
            0,
            bead.position + 1 - currentState.earthActive,
          );
        } else {
          beadMovementCount = Math.max(
            0,
            currentState.earthActive - bead.position,
          );
        }
      }

      // Play sound if enabled with intensity
      if (finalConfig.soundEnabled) {
        playBeadSound(finalConfig.soundVolume, beadMovementCount);
      }

      if (bead.type === "heaven") {
        // Heaven bead: directly set the state based on direction
        const newHeavenActive = direction === "activate";
        setPlaceState(bead.placeValue, {
          ...currentState,
          heavenActive: newHeavenActive,
        });
      } else {
        // Earth bead: set the correct number of active earth beads
        const shouldActivate = direction === "activate";
        let newEarthActive;

        if (shouldActivate) {
          // When activating, ensure this bead position and all below are active
          newEarthActive = Math.max(
            currentState.earthActive,
            bead.position + 1,
          );
        } else {
          // When deactivating, ensure this bead position and all above are inactive
          newEarthActive = Math.min(currentState.earthActive, bead.position);
        }

        setPlaceState(bead.placeValue, {
          ...currentState,
          earthActive: newEarthActive,
        });
      }
    },
    [
      getPlaceState,
      setPlaceState,
      finalConfig.soundEnabled,
      finalConfig.soundVolume,
    ],
  );

  // Place value editing - FRESH IMPLEMENTATION
  const [activeColumn, setActiveColumn] = React.useState<number | null>(null);

  // Calculate current place values
  const placeValues = React.useMemo(() => {
    return columnStates.map(
      (state) => (state.heavenActive ? 5 : 0) + state.earthActive,
    );
  }, [columnStates]);

  // Update a column from a digit
  const setColumnValue = React.useCallback(
    (columnIndex: number, digit: number) => {
      if (digit < 0 || digit > 9) return;

      // Convert column index to place value
      const placeValue = (effectiveColumns -
        1 -
        columnIndex) as ValidPlaceValues;
      const currentState = getPlaceState(placeValue);

      // Calculate how many beads change for sound intensity
      const currentValue =
        (currentState.heavenActive ? 5 : 0) + currentState.earthActive;
      const newHeavenActive = digit >= 5;
      const newEarthActive = digit % 5;

      // Count bead movements: heaven bead + earth bead changes
      let beadMovementCount = 0;
      if (currentState.heavenActive !== newHeavenActive) beadMovementCount += 1;
      beadMovementCount += Math.abs(currentState.earthActive - newEarthActive);

      // Play sound if enabled with intensity based on bead changes
      if (finalConfig.soundEnabled && beadMovementCount > 0) {
        playBeadSound(finalConfig.soundVolume, beadMovementCount);
      }

      setPlaceState(placeValue, {
        heavenActive: newHeavenActive,
        earthActive: newEarthActive,
      });
    },
    [
      setPlaceState,
      effectiveColumns,
      finalConfig.soundEnabled,
      finalConfig.soundVolume,
      getPlaceState,
    ],
  );

  // Keyboard handler - only active when interactive
  React.useEffect(() => {
    // Clear activeColumn if abacus becomes non-interactive
    if (!finalConfig.interactive && activeColumn !== null) {
      setActiveColumn(null);
      return;
    }

    // Only set up keyboard listener when interactive
    if (!finalConfig.interactive) {
      return;
    }

    const handleKey = (e: KeyboardEvent) => {
      // console.log(`🎹 KEY: "${e.key}" | activeColumn: ${activeColumn} | code: ${e.code}`);

      if (activeColumn === null) {
        // console.log(`❌ activeColumn is null, ignoring`);
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        // console.log(`🔢 DIGIT: ${e.key} for column ${activeColumn}`);
        e.preventDefault();

        const digit = parseInt(e.key);
        // console.log(`📝 About to call setColumnValue(${activeColumn}, ${digit})`);
        setColumnValue(activeColumn, digit);

        // Move focus to the next column to the right
        const nextColumn = activeColumn + 1;
        if (nextColumn < effectiveColumns) {
          // console.log(`➡️ Moving focus to next column: ${nextColumn}`);
          setActiveColumn(nextColumn);
        } else {
          // console.log(`🏁 Reached last column, staying at: ${activeColumn}`);
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        // console.log(`⬅️ BACKSPACE: clearing current column and moving to previous column`);

        // Clear current column (set to 0)
        setColumnValue(activeColumn, 0);

        // Move focus to the previous column to the left
        const prevColumn = activeColumn - 1;
        if (prevColumn >= 0) {
          // console.log(`⬅️ Moving focus to previous column: ${prevColumn}`);
          setActiveColumn(prevColumn);
        } else {
          // console.log(`🏁 Reached first column, wrapping to last column`);
          setActiveColumn(effectiveColumns - 1); // Wrap around to last column
        }
      } else if (e.key === "Tab" && e.shiftKey) {
        e.preventDefault();
        // console.log(`⬅️ SHIFT+TAB: moving to higher place value (left)`);

        // Shift+Tab moves LEFT (to higher place values): ones → tens → hundreds
        // Lower columnIndex = higher place value
        const nextColumn = activeColumn - 1;
        if (nextColumn >= 0) {
          // console.log(`⬅️ Moving focus to higher place value: ${nextColumn}`);
          setActiveColumn(nextColumn);
        } else {
          // console.log(`🏁 Reached highest place, wrapping to ones place`);
          setActiveColumn(effectiveColumns - 1); // Wrap to rightmost (ones place)
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        // console.log(`➡️ TAB: moving to lower place value (right)`);

        // Tab moves RIGHT (to lower place values): hundreds → tens → ones
        // Higher columnIndex = lower place value
        const nextColumn = activeColumn + 1;
        if (nextColumn < effectiveColumns) {
          // console.log(`➡️ Moving focus to lower place value: ${nextColumn}`);
          setActiveColumn(nextColumn);
        } else {
          // console.log(`🏁 Reached lowest place, wrapping to highest place`);
          setActiveColumn(0); // Wrap to leftmost (highest place)
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        // console.log(`🚪 ESCAPE: setting activeColumn to null`);
        setActiveColumn(null);
      }
    };

    // console.log(`🔧 Setting up keyboard listener for activeColumn: ${activeColumn}`);
    document.addEventListener("keydown", handleKey);
    return () => {
      // console.log(`🗑️ Cleaning up keyboard listener for activeColumn: ${activeColumn}`);
      document.removeEventListener("keydown", handleKey);
    };
  }, [activeColumn, setColumnValue, effectiveColumns, finalConfig.interactive]);

  // Debug activeColumn changes
  React.useEffect(() => {
    // console.log(`🎯 activeColumn changed to: ${activeColumn}`);
  }, [activeColumn]);

  return (
    <div
      className="abacus-container"
      style={{
        display: "inline-block",
        textAlign: "center",
        position: "relative",
      }}
      tabIndex={
        finalConfig.interactive && finalConfig.showNumbers ? 0 : undefined
      }
      onFocus={() => {
        if (
          finalConfig.interactive &&
          finalConfig.showNumbers &&
          activeColumn === null
        ) {
          // Start at the rightmost column (ones place)
          setActiveColumn(effectiveColumns - 1);
        }
      }}
      onBlur={() => {
        if (finalConfig.interactive && finalConfig.showNumbers) {
          setActiveColumn(null);
        }
      }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className={`abacus-svg ${finalConfig.hideInactiveBeads ? "hide-inactive-mode" : ""} ${finalConfig.interactive ? "interactive" : ""}`}
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          <style>{`
          /* CSS-based opacity system for hidden inactive beads */
          .abacus-bead {
            transition: opacity 0.2s ease-in-out;
          }

          /* Hidden inactive beads are invisible by default */
          .hide-inactive-mode .abacus-bead.hidden-inactive {
            opacity: 0;
          }

          /* Interactive abacus: When hovering over the abacus, hidden inactive beads become semi-transparent */
          .abacus-svg.hide-inactive-mode.interactive:hover .abacus-bead.hidden-inactive {
            opacity: 0.5;
          }

          /* Interactive abacus: When hovering over a specific hidden inactive bead, it becomes fully visible */
          .hide-inactive-mode.interactive .abacus-bead.hidden-inactive:hover {
            opacity: 1 !important;
          }

          /* Non-interactive abacus: Hidden inactive beads always stay at opacity 0 */
          .abacus-svg.hide-inactive-mode:not(.interactive) .abacus-bead.hidden-inactive {
            opacity: 0 !important;
          }
        `}</style>
        </defs>

        {/* Background glow effects - rendered behind everything */}
        {Array.from({ length: effectiveColumns }, (_, colIndex) => {
          const placeValue = effectiveColumns - 1 - colIndex;
          const columnStyles = customStyles?.columns?.[colIndex];
          const backgroundGlow = columnStyles?.backgroundGlow;

          if (!backgroundGlow) return null;

          const x =
            colIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;
          const glowWidth =
            dimensions.rodSpacing + (backgroundGlow.spread || 0);
          const glowHeight = dimensions.height + (backgroundGlow.spread || 0);

          return (
            <rect
              key={`background-glow-pv${placeValue}`}
              x={x - glowWidth / 2}
              y={-(backgroundGlow.spread || 0) / 2}
              width={glowWidth}
              height={glowHeight}
              fill={backgroundGlow.fill || "rgba(59, 130, 246, 0.2)"}
              filter={
                backgroundGlow.blur ? `blur(${backgroundGlow.blur}px)` : "none"
              }
              opacity={0.6}
              rx={8}
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {/* Rods - positioned as rectangles like in Typst */}
        {Array.from({ length: effectiveColumns }, (_, colIndex) => {
          const placeValue = effectiveColumns - 1 - colIndex;
          const x =
            colIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;

          // Calculate rod bounds based on visible beads (matching Typst logic)
          const rodStartY = 0; // Start from top for now, will be refined
          const rodEndY = dimensions.height; // End at bottom for now, will be refined

          // Apply custom column post styling (column-specific overrides global)
          const columnStyles = customStyles?.columns?.[colIndex];
          const globalColumnPosts = customStyles?.columnPosts;
          const rodStyle = {
            fill:
              columnStyles?.columnPost?.fill ||
              globalColumnPosts?.fill ||
              "rgb(0, 0, 0, 0.1)", // Default Typst color
            stroke:
              columnStyles?.columnPost?.stroke ||
              globalColumnPosts?.stroke ||
              "none",
            strokeWidth:
              columnStyles?.columnPost?.strokeWidth ??
              globalColumnPosts?.strokeWidth ??
              0,
            opacity:
              columnStyles?.columnPost?.opacity ??
              globalColumnPosts?.opacity ??
              1,
          };

          return (
            <rect
              key={`rod-pv${placeValue}`}
              x={x - dimensions.rodWidth / 2}
              y={rodStartY}
              width={dimensions.rodWidth}
              height={rodEndY - rodStartY}
              fill={rodStyle.fill}
              stroke={rodStyle.stroke}
              strokeWidth={rodStyle.strokeWidth}
              opacity={rodStyle.opacity}
            />
          );
        })}

        {/* Reckoning bar - spans from leftmost to rightmost bead */}
        <rect
          x={dimensions.rodSpacing / 2 - dimensions.beadSize / 2}
          y={barY}
          width={
            (effectiveColumns - 1) * dimensions.rodSpacing + dimensions.beadSize
          }
          height={dimensions.barThickness}
          fill={customStyles?.reckoningBar?.fill || "black"} // Typst default is black
          stroke={customStyles?.reckoningBar?.stroke || "none"}
          strokeWidth={customStyles?.reckoningBar?.strokeWidth ?? 0}
          opacity={customStyles?.reckoningBar?.opacity ?? 1}
        />

        {/* Beads */}
        {beadStates.map((columnBeads, colIndex) =>
          columnBeads.map((bead, beadIndex) => {
            // Render all beads - CSS handles visibility for inactive beads

            // x-offset calculation matching Typst (line 160)
            const x =
              colIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;
            let y: number;

            if (bead.type === "heaven") {
              // Heaven bead positioning - exact Typst formulas (lines 173-179)
              if (bead.active) {
                // Active heaven bead: positioned close to reckoning bar (line 175)
                y =
                  dimensions.heavenEarthGap -
                  dimensions.beadSize / 2 -
                  dimensions.activeGap;
              } else {
                // Inactive heaven bead: positioned away from reckoning bar (line 178)
                y =
                  dimensions.heavenEarthGap -
                  dimensions.inactiveGap -
                  dimensions.beadSize / 2;
              }
            } else {
              // Earth bead positioning - exact Typst formulas (lines 249-261)
              const columnState = columnStates[colIndex];
              if (!columnState) {
                throw new Error(
                  `Invalid abacus state: columnState is undefined for column index ${colIndex}. ` +
                  `effectiveColumns=${effectiveColumns}, columnStates.length=${columnStates.length}, ` +
                  `beadStates.length=${beadStates.length}, placeValue=${bead.placeValue}. ` +
                  `This indicates a mismatch between the number of columns and the bead states. ` +
                  `Please report this issue with the abacus configuration that triggered it.`
                );
              }
              const earthActive = columnState.earthActive;

              if (bead.active) {
                // Active beads: positioned near reckoning bar, adjacent beads touch (line 251)
                y =
                  dimensions.heavenEarthGap +
                  dimensions.barThickness +
                  dimensions.activeGap +
                  dimensions.beadSize / 2 +
                  bead.position *
                    (dimensions.beadSize + dimensions.adjacentSpacing);
              } else {
                // Inactive beads: positioned after active beads + gap (lines 254-261)
                if (earthActive > 0) {
                  // Position after the last active bead + gap, then adjacent inactive beads touch (line 256)
                  y =
                    dimensions.heavenEarthGap +
                    dimensions.barThickness +
                    dimensions.activeGap +
                    dimensions.beadSize / 2 +
                    (earthActive - 1) *
                      (dimensions.beadSize + dimensions.adjacentSpacing) +
                    dimensions.beadSize / 2 +
                    dimensions.inactiveGap +
                    dimensions.beadSize / 2 +
                    (bead.position - earthActive) *
                      (dimensions.beadSize + dimensions.adjacentSpacing);
                } else {
                  // No active beads: position after reckoning bar + gap, adjacent inactive beads touch (line 259)
                  y =
                    dimensions.heavenEarthGap +
                    dimensions.barThickness +
                    dimensions.inactiveGap +
                    dimensions.beadSize / 2 +
                    bead.position *
                      (dimensions.beadSize + dimensions.adjacentSpacing);
                }
              }
            }

            // Check if bead is highlighted - NO MORE EFFECTIVECOLUMNS THREADING!
            const regularHighlight = isBeadHighlightedByPlaceValue(
              bead,
              highlightBeads,
            );
            const stepHighlight = getBeadStepHighlight(
              bead,
              stepBeadHighlights,
              currentStep,
            );
            const isHighlighted =
              regularHighlight || stepHighlight.isHighlighted;

            const color = getBeadColor(
              bead,
              effectiveColumns,
              finalConfig.colorScheme,
              finalConfig.colorPalette,
              isHighlighted,
            );

            // Apply custom styling
            const beadStyle = mergeBeadStyles(
              { fill: color },
              customStyles,
              effectiveColumns - 1 - bead.placeValue, // Convert place value to column index for styling
              bead.type,
              bead.type === "earth" ? bead.position : undefined,
              bead.active,
            );

            // Check if bead is disabled - NO MORE EFFECTIVECOLUMNS THREADING!
            const isDisabled =
              isBeadDisabledByPlaceValue(bead, disabledBeads) ||
              disabledColumns?.includes(effectiveColumns - 1 - bead.placeValue);

            return (
              <Bead
                key={`bead-pv${bead.placeValue}-${bead.type}-${bead.type === "earth" ? bead.position : 0}`}
                bead={bead}
                x={x}
                y={y}
                size={dimensions.beadSize}
                shape={finalConfig.beadShape}
                color={beadStyle.fill || color}
                customStyle={beadStyle}
                isHighlighted={isHighlighted}
                isDisabled={isDisabled}
                enableAnimation={finalConfig.animated}
                enableGestures={finalConfig.interactive || finalConfig.gestures}
                hideInactiveBeads={finalConfig.hideInactiveBeads}
                showDirectionIndicator={
                  showDirectionIndicators && stepHighlight.isCurrentStep
                }
                direction={stepHighlight.direction}
                isCurrentStep={stepHighlight.isCurrentStep}
                onClick={
                  finalConfig.interactive && !isDisabled
                    ? (event) => handleBeadClick(bead, event)
                    : undefined
                }
                onHover={
                  callbacks?.onBeadHover
                    ? (event) => {
                        const beadClickEvent: BeadClickEvent = {
                          bead,
                          columnIndex: effectiveColumns - 1 - bead.placeValue, // Convert place value to column index for callback
                          beadType: bead.type,
                          position: bead.position,
                          active: bead.active,
                          value: bead.value,
                          event,
                        };
                        callbacks.onBeadHover?.(beadClickEvent);
                      }
                    : undefined
                }
                onLeave={
                  callbacks?.onBeadLeave
                    ? (event) => {
                        const beadClickEvent: BeadClickEvent = {
                          bead,
                          columnIndex: effectiveColumns - 1 - bead.placeValue, // Convert place value to column index for callback
                          beadType: bead.type,
                          position: bead.position,
                          active: bead.active,
                          value: bead.value,
                          event,
                        };
                        callbacks.onBeadLeave?.(beadClickEvent);
                      }
                    : undefined
                }
                onGestureToggle={handleGestureToggle}
                onRef={
                  callbacks?.onBeadRef
                    ? (element) => callbacks.onBeadRef!(bead, element)
                    : undefined
                }
                heavenEarthGap={dimensions.heavenEarthGap}
                barY={barY}
                colorScheme={finalConfig.colorScheme}
                colorPalette={finalConfig.colorPalette}
                totalColumns={effectiveColumns}
              />
            );
          }),
        )}

        {/* Background rectangles for place values - in SVG */}
        {finalConfig.showNumbers &&
          placeValues.map((value, columnIndex) => {
            const placeValue = effectiveColumns - 1 - columnIndex;
            const x =
              columnIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;
            // Position background rectangles to match the text positioning
            const baseHeight =
              dimensions.heavenEarthGap +
              5 * (dimensions.beadSize + 4 * finalConfig.scaleFactor) +
              10 * finalConfig.scaleFactor;
            const y = baseHeight + 25;
            const isActive = activeColumn === columnIndex;

            return (
              <rect
                key={`place-bg-pv${placeValue}`}
                x={x - 12 * finalConfig.scaleFactor}
                y={y - 12 * finalConfig.scaleFactor}
                width={24 * finalConfig.scaleFactor}
                height={24 * finalConfig.scaleFactor}
                fill={isActive ? "#e3f2fd" : "#f5f5f5"}
                stroke={isActive ? "#2196f3" : "#ccc"}
                strokeWidth={
                  isActive
                    ? 2 * finalConfig.scaleFactor
                    : 1 * finalConfig.scaleFactor
                }
                rx={3 * finalConfig.scaleFactor}
                style={{
                  cursor: finalConfig.interactive ? "pointer" : "default",
                }}
                onClick={
                  finalConfig.interactive
                    ? () => setActiveColumn(columnIndex)
                    : undefined
                }
              />
            );
          })}

        {/* NumberFlow place value displays - inside SVG using foreignObject */}
        {finalConfig.showNumbers &&
          placeValues.map((value, columnIndex) => {
            const placeValue = effectiveColumns - 1 - columnIndex;
            const x =
              columnIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;
            // Position numbers within the allocated numbers space (below the baseHeight)
            const baseHeight =
              dimensions.heavenEarthGap +
              5 * (dimensions.beadSize + 4 * finalConfig.scaleFactor) +
              10 * finalConfig.scaleFactor;
            const y = baseHeight + 25;

            return (
              <foreignObject
                key={`place-number-pv${placeValue}`}
                x={x - 12 * finalConfig.scaleFactor}
                y={y - 8 * finalConfig.scaleFactor}
                width={24 * finalConfig.scaleFactor}
                height={16 * finalConfig.scaleFactor}
                style={{ pointerEvents: "none" }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: `${Math.max(8, 14 * finalConfig.scaleFactor)}px`,
                    fontFamily: "monospace",
                    fontWeight: "bold",
                    pointerEvents: finalConfig.interactive ? "auto" : "none",
                    cursor: finalConfig.interactive ? "pointer" : "default",
                  }}
                  onClick={
                    finalConfig.interactive
                      ? () => setActiveColumn(columnIndex)
                      : undefined
                  }
                >
                  <NumberFlow
                    value={value}
                    format={{ style: "decimal" }}
                    style={{
                      fontFamily: "monospace",
                      fontWeight: "bold",
                      fontSize: `${Math.max(8, 14 * finalConfig.scaleFactor)}px`,
                    }}
                  />
                </div>
              </foreignObject>
            );
          })}

        {/* Overlay system for tooltips, arrows, highlights, etc. */}
        {overlays.map((overlay) => {
          if (overlay.visible === false) return null;

          let position = { x: 0, y: 0 };

          // Calculate overlay position based on target
          if (overlay.target.type === "bead") {
            // Find the bead position
            const targetColumn = overlay.target.columnIndex;
            const targetBeadType = overlay.target.beadType;
            const targetBeadPosition = overlay.target.beadPosition;

            if (targetColumn !== undefined && targetBeadType) {
              const x =
                targetColumn * dimensions.rodSpacing +
                dimensions.rodSpacing / 2;
              let y = 0;

              if (targetBeadType === "heaven") {
                const columnState = columnStates[targetColumn];
                if (!columnState) {
                  console.error(
                    `Invalid abacus overlay: columnState is undefined for overlay targeting column ${targetColumn}`
                  );
                  return;
                }
                y = columnState.heavenActive
                  ? dimensions.heavenEarthGap -
                    dimensions.beadSize / 2 -
                    dimensions.activeGap
                  : dimensions.heavenEarthGap -
                    dimensions.inactiveGap -
                    dimensions.beadSize / 2;
              } else if (
                targetBeadType === "earth" &&
                targetBeadPosition !== undefined
              ) {
                const columnState = columnStates[targetColumn];
                if (!columnState) {
                  console.error(
                    `Invalid abacus overlay: columnState is undefined for overlay targeting column ${targetColumn}`
                  );
                  return;
                }
                const earthActive = columnState.earthActive;
                const isActive = targetBeadPosition < earthActive;

                if (isActive) {
                  y =
                    dimensions.heavenEarthGap +
                    dimensions.barThickness +
                    dimensions.activeGap +
                    dimensions.beadSize / 2 +
                    targetBeadPosition *
                      (dimensions.beadSize + dimensions.adjacentSpacing);
                } else {
                  if (earthActive > 0) {
                    y =
                      dimensions.heavenEarthGap +
                      dimensions.barThickness +
                      dimensions.activeGap +
                      dimensions.beadSize / 2 +
                      (earthActive - 1) *
                        (dimensions.beadSize + dimensions.adjacentSpacing) +
                      dimensions.beadSize / 2 +
                      dimensions.inactiveGap +
                      dimensions.beadSize / 2 +
                      (targetBeadPosition - earthActive) *
                        (dimensions.beadSize + dimensions.adjacentSpacing);
                  } else {
                    y =
                      dimensions.heavenEarthGap +
                      dimensions.barThickness +
                      dimensions.inactiveGap +
                      dimensions.beadSize / 2 +
                      targetBeadPosition *
                        (dimensions.beadSize + dimensions.adjacentSpacing);
                  }
                }
              }

              position = calculateOverlayPosition(
                overlay,
                dimensions,
                targetColumn,
                { x, y },
              );
            }
          } else {
            position = calculateOverlayPosition(overlay, dimensions);
          }

          return (
            <foreignObject
              key={overlay.id}
              x={position.x}
              y={position.y}
              width="200"
              height="100"
              style={{
                overflow: "visible",
                pointerEvents: "none",
                ...overlay.style,
              }}
              className={overlay.className}
            >
              <div style={{ position: "relative", pointerEvents: "none" }}>
                {overlay.content}
              </div>
            </foreignObject>
          );
        })}

        {/* Column interaction areas - rendered last to be on top of all other elements */}
        {Array.from({ length: effectiveColumns }, (_, colIndex) => {
          const placeValue = effectiveColumns - 1 - colIndex;
          const x =
            colIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;
          const columnStyles = customStyles?.columns?.[colIndex];
          const hasColumnHighlight = columnStyles?.columnPost;

          const backgroundWidth = dimensions.rodSpacing; // Full column width for better interaction
          const backgroundHeight = dimensions.height;

          return (
            <rect
              key={`column-interaction-pv${placeValue}`}
              x={x - backgroundWidth / 2}
              y={0}
              width={backgroundWidth}
              height={backgroundHeight}
              fill="transparent"
              stroke="none"
              style={{
                cursor:
                  callbacks?.onColumnClick || callbacks?.onColumnHover
                    ? "pointer"
                    : "default",
                pointerEvents:
                  callbacks?.onColumnClick || callbacks?.onColumnHover
                    ? "all"
                    : "none", // Only capture events when callbacks exist
              }}
              onClick={(e) => callbacks?.onColumnClick?.(colIndex, e)}
              onMouseEnter={(e) => callbacks?.onColumnHover?.(colIndex, e)}
              onMouseLeave={(e) => callbacks?.onColumnLeave?.(colIndex, e)}
            />
          );
        })}
      </svg>
    </div>
  );
};

export default AbacusReact;
