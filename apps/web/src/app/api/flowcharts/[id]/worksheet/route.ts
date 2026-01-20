/**
 * API Route: Generate Flowchart Worksheet PDF
 *
 * Creates a printable worksheet with problems from the flowchart,
 * distributed by difficulty tier, with an optional answer key.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { generateWorksheetPDF, type WorksheetConfig } from '@/lib/flowcharts/worksheet-generator'

interface WorksheetRequest {
  /** Distribution of problems by difficulty tier */
  distribution: {
    easy: number
    medium: number
    hard: number
  }
  /** Total number of problems */
  problemCount: number
  /** Number of pages */
  pageCount: number
  /** Whether to include an answer key */
  includeAnswerKey?: boolean
  /** Optional custom title */
  title?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: flowchartId } = await params
    const body: WorksheetRequest = await request.json()

    // Validate required fields
    if (!body.distribution) {
      return NextResponse.json(
        { error: 'Missing required field: distribution' },
        { status: 400 }
      )
    }

    if (!body.problemCount || body.problemCount < 1) {
      return NextResponse.json(
        { error: 'problemCount must be at least 1' },
        { status: 400 }
      )
    }

    if (!body.pageCount || body.pageCount < 1) {
      return NextResponse.json(
        { error: 'pageCount must be at least 1' },
        { status: 400 }
      )
    }

    // Validate distribution sums to 100
    const distSum = body.distribution.easy + body.distribution.medium + body.distribution.hard
    if (Math.abs(distSum - 100) > 1) {
      return NextResponse.json(
        { error: `Distribution must sum to 100 (got ${distSum})` },
        { status: 400 }
      )
    }

    // Build config
    const config: WorksheetConfig = {
      distribution: body.distribution,
      problemCount: body.problemCount,
      pageCount: body.pageCount,
      includeAnswerKey: body.includeAnswerKey !== false,
      title: body.title,
    }

    // Generate PDF
    const pdfBuffer = await generateWorksheetPDF(flowchartId, config)

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="worksheet.pdf"`,
      },
    })
  } catch (error) {
    console.error('Worksheet generation error:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      {
        error: 'Failed to generate worksheet',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
