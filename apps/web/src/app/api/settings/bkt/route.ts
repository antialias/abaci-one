import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings } from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'

/** Default BKT confidence threshold */
const DEFAULT_THRESHOLD = 0.3

/**
 * Ensure the default settings row exists.
 * Creates it if missing (handles fresh databases).
 */
async function ensureDefaultSettings() {
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 'default')).limit(1)

  if (existing.length === 0) {
    await db.insert(appSettings).values({
      id: 'default',
      bktConfidenceThreshold: DEFAULT_THRESHOLD,
    })
  }
}

/**
 * GET /api/settings/bkt
 *
 * Returns the current BKT confidence threshold setting.
 * Creates the default row if it doesn't exist.
 */
export const GET = withAuth(async () => {
  try {
    await ensureDefaultSettings()

    const [settings] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .limit(1)

    return NextResponse.json({
      bktConfidenceThreshold: settings?.bktConfidenceThreshold ?? DEFAULT_THRESHOLD,
    })
  } catch (error) {
    console.error('Error fetching BKT settings:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
})

/**
 * PATCH /api/settings/bkt
 *
 * Updates the BKT confidence threshold setting.
 *
 * Body:
 * - bktConfidenceThreshold: number (0.1 to 0.9)
 */
export const PATCH = withAuth(async (request) => {
  try {
    const body = await request.json()
    const { bktConfidenceThreshold } = body

    // Validate the threshold
    if (typeof bktConfidenceThreshold !== 'number') {
      return NextResponse.json(
        { error: 'bktConfidenceThreshold must be a number' },
        { status: 400 }
      )
    }

    if (bktConfidenceThreshold < 0.1 || bktConfidenceThreshold > 0.9) {
      return NextResponse.json(
        { error: 'bktConfidenceThreshold must be between 0.1 and 0.9' },
        { status: 400 }
      )
    }

    await ensureDefaultSettings()

    // Update the setting
    await db
      .update(appSettings)
      .set({ bktConfidenceThreshold })
      .where(eq(appSettings.id, 'default'))

    return NextResponse.json({ bktConfidenceThreshold })
  } catch (error) {
    console.error('Error updating BKT settings:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
})
