import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { generateWorksheetPreview } from '../generatePreview'
import { PreviewDataInjector } from './PreviewDataInjector'

interface StreamedPreviewProps {
  config: WorksheetFormState
}

/**
 * Async server component that generates the worksheet preview.
 * This runs inside a Suspense boundary, so it streams to the client
 * when ready without blocking the initial page render.
 */
export async function StreamedPreview({ config }: StreamedPreviewProps) {
  const startTime = Date.now()
  console.log('[StreamedPreview] Starting preview generation...')

  // Pre-generate first 3 pages (or fewer if config has fewer pages)
  const INITIAL_PAGES = 3
  const pagesToGenerate = Math.min(INITIAL_PAGES, config.pages ?? 1)

  const previewResult = await generateWorksheetPreview(config, 0, pagesToGenerate - 1)

  const elapsed = Date.now() - startTime
  console.log(
    `[StreamedPreview] Preview generation complete in ${elapsed}ms:`,
    previewResult.success ? 'success' : 'failed'
  )

  // Return a client component that injects the preview data into context
  return (
    <PreviewDataInjector
      pages={previewResult.success ? previewResult.pages : undefined}
      totalPages={previewResult.totalPages}
    />
  )
}
