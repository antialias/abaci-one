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

  // Helper for tables with unique constraint on user_id (one row per user).
  // Delete the guest's row if the target user already has one; otherwise re-parent.
  async function reparentOrDrop(table: string, column: string) {
    await db.run(
      sql`DELETE FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} = ${sourceUserId} AND EXISTS (SELECT 1 FROM ${sql.identifier(table)} AS t2 WHERE t2.${sql.identifier(column)} = ${targetUserId})`
    )
    await reparent(table, column)
  }

  // Tables with user_id FK (multi-row, no unique constraint on user_id)
  await reparent('players', 'user_id')
  await reparent('arcade_sessions', 'user_id')
  await reparent('custom_skills', 'user_id')
  await reparent('mcp_api_keys', 'user_id')
  await reparent('teacher_flowcharts', 'user_id')
  await reparent('skill_customizations', 'user_id')
  await reparent('workshop_sessions', 'user_id')

  // Arcade tables
  await reparent('arcade_rooms', 'created_by')
  await reparentOrDrop('room_members', 'user_id')
  await reparent('room_bans', 'user_id')
  await reparent('room_bans', 'banned_by')
  await reparent('room_reports', 'reporter_id')
  await reparent('room_reports', 'reported_user_id')
  await reparent('room_reports', 'reviewed_by')
  await reparent('room_invitations', 'user_id')
  await reparent('room_invitations', 'invited_by')
  await reparent('room_join_requests', 'user_id')
  await reparent('room_join_requests', 'reviewed_by')
  await reparent('room_member_history', 'user_id')

  // Worksheet tables
  await reparentOrDrop('worksheet_settings', 'user_id')
  await reparent('worksheet_mastery', 'user_id')
  await reparent('worksheet_attempts', 'user_id')
  await reparent('problem_attempts', 'user_id')

  // Game results and observation shares
  await reparent('game_results', 'user_id')
  await reparent('session_observation_shares', 'created_by')

  // Tables with unique constraint on user_id (one settings row per user)
  // Prefer the target user's settings; drop the guest's if both exist
  await reparentOrDrop('abacus_settings', 'user_id')
  await reparentOrDrop('scanner_settings', 'user_id')
  await reparentOrDrop('user_stats', 'user_id')
  await reparentOrDrop('feature_flag_overrides', 'user_id')

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
