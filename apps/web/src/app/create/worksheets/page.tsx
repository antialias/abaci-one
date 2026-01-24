import { Suspense } from 'react'
import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'
import { parseAdditionConfig, defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { AdditionWorksheetClient } from './components/AdditionWorksheetClient'
import { WorksheetErrorBoundary } from './components/WorksheetErrorBoundary'
import { PreviewSkeleton } from './components/PreviewSkeleton'
import { StreamedPreview } from './components/StreamedPreview'
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
 * Build full config from settings
 */
function buildFullConfig(
  settings: Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
): WorksheetFormState {
  const problemsPerPage = settings.problemsPerPage ?? 20
  const pages = settings.pages ?? 1
  const cols = settings.cols ?? 5
  const rows = Math.ceil((problemsPerPage * pages) / cols)
  const total = problemsPerPage * pages

  return {
    ...settings,
    rows,
    total,
    date: getDefaultDate(),
  }
}

/**
 * Worksheet page with Suspense streaming for preview
 *
 * Architecture:
 * 1. Settings load fast (~50ms) - page shell renders immediately
 * 2. Preview generates async (~500ms) and streams in via Suspense
 * 3. User sees the page UI in ~200ms, preview appears when ready
 */
export default async function AdditionWorksheetPage() {
  const pageStart = Date.now()

  // Fast path: load settings from DB
  const initialSettings = await loadWorksheetSettings()
  console.log(`[SSR] Settings loaded in ${Date.now() - pageStart}ms`)

  // Build full config for preview generation
  const fullConfig = buildFullConfig(initialSettings)

  // Page shell renders immediately, preview streams in via Suspense
  return (
    <WorksheetErrorBoundary>
      <AdditionWorksheetClient
        initialSettings={initialSettings}
        streamedPreview={
          <Suspense fallback={<PreviewSkeleton />}>
            <StreamedPreview config={fullConfig} />
          </Suspense>
        }
      />
    </WorksheetErrorBoundary>
  )
}
