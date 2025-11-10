// Migration mapping from old skill IDs to new progression step IDs
// This allows existing mastery data to work with the new progression system

import type { SkillId } from './skills'

/**
 * Maps old skill IDs to new progression step IDs
 *
 * Strategy:
 * - Old skills with ten-frames → map to "full" scaffolding steps
 * - Old skills without ten-frames → map to "minimal" scaffolding steps
 * - Skills that don't have a direct equivalent → map to closest step
 */
export const SKILL_TO_STEP_MIGRATION: Record<SkillId, string> = {
  // ============================================================================
  // ADDITION SKILLS → SINGLE_CARRY_PATH steps
  // ============================================================================

  // Single-digit addition
  'sd-no-regroup': 'single-carry-1d-full', // Basic addition, map to first step
  'sd-simple-regroup': 'single-carry-1d-full', // Has ten-frames → full scaffolding

  // Two-digit addition
  'td-no-regroup': 'single-carry-2d-full', // No regrouping, but map to 2-digit entry point
  'td-ones-regroup': 'single-carry-2d-full', // Ones place regrouping → 2-digit full
  'td-mixed-regroup': 'single-carry-2d-minimal', // Mixed regrouping, more advanced → minimal
  'td-full-regroup': 'single-carry-2d-minimal', // Full regrouping → minimal scaffolding

  // Three-digit addition
  '3d-no-regroup': 'single-carry-3d-full', // No regrouping, but map to 3-digit entry
  '3d-simple-regroup': 'single-carry-3d-full', // Simple regrouping → full scaffolding
  '3d-full-regroup': 'single-carry-3d-minimal', // Full regrouping → minimal scaffolding

  // Four/five-digit addition (no direct equivalent, map to end of path)
  '4d-mastery': 'single-carry-3d-minimal', // Advanced, map to final step
  '5d-mastery': 'single-carry-3d-minimal', // Advanced, map to final step

  // ============================================================================
  // SUBTRACTION SKILLS → Future borrowing paths
  // ============================================================================
  // For now, map to addition equivalents (will create SINGLE_BORROW_PATH later)

  // Single-digit subtraction
  'sd-sub-no-borrow': 'single-carry-1d-full', // Map to equivalent complexity
  'sd-sub-borrow': 'single-carry-1d-full',

  // Two-digit subtraction
  'td-sub-no-borrow': 'single-carry-2d-full',
  'td-sub-ones-borrow': 'single-carry-2d-full',
  'td-sub-mixed-borrow': 'single-carry-2d-minimal',
  'td-sub-full-borrow': 'single-carry-2d-minimal',

  // Three-digit subtraction
  '3d-sub-simple': 'single-carry-3d-full',
  '3d-sub-complex': 'single-carry-3d-minimal',

  // Four/five-digit subtraction
  '4d-sub-mastery': 'single-carry-3d-minimal',
  '5d-sub-mastery': 'single-carry-3d-minimal',
}

/**
 * Migrate old skill ID to new step ID
 * @param skillId - Old skill ID from skills.ts
 * @returns New step ID from progressionPath.ts
 */
export function migrateSkillToStep(skillId: SkillId): string {
  return SKILL_TO_STEP_MIGRATION[skillId] ?? 'single-carry-1d-full'
}

/**
 * Check if a skill ID exists in the migration mapping
 */
export function isSkillMigrated(skillId: SkillId): boolean {
  return skillId in SKILL_TO_STEP_MIGRATION
}

/**
 * Get all old skill IDs that map to a given step ID
 * Useful for displaying which legacy skills contributed to a step's mastery
 */
export function getSkillsForStep(stepId: string): SkillId[] {
  return Object.entries(SKILL_TO_STEP_MIGRATION)
    .filter(([_, targetStepId]) => targetStepId === stepId)
    .map(([skillId]) => skillId as SkillId)
}
