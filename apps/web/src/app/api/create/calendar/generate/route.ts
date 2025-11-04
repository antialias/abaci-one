import { type NextRequest, NextResponse } from 'next/server'
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
    const scriptPath = join(process.cwd(), 'scripts', 'generateCalendarAbacus.tsx')

    // Generate day SVGs (1 to maxDay)
    for (let day = 1; day <= maxDay; day++) {
      const svg = execSync(`npx tsx "${scriptPath}" ${day} 2`, {
        encoding: 'utf-8',
        cwd: process.cwd(),
      })
      writeFileSync(join(tempDir, `day-${day}.svg`), svg)
    }

    // Generate year SVG
    const yearColumns = Math.max(1, Math.ceil(Math.log10(year + 1)))
    const yearSvg = execSync(`npx tsx "${scriptPath}" ${year} ${yearColumns}`, {
      encoding: 'utf-8',
      cwd: process.cwd(),
    })
    writeFileSync(join(tempDir, 'year.svg'), yearSvg)

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
