import { eq, and } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'
import {
  parseAdditionConfig,
  serializeAdditionConfig,
  defaultAdditionConfig,
  type AdditionConfigV1,
} from '@/app/create/worksheets/config-schemas'

/**
 * GET /api/worksheets/settings?type=addition
 * Load user's saved worksheet settings
 *
 * Query params:
 *   - type: 'addition' | 'subtraction' | etc.
 *
 * Returns:
 *   - config: Parsed and validated config (latest version)
 *   - exists: boolean (true if user has saved settings)
 */
export async function GET(req: NextRequest) {
  try {
    const viewerId = await getViewerId()
    const { searchParams } = new URL(req.url)
    const worksheetType = searchParams.get('type')

    if (!worksheetType) {
      return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 })
    }

    // Only 'addition' is supported for now
    if (worksheetType !== 'addition') {
      return NextResponse.json({ error: `Unsupported worksheet type: ${worksheetType}` }, { status: 400 })
    }

    // Look up user's saved settings
    const [row] = await db
      .select()
      .from(schema.worksheetSettings)
      .where(
        and(
          eq(schema.worksheetSettings.userId, viewerId),
          eq(schema.worksheetSettings.worksheetType, worksheetType)
        )
      )
      .limit(1)

    if (!row) {
      // No saved settings, return defaults
      return NextResponse.json({
        config: defaultAdditionConfig,
        exists: false,
      })
    }

    // Parse and validate config (auto-migrates to latest version)
    const config = parseAdditionConfig(row.config)

    return NextResponse.json({
      config,
      exists: true,
    })
  } catch (error: any) {
    console.error('Failed to load worksheet settings:', error)
    return NextResponse.json({ error: 'Failed to load worksheet settings' }, { status: 500 })
  }
}

/**
 * POST /api/worksheets/settings
 * Save user's worksheet settings
 *
 * Body:
 *   - type: 'addition' | 'subtraction' | etc.
 *   - config: Config object (version will be added automatically)
 *
 * Returns:
 *   - success: boolean
 *   - id: string (worksheet_settings row id)
 */
export async function POST(req: NextRequest) {
  try {
    const viewerId = await getViewerId()
    const body = await req.json()

    const { type: worksheetType, config } = body

    if (!worksheetType) {
      return NextResponse.json({ error: 'Missing type field' }, { status: 400 })
    }

    if (!config) {
      return NextResponse.json({ error: 'Missing config field' }, { status: 400 })
    }

    // Only 'addition' is supported for now
    if (worksheetType !== 'addition') {
      return NextResponse.json({ error: `Unsupported worksheet type: ${worksheetType}` }, { status: 400 })
    }

    // Serialize config (adds version automatically)
    const configJson = serializeAdditionConfig(config)

    // Check if user already has settings for this type
    const [existing] = await db
      .select()
      .from(schema.worksheetSettings)
      .where(
        and(
          eq(schema.worksheetSettings.userId, viewerId),
          eq(schema.worksheetSettings.worksheetType, worksheetType)
        )
      )
      .limit(1)

    const now = new Date()

    if (existing) {
      // Update existing row
      await db
        .update(schema.worksheetSettings)
        .set({
          config: configJson,
          updatedAt: now,
        })
        .where(eq(schema.worksheetSettings.id, existing.id))

      return NextResponse.json({
        success: true,
        id: existing.id,
      })
    } else {
      // Insert new row
      const id = crypto.randomUUID()
      await db.insert(schema.worksheetSettings).values({
        id,
        userId: viewerId,
        worksheetType,
        config: configJson,
        createdAt: now,
        updatedAt: now,
      })

      return NextResponse.json({
        success: true,
        id,
      })
    }
  } catch (error: any) {
    console.error('Failed to save worksheet settings:', error)
    return NextResponse.json({ error: 'Failed to save worksheet settings' }, { status: 500 })
  }
}
