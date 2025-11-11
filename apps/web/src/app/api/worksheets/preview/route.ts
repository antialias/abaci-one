import { NextResponse } from 'next/server'
import { generateWorksheetPreview } from '@/app/create/worksheets/generatePreview'
import type { WorksheetFormState } from '@/app/create/worksheets/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/worksheets/preview
 * Generate a preview of a worksheet configuration
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { config } = body as { config: WorksheetFormState }

    if (!config) {
      return NextResponse.json({ success: false, error: 'Missing config' }, { status: 400 })
    }

    // Calculate derived state fields
    const problemsPerPage = config.problemsPerPage ?? 20
    const pages = config.pages ?? 1
    const cols = config.cols ?? 5
    const rows = Math.ceil((problemsPerPage * pages) / cols)
    const total = problemsPerPage * pages

    // Add date, seed, and derived fields if missing
    const fullConfig: WorksheetFormState = {
      ...config,
      date:
        config.date ||
        new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      seed: config.seed || Date.now() % 2147483647,
      rows,
      total,
    }

    // Generate preview
    const result = generateWorksheetPreview(fullConfig)

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          details: result.details,
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      pages: result.pages,
    })
  } catch (error) {
    console.error('Preview generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
