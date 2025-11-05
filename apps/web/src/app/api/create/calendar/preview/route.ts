import { type NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import { generateMonthlyTypst, getDaysInMonth } from '../utils/typstGenerator'
import { generateCalendarComposite } from '@/utils/calendar/generateCalendarComposite'
import { generateAbacusElement } from '@/utils/calendar/generateCalendarAbacus'

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

    // Dynamic import to avoid Next.js bundler issues
    const { renderToStaticMarkup } = await import('react-dom/server')

    // Create temp directory for SVG file(s)
    tempDir = join(tmpdir(), `calendar-preview-${Date.now()}-${Math.random()}`)
    mkdirSync(tempDir, { recursive: true })

    // Generate Typst document content
    const daysInMonth = getDaysInMonth(year, month)
    let typstContent: string

    if (format === 'monthly') {
      // Generate and write composite SVG
      const calendarSvg = generateCalendarComposite({
        month,
        year,
        renderToString: renderToStaticMarkup,
      })
      writeFileSync(join(tempDir, 'calendar.svg'), calendarSvg)

      typstContent = generateMonthlyTypst({
        month,
        year,
        paperSize: 'us-letter',
        daysInMonth,
      })
    } else {
      // Daily format: Create a SINGLE composite SVG (like monthly) to avoid multi-image export issue

      // Generate individual abacus SVGs
      const daySvg = renderToStaticMarkup(generateAbacusElement(1, 2))
      if (!daySvg || daySvg.trim().length === 0) {
        throw new Error('Generated empty SVG for day 1')
      }

      const yearColumns = Math.max(1, Math.ceil(Math.log10(year + 1)))
      const yearSvg = renderToStaticMarkup(generateAbacusElement(year, yearColumns))
      if (!yearSvg || yearSvg.trim().length === 0) {
        throw new Error(`Generated empty SVG for year ${year}`)
      }

      // Create composite SVG with both year and day abacus
      const monthName = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ][month - 1]
      const dayOfWeek = new Date(year, month - 1, 1).toLocaleDateString('en-US', {
        weekday: 'long',
      })

      // Extract SVG content (remove outer <svg> tags)
      const yearSvgContent = yearSvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '')
      const daySvgContent = daySvg.replace(/<svg[^>]*>/, '').replace(/<\/svg>$/, '')

      // Create composite SVG (850x1100 = US Letter aspect ratio)
      const compositeWidth = 850
      const compositeHeight = 1100
      const yearAbacusWidth = 120 // Natural width at scale 1
      const yearAbacusHeight = 230
      const dayAbacusWidth = 120
      const dayAbacusHeight = 230

      const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${compositeWidth}" height="${compositeHeight}" viewBox="0 0 ${compositeWidth} ${compositeHeight}">
  <!-- Background -->
  <rect width="${compositeWidth}" height="${compositeHeight}" fill="white"/>

  <!-- Decorative border -->
  <rect x="40" y="40" width="${compositeWidth - 80}" height="${compositeHeight - 80}" fill="none" stroke="#2563eb" stroke-width="3" rx="8"/>
  <rect x="50" y="50" width="${compositeWidth - 100}" height="${compositeHeight - 100}" fill="none" stroke="#2563eb" stroke-width="1" rx="4"/>

  <!-- Header section with background -->
  <rect x="70" y="70" width="${compositeWidth - 140}" height="120" fill="#eff6ff" stroke="#2563eb" stroke-width="2" rx="6"/>

  <!-- Month name -->
  <text x="${compositeWidth / 2}" y="125" text-anchor="middle" font-family="Georgia, serif" font-size="48" font-weight="bold" fill="#1e40af" letter-spacing="2">
    ${monthName.toUpperCase()}
  </text>

  <!-- Year abacus (smaller, in header) -->
  <svg x="${compositeWidth / 2 - yearAbacusWidth * 0.4}" y="140" width="${yearAbacusWidth * 0.8}" height="${yearAbacusHeight * 0.8}" viewBox="0 0 ${yearAbacusWidth} ${yearAbacusHeight}">
    ${yearSvgContent}
  </svg>

  <!-- Day of week (large and prominent) -->
  <text x="${compositeWidth / 2}" y="260" text-anchor="middle" font-family="Georgia, serif" font-size="42" font-weight="bold" fill="#1e3a8a">
    ${dayOfWeek}
  </text>

  <!-- Day abacus (much larger, main focus) -->
  <svg x="${compositeWidth / 2 - dayAbacusWidth * 1.25}" y="300" width="${dayAbacusWidth * 2.5}" height="${dayAbacusHeight * 2.5}" viewBox="0 0 ${dayAbacusWidth} ${dayAbacusHeight}">
    ${daySvgContent}
  </svg>

  <!-- Full date (below day abacus) -->
  <text x="${compositeWidth / 2}" y="890" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-weight="500" fill="#475569">
    ${monthName} 1, ${year}
  </text>

  <!-- Notes section with decorative box -->
  <rect x="70" y="930" width="${compositeWidth - 140}" height="120" fill="#fefce8" stroke="#ca8a04" stroke-width="2" rx="4"/>
  <text x="90" y="960" font-family="Georgia, serif" font-size="18" font-weight="bold" fill="#854d0e">
    Notes:
  </text>
  <line x1="90" y1="980" x2="${compositeWidth - 90}" y2="980" stroke="#ca8a04" stroke-width="1"/>
  <line x1="90" y1="1005" x2="${compositeWidth - 90}" y2="1005" stroke="#ca8a04" stroke-width="1"/>
  <line x1="90" y1="1030" x2="${compositeWidth - 90}" y2="1030" stroke="#ca8a04" stroke-width="1"/>
</svg>`

      writeFileSync(join(tempDir, 'daily-preview.svg'), compositeSvg)

      // Use single composite image (like monthly)
      typstContent = `#set page(
  paper: "us-letter",
  margin: (x: 0.5in, y: 0.5in),
)

#align(center + horizon)[
  #image("daily-preview.svg", width: 100%, fit: "contain")
]
`
    }

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
