'use client'

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useSpring, animated, config, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import NumberFlow from '@number-flow/react';
import { useAbacusConfig, getDefaultAbacusConfig } from './AbacusContext';

// Types
export interface BeadConfig {
  type: 'heaven' | 'earth';
  value: number;
  active: boolean;
  position: number; // 0-based position within its type group
  columnIndex: number;
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
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  className?: string;
}

export interface ReckoningBarStyle {
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
export type PlaceValue = number & { readonly __brand: 'PlaceValue' };
export type ColumnIndex = number & { readonly __brand: 'ColumnIndex' };

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
  beadType: 'heaven' | 'earth';
  position?: EarthBeadPosition; // for earth beads, 0-3
}

// Legacy column-index based bead specification
export interface ColumnIndexBead {
  columnIndex: number; // array index (0=leftmost)
  beadType: 'heaven' | 'earth';
  position?: EarthBeadPosition; // for earth beads, 0-3
}

// Type-safe conversion utilities
export namespace PlaceValueUtils {
  export function toColumnIndex(placeValue: ValidPlaceValues, totalColumns: number): number {
    const result = totalColumns - 1 - placeValue;
    if (result < 0 || result >= totalColumns) {
      throw new Error(`Place value ${placeValue} is out of range for ${totalColumns} columns`);
    }
    return result;
  }

  export function fromColumnIndex(columnIndex: number, totalColumns: number): ValidPlaceValues {
    const result = totalColumns - 1 - columnIndex;
    if (result < 0 || result > 9) {
      throw new Error(`Column index ${columnIndex} maps to invalid place value ${result}`);
    }
    return result as ValidPlaceValues;
  }

  // Type-safe creation helpers
  export const ones = (): PlaceValueBead['placeValue'] => 0;
  export const tens = (): PlaceValueBead['placeValue'] => 1;
  export const hundreds = (): PlaceValueBead['placeValue'] => 2;
  export const thousands = (): PlaceValueBead['placeValue'] => 3;
}

// Union type for backward compatibility
export type BeadHighlight = PlaceValueBead | ColumnIndexBead;

// Type guards to distinguish between the two APIs
export function isPlaceValueBead(bead: BeadHighlight): bead is PlaceValueBead {
  return 'placeValue' in bead;
}

export function isColumnIndexBead(bead: BeadHighlight): bead is ColumnIndexBead {
  return 'columnIndex' in bead;
}

// Event system
export interface BeadClickEvent {
  bead: BeadConfig;
  columnIndex: number;
  beadType: 'heaven' | 'earth';
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
  onNumeralClick?: (columnIndex: number, value: number, event: React.MouseEvent) => void;
  onValueChange?: (newValue: number) => void;
  onBeadRef?: (bead: BeadConfig, element: SVGElement | null) => void;
  // Legacy callback for backward compatibility
  onClick?: (bead: BeadConfig) => void;
}

// Overlay and injection system
export interface AbacusOverlay {
  id: string;
  type: 'tooltip' | 'arrow' | 'highlight' | 'custom';
  target: {
    type: 'bead' | 'column' | 'numeral' | 'bar' | 'coordinates';
    columnIndex?: number;
    beadType?: 'heaven' | 'earth';
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
  value?: number;
  columns?: number | 'auto';
  showEmptyColumns?: boolean;
  hideInactiveBeads?: boolean;
  beadShape?: 'diamond' | 'square' | 'circle';
  colorScheme?: 'monochrome' | 'place-value' | 'alternating' | 'heaven-earth';
  colorPalette?: 'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature';
  scaleFactor?: number;
  animated?: boolean;
  interactive?: boolean;
  gestures?: boolean;
  showNumbers?: boolean;

  // Advanced customization
  customStyles?: AbacusCustomStyles;
  callbacks?: AbacusCallbacks;
  overlays?: AbacusOverlay[];

  // Tutorial and accessibility features
  highlightColumns?: number[]; // Highlight specific columns (legacy - array indices)
  highlightBeads?: BeadHighlight[]; // Support both place-value and column-index based highlighting
  disabledColumns?: number[]; // Disable interaction on specific columns (legacy - array indices)
  disabledBeads?: BeadHighlight[]; // Support both place-value and column-index based disabling

  // Legacy callbacks for backward compatibility
  onClick?: (bead: BeadConfig) => void;
  onValueChange?: (newValue: number) => void;
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
  showNumbers: boolean = false
): AbacusDimensions {
  return useMemo(() => {
    // Exact Typst parameters (lines 33-39 in flashcards.typ)
    const rodWidth = 3 * scaleFactor;
    const beadSize = 12 * scaleFactor;
    const adjacentSpacing = 0.5 * scaleFactor;  // Minimal spacing for adjacent beads of same type
    const columnSpacing = 25 * scaleFactor;     // rod spacing
    const heavenEarthGap = 30 * scaleFactor;
    const barThickness = 2 * scaleFactor;

    // Positioning gaps (lines 169-170 in flashcards.typ)
    const activeGap = 1 * scaleFactor;         // Gap between active beads and reckoning bar
    const inactiveGap = 8 * scaleFactor;       // Gap between inactive beads and active beads/bar

    // Calculate total dimensions based on Typst logic (line 154-155)
    const totalWidth = columns * columnSpacing;
    const baseHeight = heavenEarthGap + 5 * (beadSize + 4 * scaleFactor) + 10 * scaleFactor;

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
      adjacentSpacing
    };
  }, [columns, scaleFactor, showNumbers]);
}

// Independent column state for heaven and earth beads
interface ColumnState {
  heavenActive: boolean;  // true if heaven bead (value 5) is active
  earthActive: number;    // 0-4, number of active earth beads
}

export function useAbacusState(initialValue: number = 0, targetColumns?: number) {
  // Initialize state from the initial value
  const initializeFromValue = useCallback((value: number, minColumns?: number): ColumnState[] => {
    if (value === 0) {
      // Special case: for value 0, use minColumns if provided, otherwise single column
      const columnCount = minColumns || 1;
      return Array(columnCount).fill(null).map(() => ({ heavenActive: false, earthActive: 0 }));
    }
    const digits = value.toString().split('').map(Number);
    const result = digits.map(digit => ({
      heavenActive: digit >= 5,
      earthActive: digit % 5
    }));

    // Ensure we have at least minColumns if specified
    if (minColumns && result.length < minColumns) {
      const paddingNeeded = minColumns - result.length;
      const padding = Array(paddingNeeded).fill(null).map(() => ({ heavenActive: false, earthActive: 0 }));
      return [...padding, ...result];
    }

    return result;
  }, [targetColumns]);

  const [columnStates, setColumnStates] = useState<ColumnState[]>(() => initializeFromValue(initialValue, targetColumns));

  // Calculate current value from independent column states
  const value = useMemo(() => {
    return columnStates.reduce((total, columnState, index) => {
      const placeValue = Math.pow(10, columnStates.length - index - 1);
      const columnValue = (columnState.heavenActive ? 5 : 0) + columnState.earthActive;
      return total + (columnValue * placeValue);
    }, 0);
  }, [columnStates]);

  const setValue = useCallback((newValue: number) => {
    setColumnStates(initializeFromValue(newValue, targetColumns));
  }, [initializeFromValue, targetColumns]);

  const getColumnState = useCallback((columnIndex: number): ColumnState => {
    return columnStates[columnIndex] || { heavenActive: false, earthActive: 0 };
  }, [columnStates]);

  const setColumnState = useCallback((columnIndex: number, newState: ColumnState) => {
    setColumnStates(prev => {
      const newStates = [...prev];
      // Extend array if necessary
      while (newStates.length <= columnIndex) {
        newStates.push({ heavenActive: false, earthActive: 0 });
      }
      newStates[columnIndex] = newState;
      return newStates;
    });
  }, []);

  const toggleBead = useCallback((bead: BeadConfig, totalColumns: number) => {
    const currentState = getColumnState(bead.columnIndex);

    if (bead.type === 'heaven') {
      // Toggle heaven bead independently
      setColumnState(bead.columnIndex, {
        ...currentState,
        heavenActive: !currentState.heavenActive
      });
    } else {
      // Toggle earth bead - affects the number of active earth beads
      if (bead.active) {
        // Deactivate this bead and all higher positioned earth beads
        setColumnState(bead.columnIndex, {
          ...currentState,
          earthActive: Math.min(currentState.earthActive, bead.position)
        });
      } else {
        // Activate this bead and all lower positioned earth beads
        setColumnState(bead.columnIndex, {
          ...currentState,
          earthActive: Math.max(currentState.earthActive, bead.position + 1)
        });
      }
    }
  }, [getColumnState, setColumnState]);

  return {
    value,
    setValue,
    columnStates,
    getColumnState,
    setColumnState,
    toggleBead
  };
}

// Utility functions for customization system
function mergeBeadStyles(
  baseStyle: BeadStyle,
  customStyles?: AbacusCustomStyles,
  columnIndex?: number,
  beadType?: 'heaven' | 'earth',
  position?: number,
  isActive?: boolean
): BeadStyle {
  let mergedStyle = { ...baseStyle };

  // Apply global bead type styles
  if (customStyles?.heavenBeads && beadType === 'heaven') {
    mergedStyle = { ...mergedStyle, ...customStyles.heavenBeads };
  }
  if (customStyles?.earthBeads && beadType === 'earth') {
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
    if (columnStyles.heavenBeads && beadType === 'heaven') {
      mergedStyle = { ...mergedStyle, ...columnStyles.heavenBeads };
    }
    if (columnStyles.earthBeads && beadType === 'earth') {
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
    if (beadType === 'heaven' && beadStyles.heaven) {
      mergedStyle = { ...mergedStyle, ...beadStyles.heaven };
    }
    if (beadType === 'earth' && position !== undefined && beadStyles.earth?.[position]) {
      mergedStyle = { ...mergedStyle, ...beadStyles.earth[position] };
    }
  }

  return mergedStyle;
}

// Convert BeadHighlight to column index for internal use
function normalizeBeadHighlight(bead: BeadHighlight, totalColumns: number): ColumnIndexBead {
  if (isPlaceValueBead(bead)) {
    try {
      const columnIndex = PlaceValueUtils.toColumnIndex(bead.placeValue, totalColumns);
      return {
        columnIndex,
        beadType: bead.beadType,
        position: bead.position
      };
    } catch (error) {
      console.warn(`${error instanceof Error ? error.message : error}. Using ones place (0) instead.`);
      return {
        columnIndex: totalColumns - 1, // Default to ones place
        beadType: bead.beadType,
        position: bead.position
      };
    }
  } else {
    // Legacy columnIndex API - show deprecation warning
    if (process.env.NODE_ENV === 'development') {
      try {
        const placeValue = PlaceValueUtils.fromColumnIndex(bead.columnIndex, totalColumns);
        console.warn(
          `Deprecated: Using columnIndex (${bead.columnIndex}) is deprecated. ` +
          `Use placeValue (${placeValue}) instead. ` +
          `Migration: Change { columnIndex: ${bead.columnIndex} } to { placeValue: ${placeValue} }`
        );
      } catch {
        console.warn(
          `Deprecated: Using columnIndex (${bead.columnIndex}) is deprecated and invalid for ${totalColumns} columns. ` +
          `Use placeValue API instead.`
        );
      }
    }
    return bead; // Already a ColumnIndexBead
  }
}

function isBeadHighlighted(
  columnIndex: number,
  beadType: 'heaven' | 'earth',
  position: number | undefined,
  highlightBeads?: BeadHighlight[],
  totalColumns?: number
): boolean {
  if (!highlightBeads || !totalColumns) return false;

  return highlightBeads.some(highlight => {
    const normalizedHighlight = normalizeBeadHighlight(highlight, totalColumns);
    return normalizedHighlight.columnIndex === columnIndex &&
           normalizedHighlight.beadType === beadType &&
           (normalizedHighlight.position === undefined || normalizedHighlight.position === position);
  });
}

function isBeadDisabled(
  columnIndex: number,
  beadType: 'heaven' | 'earth',
  position: number | undefined,
  disabledColumns?: number[],
  disabledBeads?: BeadHighlight[],
  totalColumns?: number
): boolean {
  // Check if entire column is disabled (legacy column index system)
  if (disabledColumns?.includes(columnIndex)) {
    return true;
  }

  // Check if specific bead is disabled
  if (!disabledBeads || !totalColumns) return false;

  return disabledBeads.some(disabled => {
    const normalizedDisabled = normalizeBeadHighlight(disabled, totalColumns);
    return normalizedDisabled.columnIndex === columnIndex &&
           normalizedDisabled.beadType === beadType &&
           (normalizedDisabled.position === undefined || normalizedDisabled.position === position);
  });
}

function calculateOverlayPosition(
  overlay: AbacusOverlay,
  dimensions: AbacusDimensions,
  columnIndex?: number,
  beadPosition?: { x: number; y: number }
): { x: number; y: number } {
  let x = 0;
  let y = 0;

  switch (overlay.target.type) {
    case 'coordinates':
      x = overlay.target.x || 0;
      y = overlay.target.y || 0;
      break;

    case 'bead':
      if (beadPosition) {
        x = beadPosition.x;
        y = beadPosition.y;
      }
      break;

    case 'column':
      if (overlay.target.columnIndex !== undefined) {
        x = (overlay.target.columnIndex * dimensions.rodSpacing) + (dimensions.rodSpacing / 2);
        y = dimensions.height / 2;
      }
      break;

    case 'numeral':
      if (overlay.target.columnIndex !== undefined) {
        x = (overlay.target.columnIndex * dimensions.rodSpacing) + (dimensions.rodSpacing / 2);
        const baseHeight = dimensions.heavenEarthGap + 5 * (dimensions.beadSize + 4) + 10;
        y = baseHeight + 25;
      }
      break;

    case 'bar':
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
  default: ['#2E86AB', '#A23B72', '#F18F01', '#6A994E', '#BC4B51'],
  colorblind: ['#0173B2', '#DE8F05', '#CC78BC', '#029E73', '#D55E00'],
  mnemonic: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'],
  grayscale: ['#000000', '#404040', '#808080', '#b0b0b0', '#d0d0d0'],
  nature: ['#4E79A7', '#F28E2C', '#E15759', '#76B7B2', '#59A14F']
};

// Utility functions
function getBeadColor(
  bead: BeadConfig,
  totalColumns: number,
  colorScheme: string,
  colorPalette: string
): string {
  const inactiveColor = 'rgb(211, 211, 211)'; // Typst uses gray.lighten(70%)

  if (!bead.active) return inactiveColor;

  switch (colorScheme) {
    case 'place-value': {
      const placeIndex = totalColumns - bead.columnIndex - 1;
      const colors = COLOR_PALETTES[colorPalette as keyof typeof COLOR_PALETTES] || COLOR_PALETTES.default;
      return colors[placeIndex % colors.length];
    }
    case 'alternating':
      return bead.columnIndex % 2 === 0 ? '#1E88E5' : '#43A047';
    case 'heaven-earth':
      return bead.type === 'heaven' ? '#F18F01' : '#2E86AB'; // Exact Typst colors (lines 228, 265)
    default:
      return '#000000';
  }
}

function calculateBeadStates(columnStates: ColumnState[], originalLength: number): BeadConfig[][] {
  return columnStates.map((columnState, arrayIndex) => {
    const beads: BeadConfig[] = [];
    // Each column maps to its array index since columnStates should match display columns
    const logicalColumnIndex = arrayIndex;

    // Heaven bead (value 5) - independent state
    beads.push({
      type: 'heaven',
      value: 5,
      active: columnState.heavenActive,
      position: 0,
      columnIndex: logicalColumnIndex
    });

    // Earth beads (4 beads, each value 1) - independent state
    for (let i = 0; i < 4; i++) {
      beads.push({
        type: 'earth',
        value: 1,
        active: i < columnState.earthActive,
        position: i,
        columnIndex: logicalColumnIndex
      });
    }

    return beads;
  });
}

// Calculate numeric value from column states
function calculateValueFromColumnStates(columnStates: ColumnState[], totalColumns: number): number {
  let value = 0;

  columnStates.forEach((columnState, index) => {
    const placeValue = Math.pow(10, totalColumns - 1 - index);
    const columnValue = (columnState.heavenActive ? 5 : 0) + columnState.earthActive;
    value += columnValue * placeValue;
  });

  return value;
}


// Components
interface BeadProps {
  bead: BeadConfig;
  x: number;
  y: number;
  size: number;
  shape: 'diamond' | 'square' | 'circle';
  color: string;
  customStyle?: BeadStyle;
  isHighlighted?: boolean;
  isDisabled?: boolean;
  enableAnimation: boolean;
  enableGestures?: boolean;
  hideInactiveBeads?: boolean;
  onClick?: (event: React.MouseEvent) => void;
  onHover?: (event: React.MouseEvent) => void;
  onLeave?: (event: React.MouseEvent) => void;
  onGestureToggle?: (bead: BeadConfig, direction: 'activate' | 'deactivate') => void;
  onRef?: (element: SVGElement | null) => void;
  heavenEarthGap: number;
  barY: number;
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
  onClick,
  onHover,
  onLeave,
  onGestureToggle,
  onRef,
  heavenEarthGap,
  barY
}) => {
  const [{ x: springX, y: springY }, api] = useSpring(() => ({ x, y }));
  const gestureStateRef = useRef({
    isDragging: false,
    lastDirection: null as 'activate' | 'deactivate' | null,
    startY: 0,
    threshold: size * 0.3, // Minimum movement to trigger toggle
    hasGestureTriggered: false // Track if a gesture has triggered to avoid click conflicts
  });

  // Calculate gesture direction based on bead type and position
  const getGestureDirection = useCallback((deltaY: number) => {
    const movement = Math.abs(deltaY);
    if (movement < gestureStateRef.current.threshold) return null;

    if (bead.type === 'heaven') {
      // Heaven bead: down toward bar = activate, up away from bar = deactivate
      return deltaY > 0 ? 'activate' : 'deactivate';
    } else {
      // Earth bead: up toward bar = activate, down away from bar = deactivate
      return deltaY < 0 ? 'activate' : 'deactivate';
    }
  }, [bead.type]);

  // Directional gesture handler
  const bind = useDrag(
    ({
      event,
      movement: [, deltaY],
      first,
      active
    }) => {
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
      if (currentDirection && currentDirection !== gestureStateRef.current.lastDirection) {
        gestureStateRef.current.lastDirection = currentDirection;
        gestureStateRef.current.hasGestureTriggered = true;
        onGestureToggle?.(bead, currentDirection);
      }
    },
    {
      enabled: enableGestures,
      preventDefault: true
    }
  );

  React.useEffect(() => {
    if (enableAnimation) {
      api.start({ x, y, config: { tension: 400, friction: 30, mass: 0.8 } });
    } else {
      api.set({ x, y });
    }
  }, [x, y, enableAnimation, api]);

  const renderShape = () => {
    const halfSize = size / 2;

    switch (shape) {
      case 'diamond':
        return (
          <polygon
            points={`${size * 0.7},0 ${size * 1.4},${halfSize} ${size * 0.7},${size} 0,${halfSize}`}
            fill={color}
            stroke="#000"
            strokeWidth="0.5"
          />
        );
      case 'square':
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
      case 'circle':
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

  const AnimatedG = animated.g;

  // Calculate correct offset based on shape (matching Typst positioning)
  const getXOffset = () => {
    return shape === 'diamond' ? size * 0.7 : size / 2;
  };

  const getYOffset = () => {
    return size / 2; // Y offset is always size/2 for all shapes
  };

  return (
    <AnimatedG
      ref={onRef}
      {...(enableGestures ? bind() : {})}
      className={`abacus-bead ${bead.active ? 'active' : 'inactive'} ${hideInactiveBeads && !bead.active ? 'hidden-inactive' : ''}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      data-testid={onClick ? `bead-col-${bead.columnIndex}-${bead.type}${bead.type === 'earth' ? `-pos-${bead.position}` : ''}` : undefined}
      transform={enableAnimation ? undefined : `translate(${x - getXOffset()}, ${y - getYOffset()})`}
      style={
        enableAnimation
          ? {
              transform: to([springX, springY], (sx, sy) => `translate(${sx - getXOffset()}px, ${sy - getYOffset()}px)`),
              cursor: enableGestures ? 'grab' : (onClick ? 'pointer' : 'default'),
              touchAction: 'none',
              transition: 'opacity 0.2s ease-in-out'
            }
          : {
              cursor: enableGestures ? 'grab' : (onClick ? 'pointer' : 'default'),
              touchAction: 'none',
              transition: 'opacity 0.2s ease-in-out'
            }
      }
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
    </AnimatedG>
  );
};

// Main component
export const AbacusReact: React.FC<AbacusConfig> = ({
  value = 0,
  columns = 'auto',
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
  // Advanced customization props
  customStyles,
  callbacks,
  overlays = [],
  highlightColumns = [],
  highlightBeads = [],
  disabledColumns = [],
  disabledBeads = [],
  // Legacy callbacks
  onClick,
  onValueChange
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
    showNumbers: showNumbers ?? contextConfig.showNumbers
  };
  // Calculate effective columns first, without depending on columnStates
  const effectiveColumns = useMemo(() => {
    if (columns === 'auto') {
      const minColumns = Math.max(1, value.toString().length);
      return showEmptyColumns ? minColumns : minColumns;
    }
    return columns;
  }, [columns, value, showEmptyColumns]);

  const { value: currentValue, columnStates, toggleBead, setColumnState } = useAbacusState(value, effectiveColumns);

  // Debug prop changes
  React.useEffect(() => {
    // console.log(`🔄 Component received value prop: ${value}, internal value: ${currentValue}`);
  }, [value, currentValue]);

  // Notify about value changes
  React.useEffect(() => {
    onValueChange?.(currentValue);
  }, [currentValue, onValueChange]);


  const dimensions = useAbacusDimensions(effectiveColumns, finalConfig.scaleFactor, finalConfig.showNumbers);

  const beadStates = useMemo(
    () => calculateBeadStates(columnStates, columnStates.length),
    [columnStates]
  );

  // Layout calculations using exact Typst positioning
  // In Typst, the reckoning bar is positioned at heaven-earth-gap from the top
  const barY = dimensions.heavenEarthGap;



  const handleBeadClick = useCallback((bead: BeadConfig, event?: React.MouseEvent) => {
    // Check if bead is disabled
    const isDisabled = isBeadDisabled(
      bead.columnIndex,
      bead.type,
      bead.type === 'earth' ? bead.position : undefined,
      disabledColumns,
      disabledBeads,
      effectiveColumns
    );

    if (isDisabled) {
      return;
    }

    // Create enhanced event object
    const beadClickEvent: BeadClickEvent = {
      bead,
      columnIndex: bead.columnIndex,
      beadType: bead.type,
      position: bead.position,
      active: bead.active,
      value: bead.value,
      event: event!
    };

    // Call new callback system
    callbacks?.onBeadClick?.(beadClickEvent);

    // Legacy callback for backward compatibility
    onClick?.(bead);

    // Toggle the bead
    toggleBead(bead, effectiveColumns);
  }, [onClick, callbacks, toggleBead, effectiveColumns, disabledColumns, disabledBeads]);

  const handleGestureToggle = useCallback((bead: BeadConfig, direction: 'activate' | 'deactivate') => {
    const currentState = columnStates[bead.columnIndex];

    if (bead.type === 'heaven') {
      // Heaven bead: directly set the state based on direction
      const newHeavenActive = direction === 'activate';
      setColumnState(bead.columnIndex, {
        ...currentState,
        heavenActive: newHeavenActive
      });
    } else {
      // Earth bead: set the correct number of active earth beads
      const shouldActivate = direction === 'activate';
      let newEarthActive;

      if (shouldActivate) {
        // When activating, ensure this bead position and all below are active
        newEarthActive = Math.max(currentState.earthActive, bead.position + 1);
      } else {
        // When deactivating, ensure this bead position and all above are inactive
        newEarthActive = Math.min(currentState.earthActive, bead.position);
      }

      setColumnState(bead.columnIndex, {
        ...currentState,
        earthActive: newEarthActive
      });
    }
  }, [columnStates, setColumnState]);

  // Place value editing - FRESH IMPLEMENTATION
  const [activeColumn, setActiveColumn] = React.useState<number | null>(null);

  // Calculate current place values
  const placeValues = React.useMemo(() => {
    return columnStates.map(state =>
      (state.heavenActive ? 5 : 0) + state.earthActive
    );
  }, [columnStates]);

  // Update a column from a digit
  const setColumnValue = React.useCallback((columnIndex: number, digit: number) => {
    if (digit < 0 || digit > 9) return;

    setColumnState(columnIndex, {
      heavenActive: digit >= 5,
      earthActive: digit % 5
    });
  }, [setColumnState]);

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

      if (e.key >= '0' && e.key <= '9') {
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
      } else if (e.key === 'Backspace' || (e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        // console.log(`⬅️ ${e.key === 'Backspace' ? 'BACKSPACE' : 'SHIFT+TAB'}: moving to previous column`);

        // Move focus to the previous column to the left
        const prevColumn = activeColumn - 1;
        if (prevColumn >= 0) {
          // console.log(`⬅️ Moving focus to previous column: ${prevColumn}`);
          setActiveColumn(prevColumn);
        } else {
          // console.log(`🏁 Reached first column, wrapping to last column`);
          setActiveColumn(effectiveColumns - 1); // Wrap around to last column
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        // console.log(`🔄 TAB: moving to next column`);

        // Move focus to the next column to the right
        const nextColumn = activeColumn + 1;
        if (nextColumn < effectiveColumns) {
          // console.log(`➡️ Moving focus to next column: ${nextColumn}`);
          setActiveColumn(nextColumn);
        } else {
          // console.log(`🏁 Reached last column, wrapping to first column`);
          setActiveColumn(0); // Wrap around to first column
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // console.log(`🚪 ESCAPE: setting activeColumn to null`);
        setActiveColumn(null);
      }
    };

    // console.log(`🔧 Setting up keyboard listener for activeColumn: ${activeColumn}`);
    document.addEventListener('keydown', handleKey);
    return () => {
      // console.log(`🗑️ Cleaning up keyboard listener for activeColumn: ${activeColumn}`);
      document.removeEventListener('keydown', handleKey);
    };
  }, [activeColumn, setColumnValue, effectiveColumns, finalConfig.interactive]);

  // Debug activeColumn changes
  React.useEffect(() => {
    // console.log(`🎯 activeColumn changed to: ${activeColumn}`);
  }, [activeColumn]);

  return (
    <div
      className="abacus-container"
      style={{ display: 'inline-block', textAlign: 'center', position: 'relative' }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className={`abacus-svg ${finalConfig.hideInactiveBeads ? 'hide-inactive-mode' : ''} ${finalConfig.interactive ? 'interactive' : ''}`}
        style={{ overflow: 'visible', display: 'block' }}
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
      {/* Rods - positioned as rectangles like in Typst */}
      {Array.from({ length: effectiveColumns }, (_, colIndex) => {
        const x = (colIndex * dimensions.rodSpacing) + dimensions.rodSpacing / 2;

        // Calculate rod bounds based on visible beads (matching Typst logic)
        const rodStartY = 0; // Start from top for now, will be refined
        const rodEndY = dimensions.height; // End at bottom for now, will be refined

        return (
          <rect
            key={`rod-${colIndex}`}
            x={x - dimensions.rodWidth / 2}
            y={rodStartY}
            width={dimensions.rodWidth}
            height={rodEndY - rodStartY}
            fill="rgb(0, 0, 0, 0.1)" // Typst uses gray.lighten(80%)
            stroke="none"
          />
        );
      })}

      {/* Reckoning bar - matching Typst implementation */}
      <rect
        x={0}
        y={barY}
        width={dimensions.width}
        height={dimensions.barThickness}
        fill="black" // Typst uses black
        stroke="none"
      />

      {/* Beads */}
      {beadStates.map((columnBeads, colIndex) =>
        columnBeads.map((bead, beadIndex) => {
          // Render all beads - CSS handles visibility for inactive beads

          // x-offset calculation matching Typst (line 160)
          const x = (colIndex * dimensions.rodSpacing) + dimensions.rodSpacing / 2;
          let y: number;

          if (bead.type === 'heaven') {
            // Heaven bead positioning - exact Typst formulas (lines 173-179)
            if (bead.active) {
              // Active heaven bead: positioned close to reckoning bar (line 175)
              y = dimensions.heavenEarthGap - dimensions.beadSize / 2 - dimensions.activeGap;
            } else {
              // Inactive heaven bead: positioned away from reckoning bar (line 178)
              y = dimensions.heavenEarthGap - dimensions.inactiveGap - dimensions.beadSize / 2;
            }
          } else {
            // Earth bead positioning - exact Typst formulas (lines 249-261)
            const columnState = columnStates[colIndex];
            const earthActive = columnState.earthActive;

            if (bead.active) {
              // Active beads: positioned near reckoning bar, adjacent beads touch (line 251)
              y = dimensions.heavenEarthGap + dimensions.barThickness + dimensions.activeGap + dimensions.beadSize / 2 + bead.position * (dimensions.beadSize + dimensions.adjacentSpacing);
            } else {
              // Inactive beads: positioned after active beads + gap (lines 254-261)
              if (earthActive > 0) {
                // Position after the last active bead + gap, then adjacent inactive beads touch (line 256)
                y = dimensions.heavenEarthGap + dimensions.barThickness + dimensions.activeGap + dimensions.beadSize / 2 + (earthActive - 1) * (dimensions.beadSize + dimensions.adjacentSpacing) + dimensions.beadSize / 2 + dimensions.inactiveGap + dimensions.beadSize / 2 + (bead.position - earthActive) * (dimensions.beadSize + dimensions.adjacentSpacing);
              } else {
                // No active beads: position after reckoning bar + gap, adjacent inactive beads touch (line 259)
                y = dimensions.heavenEarthGap + dimensions.barThickness + dimensions.inactiveGap + dimensions.beadSize / 2 + bead.position * (dimensions.beadSize + dimensions.adjacentSpacing);
              }
            }
          }

          const color = getBeadColor(bead, effectiveColumns, finalConfig.colorScheme, finalConfig.colorPalette);

          // Apply custom styling
          const beadStyle = mergeBeadStyles(
            { fill: color },
            customStyles,
            bead.columnIndex,
            bead.type,
            bead.type === 'earth' ? bead.position : undefined,
            bead.active
          );

          // Check if bead is highlighted
          const isHighlighted = isBeadHighlighted(
            bead.columnIndex,
            bead.type,
            bead.type === 'earth' ? bead.position : undefined,
            highlightBeads,
            effectiveColumns
          );

          // Check if bead is disabled
          const isDisabled = isBeadDisabled(
            bead.columnIndex,
            bead.type,
            bead.type === 'earth' ? bead.position : undefined,
            disabledColumns,
            disabledBeads,
            effectiveColumns
          );

          return (
            <Bead
              key={`bead-${colIndex}-${bead.type}-${beadIndex}`}
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
              onClick={finalConfig.interactive && !isDisabled ? (event) => handleBeadClick(bead, event) : undefined}
              onHover={callbacks?.onBeadHover ? (event) => {
                const beadClickEvent: BeadClickEvent = {
                  bead,
                  columnIndex: bead.columnIndex,
                  beadType: bead.type,
                  position: bead.position,
                  active: bead.active,
                  value: bead.value,
                  event
                };
                callbacks.onBeadHover?.(beadClickEvent);
              } : undefined}
              onLeave={callbacks?.onBeadLeave ? (event) => {
                const beadClickEvent: BeadClickEvent = {
                  bead,
                  columnIndex: bead.columnIndex,
                  beadType: bead.type,
                  position: bead.position,
                  active: bead.active,
                  value: bead.value,
                  event
                };
                callbacks.onBeadLeave?.(beadClickEvent);
              } : undefined}
              onGestureToggle={handleGestureToggle}
              onRef={callbacks?.onBeadRef ? (element) => callbacks.onBeadRef!(bead, element) : undefined}
              heavenEarthGap={dimensions.heavenEarthGap}
              barY={barY}
            />
          );
        })
      )}

      {/* Background rectangles for place values - in SVG */}
      {finalConfig.showNumbers && placeValues.map((value, columnIndex) => {
        const x = (columnIndex * dimensions.rodSpacing) + dimensions.rodSpacing / 2;
        // Position background rectangles to match the text positioning
        const baseHeight = dimensions.heavenEarthGap + 5 * (dimensions.beadSize + 4 * finalConfig.scaleFactor) + 10 * finalConfig.scaleFactor;
        const y = baseHeight + 25;
        const isActive = activeColumn === columnIndex;

        return (
          <rect
            key={`place-bg-${columnIndex}`}
            x={x - (12 * finalConfig.scaleFactor)}
            y={y - (12 * finalConfig.scaleFactor)}
            width={24 * finalConfig.scaleFactor}
            height={24 * finalConfig.scaleFactor}
            fill={isActive ? '#e3f2fd' : '#f5f5f5'}
            stroke={isActive ? '#2196f3' : '#ccc'}
            strokeWidth={isActive ? 2 * finalConfig.scaleFactor : 1 * finalConfig.scaleFactor}
            rx={3 * finalConfig.scaleFactor}
            style={{ cursor: finalConfig.interactive ? 'pointer' : 'default' }}
            onClick={finalConfig.interactive ? () => setActiveColumn(columnIndex) : undefined}
          />
        );
      })}

      {/* NumberFlow place value displays - inside SVG using foreignObject */}
      {finalConfig.showNumbers && placeValues.map((value, columnIndex) => {
        const x = (columnIndex * dimensions.rodSpacing) + dimensions.rodSpacing / 2;
        // Position numbers within the allocated numbers space (below the baseHeight)
        const baseHeight = dimensions.heavenEarthGap + 5 * (dimensions.beadSize + 4 * finalConfig.scaleFactor) + 10 * finalConfig.scaleFactor;
        const y = baseHeight + 25;

        return (
          <foreignObject
            key={`place-number-${columnIndex}`}
            x={x - (12 * finalConfig.scaleFactor)}
            y={y - (8 * finalConfig.scaleFactor)}
            width={24 * finalConfig.scaleFactor}
            height={16 * finalConfig.scaleFactor}
            style={{ pointerEvents: 'none' }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${Math.max(8, 14 * finalConfig.scaleFactor)}px`,
                fontFamily: 'monospace',
                fontWeight: 'bold',
                pointerEvents: finalConfig.interactive ? 'auto' : 'none',
                cursor: finalConfig.interactive ? 'pointer' : 'default'
              }}
              onClick={finalConfig.interactive ? () => setActiveColumn(columnIndex) : undefined}
            >
              <NumberFlow
                value={value}
                format={{ style: 'decimal' }}
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 'bold',
                  fontSize: `${Math.max(8, 14 * finalConfig.scaleFactor)}px`
                }}
              />
            </div>
          </foreignObject>
        );
      })}

      {/* Overlay system for tooltips, arrows, highlights, etc. */}
      {overlays.map(overlay => {
        if (overlay.visible === false) return null;

        let position = { x: 0, y: 0 };

        // Calculate overlay position based on target
        if (overlay.target.type === 'bead') {
          // Find the bead position
          const targetColumn = overlay.target.columnIndex;
          const targetBeadType = overlay.target.beadType;
          const targetBeadPosition = overlay.target.beadPosition;

          if (targetColumn !== undefined && targetBeadType) {
            const x = (targetColumn * dimensions.rodSpacing) + dimensions.rodSpacing / 2;
            let y = 0;

            if (targetBeadType === 'heaven') {
              const columnState = columnStates[targetColumn];
              y = columnState.heavenActive
                ? dimensions.heavenEarthGap - dimensions.beadSize / 2 - dimensions.activeGap
                : dimensions.heavenEarthGap - dimensions.inactiveGap - dimensions.beadSize / 2;
            } else if (targetBeadType === 'earth' && targetBeadPosition !== undefined) {
              const columnState = columnStates[targetColumn];
              const earthActive = columnState.earthActive;
              const isActive = targetBeadPosition < earthActive;

              if (isActive) {
                y = dimensions.heavenEarthGap + dimensions.barThickness + dimensions.activeGap + dimensions.beadSize / 2 + targetBeadPosition * (dimensions.beadSize + dimensions.adjacentSpacing);
              } else {
                if (earthActive > 0) {
                  y = dimensions.heavenEarthGap + dimensions.barThickness + dimensions.activeGap + dimensions.beadSize / 2 + (earthActive - 1) * (dimensions.beadSize + dimensions.adjacentSpacing) + dimensions.beadSize / 2 + dimensions.inactiveGap + dimensions.beadSize / 2 + (targetBeadPosition - earthActive) * (dimensions.beadSize + dimensions.adjacentSpacing);
                } else {
                  y = dimensions.heavenEarthGap + dimensions.barThickness + dimensions.inactiveGap + dimensions.beadSize / 2 + targetBeadPosition * (dimensions.beadSize + dimensions.adjacentSpacing);
                }
              }
            }

            position = calculateOverlayPosition(overlay, dimensions, targetColumn, { x, y });
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
              overflow: 'visible',
              pointerEvents: 'none',
              ...overlay.style
            }}
            className={overlay.className}
          >
            <div style={{ position: 'relative', pointerEvents: 'auto' }}>
              {overlay.content}
            </div>
          </foreignObject>
        );
      })}

    </svg>

    </div>
  );
};


export default AbacusReact;