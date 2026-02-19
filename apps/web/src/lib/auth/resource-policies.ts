/**
 * Static resource-level policies for Casbin Layer 2.
 *
 * These define what actions each relationship-role can perform on resources.
 * Seeded into casbin_rules table on enforcer initialization.
 *
 * Format: [ptype, sub, dom, obj, act]
 * - ptype: 'p' for policy rules
 * - sub: role name (parent, teacher-present, teacher-enrolled, teacher)
 * - dom: '*' (applies to all domains of this role)
 * - obj: resource type (player, classroom)
 * - act: action name
 */
export const RESOURCE_POLICIES: [string, string, string, string, string][] = [
  // Parent can do everything with their child
  ['p', 'parent', '*', 'player', 'view'],
  ['p', 'parent', '*', 'player', 'start-session'],
  ['p', 'parent', '*', 'player', 'observe'],
  ['p', 'parent', '*', 'player', 'control-tutorial'],
  ['p', 'parent', '*', 'player', 'control-abacus'],

  // Teacher-present (student is in their classroom) — same as parent
  ['p', 'teacher-present', '*', 'player', 'view'],
  ['p', 'teacher-present', '*', 'player', 'start-session'],
  ['p', 'teacher-present', '*', 'player', 'observe'],
  ['p', 'teacher-present', '*', 'player', 'control-tutorial'],
  ['p', 'teacher-present', '*', 'player', 'control-abacus'],

  // Teacher-enrolled (student enrolled but not present) — view only
  ['p', 'teacher-enrolled', '*', 'player', 'view'],

  // Teacher role for classroom management
  ['p', 'teacher', '*', 'classroom', 'manage'],
  ['p', 'teacher', '*', 'classroom', 'view'],
]
