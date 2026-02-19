/**
 * Sync relationship tables to Casbin resource-level role assignments.
 *
 * Source of truth: parent_child, classroom_enrollments, classroom_presence tables.
 * Target: casbin_rules table (via resource enforcer).
 *
 * Domain format: "player:<playerId>" or "classroom:<classroomId>"
 * Role assignments: g, <userId>, <role>, <domain>
 */

import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getResourceEnforcer, notifyPolicyChanged } from './enforcer'
import { RESOURCE_POLICIES } from './resource-policies'

// --- Individual sync functions (call after mutations) ---

/**
 * After linking a parent to a child player.
 */
export async function syncParentLink(
  parentUserId: string,
  childPlayerId: string
): Promise<void> {
  const enforcer = await getResourceEnforcer()
  await enforcer.addGroupingPolicy(parentUserId, 'parent', `player:${childPlayerId}`)
  await notifyPolicyChanged()
}

/**
 * After unlinking a parent from a child player.
 */
export async function removeParentLink(
  parentUserId: string,
  childPlayerId: string
): Promise<void> {
  const enforcer = await getResourceEnforcer()
  await enforcer.removeGroupingPolicy(parentUserId, 'parent', `player:${childPlayerId}`)
  await notifyPolicyChanged()
}

/**
 * After enrolling a student in a classroom.
 * The teacher gets "teacher-enrolled" role for this player.
 */
export async function syncEnrollment(
  teacherUserId: string,
  playerId: string
): Promise<void> {
  const enforcer = await getResourceEnforcer()
  await enforcer.addGroupingPolicy(teacherUserId, 'teacher-enrolled', `player:${playerId}`)
  await notifyPolicyChanged()
}

/**
 * After unenrolling a student from a classroom.
 * Remove both teacher-enrolled and teacher-present roles.
 */
export async function removeEnrollment(
  teacherUserId: string,
  playerId: string
): Promise<void> {
  const enforcer = await getResourceEnforcer()
  // Remove both roles (presence implies enrollment)
  await enforcer.removeGroupingPolicy(
    teacherUserId,
    'teacher-enrolled',
    `player:${playerId}`
  )
  await enforcer.removeGroupingPolicy(
    teacherUserId,
    'teacher-present',
    `player:${playerId}`
  )
  await notifyPolicyChanged()
}

/**
 * After a student enters a classroom (gains presence).
 * Upgrade the teacher's role from teacher-enrolled to teacher-present.
 */
export async function syncPresence(
  teacherUserId: string,
  playerId: string
): Promise<void> {
  const enforcer = await getResourceEnforcer()
  // Remove enrolled, add present (upgrade)
  await enforcer.removeGroupingPolicy(
    teacherUserId,
    'teacher-enrolled',
    `player:${playerId}`
  )
  await enforcer.addGroupingPolicy(
    teacherUserId,
    'teacher-present',
    `player:${playerId}`
  )
  await notifyPolicyChanged()
}

/**
 * After a student leaves a classroom (loses presence).
 * Downgrade the teacher's role from teacher-present to teacher-enrolled.
 */
export async function removePresence(
  teacherUserId: string,
  playerId: string
): Promise<void> {
  const enforcer = await getResourceEnforcer()
  // Remove present, restore enrolled (downgrade)
  await enforcer.removeGroupingPolicy(
    teacherUserId,
    'teacher-present',
    `player:${playerId}`
  )
  await enforcer.addGroupingPolicy(
    teacherUserId,
    'teacher-enrolled',
    `player:${playerId}`
  )
  await notifyPolicyChanged()
}

/**
 * After creating a classroom, give the teacher management role.
 */
export async function syncClassroomOwner(
  teacherUserId: string,
  classroomId: string
): Promise<void> {
  const enforcer = await getResourceEnforcer()
  await enforcer.addGroupingPolicy(
    teacherUserId,
    'teacher',
    `classroom:${classroomId}`
  )
  await notifyPolicyChanged()
}

// --- Bulk sync (run on startup or manual reconciliation) ---

/**
 * Full sync of all relationship tables into Casbin.
 *
 * 1. Clears all existing grouping policies (g rules)
 * 2. Seeds static resource policies (p rules) if not present
 * 3. Syncs parent_child → parent role assignments
 * 4. Syncs classroom_enrollments → teacher-enrolled assignments
 * 5. Syncs classroom_presence → upgrades to teacher-present
 * 6. Syncs classrooms → teacher classroom management roles
 */
export async function bulkSyncRelationships(): Promise<void> {
  const enforcer = await getResourceEnforcer()

  // Clear existing dynamic policies and reload
  await db.delete(schema.casbinRules)
  await enforcer.loadPolicy()

  // Seed static resource policies
  for (const [ptype, sub, dom, obj, act] of RESOURCE_POLICIES) {
    await enforcer.addPolicy(sub, dom, obj, act)
    // ptype is always 'p' for these
    void ptype
  }

  // Sync parent-child relationships
  const parentLinks = await db.select().from(schema.parentChild).all()
  for (const link of parentLinks) {
    await enforcer.addGroupingPolicy(
      link.parentUserId,
      'parent',
      `player:${link.childPlayerId}`
    )
  }

  // Sync classroom enrollments
  // We need the teacher's userId for each enrollment
  const enrollments = await db
    .select({
      playerId: schema.classroomEnrollments.playerId,
      classroomId: schema.classroomEnrollments.classroomId,
      teacherId: schema.classrooms.teacherId,
    })
    .from(schema.classroomEnrollments)
    .innerJoin(
      schema.classrooms,
      eq(schema.classroomEnrollments.classroomId, schema.classrooms.id)
    )
    .all()

  // Track which players have presence (will be upgraded)
  const presenceSet = new Set<string>()
  const presenceRows = await db.select().from(schema.classroomPresence).all()
  for (const row of presenceRows) {
    presenceSet.add(`${row.classroomId}:${row.playerId}`)
  }

  for (const enrollment of enrollments) {
    const key = `${enrollment.classroomId}:${enrollment.playerId}`
    if (presenceSet.has(key)) {
      // Student is present — assign teacher-present
      await enforcer.addGroupingPolicy(
        enrollment.teacherId,
        'teacher-present',
        `player:${enrollment.playerId}`
      )
    } else {
      // Student is enrolled but not present — assign teacher-enrolled
      await enforcer.addGroupingPolicy(
        enrollment.teacherId,
        'teacher-enrolled',
        `player:${enrollment.playerId}`
      )
    }
  }

  // Sync classroom ownership
  const classrooms = await db.select().from(schema.classrooms).all()
  for (const classroom of classrooms) {
    await enforcer.addGroupingPolicy(
      classroom.teacherId,
      'teacher',
      `classroom:${classroom.id}`
    )
  }

  await enforcer.savePolicy()
  console.log(
    `[casbin] Bulk sync complete: ${parentLinks.length} parent links, ` +
      `${enrollments.length} enrollments, ${presenceSet.size} present, ` +
      `${classrooms.length} classrooms`
  )
}
