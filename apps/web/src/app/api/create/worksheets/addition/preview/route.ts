// API route for generating addition worksheet previews (SVG)

import { type NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { validateWorksheetConfig } from '@/app/create/worksheets/addition/validation'
import { generateProblems } from '@/app/create/worksheets/addition/problemGenerator'
import { generateTypstSource } from '@/app/create/worksheets/addition/typstGenerator'
import type { WorksheetFormState } from '@/app/create/worksheets/addition/types'

export const dynamic = 'force-dynamic'

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

    // Generate all problems for full preview
    const problems = generateProblems(
      config.total,
      config.pAnyStart,
      config.pAllStart,
      config.interpolate,
      config.seed
    )

    // Generate Typst sources (one per page)
    const typstSources = generateTypstSource(config, problems)

    // Compile each page source to SVG (using stdout for single-page output)
    const pages: string[] = []
    for (let i = 0; i < typstSources.length; i++) {
      const typstSource = typstSources[i]

      // Compile to SVG via stdin/stdout
      try {
        const svgOutput = execSync('typst compile --format svg - -', {
          input: typstSource,
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024, // 10MB limit
        })
        pages.push(svgOutput)
      } catch (error) {
        console.error(`Typst compilation error (page ${i + 1}):`, error)

        // Extract the actual Typst error message
        const stderr =
          error instanceof Error && 'stderr' in error
            ? String((error as any).stderr)
            : 'Unknown compilation error'

        return NextResponse.json(
          {
            error: `Failed to compile preview (page ${i + 1})`,
            details: stderr,
          },
          { status: 500 }
        )
      }
    }

    // Return pages as JSON
    return NextResponse.json({ pages })
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
