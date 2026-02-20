// API route for generating addition worksheet previews (SVG)

import { NextResponse } from 'next/server'
import { generateWorksheetPreview } from '@/app/create/worksheets/generatePreview'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { withAuth } from '@/lib/auth/withAuth'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (request) => {
  try {
    const body: WorksheetFormState = await request.json()

    // Generate preview using shared logic
    const result = await generateWorksheetPreview(body)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
        },
        { status: 400 }
      )
    }

    // Return pages as JSON
    return NextResponse.json({ pages: result.pages })
  } catch (error) {
    console.error('Error generating preview:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      {
        error: 'Failed to generate preview',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
})
