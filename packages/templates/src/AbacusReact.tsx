import React, { useState, useCallback, useMemo, useRef } from "react";
import { useSpring, animated, config, to } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import NumberFlow from "@number-flow/react";

// Types
export interface BeadConfig {
  type: "heaven" | "earth";
  value: number;
  active: boolean;
  position: number; // 0-based position within its type group
  columnIndex: number;
}

export interface AbacusConfig {
  value?: number;
  columns?: number | "auto";
  showEmptyColumns?: boolean;
  hideInactiveBeads?: boolean;
  beadShape?: "diamond" | "square" | "circle";
  colorScheme?: "monochrome" | "place-value" | "alternating" | "heaven-earth";
  colorPalette?: "default" | "colorblind" | "mnemonic" | "grayscale" | "nature";
  scaleFactor?: number;
  animated?: boolean;
  gestures?: boolean;
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
    const totalHeight =
      heavenEarthGap + 5 * (beadSize + 4 * scaleFactor) + 10 * scaleFactor;

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
  }, [columns, scaleFactor]);
}

// Independent column state for heaven and earth beads
interface ColumnState {
  heavenActive: boolean; // true if heaven bead (value 5) is active
  earthActive: number; // 0-4, number of active earth beads
}

export function useAbacusState(initialValue: number = 0) {
  // Initialize state from the initial value
  const initializeFromValue = useCallback((value: number): ColumnState[] => {
    const digits = value.toString().split("").map(Number);
    return digits.map((digit) => ({
      heavenActive: digit >= 5,
      earthActive: digit % 5,
    }));
  }, []);

  const [columnStates, setColumnStates] = useState<ColumnState[]>(() =>
    initializeFromValue(initialValue),
  );

  // Sync with prop changes
  React.useEffect(() => {
    console.log(`🔄 Syncing internal state to new prop value: ${initialValue}`);
    setColumnStates(initializeFromValue(initialValue));
  }, [initialValue, initializeFromValue]);

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
      setColumnStates(initializeFromValue(newValue));
    },
    [initializeFromValue],
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
    (bead: BeadConfig, totalColumns: number) => {
      const currentState = getColumnState(bead.columnIndex);

      if (bead.type === "heaven") {
        // Toggle heaven bead independently
        setColumnState(bead.columnIndex, {
          ...currentState,
          heavenActive: !currentState.heavenActive,
        });
      } else {
        // Toggle earth bead - affects the number of active earth beads
        if (bead.active) {
          // Deactivate this bead and all higher positioned earth beads
          setColumnState(bead.columnIndex, {
            ...currentState,
            earthActive: Math.min(currentState.earthActive, bead.position),
          });
        } else {
          // Activate this bead and all lower positioned earth beads
          setColumnState(bead.columnIndex, {
            ...currentState,
            earthActive: Math.max(currentState.earthActive, bead.position + 1),
          });
        }
      }
    },
    [getColumnState, setColumnState],
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
): string {
  const inactiveColor = "rgb(211, 211, 211)"; // Typst uses gray.lighten(70%)

  if (!bead.active) return inactiveColor;

  switch (colorScheme) {
    case "place-value": {
      const placeIndex = totalColumns - bead.columnIndex - 1;
      const colors =
        COLOR_PALETTES[colorPalette as keyof typeof COLOR_PALETTES] ||
        COLOR_PALETTES.default;
      return colors[placeIndex % colors.length];
    }
    case "alternating":
      return bead.columnIndex % 2 === 0 ? "#1E88E5" : "#43A047";
    case "heaven-earth":
      return bead.type === "heaven" ? "#F18F01" : "#2E86AB"; // Exact Typst colors (lines 228, 265)
    default:
      return "#000000";
  }
}

function calculateBeadStates(columnStates: ColumnState[]): BeadConfig[][] {
  return columnStates.map((columnState, columnIndex) => {
    const beads: BeadConfig[] = [];

    // Heaven bead (value 5) - independent state
    beads.push({
      type: "heaven",
      value: 5,
      active: columnState.heavenActive,
      position: 0,
      columnIndex,
    });

    // Earth beads (4 beads, each value 1) - independent state
    for (let i = 0; i < 4; i++) {
      beads.push({
        type: "earth",
        value: 1,
        active: i < columnState.earthActive,
        position: i,
        columnIndex,
      });
    }

    return beads;
  });
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

// Components
interface BeadProps {
  bead: BeadConfig;
  x: number;
  y: number;
  size: number;
  shape: "diamond" | "square" | "circle";
  color: string;
  enableAnimation: boolean;
  enableGestures?: boolean;
  hideInactiveBeads?: boolean;
  onClick?: () => void;
  onGestureToggle?: (
    bead: BeadConfig,
    direction: "activate" | "deactivate",
  ) => void;
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
  enableAnimation,
  enableGestures = false,
  hideInactiveBeads = false,
  onClick,
  onGestureToggle,
  heavenEarthGap,
  barY,
}) => {
  const [{ x: springX, y: springY }, api] = useSpring(() => ({ x, y }));
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

  // Directional gesture handler
  const bind = useDrag(
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

  const AnimatedG = animated.g;

  // Calculate correct offset based on shape (matching Typst positioning)
  const getXOffset = () => {
    return shape === "diamond" ? size * 0.7 : size / 2;
  };

  const getYOffset = () => {
    return size / 2; // Y offset is always size/2 for all shapes
  };

  return (
    <AnimatedG
      {...(enableGestures ? bind() : {})}
      className={`abacus-bead ${bead.active ? "active" : "inactive"} ${hideInactiveBeads && !bead.active ? "hidden-inactive" : ""}`}
      transform={
        enableAnimation
          ? undefined
          : `translate(${x - getXOffset()}, ${y - getYOffset()})`
      }
      style={
        enableAnimation
          ? {
              transform: to(
                [springX, springY],
                (sx, sy) =>
                  `translate(${sx - getXOffset()}px, ${sy - getYOffset()}px)`,
              ),
              cursor: enableGestures ? "grab" : onClick ? "pointer" : "default",
              touchAction: "none",
              transition: "opacity 0.2s ease-in-out",
            }
          : {
              cursor: enableGestures ? "grab" : onClick ? "pointer" : "default",
              touchAction: "none",
              transition: "opacity 0.2s ease-in-out",
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
  columns = "auto",
  showEmptyColumns = false,
  hideInactiveBeads = false,
  beadShape = "diamond",
  colorScheme = "monochrome",
  colorPalette = "default",
  scaleFactor = 1,
  animated = true,
  gestures = false,
  onClick,
  onValueChange,
}) => {
  const {
    value: currentValue,
    columnStates,
    toggleBead,
    setColumnState,
  } = useAbacusState(value);

  // Debug prop changes
  React.useEffect(() => {
    console.log(
      `🔄 Component received value prop: ${value}, internal value: ${currentValue}`,
    );
  }, [value, currentValue]);

  // Calculate effective columns
  const effectiveColumns = useMemo(() => {
    if (columns === "auto") {
      const minColumns = Math.max(
        1,
        Math.max(currentValue.toString().length, columnStates.length),
      );
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
    [paddedColumnStates],
  );

  // Layout calculations using exact Typst positioning
  // In Typst, the reckoning bar is positioned at heaven-earth-gap from the top
  const barY = dimensions.heavenEarthGap;

  // Notify about value changes
  React.useEffect(() => {
    onValueChange?.(currentValue);
  }, [currentValue, onValueChange]);

  const handleBeadClick = useCallback(
    (bead: BeadConfig) => {
      onClick?.(bead);
      toggleBead(bead, effectiveColumns);
    },
    [onClick, toggleBead, effectiveColumns],
  );

  const handleGestureToggle = useCallback(
    (bead: BeadConfig, direction: "activate" | "deactivate") => {
      const currentState = paddedColumnStates[bead.columnIndex];

      if (bead.type === "heaven") {
        // Heaven bead: directly set the state based on direction
        const newHeavenActive = direction === "activate";
        setColumnState(bead.columnIndex, {
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

        setColumnState(bead.columnIndex, {
          ...currentState,
          earthActive: newEarthActive,
        });
      }
    },
    [paddedColumnStates, setColumnState],
  );

  // Place value editing - FRESH IMPLEMENTATION
  const [activeColumn, setActiveColumn] = React.useState<number | null>(null);

  // Calculate current place values
  const placeValues = React.useMemo(() => {
    return paddedColumnStates.map(
      (state) => (state.heavenActive ? 5 : 0) + state.earthActive,
    );
  }, [paddedColumnStates]);

  // Update a column from a digit
  const setColumnValue = React.useCallback(
    (columnIndex: number, digit: number) => {
      if (digit < 0 || digit > 9) return;

      setColumnState(columnIndex, {
        heavenActive: digit >= 5,
        earthActive: digit % 5,
      });
    },
    [setColumnState],
  );

  // Keyboard handler
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      console.log(
        `🎹 KEY: "${e.key}" | activeColumn: ${activeColumn} | code: ${e.code}`,
      );

      if (activeColumn === null) {
        console.log(`❌ activeColumn is null, ignoring`);
        return;
      }

      if (e.key >= "0" && e.key <= "9") {
        console.log(`🔢 DIGIT: ${e.key} for column ${activeColumn}`);
        e.preventDefault();

        const digit = parseInt(e.key);
        console.log(
          `📝 About to call setColumnValue(${activeColumn}, ${digit})`,
        );
        setColumnValue(activeColumn, digit);

        // Move focus to the next column to the right
        const nextColumn = activeColumn + 1;
        if (nextColumn < effectiveColumns) {
          console.log(`➡️ Moving focus to next column: ${nextColumn}`);
          setActiveColumn(nextColumn);
        } else {
          console.log(`🏁 Reached last column, staying at: ${activeColumn}`);
        }
      } else if (e.key === "Backspace" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        console.log(
          `⬅️ ${e.key === "Backspace" ? "BACKSPACE" : "SHIFT+TAB"}: moving to previous column`,
        );

        // Move focus to the previous column to the left
        const prevColumn = activeColumn - 1;
        if (prevColumn >= 0) {
          console.log(`⬅️ Moving focus to previous column: ${prevColumn}`);
          setActiveColumn(prevColumn);
        } else {
          console.log(`🏁 Reached first column, wrapping to last column`);
          setActiveColumn(effectiveColumns - 1); // Wrap around to last column
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        console.log(`🔄 TAB: moving to next column`);

        // Move focus to the next column to the right
        const nextColumn = activeColumn + 1;
        if (nextColumn < effectiveColumns) {
          console.log(`➡️ Moving focus to next column: ${nextColumn}`);
          setActiveColumn(nextColumn);
        } else {
          console.log(`🏁 Reached last column, wrapping to first column`);
          setActiveColumn(0); // Wrap around to first column
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        console.log(`🚪 ESCAPE: setting activeColumn to null`);
        setActiveColumn(null);
      }
    };

    console.log(
      `🔧 Setting up keyboard listener for activeColumn: ${activeColumn}`,
    );
    document.addEventListener("keydown", handleKey);
    return () => {
      console.log(
        `🗑️ Cleaning up keyboard listener for activeColumn: ${activeColumn}`,
      );
      document.removeEventListener("keydown", handleKey);
    };
  }, [activeColumn, setColumnValue, effectiveColumns]);

  // Debug activeColumn changes
  React.useEffect(() => {
    console.log(`🎯 activeColumn changed to: ${activeColumn}`);
  }, [activeColumn]);

  return (
    <div
      className="abacus-container"
      style={{
        display: "inline-block",
        textAlign: "center",
        position: "relative",
      }}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height + 40}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height + 40}`}
        className={`abacus-svg ${hideInactiveBeads ? "hide-inactive-mode" : ""}`}
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

          /* When hovering over the abacus, hidden inactive beads become semi-transparent */
          .abacus-svg.hide-inactive-mode:hover .abacus-bead.hidden-inactive {
            opacity: 0.5;
          }

          /* When hovering over a specific hidden inactive bead, it becomes fully visible */
          .hide-inactive-mode .abacus-bead.hidden-inactive:hover {
            opacity: 1 !important;
          }
        `}</style>
        </defs>
        {/* Rods - positioned as rectangles like in Typst */}
        {Array.from({ length: effectiveColumns }, (_, colIndex) => {
          const x =
            colIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;

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
              const columnState = paddedColumnStates[colIndex];
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

            const color = getBeadColor(
              bead,
              effectiveColumns,
              colorScheme,
              colorPalette,
            );

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
                enableGestures={gestures}
                hideInactiveBeads={hideInactiveBeads}
                onClick={() => handleBeadClick(bead)} // Enable click always - gestures and clicks work together
                onGestureToggle={handleGestureToggle}
                heavenEarthGap={dimensions.heavenEarthGap}
                barY={barY}
              />
            );
          }),
        )}

        {/* Background rectangles for place values - in SVG */}
        {placeValues.map((value, columnIndex) => {
          const x =
            columnIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;
          const y = dimensions.height + 20;
          const isActive = activeColumn === columnIndex;

          return (
            <rect
              key={`place-bg-${columnIndex}`}
              x={x - 12}
              y={y - 12}
              width={24}
              height={24}
              fill={isActive ? "#e3f2fd" : "#f5f5f5"}
              stroke={isActive ? "#2196f3" : "#ccc"}
              strokeWidth={isActive ? 2 : 1}
              rx={3}
              style={{ cursor: "pointer" }}
              onClick={() => setActiveColumn(columnIndex)}
            />
          );
        })}
      </svg>

      {/* NumberFlow place value displays - positioned over SVG */}
      {placeValues.map((value, columnIndex) => {
        const x =
          columnIndex * dimensions.rodSpacing + dimensions.rodSpacing / 2;
        const y = dimensions.height + 20;

        return (
          <div
            key={`place-number-${columnIndex}`}
            style={{
              position: "absolute",
              left: `${x - 12}px`,
              top: `${y - 8}px`,
              width: "24px",
              height: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              fontSize: "14px",
              fontFamily: "monospace",
              fontWeight: "bold",
            }}
          >
            <NumberFlow
              value={value}
              format={{ style: "decimal" }}
              style={{
                fontFamily: "monospace",
                fontWeight: "bold",
                fontSize: "14px",
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default AbacusReact;
