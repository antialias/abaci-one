/**
 * API Route: Generate Workshop Flowchart Worksheet PDF
 *
 * Creates a printable worksheet from a workshop session's draft flowchart.
 * Works with drafts that haven't been saved to the database yet.
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { db } from '@/db'
import { workshopSessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { loadFlowchart } from '@/lib/flowcharts/loader'
import {
  generateWorksheetPDFFromFlowchart,
  type WorksheetConfig,
} from '@/lib/flowcharts/worksheet-generator'
import type { FlowchartDefinition } from '@/lib/flowcharts/schema'

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
  /** Whether to order problems by progressive difficulty (easy → medium → hard) */
  orderByDifficulty?: boolean
}

export const POST = withAuth(async (request, { params }) => {
  try {
    const { id: sessionId } = (await params) as { id: string }
    const body: WorksheetRequest = await request.json()

    // Load the session
    const [session] = await db
      .select()
      .from(workshopSessions)
      .where(eq(workshopSessions.id, sessionId))
      .limit(1)

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (!session.draftDefinitionJson || !session.draftMermaidContent) {
      return NextResponse.json(
        { error: 'Session has no draft flowchart. Generate one first.' },
        { status: 400 }
      )
    }

    // Parse the definition
    let definition: FlowchartDefinition
    try {
      definition = JSON.parse(session.draftDefinitionJson)
    } catch {
      return NextResponse.json(
        { error: 'Invalid flowchart definition in session' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.distribution) {
      return NextResponse.json({ error: 'Missing required field: distribution' }, { status: 400 })
    }

    if (!body.problemCount || body.problemCount < 1) {
      return NextResponse.json({ error: 'problemCount must be at least 1' }, { status: 400 })
    }

    if (!body.pageCount || body.pageCount < 1) {
      return NextResponse.json({ error: 'pageCount must be at least 1' }, { status: 400 })
    }

    // Validate distribution sums to 100
    const distSum = body.distribution.easy + body.distribution.medium + body.distribution.hard
    if (Math.abs(distSum - 100) > 1) {
      return NextResponse.json(
        { error: `Distribution must sum to 100 (got ${distSum})` },
        { status: 400 }
      )
    }

    // Build ExecutableFlowchart
    const flowchart = await loadFlowchart(definition, session.draftMermaidContent)

    // Build config
    const config: WorksheetConfig = {
      distribution: body.distribution,
      problemCount: body.problemCount,
      pageCount: body.pageCount,
      includeAnswerKey: body.includeAnswerKey !== false,
      title: body.title || session.draftTitle || undefined,
      orderByDifficulty: body.orderByDifficulty ?? false,
    }

    // Generate PDF
    const pdfBuffer = await generateWorksheetPDFFromFlowchart(flowchart, config)

    // Return PDF
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="worksheet.pdf"`,
      },
    })
  } catch (error) {
    console.error('Workshop worksheet generation error:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate worksheet',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
})
