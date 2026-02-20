/**
 * Casbin-based access control — drop-in replacement for access-control.ts.
 *
 * Re-exports all the same types and provides Casbin-backed implementations
 * with parallel-run mode for safe migration. In parallel-run mode, both
 * Casbin and legacy are called, mismatches are logged, and legacy result
 * is returned until the migration is validated.
 */

import {
  canPerformAction as legacyCanPerformAction,
  getPlayerAccess as legacyGetPlayerAccess,
  getAccessiblePlayers as legacyGetAccessiblePlayers,
  isParentOf as legacyIsParentOf,
  isTeacherOf as legacyIsTeacherOf,
  generateAuthorizationError,
  type AccessLevel,
  type PlayerAccess,
  type PlayerAction,
  type AccessiblePlayers,
  type RemediationType,
  type AuthorizationError,
} from '@/lib/classroom/access-control'
import { getResourceEnforcer } from './enforcer'

// Re-export types that callers depend on
export type {
  AccessLevel,
  PlayerAccess,
  PlayerAction,
  AccessiblePlayers,
  RemediationType,
  AuthorizationError,
}

// Re-export generateAuthorizationError directly (no Casbin equivalent needed)
export { generateAuthorizationError }

/**
 * When true, both Casbin and legacy are called and results are compared.
 * Set to false to cut over to Casbin-only after validation.
 */
const PARALLEL_RUN = true

/**
 * Check if a user can perform an action on a player (Casbin-backed).
 */
export async function checkPlayerAccess(
  userId: string,
  playerId: string,
  action: PlayerAction
): Promise<boolean> {
  if (!PARALLEL_RUN) {
    const enforcer = await getResourceEnforcer()
    return enforcer.enforce(userId, `player:${playerId}`, 'player', action)
  }

  // Parallel run: call both and compare
  const [casbinResult, legacyResult] = await Promise.all([
    getResourceEnforcer()
      .then((e) => e.enforce(userId, `player:${playerId}`, 'player', action))
      .catch((err) => {
        console.error('[AUTH-MIGRATION] Casbin error:', err)
        return null
      }),
    legacyCanPerformAction(userId, playerId, action),
  ])

  if (casbinResult !== null && casbinResult !== legacyResult) {
    console.warn(
      `[AUTH-MIGRATION] Mismatch on checkPlayerAccess: ` +
        `user=${userId} player=${playerId} action=${action} ` +
        `casbin=${casbinResult} legacy=${legacyResult}`
    )
  }

  return legacyResult
}

/**
 * Get access details for a user-player pair.
 * During parallel run, delegates to legacy.
 */
export async function getPlayerAccessLevel(
  viewerId: string,
  playerId: string
): Promise<PlayerAccess> {
  // For now, delegate to legacy — Casbin doesn't produce the same rich structure.
  // After cutover, this would query Casbin for the user's roles in the player domain.
  return legacyGetPlayerAccess(viewerId, playerId)
}

/**
 * Get all players accessible to a viewer.
 * During parallel run, delegates to legacy.
 */
export async function getAccessiblePlayersForViewer(viewerId: string): Promise<AccessiblePlayers> {
  // Casbin equivalent would query all domains where user has a grouping policy,
  // then categorize by role. For now, use legacy.
  return legacyGetAccessiblePlayers(viewerId)
}

/**
 * Check if a user is a parent of a player.
 */
export async function checkIsParentOf(userId: string, playerId: string): Promise<boolean> {
  if (!PARALLEL_RUN) {
    const enforcer = await getResourceEnforcer()
    return enforcer.hasGroupingPolicy(userId, 'parent', `player:${playerId}`)
  }

  const [casbinResult, legacyResult] = await Promise.all([
    getResourceEnforcer()
      .then((e) => e.hasGroupingPolicy(userId, 'parent', `player:${playerId}`))
      .catch((err) => {
        console.error('[AUTH-MIGRATION] Casbin error:', err)
        return null
      }),
    legacyIsParentOf(userId, playerId),
  ])

  if (casbinResult !== null && casbinResult !== legacyResult) {
    console.warn(
      `[AUTH-MIGRATION] Mismatch on checkIsParentOf: ` +
        `user=${userId} player=${playerId} ` +
        `casbin=${casbinResult} legacy=${legacyResult}`
    )
  }

  return legacyResult
}

/**
 * Check if a user is a teacher of a player (student enrolled in their classroom).
 */
export async function checkIsTeacherOf(userId: string, playerId: string): Promise<boolean> {
  if (!PARALLEL_RUN) {
    const enforcer = await getResourceEnforcer()
    const enrolled = await enforcer.hasGroupingPolicy(
      userId,
      'teacher-enrolled',
      `player:${playerId}`
    )
    const present = await enforcer.hasGroupingPolicy(
      userId,
      'teacher-present',
      `player:${playerId}`
    )
    return enrolled || present
  }

  const [casbinResult, legacyResult] = await Promise.all([
    getResourceEnforcer()
      .then(async (e) => {
        const enrolled = await e.hasGroupingPolicy(userId, 'teacher-enrolled', `player:${playerId}`)
        const present = await e.hasGroupingPolicy(userId, 'teacher-present', `player:${playerId}`)
        return enrolled || present
      })
      .catch((err) => {
        console.error('[AUTH-MIGRATION] Casbin error:', err)
        return null
      }),
    legacyIsTeacherOf(userId, playerId),
  ])

  if (casbinResult !== null && casbinResult !== legacyResult) {
    console.warn(
      `[AUTH-MIGRATION] Mismatch on checkIsTeacherOf: ` +
        `user=${userId} player=${playerId} ` +
        `casbin=${casbinResult} legacy=${legacyResult}`
    )
  }

  return legacyResult
}
