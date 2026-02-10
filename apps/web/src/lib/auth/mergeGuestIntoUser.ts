import { eq, sql } from 'drizzle-orm'
import { db, schema } from '@/db'

/**
 * Merge a guest user's data into an existing authenticated user.
 *
 * This handles the "same person, different device" scenario:
 * User signs in on Device B with Google, but they already have an
 * authenticated account from Device A. Device B has a guest user row
 * with its own players/data that needs to be merged into the existing account.
 *
 * All data from sourceUserId is re-parented to targetUserId, then the
 * source user record is deleted.
 */
export async function mergeGuestIntoUser(
  sourceUserId: string,
  targetUserId: string
): Promise<void> {
  if (sourceUserId === targetUserId) {
    return
  }

  console.log(`[auth] merging guest user ${sourceUserId} into ${targetUserId}`)

  // Helper to re-parent rows from source to target in a given table/column
  async function reparent(table: string, column: string) {
    await db.run(
      sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${targetUserId} WHERE ${sql.identifier(column)} = ${sourceUserId}`
    )
  }

  // Tables with user_id FK
  await reparent('players', 'user_id')
  await reparent('abacus_settings', 'user_id')
  await reparent('scanner_settings', 'user_id')
  await reparent('user_stats', 'user_id')
  await reparent('arcade_sessions', 'user_id')
  await reparent('custom_skills', 'user_id')
  await reparent('mcp_api_keys', 'user_id')
  await reparent('teacher_flowcharts', 'user_id')
  await reparent('skill_customizations', 'user_id')
  await reparent('workshop_sessions', 'user_id')

  // Tables with differently named FK columns
  await reparent('classrooms', 'teacher_id')
  await reparent('parent_child', 'parent_user_id')
  await reparent('entry_prompts', 'teacher_id')
  await reparent('entry_prompts', 'responded_by')
  await reparent('practice_attachments', 'uploaded_by')
  await reparent('classroom_presence', 'entered_by')
  await reparent('enrollment_requests', 'requested_by')
  await reparent('enrollment_requests', 'parent_approved_by')

  // Delete the source user (CASCADE will clean up auth_accounts and any remaining FKs)
  await db.delete(schema.users).where(eq(schema.users.id, sourceUserId))

  console.log(`[auth] merge complete: ${sourceUserId} → ${targetUserId}`)
}
