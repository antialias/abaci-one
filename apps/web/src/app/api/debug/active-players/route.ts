import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/viewer'
import { getActivePlayers } from '@/lib/arcade/player-manager'
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'
import { withAuth } from '@/lib/auth/withAuth'

// Force dynamic rendering - this route uses headers()
export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/active-players
 * Debug endpoint to check active players for current user
 */
export const GET = withAuth(
  async () => {
    try {
      const userId = await getUserId()

      // Get ALL players for this user
      const allPlayers = await db.query.players.findMany({
        where: eq(schema.players.userId, userId),
      })

      // Get active players using the helper
      const activePlayers = await getActivePlayers(userId)

      return NextResponse.json({
        userId,
        allPlayers: allPlayers.map((p) => ({
          id: p.id,
          name: p.name,
          emoji: p.emoji,
          isActive: p.isActive,
        })),
        activePlayers: activePlayers.map((p) => ({
          id: p.id,
          name: p.name,
          emoji: p.emoji,
          isActive: p.isActive,
        })),
        activeCount: activePlayers.length,
        totalCount: allPlayers.length,
      })
    } catch (error) {
      console.error('Failed to fetch active players:', error)
      return NextResponse.json(
        { error: 'Failed to fetch active players', details: String(error) },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)
