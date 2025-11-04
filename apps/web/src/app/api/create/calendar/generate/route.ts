import { type NextRequest, NextResponse } from 'next/server'
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { generateMonthlyTypst, generateDailyTypst, getDaysInMonth } from '../utils/typstGenerator'
import type { AbacusConfig } from '@soroban/abacus-react'
import { generateCalendarComposite } from '@/../../scripts/generateCalendarComposite'
import { generateAbacusElement } from '@/../../scripts/generateCalendarAbacus'

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

    // Create temp directory
    tempDir = join(tmpdir(), `calendar-${Date.now()}-${Math.random()}`)
    mkdirSync(tempDir, { recursive: true })

    // Generate SVGs using server-side rendering (API routes can use react-dom/server)
    const daysInMonth = getDaysInMonth(year, month)
    let previewSvg: string | null = null

    if (format === 'monthly') {
      // Generate single composite SVG for monthly calendar (prevents multi-page overflow)
      try {
        const compositeSvg = generateCalendarComposite({
          month,
          year,
          renderToString: renderToStaticMarkup
        })
        if (!compositeSvg || compositeSvg.trim().length === 0) {
          throw new Error(`Generated empty composite calendar SVG`)
        }
        previewSvg = compositeSvg
        writeFileSync(join(tempDir, 'calendar.svg'), compositeSvg)
      } catch (error: any) {
        console.error(`Error generating composite calendar:`, error.message)
        throw error
      }
    } else {
      // Daily format: generate individual SVGs for each day

      // Generate day SVGs (1 to daysInMonth)
      for (let day = 1; day <= daysInMonth; day++) {
        try {
          const svg = renderToStaticMarkup(generateAbacusElement(day, 2))
          if (!svg || svg.trim().length === 0) {
            throw new Error(`Generated empty SVG for day ${day}`)
          }
          writeFileSync(join(tempDir, `day-${day}.svg`), svg)
        } catch (error: any) {
          console.error(`Error generating day ${day} SVG:`, error.message)
          throw error
        }
      }

      // Generate year SVG
      const yearColumns = Math.max(1, Math.ceil(Math.log10(year + 1)))
      try {
        const yearSvg = renderToStaticMarkup(generateAbacusElement(year, yearColumns))
        if (!yearSvg || yearSvg.trim().length === 0) {
          throw new Error(`Generated empty SVG for year ${year}`)
        }
        writeFileSync(join(tempDir, 'year.svg'), yearSvg)
      } catch (error: any) {
        console.error(`Error generating year ${year} SVG:`, error.message)
        throw error
      }
    }

    // Generate Typst document
    const typstContent =
      format === 'monthly'
        ? generateMonthlyTypst({
            month,
            year,
            paperSize,
            tempDir,
            daysInMonth,
          })
        : generateDailyTypst({
            month,
            year,
            paperSize,
            tempDir,
            daysInMonth,
          })

    const typstPath = join(tempDir, 'calendar.typ')
    writeFileSync(typstPath, typstContent)

    // Compile with Typst (run from tempDir so relative paths work)
    const pdfPath = join(tempDir, 'calendar.pdf')
    try {
      execSync(`typst compile "calendar.typ" "calendar.pdf"`, {
        cwd: tempDir,
        stdio: 'pipe',
      })
    } catch (error) {
      console.error('Typst compilation error:', error)
      return NextResponse.json(
        { error: 'Failed to compile PDF. Is Typst installed?' },
        { status: 500 }
      )
    }

    // Read PDF
    const pdfBuffer = readFileSync(pdfPath)

    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = null

    // Return JSON with both PDF and SVG preview
    return NextResponse.json({
      pdf: pdfBuffer.toString('base64'),
      svg: previewSvg,
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
