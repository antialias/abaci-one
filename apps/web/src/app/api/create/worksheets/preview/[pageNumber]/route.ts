// API route for generating a single worksheet page (SVG)

import { NextResponse } from 'next/server'
import { generateSinglePage } from '@/app/create/worksheets/generatePreview'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { withAuth } from '@/lib/auth/withAuth'

export const dynamic = 'force-dynamic'

export const POST = withAuth(async (request, { params }) => {
  try {
    const body: WorksheetFormState = await request.json()
    const { pageNumber: pageNumberStr } = (await params) as { pageNumber: string }
    const pageNumber = parseInt(pageNumberStr, 10)

    if (isNaN(pageNumber) || pageNumber < 0) {
      return NextResponse.json({ error: 'Invalid page number' }, { status: 400 })
    }

    // Generate only the requested page
    const result = await generateSinglePage(body, pageNumber)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
        },
        { status: result.error?.includes('Invalid page number') ? 404 : 400 }
      )
    }

    // Return the page and total count
    return NextResponse.json({
      page: result.page,
      totalPages: result.totalPages,
    })
  } catch (error) {
    console.error('Error generating page preview:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      {
        error: 'Failed to generate page preview',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
})
