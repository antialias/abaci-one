import { eq, and } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getViewerId } from '@/lib/viewer'
import { parseAdditionConfig, defaultAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { AdditionWorksheetClient } from './components/AdditionWorksheetClient'
import { WorksheetErrorBoundary } from './components/WorksheetErrorBoundary'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { generateWorksheetPreview } from './generatePreview'
import { worksheetShares } from '@/db/schema'

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
 * Load worksheet settings from database or shared link (server-side)
 */
async function loadWorksheetSettings(
  shareId?: string
): Promise<Omit<WorksheetFormState, 'date' | 'rows' | 'total'>> {
  try {
    // If loading from a shared link
    if (shareId) {
      const share = await db.query.worksheetShares.findFirst({
        where: eq(worksheetShares.id, shareId),
      })

      if (share) {
        // Parse the shared config (already stored with serializeAdditionConfig)
        const config = parseAdditionConfig(share.config)
        return {
          ...config,
          seed: Date.now() % 2147483647,
        } as unknown as Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
      }
      // If share not found, fall through to load user's settings
      console.warn(`Share ID ${shareId} not found, loading user settings instead`)
    }

    // Load user's saved settings
    const viewerId = await getViewerId()
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
      } as unknown as Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
    }

    // Parse and validate config (auto-migrates to latest version)
    const config = parseAdditionConfig(row.config)
    return {
      ...config,
      seed: Date.now() % 2147483647,
    } as unknown as Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
  } catch (error) {
    console.error('Failed to load worksheet settings:', error)
    // Return defaults on error with a stable seed
    return {
      ...defaultAdditionConfig,
      seed: Date.now() % 2147483647,
    } as unknown as Omit<WorksheetFormState, 'date' | 'rows' | 'total'>
  }
}

export default async function AdditionWorksheetPage({
  searchParams,
}: {
  searchParams: Promise<{ share?: string }>
}) {
  const { share: shareId } = await searchParams
  const initialSettings = await loadWorksheetSettings(shareId)

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

  // Pre-generate worksheet preview on the server
  console.log('[SSR] Generating worksheet preview on server...')
  const previewResult = generateWorksheetPreview(fullConfig)
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
