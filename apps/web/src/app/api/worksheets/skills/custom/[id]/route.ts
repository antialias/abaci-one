import { eq, and } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { customSkills } from '@/db/schema'
import { getViewerId } from '@/lib/viewer'

/**
 * PUT /api/worksheets/skills/custom/[id]
 *
 * Update an existing custom skill
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const viewerId = await getViewerId()
    const { id } = await params
    const body = await request.json()

    const { name, description, digitRange, regroupingConfig, displayRules } = body

    // Verify skill exists and belongs to user
    const existing = await db.query.customSkills.findFirst({
      where: and(eq(customSkills.id, id), eq(customSkills.userId, viewerId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Custom skill not found' }, { status: 404 })
    }

    // Build update object (only update provided fields)
    const updates: Record<string, string> = {
      updatedAt: new Date().toISOString(),
    }

    if (name) updates.name = name
    if (description !== undefined) updates.description = description
    if (digitRange) updates.digitRange = JSON.stringify(digitRange)
    if (regroupingConfig) updates.regroupingConfig = JSON.stringify(regroupingConfig)
    if (displayRules) updates.displayRules = JSON.stringify(displayRules)

    await db
      .update(customSkills)
      .set(updates)
      .where(and(eq(customSkills.id, id), eq(customSkills.userId, viewerId)))

    // Fetch updated skill
    const updated = await db.query.customSkills.findFirst({
      where: and(eq(customSkills.id, id), eq(customSkills.userId, viewerId)),
    })

    if (!updated) {
      return NextResponse.json({ error: 'Failed to fetch updated skill' }, { status: 500 })
    }

    // Return parsed skill
    return NextResponse.json({
      skill: {
        ...updated,
        digitRange: JSON.parse(updated.digitRange),
        regroupingConfig: JSON.parse(updated.regroupingConfig),
        displayRules: JSON.parse(updated.displayRules),
      },
    })
  } catch (error) {
    console.error('Failed to update custom skill:', error)
    return NextResponse.json({ error: 'Failed to update custom skill' }, { status: 500 })
  }
}

/**
 * DELETE /api/worksheets/skills/custom/[id]
 *
 * Delete a custom skill
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewerId = await getViewerId()
    const { id } = await params

    // Verify skill exists and belongs to user
    const existing = await db.query.customSkills.findFirst({
      where: and(eq(customSkills.id, id), eq(customSkills.userId, viewerId)),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Custom skill not found' }, { status: 404 })
    }

    // Delete the skill
    await db
      .delete(customSkills)
      .where(and(eq(customSkills.id, id), eq(customSkills.userId, viewerId)))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete custom skill:', error)
    return NextResponse.json({ error: 'Failed to delete custom skill' }, { status: 500 })
  }
}
