/**
 * The practice types of the app's screens: since practice-kinds K3 a view
 * over arithmetic's presentations (`parts/arithmetic/presentations.ts`, R7),
 * which decide the ids and their order. This file keeps only the display
 * copy these screens have always shown (offline session logging, the
 * session hero's chips, the song's part names), which differs from a
 * presentation's own label.
 *
 * A new arithmetic presentation is registered in arithmetic's list, not here;
 * it is not a practice type until it has copy here (it is left out of
 * `PRACTICE_TYPES`, not shown blank). A new kind's presentations are not
 * practice types: they come from the registry.
 */

import { arithmeticPresentations } from '@/lib/curriculum/parts/arithmetic/presentations'

export interface PracticeTypeConfig {
  /** Unique identifier - used in database and code */
  id: string
  /** Human-readable label */
  label: string
  /** Short description of the practice type */
  description: string
  /** Emoji icon for display */
  icon: string
}

/** The display copy per arithmetic presentation id */
const PRACTICE_TYPE_COPY = {
  abacus: {
    label: 'Use Abacus',
    description: 'Physical abacus practice',
    icon: '🧮',
  },
  visualization: {
    label: 'Visualize',
    description: 'Mental math by visualizing beads',
    icon: '🧠',
  },
  linear: {
    label: 'Linear',
    description: 'Mental math with number sentences',
    icon: '📝',
  },
} as const satisfies Record<string, Omit<PracticeTypeConfig, 'id'>>

/**
 * Union type of all valid practice type IDs: arithmetic's presentations that
 * have copy here.
 */
export type PracticeTypeId = keyof typeof PRACTICE_TYPE_COPY

function hasCopy(id: string): id is PracticeTypeId {
  return (Object.keys(PRACTICE_TYPE_COPY) as string[]).includes(id)
}

/**
 * All available practice types, in arithmetic's presentation order.
 */
export const PRACTICE_TYPES: readonly (PracticeTypeConfig & { id: PracticeTypeId })[] = [
  ...arithmeticPresentations.keys(),
]
  .filter(hasCopy)
  .map((id) => ({ id, ...PRACTICE_TYPE_COPY[id] }))

/**
 * Array of just the practice type IDs (useful for validation).
 */
export const PRACTICE_TYPE_IDS = PRACTICE_TYPES.map((t) => t.id) as PracticeTypeId[]

/**
 * Get a practice type config by ID.
 */
export function getPracticeType(id: PracticeTypeId): PracticeTypeConfig {
  const type = PRACTICE_TYPES.find((t) => t.id === id)
  if (!type) {
    throw new Error(`Unknown practice type: ${id}`)
  }
  return type
}

/**
 * Check if a string is a valid practice type ID.
 */
export function isValidPracticeTypeId(id: string): id is PracticeTypeId {
  return PRACTICE_TYPE_IDS.includes(id as PracticeTypeId)
}
