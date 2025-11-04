import { type NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { generateMonthlyTypst, generateDailyTypst, getDaysInMonth } from '../utils/typstGenerator'
import type { AbacusConfig } from '@soroban/abacus-react'
import { generateCalendarComposite } from '@/utils/calendar/generateCalendarComposite'
import { generateAbacusElement } from '@/utils/calendar/generateCalendarAbacus'

interface CalendarRequest {
  month: number
  year: number
  format: 'monthly' | 'daily'
  paperSize: 'us-letter' | 'a4' | 'a3' | 'tabloid'
  abacusConfig?: AbacusConfig
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null

  try {
    // Dynamic import to avoid Next.js bundler issues with react-dom/server
    const { renderToStaticMarkup } = await import('react-dom/server')

    const body: CalendarRequest = await request.json()
    const { month, year, format, paperSize, abacusConfig } = body

    // Validate inputs
    if (!month || month < 1 || month > 12 || !year || year < 1 || year > 9999) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }

    // Create temp directory for SVG files
    tempDir = join(tmpdir(), `calendar-${Date.now()}-${Math.random()}`)
    mkdirSync(tempDir, { recursive: true })

    // Generate and write SVG files
    const daysInMonth = getDaysInMonth(year, month)
    let typstContent: string

    if (format === 'monthly') {
      // Generate single composite SVG for monthly calendar
      const calendarSvg = generateCalendarComposite({
        month,
        year,
        renderToString: renderToStaticMarkup
      })
      if (!calendarSvg || calendarSvg.trim().length === 0) {
        throw new Error('Generated empty composite calendar SVG')
      }
      writeFileSync(join(tempDir, 'calendar.svg'), calendarSvg)

      // Generate Typst document
      typstContent = generateMonthlyTypst({
        month,
        year,
        paperSize,
        daysInMonth,
      })
    } else {
      // Daily format: generate individual SVGs for each day
      for (let day = 1; day <= daysInMonth; day++) {
        const svg = renderToStaticMarkup(generateAbacusElement(day, 2))
        if (!svg || svg.trim().length === 0) {
          throw new Error(`Generated empty SVG for day ${day}`)
        }
        writeFileSync(join(tempDir, `day-${day}.svg`), svg)
      }

      // Generate year SVG
      const yearColumns = Math.max(1, Math.ceil(Math.log10(year + 1)))
      const yearSvg = renderToStaticMarkup(generateAbacusElement(year, yearColumns))
      if (!yearSvg || yearSvg.trim().length === 0) {
        throw new Error(`Generated empty SVG for year ${year}`)
      }
      writeFileSync(join(tempDir, 'year.svg'), yearSvg)

      // Generate Typst document
      typstContent = generateDailyTypst({
        month,
        year,
        paperSize,
        daysInMonth,
      })
    }

    // Compile with Typst: stdin for .typ content, stdout for PDF output
    let pdfBuffer: Buffer
    try {
      pdfBuffer = execSync('typst compile - -', {
        input: typstContent,
        cwd: tempDir, // Run in temp dir so relative paths work
        maxBuffer: 50 * 1024 * 1024, // 50MB limit for large calendars
      })
    } catch (error) {
      console.error('Typst compilation error:', error)
      return NextResponse.json(
        { error: 'Failed to compile PDF. Is Typst installed?' },
        { status: 500 }
      )
    }

    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = null

    // Return JSON with PDF
    return NextResponse.json({
      pdf: pdfBuffer.toString('base64'),
      filename: `calendar-${year}-${String(month).padStart(2, '0')}.pdf`,
    })
  } catch (error) {
    console.error('Error generating calendar:', error)

    // Clean up temp directory if it exists
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch (cleanupError) {
        console.error('Failed to clean up temp directory:', cleanupError)
      }
    }

    // Surface the actual error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined

    return NextResponse.json(
      {
        error: 'Failed to generate calendar',
        message: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    )
  }
}
