import { type NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { generateMonthlyTypst, getDaysInMonth } from '../utils/typstGenerator'
import { generateCalendarComposite } from '@/../../scripts/generateCalendarComposite'

interface PreviewRequest {
  month: number
  year: number
  format: 'monthly' | 'daily'
}

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let tempDir: string | null = null

  try {
    const body: PreviewRequest = await request.json()
    const { month, year, format } = body

    // Validate inputs
    if (!month || month < 1 || month > 12 || !year || year < 1 || year > 9999) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }

    // Only generate preview for monthly format
    if (format !== 'monthly') {
      return NextResponse.json({ svg: null })
    }

    // Dynamic import to avoid Next.js bundler issues
    const { renderToStaticMarkup } = await import('react-dom/server')

    // Create temp directory for SVG file
    tempDir = join(tmpdir(), `calendar-preview-${Date.now()}-${Math.random()}`)
    mkdirSync(tempDir, { recursive: true })

    // Generate and write composite SVG
    const calendarSvg = generateCalendarComposite({
      month,
      year,
      renderToString: renderToStaticMarkup
    })
    writeFileSync(join(tempDir, 'calendar.svg'), calendarSvg)

    // Generate Typst document content
    const daysInMonth = getDaysInMonth(year, month)
    const typstContent = generateMonthlyTypst({
      month,
      year,
      paperSize: 'us-letter',
      daysInMonth,
    })

    // Compile with Typst: stdin for .typ content, stdout for SVG output
    let svg: string
    try {
      svg = execSync('typst compile --format svg - -', {
        input: typstContent,
        encoding: 'utf8',
        cwd: tempDir, // Run in temp dir so relative paths work
      })
    } catch (error) {
      console.error('Typst compilation error:', error)
      return NextResponse.json(
        { error: 'Failed to compile preview. Is Typst installed?' },
        { status: 500 }
      )
    }

    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = null

    return NextResponse.json({ svg })
  } catch (error) {
    console.error('Error generating preview:', error)

    // Clean up temp directory if it exists
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.error('Failed to clean up temp directory:', cleanupError)
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to generate preview', message: errorMessage },
      { status: 500 }
    )
  }
}
