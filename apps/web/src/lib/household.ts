/**
 * Household Management Module
 *
 * Core logic for creating and managing households.
 * A household groups multiple users under a single subscription —
 * the owner's subscription covers all household members.
 */

import { and, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { households, householdMembers, parentChild, players, users } from '@/db/schema'
import { createId } from '@paralleldrive/cuid2'

/** Maximum number of members in a household */
export const MAX_HOUSEHOLD_SIZE = 10

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HouseholdSummary {
  id: string
  name: string
  ownerId: string
  role: 'owner' | 'member'
  memberCount: number
}

export interface HouseholdDetail {
  id: string
  name: string
  ownerId: string
  createdAt: Date
  members: Array<{
    userId: string
    name: string | null
    email: string | null
    image: string | null
    role: 'owner' | 'member'
    joinedAt: Date
  }>
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all households a user belongs to, with member counts.
 */
export async function getUserHouseholds(userId: string): Promise<HouseholdSummary[]> {
  const rows = await db
    .select({
      id: households.id,
      name: households.name,
      ownerId: households.ownerId,
      role: householdMembers.role,
      memberCount: sql<number>`(
        SELECT COUNT(*) FROM household_members hm2
        WHERE hm2.household_id = ${households.id}
      )`,
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    ownerId: r.ownerId,
    role: r.role as 'owner' | 'member',
    memberCount: Number(r.memberCount),
  }))
}

/**
 * Get full details of a household including all members.
 */
export async function getHouseholdDetail(householdId: string): Promise<HouseholdDetail | null> {
  const household = await db.query.households.findFirst({
    where: eq(households.id, householdId),
  })

  if (!household) return null

  const members = await db
    .select({
      userId: householdMembers.userId,
      name: users.name,
      email: users.email,
      image: users.image,
      role: householdMembers.role,
      joinedAt: householdMembers.joinedAt,
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, householdId))

  return {
    id: household.id,
    name: household.name,
    ownerId: household.ownerId,
    createdAt: household.createdAt,
    members: members.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      image: m.image,
      role: m.role as 'owner' | 'member',
      joinedAt: m.joinedAt,
    })),
  }
}

/**
 * Check if a user is a member of a specific household.
 */
export async function isHouseholdMember(householdId: string, userId: string): Promise<boolean> {
  const row = await db.query.householdMembers.findFirst({
    where: and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)),
  })
  return !!row
}

/**
 * Suggest users who share children with household members but aren't in the household.
 */
export async function getHouseholdSuggestions(householdId: string): Promise<
  Array<{
    userId: string
    name: string | null
    email: string | null
    image: string | null
    sharedChildren: string[]
  }>
> {
  // 1. Get current household member IDs
  const members = await db
    .select({ userId: householdMembers.userId })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId))

  const memberIds = members.map((m) => m.userId)
  if (memberIds.length === 0) return []

  // 2. Find children of household members
  const memberChildren = await db
    .select({
      parentUserId: parentChild.parentUserId,
      childPlayerId: parentChild.childPlayerId,
    })
    .from(parentChild)
    .where(inArray(parentChild.parentUserId, memberIds))

  const childIds = [...new Set(memberChildren.map((r) => r.childPlayerId))]
  if (childIds.length === 0) return []

  // 3. Find other parents of those children who aren't in the household
  const coParents = await db
    .select({
      parentUserId: parentChild.parentUserId,
      childPlayerId: parentChild.childPlayerId,
    })
    .from(parentChild)
    .where(
      and(
        inArray(parentChild.childPlayerId, childIds),
        notInArray(parentChild.parentUserId, memberIds)
      )
    )

  if (coParents.length === 0) return []

  // 4. Group by parent, collect shared child IDs
  const parentChildMap = new Map<string, Set<string>>()
  for (const row of coParents) {
    if (!parentChildMap.has(row.parentUserId)) {
      parentChildMap.set(row.parentUserId, new Set())
    }
    parentChildMap.get(row.parentUserId)!.add(row.childPlayerId)
  }

  // 5. Look up user details
  const parentIds = [...parentChildMap.keys()]
  const parentUsers = await db
    .select({ id: users.id, name: users.name, email: users.email, image: users.image })
    .from(users)
    .where(inArray(users.id, parentIds))

  // 6. Resolve child player names
  const allChildIds = [...new Set([...parentChildMap.values()].flatMap((s) => [...s]))]
  const childPlayers =
    allChildIds.length > 0
      ? await db
          .select({ id: players.id, name: players.name })
          .from(players)
          .where(inArray(players.id, allChildIds))
      : []
  const childNameMap = new Map(childPlayers.map((p) => [p.id, p.name]))

  // Only suggest users with a name or email (skip anonymous guest accounts)
  return parentUsers
    .filter((u) => u.name || u.email)
    .map((u) => ({
      userId: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      sharedChildren: [...(parentChildMap.get(u.id) || [])].map(
        (id) => childNameMap.get(id) || 'Unknown'
      ),
    }))
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new household with the given user as owner.
 * A user can only own one household.
 */
export async function createHousehold(
  ownerId: string,
  name: string
): Promise<{ id: string; name: string }> {
  // Enforce one-household-per-owner
  const existing = await findOwnedHousehold(ownerId)
  if (existing) {
    throw new Error('You already own a household')
  }

  const id = createId()

  await db.insert(households).values({
    id,
    name,
    ownerId,
  })

  // Add the owner as the first member
  await db.insert(householdMembers).values({
    householdId: id,
    userId: ownerId,
    role: 'owner',
  })

  return { id, name }
}

/**
 * Find a household owned by a specific user.
 * Returns the first one found (a user could own multiple).
 */
async function findOwnedHousehold(ownerId: string) {
  return db.query.households.findFirst({
    where: eq(households.ownerId, ownerId),
  })
}

/**
 * Get the current member count for a household.
 */
async function getHouseholdMemberCount(householdId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId))

  return Number(row?.count ?? 0)
}

/**
 * Add a user to a household if they're not already a member.
 * Idempotent — silently succeeds if already a member.
 */
async function addMemberIfNotExists(householdId: string, userId: string): Promise<void> {
  const existing = await db.query.householdMembers.findFirst({
    where: and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)),
  })

  if (existing) return

  await db.insert(householdMembers).values({
    householdId,
    userId,
    role: 'member',
  })
}

/**
 * Add a member to a household (owner-initiated).
 * Enforces the size cap and uniqueness.
 */
export async function addHouseholdMember(
  householdId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Check size cap
  const count = await getHouseholdMemberCount(householdId)
  if (count >= MAX_HOUSEHOLD_SIZE) {
    return { success: false, error: `Household is full (max ${MAX_HOUSEHOLD_SIZE} members)` }
  }

  // Check if already a member
  const existing = await db.query.householdMembers.findFirst({
    where: and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)),
  })

  if (existing) {
    return { success: false, error: 'User is already a member of this household' }
  }

  await db.insert(householdMembers).values({
    householdId,
    userId,
    role: 'member',
  })

  return { success: true }
}

/**
 * Remove a member from a household.
 *
 * Lifecycle rules:
 * - Non-owner members can leave freely.
 * - Owner with other members must transfer ownership first.
 * - Owner as sole member → dissolves the household entirely.
 */
export async function removeHouseholdMember(
  householdId: string,
  userId: string
): Promise<{ success: boolean; dissolved?: boolean; error?: string }> {
  const household = await db.query.households.findFirst({
    where: eq(households.id, householdId),
  })

  if (!household) {
    return { success: false, error: 'Household not found' }
  }

  if (household.ownerId === userId) {
    const memberCount = await getHouseholdMemberCount(householdId)

    if (memberCount > 1) {
      return { success: false, error: 'Transfer ownership before leaving the household' }
    }

    // Sole owner — dissolve the household (CASCADE deletes memberships)
    await db.delete(households).where(eq(households.id, householdId))
    return { success: true, dissolved: true }
  }

  await db
    .delete(householdMembers)
    .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))

  return { success: true }
}

/**
 * Transfer household ownership to another member.
 * The new owner must already be a member of the household.
 */
export async function transferHouseholdOwnership(
  householdId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<{ success: boolean; error?: string }> {
  const household = await db.query.households.findFirst({
    where: eq(households.id, householdId),
  })

  if (!household) {
    return { success: false, error: 'Household not found' }
  }

  if (household.ownerId !== currentOwnerId) {
    return { success: false, error: 'Only the current owner can transfer ownership' }
  }

  // Verify new owner is a member
  const newOwnerMembership = await db.query.householdMembers.findFirst({
    where: and(
      eq(householdMembers.householdId, householdId),
      eq(householdMembers.userId, newOwnerId)
    ),
  })

  if (!newOwnerMembership) {
    return { success: false, error: 'New owner must be a member of the household' }
  }

  // Update household owner
  await db
    .update(households)
    .set({ ownerId: newOwnerId, updatedAt: new Date() })
    .where(eq(households.id, householdId))

  // Update member roles
  await db
    .update(householdMembers)
    .set({ role: 'member' })
    .where(
      and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.userId, currentOwnerId)
      )
    )

  await db
    .update(householdMembers)
    .set({ role: 'owner' })
    .where(
      and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, newOwnerId))
    )

  return { success: true }
}

/**
 * Update household name.
 */
export async function updateHouseholdName(householdId: string, name: string): Promise<void> {
  await db
    .update(households)
    .set({ name, updatedAt: new Date() })
    .where(eq(households.id, householdId))
}

// ---------------------------------------------------------------------------
// Auto-formation (called from family-manager on family code link)
// ---------------------------------------------------------------------------

/**
 * Automatically create or join a household when a parent links to a child.
 *
 * If the child's owner already has a household, add the new parent to it.
 * If not, create a household for the owner and add both.
 *
 * This is called from `linkParentToChild()` after a successful link.
 */
export async function autoFormHousehold(
  childOwnerUserId: string,
  newParentUserId: string
): Promise<void> {
  // Don't form a household with yourself
  if (childOwnerUserId === newParentUserId) return

  // 1. Find owner's existing household (where they are owner)
  let household = await findOwnedHousehold(childOwnerUserId)

  // 2. If none, create one
  if (!household) {
    // Look up owner's name for the household name
    const owner = await db.query.users.findFirst({
      where: eq(users.id, childOwnerUserId),
      columns: { name: true },
    })
    const householdName = owner?.name ? `${owner.name}'s Family` : 'My Family'

    const created = await createHousehold(childOwnerUserId, householdName)
    household = await db.query.households.findFirst({
      where: eq(households.id, created.id),
    })
    if (!household) return // shouldn't happen
  }

  // 3. Check size cap
  const memberCount = await getHouseholdMemberCount(household.id)
  if (memberCount >= MAX_HOUSEHOLD_SIZE) return // silently skip

  // 4. Add new parent (idempotent)
  await addMemberIfNotExists(household.id, newParentUserId)
}
