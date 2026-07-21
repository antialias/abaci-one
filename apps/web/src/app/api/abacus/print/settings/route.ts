/**
 * User-bound print-settings overlay (gh#160)
 *
 * GET /api/abacus/print/settings - the caller's saved TicketStyle, or null
 * PUT /api/abacus/print/settings - validate + upsert the overlay verbatim
 *
 * One row per user. Absent row reads as `style: null` — there is no honest
 * server-side default; the default intent lives in the paired printer's
 * capability doc and the dialog derives its seed from that. The stored style
 * is the user's edits verbatim, never the service's `applied` clamp echoes.
 */
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { abacusPrintSettings } from '@/db/schema/print-service'
import { parseTicketStyle } from '@/lib/abacus/print/ticket-style'
import { withAuth } from '@/lib/auth/withAuth'
import { getUserId } from '@/lib/viewer'

export const GET = withAuth(async () => {
  try {
    const userId = await getUserId()
    const row = await db
      .select()
      .from(abacusPrintSettings)
      .where(eq(abacusPrintSettings.userId, userId))
      .get()

    const style = row ? parseTicketStyle(JSON.parse(row.style)) : null
    return NextResponse.json({ style })
  } catch (error) {
    console.error('[print-settings] read failed:', error)
    return NextResponse.json({ error: 'Failed to load print settings' }, { status: 500 })
  }
})

export const PUT = withAuth(async (request) => {
  try {
    const userId = await getUserId()
    const body = (await request.json().catch(() => null)) as { style?: unknown } | null
    const style = parseTicketStyle(body?.style)
    if (!style) {
      return NextResponse.json({ error: 'Invalid print settings' }, { status: 400 })
    }

    const now = new Date()
    await db
      .insert(abacusPrintSettings)
      .values({ userId, style: JSON.stringify(style), updatedAt: now })
      .onConflictDoUpdate({
        target: abacusPrintSettings.userId,
        set: { style: JSON.stringify(style), updatedAt: now },
      })

    return NextResponse.json({ style })
  } catch (error) {
    console.error('[print-settings] save failed:', error)
    return NextResponse.json({ error: 'Failed to save print settings' }, { status: 500 })
  }
})
