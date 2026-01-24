import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'
import { parseAdditionConfig, defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { AdditionWorksheetClient } from './components/AdditionWorksheetClient'
import { WorksheetErrorBoundary } from './components/WorksheetErrorBoundary'
import type { WorksheetFormState } from '@/app/create/worksheets/types'

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
      // No saved settings, return defaults with a new seed
      return {
        ...defaultAdditionConfig,
        seed: Date.now() % 2147483647,
        prngAlgorithm: 'mulberry32',
      } as unknown as Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
    }

    // Parse and validate config (auto-migrates to latest version)
    const config = parseAdditionConfig(row.config)

    // CRITICAL: Use saved seed if present, otherwise generate new one
    // This ensures reloading the page shows the same problems
    const savedSeed = (config as any).seed
    const finalSeed = savedSeed ?? Date.now() % 2147483647

    return {
      ...config,
      seed: finalSeed,
      prngAlgorithm: (config as any).prngAlgorithm ?? 'mulberry32',
    } as unknown as Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
  } catch (error) {
    console.error('Failed to load worksheet settings:', error)
    // Return defaults on error with a new seed
    return {
      ...defaultAdditionConfig,
      seed: Date.now() % 2147483647,
      prngAlgorithm: 'mulberry32',
    } as unknown as Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
  }
}

/**
 * Worksheet page - loads settings fast, preview fetched client-side
 *
 * Performance optimization:
 * - Settings load fast (~50ms) - page shell renders immediately
 * - Preview is fetched via API after initial render (non-blocking)
 * - User sees the page UI in ~200ms, preview appears when API completes
 */
export default async function AdditionWorksheetPage() {
  const pageStart = Date.now()

  // Fast path: load settings from DB
  const initialSettings = await loadWorksheetSettings()
  console.log(`[SSR] Settings loaded in ${Date.now() - pageStart}ms`)

  // Page renders immediately - preview will be fetched client-side
  // This avoids embedding the 1.25MB SVG in the initial HTML
  return (
    <WorksheetErrorBoundary>
      <AdditionWorksheetClient
        initialSettings={initialSettings}
        // No initial preview - will be fetched via API
      />
    </WorksheetErrorBoundary>
  )
}
