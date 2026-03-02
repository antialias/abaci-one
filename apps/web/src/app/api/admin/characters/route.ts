/**
 * GET /api/admin/characters
 *
 * Returns a list of all registered characters with summary data.
 */

import { NextResponse } from 'next/server'
import { getAllCharacterSummaries } from '@/lib/character/characters'

export async function GET() {
  const characters = getAllCharacterSummaries()
  return NextResponse.json({ characters })
}
