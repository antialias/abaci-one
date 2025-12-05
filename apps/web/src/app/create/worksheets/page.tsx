import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'
import { parseAdditionConfig, defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { AdditionWorksheetClient } from './components/AdditionWorksheetClient'
import { WorksheetErrorBoundary } from './components/WorksheetErrorBoundary'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
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

    console.log('[loadWorksheetSettings] Loaded from DB:', {
      hasSavedSeed: !!savedSeed,
      savedSeed,
      finalSeed,
      prngAlgorithm: (config as any).prngAlgorithm,
    })

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

export default async function AdditionWorksheetPage() {
  const initialSettings = await loadWorksheetSettings()

  // Calculate derived state needed for preview
  // Use defaults for required fields (loadWorksheetSettings should always provide these, but TypeScript needs guarantees)
  const problemsPerPage = initialSettings.problemsPerPage ?? 20
  const pages = initialSettings.pages ?? 1
  const cols = initialSettings.cols ?? 5

  const rows = Math.ceil((problemsPerPage * pages) / cols)
  const total = problemsPerPage * pages

  // Create full config for preview generation
  const fullConfig: WorksheetFormState = {
    ...initialSettings,
    rows,
    total,
    date: getDefaultDate(),
  }

  // Pre-generate ONLY the first 3 pages on the server
  // The virtualization system will handle loading additional pages on-demand
  const INITIAL_PAGES = 3
  const pagesToGenerate = Math.min(INITIAL_PAGES, pages)
  console.log(`[SSR] Generating initial ${pagesToGenerate} pages on server (total: ${pages})...`)
  const previewResult = await generateWorksheetPreview(fullConfig, 0, pagesToGenerate - 1)
  console.log('[SSR] Preview generation complete:', previewResult.success ? 'success' : 'failed')

  // Pass settings and preview to client, wrapped in error boundary
  return (
    <WorksheetErrorBoundary>
      <AdditionWorksheetClient
        initialSettings={initialSettings}
        initialPreview={previewResult.success ? previewResult.pages : undefined}
      />
    </WorksheetErrorBoundary>
  )
}
