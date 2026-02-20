import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { withAuth } from '@/lib/auth/withAuth'
import { getDbUserId } from '@/lib/viewer'

/**
 * GET /api/scanner-settings
 * Fetch scanner settings for the current user
 */
export const GET = withAuth(async () => {
  try {
    const userId = await getDbUserId()

    // Find or create scanner settings
    let settings = await db.query.scannerSettings.findFirst({
      where: eq(schema.scannerSettings.userId, userId),
    })

    // If no settings exist, create with defaults
    if (!settings) {
      const [newSettings] = await db
        .insert(schema.scannerSettings)
        .values({ userId })
        .returning()
      settings = newSettings
    }

    // Transform database format to QuadDetectorConfig format
    const config = {
      preprocessing: settings.preprocessing,
      enableHistogramEqualization: settings.enableHistogramEqualization,
      enableAdaptiveThreshold: settings.enableAdaptiveThreshold,
      enableMorphGradient: settings.enableMorphGradient,
      cannyThresholds: [settings.cannyLow, settings.cannyHigh] as [number, number],
      adaptiveBlockSize: settings.adaptiveBlockSize,
      adaptiveC: settings.adaptiveC,
      enableHoughLines: settings.enableHoughLines,
    }

    return NextResponse.json({ settings: config })
  } catch (error) {
    console.error('Failed to fetch scanner settings:', error)
    return NextResponse.json({ error: 'Failed to fetch scanner settings' }, { status: 500 })
  }
})

/**
 * PATCH /api/scanner-settings
 * Update scanner settings for the current user
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

    // Transform QuadDetectorConfig format to database format
    const dbUpdates: Record<string, unknown> = {}

    if (updates.preprocessing !== undefined) {
      dbUpdates.preprocessing = updates.preprocessing
    }
    if (updates.enableHistogramEqualization !== undefined) {
      dbUpdates.enableHistogramEqualization = updates.enableHistogramEqualization
    }
    if (updates.enableAdaptiveThreshold !== undefined) {
      dbUpdates.enableAdaptiveThreshold = updates.enableAdaptiveThreshold
    }
    if (updates.enableMorphGradient !== undefined) {
      dbUpdates.enableMorphGradient = updates.enableMorphGradient
    }
    if (updates.cannyThresholds !== undefined) {
      const thresholds = updates.cannyThresholds as [number, number]
      dbUpdates.cannyLow = thresholds[0]
      dbUpdates.cannyHigh = thresholds[1]
    }
    if (updates.adaptiveBlockSize !== undefined) {
      dbUpdates.adaptiveBlockSize = updates.adaptiveBlockSize
    }
    if (updates.adaptiveC !== undefined) {
      dbUpdates.adaptiveC = updates.adaptiveC
    }
    if (updates.enableHoughLines !== undefined) {
      dbUpdates.enableHoughLines = updates.enableHoughLines
    }

    // Ensure settings exist
    const existingSettings = await db.query.scannerSettings.findFirst({
      where: eq(schema.scannerSettings.userId, userId),
    })

    let resultSettings: schema.ScannerSettings

    if (!existingSettings) {
      // Create new settings with updates
      const [newSettings] = await db
        .insert(schema.scannerSettings)
        .values({ userId, ...dbUpdates })
        .returning()
      resultSettings = newSettings
    } else {
      // Update existing settings
      const [updatedSettings] = await db
        .update(schema.scannerSettings)
        .set(dbUpdates)
        .where(eq(schema.scannerSettings.userId, userId))
        .returning()
      resultSettings = updatedSettings
    }

    // Transform back to QuadDetectorConfig format
    const config = {
      preprocessing: resultSettings.preprocessing,
      enableHistogramEqualization: resultSettings.enableHistogramEqualization,
      enableAdaptiveThreshold: resultSettings.enableAdaptiveThreshold,
      enableMorphGradient: resultSettings.enableMorphGradient,
      cannyThresholds: [resultSettings.cannyLow, resultSettings.cannyHigh] as [number, number],
      adaptiveBlockSize: resultSettings.adaptiveBlockSize,
      adaptiveC: resultSettings.adaptiveC,
      enableHoughLines: resultSettings.enableHoughLines,
    }

    return NextResponse.json({ settings: config })
  } catch (error) {
    console.error('Failed to update scanner settings:', error)
    return NextResponse.json({ error: 'Failed to update scanner settings' }, { status: 500 })
  }
})
