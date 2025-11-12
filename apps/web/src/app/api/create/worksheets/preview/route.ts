// API route for generating addition worksheet previews (SVG)

import { type NextRequest, NextResponse } from 'next/server'
import { generateWorksheetPreview } from '@/app/create/worksheets/generatePreview'
import type { WorksheetFormState } from '@/app/create/worksheets/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body: WorksheetFormState = await request.json()

    // Parse pagination parameters from query string
    const { searchParams } = new URL(request.url)

    // Support cursor-based pagination (GraphQL style)
    const cursor = searchParams.get('cursor')
    const limit = searchParams.get('limit')

    // Support range-based pagination (traditional)
    const startPageParam = searchParams.get('startPage')
    const endPageParam = searchParams.get('endPage')

    let startPage: number | undefined
    let endPage: number | undefined

    // Cursor-based: cursor=3&limit=5 means pages [3, 4, 5, 6, 7]
    if (cursor !== null) {
      startPage = Number.parseInt(cursor, 10)
      if (limit !== null) {
        const limitNum = Number.parseInt(limit, 10)
        endPage = startPage + limitNum - 1
      }
    }
    // Range-based: startPage=3&endPage=7 means pages [3, 4, 5, 6, 7]
    else if (startPageParam !== null || endPageParam !== null) {
      if (startPageParam !== null) {
        startPage = Number.parseInt(startPageParam, 10)
      }
      if (endPageParam !== null) {
        endPage = Number.parseInt(endPageParam, 10)
      }
    }

    // Generate preview using shared logic with pagination
    const result = generateWorksheetPreview(body, startPage, endPage)

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          details: result.details,
        },
        { status: 400 }
      )
    }

    // Return pages with metadata
    return NextResponse.json({
      pages: result.pages,
      totalPages: result.totalPages,
      startPage: result.startPage,
      endPage: result.endPage,
      // Include cursor for next page (GraphQL style)
      nextCursor:
        result.endPage !== undefined &&
        result.totalPages !== undefined &&
        result.endPage < result.totalPages - 1
          ? result.endPage + 1
          : null,
    })
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
}
