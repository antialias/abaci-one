import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { appSettings } from '@/db/schema'
import {
  DEFAULT_TERM_COUNT_SCALING,
  parseTermCountScaling,
  validateTermCountScaling,
  type TermCountScalingConfig,
} from '@/lib/curriculum/config/term-count-scaling'

/**
 * Ensure the default settings row exists.
 */
async function ensureDefaultSettings() {
  const existing = await db.select().from(appSettings).where(eq(appSettings.id, 'default')).limit(1)
  if (existing.length === 0) {
    await db.insert(appSettings).values({ id: 'default' })
  }
}

/**
 * GET /api/settings/practice-config
 *
 * Returns the current term count scaling configuration.
 * If no custom config is saved, returns the hardcoded defaults.
 */
export async function GET() {
  try {
    await ensureDefaultSettings()

    const [settings] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .limit(1)

    const config = parseTermCountScaling(settings?.termCountScaling ?? null)
    const isCustom = settings?.termCountScaling !== null && settings?.termCountScaling !== undefined

    return NextResponse.json({ config, isCustom })
  } catch (error) {
    console.error('Error fetching practice config:', error)
    return NextResponse.json({ error: 'Failed to fetch practice config' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/practice-config
 *
 * Updates the term count scaling configuration.
 *
 * Body:
 * - config: TermCountScalingConfig | null (null = reset to defaults)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { config } = body as { config: TermCountScalingConfig | null }

    // null means reset to defaults
    if (config === null) {
      await ensureDefaultSettings()
      await db
        .update(appSettings)
        .set({ termCountScaling: null })
        .where(eq(appSettings.id, 'default'))

      return NextResponse.json({ config: DEFAULT_TERM_COUNT_SCALING, isCustom: false })
    }

    // Validate the config
    const error = validateTermCountScaling(config)
    if (error) {
      return NextResponse.json({ error }, { status: 400 })
    }

    await ensureDefaultSettings()

    const jsonStr = JSON.stringify(config)
    await db
      .update(appSettings)
      .set({ termCountScaling: jsonStr })
      .where(eq(appSettings.id, 'default'))

    return NextResponse.json({ config, isCustom: true })
  } catch (error) {
    console.error('Error updating practice config:', error)
    return NextResponse.json({ error: 'Failed to update practice config' }, { status: 500 })
  }
}
