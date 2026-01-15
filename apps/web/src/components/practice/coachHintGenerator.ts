/**
 * Coach hint generator for practice help system
 *
 * Uses the same readable.summary from unifiedStepGenerator that the
 * tutorial CoachBar uses, ensuring consistent hints across the app.
 */

import { generateUnifiedInstructionSequence } from "@/utils/unifiedStepGenerator";

/**
 * Generate a coach hint based on the current step
 *
 * Returns the segment's readable.summary if available, or null if not.
 * This matches the tutorial CoachBar behavior which only renders when
 * readable.summary exists.
 */
export function generateCoachHint(
  startValue: number,
  targetValue: number,
  currentStepIndex: number = 0,
): string | null {
  const sequence = generateUnifiedInstructionSequence(startValue, targetValue);

  if (!sequence || sequence.steps.length === 0) {
    return null;
  }

  // Get the current step
  const currentStep = sequence.steps[currentStepIndex];
  if (!currentStep) {
    return null;
  }

  // Find the segment this step belongs to
  const segment = sequence.segments.find((s) => s.id === currentStep.segmentId);

  // Return the segment's readable summary if available (same as tutorial CoachBar)
  return segment?.readable?.summary ?? null;
}
