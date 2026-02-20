import { and, eq, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { generateFamilyCode, parentChild } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'
import { getValidParentLinks } from '@/lib/classroom/access-control'
import { getLimitsForUser } from '@/lib/subscription'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/players
 * List all players for the current viewer (guest or user)
 * Includes both created players and linked children via parent_child
 *
 * Guest sharing expiry is handled centrally by getValidParentLinks().
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getDbUserId()

    // Get valid parent links (applies guest share expiry centrally)
    const validLinks = await getValidParentLinks(userId)
    const linkedIds = validLinks.map((link) => link.childPlayerId)

    // Get all players: created by this user OR linked via parent_child
    let players
    if (linkedIds.length > 0) {
      players = await db.query.players.findMany({
        where: or(eq(schema.players.userId, userId), inArray(schema.players.id, linkedIds)),
        orderBy: (players, { desc }) => [desc(players.createdAt)],
      })
    } else {
      // No linked players, just get created players
      players = await db.query.players.findMany({
        where: eq(schema.players.userId, userId),
        orderBy: (players, { desc }) => [desc(players.createdAt)],
      })
    }

    return NextResponse.json({ players })
  } catch (error) {
    console.error('Failed to fetch players:', error)
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
  }
})

/**
 * POST /api/players
 * Create a new player for the current viewer
 */
export const POST = withAuth(async (request) => {
  try {
    const userId = await getDbUserId()
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.emoji || !body.color) {
      return NextResponse.json(
        { error: 'Missing required fields: name, emoji, color' },
        { status: 400 }
      )
    }

    const isPracticeStudent = body.isPracticeStudent ?? true

    // Enforce practice student limit (arcade players are unlimited)
    if (isPracticeStudent) {
      const limits = await getLimitsForUser(userId)
      if (limits.maxPracticeStudents !== Infinity) {
        const practiceStudentCount = await db
          .select({ id: schema.players.id })
          .from(schema.players)
          .where(
            and(
              eq(schema.players.userId, userId),
              eq(schema.players.isArchived, false),
              eq(schema.players.isPracticeStudent, true)
            )
          )
          .all()
        if (practiceStudentCount.length >= limits.maxPracticeStudents) {
          return NextResponse.json(
            {
              error: 'Practice student limit reached',
              code: 'PRACTICE_STUDENT_LIMIT_REACHED',
              limit: limits.maxPracticeStudents,
            },
            { status: 403 }
          )
        }
      }
    }

    // Generate a unique family code for the new player
    const familyCode = generateFamilyCode()

    // Create player with family code
    const [player] = await db
      .insert(schema.players)
      .values({
        userId,
        name: body.name,
        emoji: body.emoji,
        color: body.color,
        isActive: body.isActive ?? false,
        isPracticeStudent,
        familyCode,
      })
      .returning()

    // Create parent-child relationship
    await db.insert(parentChild).values({
      parentUserId: userId,
      childPlayerId: player.id,
    })

    return NextResponse.json({ player }, { status: 201 })
  } catch (error) {
    console.error('Failed to create player:', error)
    return NextResponse.json({ error: 'Failed to create player' }, { status: 500 })
  }
})
