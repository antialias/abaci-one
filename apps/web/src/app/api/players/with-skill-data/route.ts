import { NextResponse } from 'next/server'
import { getPlayersWithSkillData } from '@/lib/curriculum/server'

/**
 * GET /api/players/with-skill-data
 * Returns all players for the current viewer with their skill data
 * (practicing skills, last practiced, skill category)
 */
export async function GET() {
  try {
    const result = await getPlayersWithSkillData()
    return NextResponse.json({ players: result.players })
  } catch (error) {
    console.error('Failed to fetch players with skill data:', error)
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
  }
}
