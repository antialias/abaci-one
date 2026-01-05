/**
 * Central definition of practice types used throughout the app.
 *
 * Add new practice types here - they'll be available in:
 * - Offline session logging
 * - Session plans
 * - Practice type filters
 * - Reporting/analytics
 */

export interface PracticeTypeConfig {
  /** Unique identifier - used in database and code */
  id: string;
  /** Human-readable label */
  label: string;
  /** Short description of the practice type */
  description: string;
  /** Emoji icon for display */
  icon: string;
}

/**
 * All available practice types.
 * Add new types here to make them available app-wide.
 */
export const PRACTICE_TYPES = [
  {
    id: "abacus",
    label: "Use Abacus",
    description: "Physical abacus practice",
    icon: "🧮",
  },
  {
    id: "visualization",
    label: "Visualize",
    description: "Mental math by visualizing beads",
    icon: "🧠",
  },
  {
    id: "linear",
    label: "Linear",
    description: "Mental math with number sentences",
    icon: "📝",
  },
] as const satisfies readonly PracticeTypeConfig[];

/**
 * Union type of all valid practice type IDs.
 * Derived from PRACTICE_TYPES to ensure type safety.
 */
export type PracticeTypeId = (typeof PRACTICE_TYPES)[number]["id"];

/**
 * Array of just the practice type IDs (useful for validation).
 */
export const PRACTICE_TYPE_IDS = PRACTICE_TYPES.map(
  (t) => t.id,
) as PracticeTypeId[];

/**
 * Get a practice type config by ID.
 */
export function getPracticeType(id: PracticeTypeId): PracticeTypeConfig {
  const type = PRACTICE_TYPES.find((t) => t.id === id);
  if (!type) {
    throw new Error(`Unknown practice type: ${id}`);
  }
  return type;
}

/**
 * Check if a string is a valid practice type ID.
 */
export function isValidPracticeTypeId(id: string): id is PracticeTypeId {
  return PRACTICE_TYPE_IDS.includes(id as PracticeTypeId);
}
