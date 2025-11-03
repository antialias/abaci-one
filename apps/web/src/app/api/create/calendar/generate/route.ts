import { NextRequest, NextResponse } from 'next/server'
import { writeFileSync, readFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { generateMonthlyTypst, generateDailyTypst, getDaysInMonth } from '../utils/typstGenerator'
import type { AbacusConfig } from '@soroban/abacus-react'

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
    const body: CalendarRequest = await request.json()
    const { month, year, format, paperSize, abacusConfig } = body

    // Validate inputs
    if (!month || month < 1 || month > 12 || !year || year < 1 || year > 9999) {
      return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
    }

    // Create temp directory
    tempDir = join(tmpdir(), `calendar-${Date.now()}-${Math.random()}`)
    mkdirSync(tempDir, { recursive: true })

    // Generate SVGs using script (avoids Next.js react-dom/server restriction)
    const daysInMonth = getDaysInMonth(year, month)
    const maxDay = format === 'daily' ? daysInMonth : 31 // For monthly, pre-generate all
    const customStyles = abacusConfig?.customStyles || {}

    // Call script to generate all SVGs
    const scriptPath = join(process.cwd(), 'scripts', 'generateCalendarSVGs.tsx')
    const customStylesJson = JSON.stringify(customStyles)
    const svgsJson = execSync(`npx tsx "${scriptPath}" ${maxDay} ${year} '${customStylesJson}'`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    })

    interface CalendarSVGs {
      days: Record<string, string>
      year: string
    }

    const svgs: CalendarSVGs = JSON.parse(svgsJson)

    // Write day SVGs to temp directory
    for (const [key, svg] of Object.entries(svgs.days)) {
      writeFileSync(join(tempDir, `${key}.svg`), svg)
    }

    // Write year SVG
    writeFileSync(join(tempDir, 'year.svg'), svgs.year)

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

    // Compile with Typst
    const pdfPath = join(tempDir, 'calendar.pdf')
    try {
      execSync(`typst compile "${typstPath}" "${pdfPath}"`, {
        stdio: 'pipe',
      })
    } catch (error) {
      console.error('Typst compilation error:', error)
      return NextResponse.json(
        { error: 'Failed to compile PDF. Is Typst installed?' },
        { status: 500 }
      )
    }

    // Read and return PDF
    const pdfBuffer = readFileSync(pdfPath)

    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true })
    tempDir = null

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="calendar-${year}-${String(month).padStart(2, '0')}.pdf"`,
      },
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

    return NextResponse.json({ error: 'Failed to generate calendar' }, { status: 500 })
  }
}
