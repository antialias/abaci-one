import { eq, and } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { skillCustomizations } from '@/db/schema'
import { getViewerId } from '@/lib/viewer'

/**
 * POST /api/worksheets/skills/[skillId]/customize
 *
 * Save a customization of a default skill
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const viewerId = await getViewerId()
    const { skillId } = await params
    const body = await request.json()

    const { operator, digitRange, regroupingConfig, displayRules } = body

    // Validate required fields
    if (!operator || !digitRange || !regroupingConfig || !displayRules) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate operator
    if (operator !== 'addition' && operator !== 'subtraction') {
      return NextResponse.json({ error: 'Invalid operator' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Check if customization already exists
    const existing = await db.query.skillCustomizations.findFirst({
      where: and(
        eq(skillCustomizations.userId, viewerId),
        eq(skillCustomizations.skillId, skillId),
        eq(skillCustomizations.operator, operator)
      ),
    })

    if (existing) {
      // Update existing customization
      await db
        .update(skillCustomizations)
        .set({
          digitRange: JSON.stringify(digitRange),
          regroupingConfig: JSON.stringify(regroupingConfig),
          displayRules: JSON.stringify(displayRules),
          updatedAt: now,
        })
        .where(
          and(
            eq(skillCustomizations.userId, viewerId),
            eq(skillCustomizations.skillId, skillId),
            eq(skillCustomizations.operator, operator)
          )
        )
    } else {
      // Insert new customization
      await db.insert(skillCustomizations).values({
        userId: viewerId,
        skillId,
        operator,
        digitRange: JSON.stringify(digitRange),
        regroupingConfig: JSON.stringify(regroupingConfig),
        displayRules: JSON.stringify(displayRules),
        updatedAt: now,
      })
    }

    // Fetch the updated/created customization
    const customization = await db.query.skillCustomizations.findFirst({
      where: and(
        eq(skillCustomizations.userId, viewerId),
        eq(skillCustomizations.skillId, skillId),
        eq(skillCustomizations.operator, operator)
      ),
    })

    if (!customization) {
      return NextResponse.json({ error: 'Failed to fetch customization' }, { status: 500 })
    }

    // Return parsed customization
    return NextResponse.json({
      customization: {
        ...customization,
        digitRange: JSON.parse(customization.digitRange),
        regroupingConfig: JSON.parse(customization.regroupingConfig),
        displayRules: JSON.parse(customization.displayRules),
      },
    })
  } catch (error) {
    console.error('Failed to save skill customization:', error)
    return NextResponse.json({ error: 'Failed to save skill customization' }, { status: 500 })
  }
}

/**
 * DELETE /api/worksheets/skills/[skillId]/customize?operator=addition
 *
 * Reset a skill to its default by deleting the customization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  try {
    const viewerId = await getViewerId()
    const { skillId } = await params
    const { searchParams } = new URL(request.url)
    const operator = searchParams.get('operator') as 'addition' | 'subtraction' | null

    if (!operator) {
      return NextResponse.json({ error: 'Operator is required' }, { status: 400 })
    }

    if (operator !== 'addition' && operator !== 'subtraction') {
      return NextResponse.json({ error: 'Invalid operator' }, { status: 400 })
    }

    // Check if customization exists
    const existing = await db.query.skillCustomizations.findFirst({
      where: and(
        eq(skillCustomizations.userId, viewerId),
        eq(skillCustomizations.skillId, skillId),
        eq(skillCustomizations.operator, operator)
      ),
    })

    if (!existing) {
      return NextResponse.json({ error: 'Skill customization not found' }, { status: 404 })
    }

    // Delete the customization
    await db
      .delete(skillCustomizations)
      .where(
        and(
          eq(skillCustomizations.userId, viewerId),
          eq(skillCustomizations.skillId, skillId),
          eq(skillCustomizations.operator, operator)
        )
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete skill customization:', error)
    return NextResponse.json({ error: 'Failed to delete skill customization' }, { status: 500 })
  }
}
