import React, { useState, useCallback, useMemo } from 'react';
import { useSpring, animated, config, to } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

// Types
export interface BeadConfig {
  type: 'heaven' | 'earth';
  value: number;
  active: boolean;
  position: number; // 0-based position within its type group
  columnIndex: number;
}

export interface AbacusConfig {
  value?: number;
  columns?: number | 'auto';
  showEmptyColumns?: boolean;
  hideInactiveBeads?: boolean;
  beadShape?: 'diamond' | 'square' | 'circle';
  colorScheme?: 'monochrome' | 'place-value' | 'alternating' | 'heaven-earth';
  colorPalette?: 'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature';
  scaleFactor?: number;
  animated?: boolean;
  draggable?: boolean;
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
  scaleFactor: number = 1
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
    const totalHeight = heavenEarthGap + 5 * (beadSize + 4 * scaleFactor) + 10 * scaleFactor;

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
  }, [columns, scaleFactor]);
}

// Independent column state for heaven and earth beads
interface ColumnState {
  heavenActive: boolean;  // true if heaven bead (value 5) is active
  earthActive: number;    // 0-4, number of active earth beads
}

export function useAbacusState(initialValue: number = 0) {
  // Initialize state from the initial value
  const initializeFromValue = useCallback((value: number): ColumnState[] => {
    const digits = value.toString().split('').map(Number);
    return digits.map(digit => ({
      heavenActive: digit >= 5,
      earthActive: digit % 5
    }));
  }, []);

  const [columnStates, setColumnStates] = useState<ColumnState[]>(() => initializeFromValue(initialValue));

  // Calculate current value from independent column states
  const value = useMemo(() => {
    return columnStates.reduce((total, columnState, index) => {
      const placeValue = Math.pow(10, columnStates.length - index - 1);
      const columnValue = (columnState.heavenActive ? 5 : 0) + columnState.earthActive;
      return total + (columnValue * placeValue);
    }, 0);
  }, [columnStates]);

  const setValue = useCallback((newValue: number) => {
    setColumnStates(initializeFromValue(newValue));
  }, [initializeFromValue]);

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

function calculateBeadStates(columnStates: ColumnState[]): BeadConfig[][] {
  return columnStates.map((columnState, columnIndex) => {
    const beads: BeadConfig[] = [];

    // Heaven bead (value 5) - independent state
    beads.push({
      type: 'heaven',
      value: 5,
      active: columnState.heavenActive,
      position: 0,
      columnIndex
    });

    // Earth beads (4 beads, each value 1) - independent state
    for (let i = 0; i < 4; i++) {
      beads.push({
        type: 'earth',
        value: 1,
        active: i < columnState.earthActive,
        position: i,
        columnIndex
      });
    }

    return beads;
  });
}

// Components
interface BeadProps {
  bead: BeadConfig;
  x: number;
  y: number;
  size: number;
  shape: 'diamond' | 'square' | 'circle';
  color: string;
  enableAnimation: boolean;
  draggable: boolean;
  onClick?: () => void;
  onDrag?: (offset: { x: number; y: number }) => void;
}

const Bead: React.FC<BeadProps> = ({
  bead,
  x,
  y,
  size,
  shape,
  color,
  enableAnimation,
  draggable,
  onClick,
  onDrag
}) => {
  const [{ x: springX, y: springY }, api] = useSpring(() => ({ x, y }));

  const bind = useDrag(
    ({ movement: [mx, my], down }) => {
      if (!draggable) return;

      if (down) {
        api.start({ x: x + mx, y: y + my, immediate: true });
        onDrag?.({ x: mx, y: my });
      } else {
        api.start({ x, y });
      }
    },
    { enabled: draggable }
  );

  React.useEffect(() => {
    if (enableAnimation) {
      api.start({ x, y, config: config.gentle });
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
      transform={enableAnimation ? undefined : `translate(${x - getXOffset()}, ${y - getYOffset()})`}
      style={
        enableAnimation
          ? {
              transform: to([springX, springY], (sx, sy) => `translate(${sx - getXOffset()}px, ${sy - getYOffset()}px)`),
              cursor: draggable ? 'grab' : onClick ? 'pointer' : 'default'
            }
          : { cursor: draggable ? 'grab' : onClick ? 'pointer' : 'default' }
      }
      {...(draggable ? bind() : {})}
      onClick={onClick}
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
  hideInactiveBeads = false,
  beadShape = 'diamond',
  colorScheme = 'monochrome',
  colorPalette = 'default',
  scaleFactor = 1,
  animated = true,
  draggable = false,
  onClick,
  onValueChange
}) => {
  const { value: currentValue, columnStates, toggleBead } = useAbacusState(value);

  // Calculate effective columns
  const effectiveColumns = useMemo(() => {
    if (columns === 'auto') {
      const minColumns = Math.max(1, Math.max(currentValue.toString().length, columnStates.length));
      return showEmptyColumns ? minColumns : minColumns;
    }
    return columns;
  }, [columns, currentValue, showEmptyColumns, columnStates.length]);

  const dimensions = useAbacusDimensions(effectiveColumns, scaleFactor);

  // Ensure we have enough column states for the effective columns
  const paddedColumnStates = useMemo(() => {
    const padded = [...columnStates];
    while (padded.length < effectiveColumns) {
      padded.unshift({ heavenActive: false, earthActive: 0 });
    }
    return padded.slice(-effectiveColumns); // Take the rightmost columns
  }, [columnStates, effectiveColumns]);

  const beadStates = useMemo(
    () => calculateBeadStates(paddedColumnStates),
    [paddedColumnStates]
  );

  // Layout calculations using exact Typst positioning
  // In Typst, the reckoning bar is positioned at heaven-earth-gap from the top
  const barY = dimensions.heavenEarthGap;

  const handleBeadClick = useCallback((bead: BeadConfig) => {
    onClick?.(bead);

    const newValue = { ...currentValue };
    toggleBead(bead, effectiveColumns);
    onValueChange?.(newValue);
  }, [onClick, toggleBead, currentValue, effectiveColumns, onValueChange]);

  return (
    <svg
      width={dimensions.width}
      height={dimensions.height}
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      style={{ overflow: 'visible' }}
    >
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
          if (hideInactiveBeads && !bead.active) return null;

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
            const columnState = paddedColumnStates[colIndex];
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

          const color = getBeadColor(bead, effectiveColumns, colorScheme, colorPalette);

          return (
            <Bead
              key={`bead-${colIndex}-${bead.type}-${beadIndex}`}
              bead={bead}
              x={x}
              y={y}
              size={dimensions.beadSize}
              shape={beadShape}
              color={color}
              enableAnimation={animated}
              draggable={draggable}
              onClick={() => handleBeadClick(bead)}
            />
          );
        })
      )}
    </svg>
  );
};

export default AbacusReact;