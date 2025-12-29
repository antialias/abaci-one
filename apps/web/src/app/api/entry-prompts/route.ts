import { and, eq, gt, inArray } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getLinkedChildren } from '@/lib/classroom'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/entry-prompts
 * Get pending entry prompts for the current user's children (parent view)
 *
 * Returns active (pending + not expired) prompts for all children linked to the viewer
 */
export async function GET(_req: NextRequest) {
  try {
    const userId = await getDbUserId()

    // Get children linked to this user (parent)
    const children = await getLinkedChildren(userId)
    if (children.length === 0) {
      return NextResponse.json({ prompts: [] })
    }

    const childIds = children.map((c) => c.id)

    // Get pending prompts for these children
    const now = new Date()
    const prompts = await db.query.entryPrompts.findMany({
      where: and(
        inArray(schema.entryPrompts.playerId, childIds),
        eq(schema.entryPrompts.status, 'pending'),
        gt(schema.entryPrompts.expiresAt, now)
      ),
    })

    // Get additional info for display (classroom names, player info)
    const enrichedPrompts = await Promise.all(
      prompts.map(async (prompt) => {
        const [classroom, player, teacher] = await Promise.all([
          db.query.classrooms.findFirst({
            where: eq(schema.classrooms.id, prompt.classroomId),
          }),
          db.query.players.findFirst({
            where: eq(schema.players.id, prompt.playerId),
          }),
          db.query.users.findFirst({
            where: eq(schema.users.id, prompt.teacherId),
          }),
        ])

        return {
          ...prompt,
          expiresAt: prompt.expiresAt.toISOString(),
          createdAt: prompt.createdAt.toISOString(),
          player: {
            id: player?.id ?? prompt.playerId,
            name: player?.name ?? 'Unknown student',
            emoji: player?.emoji ?? '👤',
          },
          classroom: {
            id: classroom?.id ?? prompt.classroomId,
            name: classroom?.name ?? 'Unknown classroom',
          },
          teacher: {
            displayName: teacher?.name ?? 'Your teacher',
          },
        }
      })
    )

    return NextResponse.json({ prompts: enrichedPrompts })
  } catch (error) {
    console.error('Failed to fetch entry prompts:', error)
    return NextResponse.json({ error: 'Failed to fetch entry prompts' }, { status: 500 })
  }
}
