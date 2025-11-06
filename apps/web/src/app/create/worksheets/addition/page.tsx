import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'
import { parseAdditionConfig, defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { AdditionWorksheetClient } from './components/AdditionWorksheetClient'
import type { WorksheetFormState } from './types'
import { generateWorksheetPreview } from './generatePreview'

/**
 * Get current date formatted as "Month Day, Year"
 */
function getDefaultDate(): string {
  const now = new Date()
  return now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Load worksheet settings from database (server-side)
 */
async function loadWorksheetSettings(): Promise<
  Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
> {
  try {
    const viewerId = await getViewerId()

    // Look up user's saved settings
    const [row] = await db
      .select()
      .from(schema.worksheetSettings)
      .where(
        and(
          eq(schema.worksheetSettings.userId, viewerId),
          eq(schema.worksheetSettings.worksheetType, 'addition')
        )
      )
      .limit(1)

    if (!row) {
      // No saved settings, return defaults with a stable seed
      return {
        ...defaultAdditionConfig,
        seed: Date.now() % 2147483647,
      }
    }

    // Parse and validate config (auto-migrates to latest version)
    const config = parseAdditionConfig(row.config)
    return {
      ...config,
      seed: Date.now() % 2147483647,
    }
  } catch (error) {
    console.error('Failed to load worksheet settings:', error)
    // Return defaults on error with a stable seed
    return {
      ...defaultAdditionConfig,
      seed: Date.now() % 2147483647,
    }
  }
}

export default async function AdditionWorksheetPage() {
  const initialSettings = await loadWorksheetSettings()

  // Calculate derived state needed for preview
  const rows = Math.ceil(
    (initialSettings.problemsPerPage * initialSettings.pages) / initialSettings.cols
  )
  const total = initialSettings.problemsPerPage * initialSettings.pages

  // Create full config for preview generation
  const fullConfig: WorksheetFormState = {
    ...initialSettings,
    rows,
    total,
    date: getDefaultDate(),
  }

  // Pre-generate worksheet preview on the server
  console.log('[SSR] Generating worksheet preview on server...')
  const previewResult = generateWorksheetPreview(fullConfig)
  console.log('[SSR] Preview generation complete:', previewResult.success ? 'success' : 'failed')

  // Pass settings and preview to client
  return (
    <AdditionWorksheetClient
      initialSettings={initialSettings}
      initialPreview={previewResult.success ? previewResult.pages : undefined}
    />
  )
}
