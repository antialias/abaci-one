import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getViewerId } from '@/lib/viewer'

/**
 * GET /api/abacus-settings
 * Fetch abacus display settings for the current user
 */
export async function GET() {
  try {
    const viewerId = await getViewerId()
    const user = await getOrCreateUser(viewerId)

    // Find or create abacus settings
    let settings = await db.query.abacusSettings.findFirst({
      where: eq(schema.abacusSettings.userId, user.id),
    })

    // If no settings exist, create with defaults
    if (!settings) {
      const [newSettings] = await db
        .insert(schema.abacusSettings)
        .values({ userId: user.id })
        .returning()
      settings = newSettings
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Failed to fetch abacus settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch abacus settings' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/abacus-settings
 * Update abacus display settings for the current user
 */
export async function PATCH(req: NextRequest) {
  try {
    const viewerId = await getViewerId()
    const body = await req.json()

    // Security: Strip userId from request body - it must come from session only
    const { userId: _, ...updates } = body

    const user = await getOrCreateUser(viewerId)

    // Ensure settings exist
    const existingSettings = await db.query.abacusSettings.findFirst({
      where: eq(schema.abacusSettings.userId, user.id),
    })

    if (!existingSettings) {
      // Create new settings with updates
      const [newSettings] = await db
        .insert(schema.abacusSettings)
        .values({ userId: user.id, ...updates })
        .returning()
      return NextResponse.json({ settings: newSettings })
    }

    // Update existing settings
    const [updatedSettings] = await db
      .update(schema.abacusSettings)
      .set(updates)
      .where(eq(schema.abacusSettings.userId, user.id))
      .returning()

    return NextResponse.json({ settings: updatedSettings })
  } catch (error) {
    console.error('Failed to update abacus settings:', error)
    return NextResponse.json(
      { error: 'Failed to update abacus settings' },
      { status: 500 }
    )
  }
}

/**
 * Get or create a user record for the given viewer ID (guest or user)
 */
async function getOrCreateUser(viewerId: string) {
  // Try to find existing user by guest ID
  let user = await db.query.users.findFirst({
    where: eq(schema.users.guestId, viewerId),
  })

  // If no user exists, create one
  if (!user) {
    const [newUser] = await db
      .insert(schema.users)
      .values({
        guestId: viewerId,
      })
      .returning()

    user = newUser
  }

  return user
}
