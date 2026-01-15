/**
 * Message pools for part transition screens
 *
 * Messages are organized by transition type and randomly selected
 * to keep daily practice sessions feeling fresh.
 */

import type { SessionPartType } from "@/db/schema/session-plans";

// ============================================================================
// Types
// ============================================================================

export interface TransitionMessage {
  /** Main headline text */
  headline: string;
  /** Optional subtitle with additional instruction */
  subtitle?: string;
}

export type TransitionType =
  | "start-to-abacus"
  | "abacus-to-visualization"
  | "visualization-to-linear"
  | "start-to-visualization"
  | "start-to-linear"
  | "abacus-to-linear";

// ============================================================================
// Message Pools
// ============================================================================

const START_TO_ABACUS_MESSAGES: TransitionMessage[] = [
  { headline: "Get Ready!", subtitle: "Grab your abacus" },
  { headline: "Let's Begin!", subtitle: "Have your abacus ready" },
  { headline: "Abacus Time", subtitle: "Get your beads ready" },
];

const ABACUS_TO_VISUALIZATION_MESSAGES: TransitionMessage[] = [
  { headline: "Mental Math Time!", subtitle: "Put your abacus aside" },
  {
    headline: "Visualization Mode",
    subtitle: "Picture the beads in your mind",
  },
  { headline: "Abacus Break", subtitle: "Set it down gently" },
  { headline: "Mind Over Beads", subtitle: "Time to imagine" },
  { headline: "Close Your Eyes...", subtitle: "See the beads in your head" },
];

const VISUALIZATION_TO_LINEAR_MESSAGES: TransitionMessage[] = [
  { headline: "Equation Mode!", subtitle: "Same math, different look" },
  { headline: "Reading Problems", subtitle: "Like a math sentence" },
  { headline: "Linear Style", subtitle: "Left to right" },
  { headline: "Number Sentences", subtitle: "Quick mental math" },
];

const START_TO_VISUALIZATION_MESSAGES: TransitionMessage[] = [
  { headline: "Mental Math!", subtitle: "No abacus needed today" },
  { headline: "Visualization Time", subtitle: "Picture the beads" },
];

const START_TO_LINEAR_MESSAGES: TransitionMessage[] = [
  { headline: "Quick Math!", subtitle: "Solve these equations" },
  { headline: "Let's Go!", subtitle: "Number sentences ahead" },
];

const ABACUS_TO_LINEAR_MESSAGES: TransitionMessage[] = [
  { headline: "Equation Time!", subtitle: "Put your abacus away" },
  { headline: "Linear Mode", subtitle: "No more beads for now" },
];

// ============================================================================
// Message Selection
// ============================================================================

/**
 * Get the transition type based on previous and next part types
 */
export function getTransitionType(
  previousPartType: SessionPartType | null,
  nextPartType: SessionPartType,
): TransitionType {
  if (previousPartType === null) {
    // Session start
    switch (nextPartType) {
      case "abacus":
        return "start-to-abacus";
      case "visualization":
        return "start-to-visualization";
      case "linear":
        return "start-to-linear";
    }
  }

  if (previousPartType === "abacus" && nextPartType === "visualization") {
    return "abacus-to-visualization";
  }
  if (previousPartType === "visualization" && nextPartType === "linear") {
    return "visualization-to-linear";
  }
  if (previousPartType === "abacus" && nextPartType === "linear") {
    return "abacus-to-linear";
  }

  // Fallback (shouldn't happen in normal flow)
  return "visualization-to-linear";
}

/**
 * Get the message pool for a transition type
 */
function getMessagePool(transitionType: TransitionType): TransitionMessage[] {
  switch (transitionType) {
    case "start-to-abacus":
      return START_TO_ABACUS_MESSAGES;
    case "abacus-to-visualization":
      return ABACUS_TO_VISUALIZATION_MESSAGES;
    case "visualization-to-linear":
      return VISUALIZATION_TO_LINEAR_MESSAGES;
    case "start-to-visualization":
      return START_TO_VISUALIZATION_MESSAGES;
    case "start-to-linear":
      return START_TO_LINEAR_MESSAGES;
    case "abacus-to-linear":
      return ABACUS_TO_LINEAR_MESSAGES;
  }
}

/**
 * Select a random message for a transition
 *
 * Uses a simple random selection. For a deterministic selection
 * (e.g., based on session ID), pass a seed.
 */
export function selectTransitionMessage(
  previousPartType: SessionPartType | null,
  nextPartType: SessionPartType,
  seed?: number,
): TransitionMessage {
  const transitionType = getTransitionType(previousPartType, nextPartType);
  const pool = getMessagePool(transitionType);

  // Use seed if provided, otherwise random
  const index =
    seed !== undefined
      ? Math.abs(seed) % pool.length
      : Math.floor(Math.random() * pool.length);

  return pool[index];
}

/**
 * Check if a transition requires putting away the abacus
 */
export function requiresAbacusPutAway(
  previousPartType: SessionPartType | null,
  nextPartType: SessionPartType,
): boolean {
  if (previousPartType === null) return false;
  return previousPartType === "abacus" && nextPartType !== "abacus";
}

/**
 * Check if a transition requires getting the abacus
 */
export function requiresAbacusPickUp(
  previousPartType: SessionPartType | null,
  nextPartType: SessionPartType,
): boolean {
  if (previousPartType === null) return nextPartType === "abacus";
  return previousPartType !== "abacus" && nextPartType === "abacus";
}
