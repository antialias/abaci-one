/**
 * API route for the player-bound "my abacus" identity
 *
 * GET /api/players/[id]/abacus-identity
 * PUT /api/players/[id]/abacus-identity
 *
 * The identity triple (color scheme + palette + column count) the Abacus
 * Studio seeds from when this player is selected. Absent row reads as the
 * stock defaults; GET never creates (a 'view'-level teacher must not write).
 * Writes require 'start-session' access: a parent, or a teacher while the
 * student is present.
 */

import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { playerAbacusIdentity } from '@/db/schema/player-abacus-identity'
import {
  type AbacusIdentity,
  DEFAULT_ABACUS_IDENTITY,
  parseAbacusIdentity,
} from '@/lib/abacus/identity'
import { withAuth } from '@/lib/auth/withAuth'
import { canPerformAction } from '@/lib/classroom'
import { getUserId } from '@/lib/viewer'

export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id: playerId } = (await params) as { id: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const userId = await getUserId()
    const canView = await canPerformAction(userId, playerId, 'view')
    if (!canView) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const row = await db
      .select()
      .from(playerAbacusIdentity)
      .where(eq(playerAbacusIdentity.playerId, playerId))
      .get()

    const identity: AbacusIdentity = row
      ? { colorScheme: row.colorScheme, colorPalette: row.colorPalette, columns: row.columns }
      : DEFAULT_ABACUS_IDENTITY

    return NextResponse.json({ identity })
  } catch (error) {
    console.error('Error fetching abacus identity:', error)
    return NextResponse.json({ error: 'Failed to fetch abacus identity' }, { status: 500 })
  }
})

export const PUT = withAuth(async (request, { params }) => {
  try {
    const { id: playerId } = (await params) as { id: string }

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID required' }, { status: 400 })
    }

    const userId = await getUserId()
    const canEdit = await canPerformAction(userId, playerId, 'start-session')
    if (!canEdit) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as { identity?: unknown } | null
    const identity = parseAbacusIdentity(body?.identity)
    if (!identity) {
      return NextResponse.json({ error: 'Invalid abacus identity' }, { status: 400 })
    }

    const now = Date.now()
    await db
      .insert(playerAbacusIdentity)
      .values({ playerId, ...identity, updatedAt: now })
      .onConflictDoUpdate({
        target: playerAbacusIdentity.playerId,
        set: { ...identity, updatedAt: now },
      })

    return NextResponse.json({ identity })
  } catch (error) {
    console.error('Error saving abacus identity:', error)
    return NextResponse.json({ error: 'Failed to save abacus identity' }, { status: 500 })
  }
})
