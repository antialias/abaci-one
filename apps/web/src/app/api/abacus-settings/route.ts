import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/abacus-settings
 * Fetch abacus display settings for the current user
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getDbUserId()

    // Find or create abacus settings
    let settings = await db.query.abacusSettings.findFirst({
      where: eq(schema.abacusSettings.userId, userId),
    })

    // If no settings exist, create with defaults
    if (!settings) {
      const [newSettings] = await db.insert(schema.abacusSettings).values({ userId }).returning()
      settings = newSettings
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Failed to fetch abacus settings:', error)
    return NextResponse.json({ error: 'Failed to fetch abacus settings' }, { status: 500 })
  }
})

/**
 * PATCH /api/abacus-settings
 * Update abacus display settings for the current user
 */
export const PATCH = withAuth(async (request) => {
  try {
    const userId = await getDbUserId()

    // Handle empty or invalid JSON body gracefully
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid or empty request body' }, { status: 400 })
    }

    // Security: Strip userId from request body - it must come from session only
    const { userId: _bodyUserId, ...updates } = body

    // Ensure settings exist
    const existingSettings = await db.query.abacusSettings.findFirst({
      where: eq(schema.abacusSettings.userId, userId),
    })

    if (!existingSettings) {
      // Create new settings with updates
      const [newSettings] = await db
        .insert(schema.abacusSettings)
        .values({ userId, ...updates })
        .returning()
      return NextResponse.json({ settings: newSettings })
    }

    // Update existing settings
    const [updatedSettings] = await db
      .update(schema.abacusSettings)
      .set(updates)
      .where(eq(schema.abacusSettings.userId, userId))
      .returning()

    return NextResponse.json({ settings: updatedSettings })
  } catch (error) {
    console.error('Failed to update abacus settings:', error)
    return NextResponse.json({ error: 'Failed to update abacus settings' }, { status: 500 })
  }
})
