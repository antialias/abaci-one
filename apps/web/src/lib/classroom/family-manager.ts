/**
 * Family Manager Module
 *
 * Manages parent-child relationships:
 * - Link parent to child via family code
 * - Get linked parents for a child
 * - Unlink parent from child
 * - Generate family codes
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  generateFamilyCode,
  parentChild,
  type Player,
  players,
  users,
  type User,
} from '@/db/schema'
import { syncParentLink, removeParentLink } from '@/lib/auth/sync-relationships'

/**
 * Result of linking a parent to a child
 */
export interface LinkResult {
  success: boolean
  player?: Player
  error?: string
}

/**
 * Link a parent to a child via family code
 *
 * Parents share family codes to link another parent to their child.
 * This creates a many-to-many relationship where children can have
 * multiple parents with equal access.
 */
export async function linkParentToChild(
  parentUserId: string,
  familyCode: string
): Promise<LinkResult> {
  // Normalize code
  const normalizedCode = familyCode.toUpperCase().trim()

  // Find player by family code
  const player = await db.query.players.findFirst({
    where: eq(players.familyCode, normalizedCode),
  })

  if (!player) {
    return { success: false, error: 'Invalid family code' }
  }

  // Only students owned by non-guest (authenticated) users can be shared.
  // Guest-created students are ephemeral and shouldn't be linked to other accounts.
  const owner = await db.query.users.findFirst({
    where: eq(users.id, player.userId),
  })
  if (!owner?.upgradedAt) {
    return { success: false, error: 'This student cannot be shared' }
  }

  // Check if already linked
  const existing = await db.query.parentChild.findFirst({
    where: and(
      eq(parentChild.parentUserId, parentUserId),
      eq(parentChild.childPlayerId, player.id)
    ),
  })

  if (existing) {
    return { success: false, error: 'Already linked to this child' }
  }

  // Create link
  await db.insert(parentChild).values({
    parentUserId,
    childPlayerId: player.id,
  })

  // Sync to Casbin (non-fatal)
  syncParentLink(parentUserId, player.id).catch((err) =>
    console.error('[auth-sync] Failed to sync parent link:', err)
  )

  return { success: true, player }
}

/**
 * Get all parents linked to a child
 */
export async function getLinkedParents(playerId: string): Promise<User[]> {
  const links = await db.query.parentChild.findMany({
    where: eq(parentChild.childPlayerId, playerId),
  })

  if (links.length === 0) return []

  const parentIds = links.map((l) => l.parentUserId)
  const linkedParents = await db.query.users.findMany({
    where: (users, { inArray }) => inArray(users.id, parentIds),
  })

  return linkedParents
}

/**
 * Get all parent user IDs for a child (simpler version)
 */
export async function getLinkedParentIds(playerId: string): Promise<string[]> {
  const links = await db.query.parentChild.findMany({
    where: eq(parentChild.childPlayerId, playerId),
  })
  return links.map((l) => l.parentUserId)
}

/**
 * Get all children linked to a parent
 */
export async function getLinkedChildren(parentUserId: string): Promise<Player[]> {
  const links = await db.query.parentChild.findMany({
    where: eq(parentChild.parentUserId, parentUserId),
  })

  if (links.length === 0) return []

  const childIds = links.map((l) => l.childPlayerId)
  const linkedChildren = await db.query.players.findMany({
    where: (players, { inArray }) => inArray(players.id, childIds),
  })

  return linkedChildren
}

/**
 * Unlink a parent from a child
 *
 * Note: The last parent cannot be unlinked (every child must have at least one parent).
 * Returns error if trying to unlink the only parent.
 */
export async function unlinkParentFromChild(
  parentUserId: string,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  // Check how many parents this child has
  const parentCount = await db.query.parentChild.findMany({
    where: eq(parentChild.childPlayerId, playerId),
  })

  if (parentCount.length <= 1) {
    return { success: false, error: 'Cannot unlink the only parent' }
  }

  // Remove the link
  await db
    .delete(parentChild)
    .where(and(eq(parentChild.parentUserId, parentUserId), eq(parentChild.childPlayerId, playerId)))

  // Sync to Casbin (non-fatal)
  removeParentLink(parentUserId, playerId).catch((err) =>
    console.error('[auth-sync] Failed to remove parent link:', err)
  )

  return { success: true }
}

/**
 * Get the family code for a player, generating one if needed
 */
export async function getOrCreateFamilyCode(playerId: string): Promise<string | null> {
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  })

  if (!player) return null

  if (player.familyCode) {
    return player.familyCode
  }

  // Generate and save new family code
  const newCode = generateFamilyCode()

  await db.update(players).set({ familyCode: newCode }).where(eq(players.id, playerId))

  return newCode
}

/**
 * Regenerate family code for a player
 *
 * Use this if a parent wants to invalidate an old code that was shared.
 * Note: This won't affect existing parent-child links.
 */
export async function regenerateFamilyCode(playerId: string): Promise<string | null> {
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  })

  if (!player) return null

  const newCode = generateFamilyCode()

  await db.update(players).set({ familyCode: newCode }).where(eq(players.id, playerId))

  return newCode
}

/**
 * Check if a user is a parent of a player
 *
 * Checks both:
 * 1. The parent_child many-to-many table (new relationship)
 * 2. The players.userId field (legacy - original creator)
 */
export async function isParent(userId: string, playerId: string): Promise<boolean> {
  // Check the parent_child table first (many-to-many relationship)
  const link = await db.query.parentChild.findFirst({
    where: and(eq(parentChild.parentUserId, userId), eq(parentChild.childPlayerId, playerId)),
  })
  if (link) return true

  // Fallback: Check if user is the original creator (legacy players)
  // This handles players created before the parent_child system was added
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  })
  if (player && player.userId === userId) return true

  return false
}

// Re-export the generateFamilyCode function from schema for convenience
export { generateFamilyCode } from '@/db/schema'
