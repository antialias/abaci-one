// API route for generating addition worksheets

import { type NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { validateWorksheetConfig } from '@/app/create/worksheets/addition/validation'
import { generateProblems } from '@/app/create/worksheets/addition/problemGenerator'
import { generateTypstSource } from '@/app/create/worksheets/addition/typstGenerator'
import type { WorksheetFormState } from '@/app/create/worksheets/addition/types'

export async function POST(request: NextRequest) {
  try {
    const body: WorksheetFormState = await request.json()

    // Validate configuration
    const validation = validateWorksheetConfig(body)
    if (!validation.isValid || !validation.config) {
      return NextResponse.json(
        { error: 'Invalid configuration', errors: validation.errors },
        { status: 400 }
      )
    }

    const config = validation.config

    // Generate problems
    const problems = generateProblems(
      config.total,
      config.pAnyStart,
      config.pAllStart,
      config.interpolate,
      config.seed
    )

    // Generate Typst sources (one per page)
    const typstSources = generateTypstSource(config, problems)

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

      // Extract the actual Typst error message
      const stderr =
        error instanceof Error && 'stderr' in error
          ? String((error as any).stderr)
          : 'Unknown compilation error'

      return NextResponse.json(
        {
          error: 'Failed to compile worksheet PDF',
          details: stderr,
          ...(process.env.NODE_ENV === 'development' && {
            typstSource: typstSource.split('\n').slice(0, 20).join('\n') + '\n...',
          }),
        },
        { status: 500 }
      )
    }

    // Return binary PDF directly
    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="addition-worksheet-${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating worksheet:', error)

    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    return NextResponse.json(
      {
        error: 'Failed to generate worksheet',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack }),
      },
      { status: 500 }
    )
  }
}
