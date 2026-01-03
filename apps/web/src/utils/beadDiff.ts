// Re-export core bead diff functionality from abacus-react
// App-specific extensions for multi-step tutorials and validation

export {
  type BeadDiffResult,
  type BeadDiffOutput,
  calculateBeadDiff,
  calculateBeadDiffFromValues,
  areStatesEqual,
  type AbacusState,
  type BeadState,
} from "@soroban/abacus-react";

import type {
  BeadDiffOutput,
  BeadDiffResult,
  AbacusState,
} from "@soroban/abacus-react";
import { calculateBeadDiffFromValues } from "@soroban/abacus-react";

/**
 * Calculate step-by-step bead diffs for multi-step operations
 * This is used for tutorial multi-step instructions where we want to show
 * the progression through intermediate states
 *
 * APP-SPECIFIC FUNCTION - not in core abacus-react
 */
export function calculateMultiStepBeadDiffs(
  startValue: number,
  steps: Array<{ expectedValue: number; instruction: string }>,
): Array<{
  stepIndex: number;
  instruction: string;
  diff: BeadDiffOutput;
  fromValue: number;
  toValue: number;
}> {
  const stepDiffs = [];
  let currentValue = startValue;

  steps.forEach((step, index) => {
    const diff = calculateBeadDiffFromValues(currentValue, step.expectedValue);

    stepDiffs.push({
      stepIndex: index,
      instruction: step.instruction,
      diff,
      fromValue: currentValue,
      toValue: step.expectedValue,
    });

    currentValue = step.expectedValue;
  });

  return stepDiffs;
}

/**
 * Validate that a bead diff is feasible (no impossible bead states)
 *
 * APP-SPECIFIC FUNCTION - not in core abacus-react
 */
export function validateBeadDiff(diff: BeadDiffOutput): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check for impossible earth bead counts
  const earthChanges = diff.changes.filter((c) => c.beadType === "earth");
  const earthByPlace = groupByPlace(earthChanges);

  Object.entries(earthByPlace).forEach(([place, changes]) => {
    const activations = changes.filter(
      (c) => c.direction === "activate",
    ).length;
    const deactivations = changes.filter(
      (c) => c.direction === "deactivate",
    ).length;
    const netChange = activations - deactivations;

    if (netChange > 4) {
      errors.push(`Place ${place}: Cannot have more than 4 earth beads`);
    }
    if (netChange < 0) {
      errors.push(`Place ${place}: Cannot have negative earth beads`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Helper function for validation
function groupByPlace(changes: BeadDiffResult[]): {
  [place: string]: BeadDiffResult[];
} {
  return changes.reduce(
    (groups, change) => {
      const place = change.placeValue.toString();
      if (!groups[place]) {
        groups[place] = [];
      }
      groups[place].push(change);
      return groups;
    },
    {} as { [place: string]: BeadDiffResult[] },
  );
}
