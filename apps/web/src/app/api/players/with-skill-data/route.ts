import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getPlayersWithSkillData } from '@/lib/curriculum/server'

/**
 * GET /api/players/with-skill-data
 * Returns all players for the current viewer with their skill data
 * (practicing skills, last practiced, skill category)
 */
export const GET = withAuth(async () => {
  try {
    const players = await getPlayersWithSkillData()
    return NextResponse.json({ players })
  } catch (error) {
    console.error('Failed to fetch players with skill data:', error)
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
  }
})
