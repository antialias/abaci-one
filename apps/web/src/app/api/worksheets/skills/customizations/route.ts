import { eq, and } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { skillCustomizations } from '@/db/schema'
import { getViewerId } from '@/lib/viewer'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * GET /api/worksheets/skills/customizations?operator=addition
 *
 * Get all skill customizations for the current user
 */
export const GET = withAuth(async (request) => {
  try {
    const viewerId = await getViewerId()
    const { searchParams } = new URL(request.url)
    const operator = searchParams.get('operator') as 'addition' | 'subtraction' | null

    const query = operator
      ? and(eq(skillCustomizations.userId, viewerId), eq(skillCustomizations.operator, operator))
      : eq(skillCustomizations.userId, viewerId)

    const customizations = await db.query.skillCustomizations.findMany({
      where: query,
      orderBy: (skillCustomizations, { asc }) => [asc(skillCustomizations.updatedAt)],
    })

    // Parse JSON fields
    const parsed = customizations.map((customization) => ({
      ...customization,
      digitRange: JSON.parse(customization.digitRange),
      regroupingConfig: JSON.parse(customization.regroupingConfig),
      displayRules: JSON.parse(customization.displayRules),
    }))

    return NextResponse.json({ customizations: parsed })
  } catch (error) {
    console.error('Failed to fetch skill customizations:', error)
    return NextResponse.json({ error: 'Failed to fetch skill customizations' }, { status: 500 })
  }
})
