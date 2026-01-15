/**
 * GET /api/worksheets/download/[id]
 *
 * Download a PDF for a shared worksheet
 * Generates PDF on-demand from stored config
 */

import { eq } from 'drizzle-orm'
import { execSync } from 'child_process'
import { type NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { worksheetShares } from '@/db/schema'
import { isValidShareId } from '@/lib/generateShareId'
import { parseAdditionConfig } from '@/app/create/worksheets/config-schemas'
import { validateWorksheetConfig } from '@/app/create/worksheets/validation'
import {
  generateProblems,
  generateSubtractionProblems,
  generateMixedProblems,
} from '@/app/create/worksheets/problemGenerator'
import { generateTypstSource } from '@/app/create/worksheets/typstGenerator'
import type { WorksheetProblem, WorksheetFormState } from '@/app/create/worksheets/types'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Validate ID format
    if (!isValidShareId(id)) {
      return NextResponse.json({ error: 'Invalid share ID format' }, { status: 400 })
    }

    // Fetch share record
    const share = await db.query.worksheetShares.findFirst({
      where: eq(worksheetShares.id, id),
    })

    if (!share) {
      return NextResponse.json({ error: 'Share not found' }, { status: 404 })
    }

    // Parse and validate config (auto-migrates to latest version)
    const parsedConfig = parseAdditionConfig(share.config)

    // Validate configuration
    // Cast to WorksheetFormState which is a permissive union type during form editing
    // The parsed V4 config is compatible but TypeScript needs help with the union types
    const validation = validateWorksheetConfig(parsedConfig as unknown as WorksheetFormState)
    if (!validation.isValid || !validation.config) {
      return NextResponse.json(
        { error: 'Invalid worksheet configuration', errors: validation.errors },
        { status: 400 }
      )
    }

    const config = validation.config

    // Generate problems based on operator type
    let problems: WorksheetProblem[]
    if (config.operator === 'addition') {
      problems = generateProblems(
        config.total,
        config.pAnyStart,
        config.pAllStart,
        config.interpolate,
        config.seed,
        config.digitRange
      )
    } else if (config.operator === 'subtraction') {
      problems = generateSubtractionProblems(
        config.total,
        config.digitRange,
        config.pAnyStart,
        config.pAllStart,
        config.interpolate,
        config.seed
      )
    } else {
      // mixed
      problems = generateMixedProblems(
        config.total,
        config.digitRange,
        config.pAnyStart,
        config.pAllStart,
        config.interpolate,
        config.seed
      )
    }

    // Build share URL for QR code if enabled
    let shareUrl: string | undefined
    if (config.includeQRCode) {
      const protocol = request.headers.get('x-forwarded-proto') || 'https'
      const host = request.headers.get('host') || 'abaci.one'
      shareUrl = `${protocol}://${host}/worksheets/shared/${id}`
    }

    // Generate Typst sources (one per page)
    const typstSources = await generateTypstSource(config, problems, shareUrl)

    // Join pages with pagebreak for PDF
    const typstSource = typstSources.join('\n\n#pagebreak()\n\n')

    // Compile with Typst: stdin → stdout
    let pdfBuffer: Buffer
    try {
      pdfBuffer = execSync('typst compile --format pdf - -', {
        input: typstSource,
        maxBuffer: 10 * 1024 * 1024, // 10MB limit
      })
    } catch (error) {
      console.error('Typst compilation error:', error)

      const stderr =
        error instanceof Error && 'stderr' in error
          ? String((error as any).stderr)
          : 'Unknown compilation error'

      return NextResponse.json(
        {
          error: 'Failed to compile worksheet PDF',
          details: stderr,
        },
        { status: 500 }
      )
    }

    // Generate filename from title or share ID
    const filename = share.title
      ? `worksheet-${share.title.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`
      : `worksheet-${id}.pdf`

    // Return binary PDF directly
    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error downloading worksheet:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)

    return NextResponse.json(
      {
        error: 'Failed to download worksheet',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}
