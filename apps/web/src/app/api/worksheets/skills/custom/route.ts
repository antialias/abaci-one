import { eq, and } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { customSkills } from '@/db/schema'
import { getViewerId } from '@/lib/viewer'
import { nanoid } from 'nanoid'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/worksheets/skills/custom
 *
 * Get all custom skills for the current user
 */
export const GET = withAuth(async (request) => {
  try {
    const viewerId = await getViewerId()
    const { searchParams } = new URL(request.url)
    const operator = searchParams.get('operator') as 'addition' | 'subtraction' | null

    const query = operator
      ? and(eq(customSkills.userId, viewerId), eq(customSkills.operator, operator))
      : eq(customSkills.userId, viewerId)

    const skills = await db.query.customSkills.findMany({
      where: query,
      orderBy: (customSkills, { asc }) => [asc(customSkills.createdAt)],
    })

    // Parse JSON fields
    const parsed = skills.map((skill) => ({
      ...skill,
      digitRange: JSON.parse(skill.digitRange),
      regroupingConfig: JSON.parse(skill.regroupingConfig),
      displayRules: JSON.parse(skill.displayRules),
    }))

    return NextResponse.json({ skills: parsed })
  } catch (error) {
    console.error('Failed to fetch custom skills:', error)
    return NextResponse.json({ error: 'Failed to fetch custom skills' }, { status: 500 })
  }
})

/**
 * POST /api/worksheets/skills/custom
 *
 * Create a new custom skill
 */
export const POST = withAuth(async (request) => {
  try {
    const viewerId = await getViewerId()
    const body = await request.json()

    const { name, description, operator, digitRange, regroupingConfig, displayRules } = body

    // Validate required fields
    if (!name || !operator || !digitRange || !regroupingConfig || !displayRules) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate operator
    if (operator !== 'addition' && operator !== 'subtraction') {
      return NextResponse.json({ error: 'Invalid operator' }, { status: 400 })
    }

    // Generate ID with custom prefix
    const id = `custom-${nanoid(10)}`
    const now = new Date().toISOString()

    const newSkill = {
      id,
      userId: viewerId,
      operator,
      name,
      description: description || null,
      digitRange: JSON.stringify(digitRange),
      regroupingConfig: JSON.stringify(regroupingConfig),
      displayRules: JSON.stringify(displayRules),
      createdAt: now,
      updatedAt: now,
    }

    await db.insert(customSkills).values(newSkill)

    // Return parsed skill
    return NextResponse.json({
      skill: {
        ...newSkill,
        digitRange,
        regroupingConfig,
        displayRules,
      },
    })
  } catch (error) {
    console.error('Failed to create custom skill:', error)
    return NextResponse.json({ error: 'Failed to create custom skill' }, { status: 500 })
  }
})
