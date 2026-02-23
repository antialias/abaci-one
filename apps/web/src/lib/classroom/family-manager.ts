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
  familyEvents,
  generateFamilyCode,
  parentChild,
  type Player,
  players,
  users,
  type User,
} from '@/db/schema'
import { syncParentLink, removeParentLink } from '@/lib/auth/sync-relationships'
import { autoFormHousehold } from '@/lib/household'
import { notifyParentLinked } from '@/lib/notifications/family-link-email'

/** Maximum number of parents that can be linked to a single child */
export const MAX_PARENTS_PER_CHILD = 4

/** Number of days before a family code expires */
export const FAMILY_CODE_EXPIRY_DAYS = 7

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

  // Check if family code has expired (7-day window)
  if (player.familyCode) {
    const generatedAt = player.familyCodeGeneratedAt
    if (!generatedAt) {
      // Code exists but no timestamp — treat as expired (legacy code without timestamp)
      return {
        success: false,
        error: 'This family code has expired. Ask the parent to regenerate it.',
      }
    }
    const expiresAt = new Date(
      generatedAt.getTime() + FAMILY_CODE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    )
    if (new Date() > expiresAt) {
      return {
        success: false,
        error: 'This family code has expired. Ask the parent to regenerate it.',
      }
    }
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

  // Check parent cap
  const existingParents = await db.query.parentChild.findMany({
    where: eq(parentChild.childPlayerId, player.id),
  })
  if (existingParents.length >= MAX_PARENTS_PER_CHILD) {
    return {
      success: false,
      error: `This student already has the maximum number of linked parents (${MAX_PARENTS_PER_CHILD})`,
    }
  }

  // Create link
  await db.insert(parentChild).values({
    parentUserId,
    childPlayerId: player.id,
  })

  // Record event (non-fatal)
  recordFamilyEvent(player.id, 'parent_linked', parentUserId, parentUserId).catch((err) =>
    console.error('[family-events] Failed to record parent_linked:', err)
  )

  // Sync to Casbin (non-fatal)
  syncParentLink(parentUserId, player.id).catch((err) =>
    console.error('[auth-sync] Failed to sync parent link:', err)
  )

  // Auto-form household between child owner and linking parent (non-fatal)
  autoFormHousehold(player.userId, parentUserId).catch((err) =>
    console.error('[household] Failed to auto-form household:', err)
  )

  // Notify existing parents (non-fatal)
  notifyParentLinked(player.id, player.name, parentUserId).catch((err) =>
    console.error('[family-notify] Failed to send parent link notification:', err)
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
  playerId: string,
  actorUserId?: string
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

  // Record event (non-fatal)
  recordFamilyEvent(playerId, 'parent_unlinked', actorUserId ?? parentUserId, parentUserId).catch(
    (err) => console.error('[family-events] Failed to record parent_unlinked:', err)
  )

  // Sync to Casbin (non-fatal)
  removeParentLink(parentUserId, playerId).catch((err) =>
    console.error('[auth-sync] Failed to remove parent link:', err)
  )

  return { success: true }
}

/**
 * Result of getting or creating a family code
 */
export interface FamilyCodeResult {
  familyCode: string
  generatedAt: Date | null
}

/**
 * Get the family code for a player, generating one if needed
 */
export async function getOrCreateFamilyCode(playerId: string): Promise<FamilyCodeResult | null> {
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  })

  if (!player) return null

  if (player.familyCode) {
    return {
      familyCode: player.familyCode,
      generatedAt: player.familyCodeGeneratedAt ?? null,
    }
  }

  // Generate and save new family code
  const newCode = generateFamilyCode()
  const now = new Date()

  await db
    .update(players)
    .set({ familyCode: newCode, familyCodeGeneratedAt: now })
    .where(eq(players.id, playerId))

  return { familyCode: newCode, generatedAt: now }
}

/**
 * Regenerate family code for a player
 *
 * Use this if a parent wants to invalidate an old code that was shared.
 * Note: This won't affect existing parent-child links.
 */
export async function regenerateFamilyCode(
  playerId: string,
  userId?: string
): Promise<string | null> {
  const player = await db.query.players.findFirst({
    where: eq(players.id, playerId),
  })

  if (!player) return null

  const newCode = generateFamilyCode()

  await db
    .update(players)
    .set({ familyCode: newCode, familyCodeGeneratedAt: new Date() })
    .where(eq(players.id, playerId))

  // Record event (non-fatal)
  if (userId) {
    recordFamilyEvent(playerId, 'code_regenerated', userId).catch((err) =>
      console.error('[family-events] Failed to record code_regenerated:', err)
    )
  }

  return newCode
}

/**
 * Record a family event for the audit log
 */
async function recordFamilyEvent(
  childPlayerId: string,
  eventType: 'parent_linked' | 'parent_unlinked' | 'code_regenerated',
  actorUserId: string,
  targetUserId?: string
): Promise<void> {
  await db.insert(familyEvents).values({
    childPlayerId,
    eventType,
    actorUserId,
    targetUserId: targetUserId ?? null,
  })
}

/**
 * Get recent family events for a child (last 7 days, max 20)
 */
export async function getRecentFamilyEvents(playerId: string) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const events = await db.query.familyEvents.findMany({
    where: and(
      eq(familyEvents.childPlayerId, playerId)
      // created_at is stored as unix timestamp in seconds
      // We need to compare with the timestamp value
    ),
    orderBy: (familyEvents, { desc }) => [desc(familyEvents.createdAt)],
    limit: 20,
  })

  // Filter by date in JS since drizzle timestamp mode stores as Date
  return events.filter((e) => e.createdAt >= sevenDaysAgo)
}

// Re-export the generateFamilyCode function from schema for convenience
export { generateFamilyCode } from '@/db/schema'
