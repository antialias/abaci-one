/**
 * Shared exploration descriptors — single source of truth for available
 * explorations.  Imported by both client (NumberLine) and server (route.ts,
 * generateScenario).
 */

export interface ExplorationDescriptor {
  id: string
  name: string
  shortDesc: string
}

/**
 * All explorations that have full narration support.
 * Order matches the original hardcoded list.
 */
export const AVAILABLE_EXPLORATIONS: ExplorationDescriptor[] = [
  { id: 'phi',       name: 'Golden Ratio',       shortDesc: 'spirals and the golden rectangle' },
  { id: 'pi',        name: 'Pi',                  shortDesc: 'circles and circumference' },
  { id: 'tau',       name: 'Tau',                 shortDesc: 'full turns (2\u03C0)' },
  { id: 'e',         name: "Euler's Number",      shortDesc: 'compound interest and growth' },
  { id: 'gamma',     name: 'Euler-Mascheroni',    shortDesc: 'the harmonic series gap' },
  { id: 'sqrt2',     name: 'Root 2',              shortDesc: 'the diagonal of a square' },
  { id: 'ramanujan', name: 'Ramanujan Summation', shortDesc: 'the surprising \u22121/12' },
]

/** Set of valid exploration IDs (for fast lookups). */
export const EXPLORATION_IDS = new Set(AVAILABLE_EXPLORATIONS.map(e => e.id))
