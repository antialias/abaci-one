/**
 * Utility hooks for working with abacus calculations and state
 */

import { useMemo } from "react";
import {
  calculateBeadDiffFromValues,
  numberToAbacusState,
  type BeadDiffOutput,
  type AbacusState,
} from "./AbacusUtils";

/**
 * Hook to calculate bead differences between two values
 * Useful for tutorials, animations, and highlighting which beads need to move
 *
 * @param fromValue - Starting value
 * @param toValue - Target value
 * @param maxPlaces - Maximum number of place values to consider (default: 5)
 * @returns BeadDiffOutput with changes, highlights, and summary
 *
 * @example
 * ```tsx
 * function Tutorial() {
 *   const diff = useAbacusDiff(5, 15)
 *
 *   return (
 *     <AbacusReact
 *       value={currentValue}
 *       stepBeadHighlights={diff.highlights}
 *     />
 *   )
 * }
 * ```
 */
export function useAbacusDiff(
  fromValue: number | bigint,
  toValue: number | bigint,
  maxPlaces: number = 5,
): BeadDiffOutput {
  return useMemo(() => {
    return calculateBeadDiffFromValues(fromValue, toValue, maxPlaces);
  }, [fromValue, toValue, maxPlaces]);
}

/**
 * Hook to convert a number to abacus state
 * Memoized for performance when used in components
 *
 * @param value - The number to convert
 * @param maxPlaces - Maximum number of place values (default: 5)
 * @returns AbacusState representing the bead positions
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const state = useAbacusState(123)
 *
 *   // Check if ones column has heaven bead active
 *   const onesHasHeaven = state[0].heavenActive
 * }
 * ```
 */
export function useAbacusState(
  value: number | bigint,
  maxPlaces: number = 5,
): AbacusState {
  return useMemo(() => {
    return numberToAbacusState(value, maxPlaces);
  }, [value, maxPlaces]);
}
