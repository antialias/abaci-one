import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * POST /api/debug/archive-practice-students
 *
 * Bulk archive or unarchive all practice students for the current user.
 * Used by e2e tests to ensure a clean slate without deleting data.
 *
 * Body: { archive: boolean }
 *
 * Admin-only (via route-policy.csv: /api/debug/* → admin).
 */
export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json()
  const { archive } = body

  if (typeof archive !== 'boolean') {
    return NextResponse.json({ error: 'archive must be a boolean' }, { status: 400 })
  }

  const updated = await db
    .update(schema.players)
    .set({ isArchived: archive })
    .where(
      and(
        eq(schema.players.userId, userId),
        eq(schema.players.isPracticeStudent, true),
        eq(schema.players.isArchived, !archive)
      )
    )
    .returning({ id: schema.players.id })

  return NextResponse.json({
    archived: archive,
    count: updated.length,
  })
})
