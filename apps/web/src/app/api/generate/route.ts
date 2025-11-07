import { type NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import type { FlashcardConfig } from '@/app/create/flashcards/page'
import {
  generateFlashcardFront,
  generateFlashcardBack,
} from '@/utils/flashcards/generateFlashcardSvgs'

export const dynamic = 'force-dynamic'

/**
 * Parse range string to get all numbers
 */
function parseRange(range: string, step: number): number[] {
  const numbers: number[] = []

  if (range.includes('-')) {
    const [start, end] = range.split('-').map((n) => parseInt(n, 10))
    for (let i = start; i <= end; i += step) {
      numbers.push(i)
    }
  } else if (range.includes(',')) {
    const parts = range.split(',').map((n) => parseInt(n.trim(), 10))
    numbers.push(...parts)
  } else {
    numbers.push(parseInt(range, 10))
  }

  return numbers
}

/**
 * Shuffle array with seed for reproducibility
 */
function shuffleWithSeed<T>(array: T[], seed?: number): T[] {
  const shuffled = [...array]
  const rng = seed !== undefined ? seededRandom(seed) : Math.random

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

/**
 * Simple seeded random number generator (Mulberry32)
 */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null

  try {
    const config: FlashcardConfig = await request.json()
    const {
      range = '0-99',
      step = 1,
      cardsPerPage = 6,
      paperSize = 'us-letter',
      orientation = 'portrait',
      margins,
      gutter = '5mm',
      shuffle = false,
      seed,
      showCutMarks = false,
      showRegistration = false,
      beadShape = 'diamond',
      colorScheme = 'place-value',
      colorPalette = 'default',
      hideInactiveBeads = false,
      showEmptyColumns = false,
      columns = 'auto',
      scaleFactor = 0.9,
      coloredNumerals = false,
      format = 'pdf',
    } = config

    // Dynamic import to avoid Next.js bundler issues
    const { renderToStaticMarkup } = await import('react-dom/server')

    // Create temp directory for SVG files
    tempDir = join(tmpdir(), `flashcards-${Date.now()}-${Math.random()}`)
    mkdirSync(tempDir, { recursive: true })

    // Get all numbers
    let numbers = parseRange(range, step)

    // Apply shuffle if requested
    if (shuffle) {
      numbers = shuffleWithSeed(numbers, seed)
    }

    if (numbers.length === 0) {
      return NextResponse.json({ error: 'No valid numbers in range' }, { status: 400 })
    }

    // Generate SVG files for each card (front and back)
    const svgConfig = {
      beadShape,
      colorScheme,
      colorPalette,
      hideInactiveBeads,
      showEmptyColumns,
      columns: (columns === 'auto' ? 'auto' : Number(columns)) as number | 'auto',
      scaleFactor,
      coloredNumerals,
    }

    for (let i = 0; i < numbers.length; i++) {
      const num = numbers[i]

      // Generate front (abacus)
      const frontElement = generateFlashcardFront(num, svgConfig)
      const frontSvg = renderToStaticMarkup(frontElement)
      writeFileSync(join(tempDir, `card_${i}_front.svg`), frontSvg)

      // Generate back (numeral)
      const backElement = generateFlashcardBack(num, svgConfig)
      const backSvg = renderToStaticMarkup(backElement)
      writeFileSync(join(tempDir, `card_${i}_back.svg`), backSvg)
    }

    // Calculate paper dimensions and layout
    const paperDimensions = {
      'us-letter': { width: 8.5, height: 11 },
      a4: { width: 8.27, height: 11.69 },
      a3: { width: 11.69, height: 16.54 },
      a5: { width: 5.83, height: 8.27 },
    }

    const paper = paperDimensions[paperSize] || paperDimensions['us-letter']
    const [pageWidth, pageHeight] =
      orientation === 'landscape' ? [paper.height, paper.width] : [paper.width, paper.height]

    // Calculate grid layout (typically 2 columns × 3 rows for 6 cards)
    const cols = 2
    const rows = Math.ceil(cardsPerPage / cols)

    // Use provided margins or defaults
    const margin = {
      top: margins?.top || '0.5in',
      bottom: margins?.bottom || '0.5in',
      left: margins?.left || '0.5in',
      right: margins?.right || '0.5in',
    }

    // Parse gutter (convert from string like "5mm" to inches for calculation)
    const gutterInches = parseFloat(gutter) / 25.4 // Rough mm to inch conversion

    // Calculate available space (approximate, Typst will handle exact layout)
    const marginInches = 0.5 // Simplified for now
    const availableWidth = pageWidth - 2 * marginInches - gutterInches * (cols - 1)
    const availableHeight = pageHeight - 2 * marginInches - gutterInches * (rows - 1)
    const cardWidth = availableWidth / cols
    const cardHeight = availableHeight / rows

    // Generate pages
    const totalPages = Math.ceil(numbers.length / cardsPerPage)
    const pages: string[] = []

    for (let pageNum = 0; pageNum < totalPages; pageNum++) {
      const startIdx = pageNum * cardsPerPage
      const endIdx = Math.min(startIdx + cardsPerPage, numbers.length)
      const pageCards = []

      for (let i = startIdx; i < endIdx; i++) {
        pageCards.push(
          `  image("card_${i}_front.svg", width: ${cardWidth}in, height: ${cardHeight}in, fit: "contain")`
        )
      }

      // Fill remaining slots with empty cells if needed
      const remaining = cardsPerPage - pageCards.length
      for (let i = 0; i < remaining; i++) {
        pageCards.push(`  []`) // Empty cell
      }

      pages.push(`#grid(
  columns: ${cols},
  rows: ${rows},
  column-gutter: ${gutter},
  row-gutter: ${gutter},
${pageCards.join(',\n')}
)`)
    }

    // Generate Typst document
    const typstContent = `
#set page(
  paper: "${paperSize}",
  margin: (x: ${margin.left}, y: ${margin.top}),
  flipped: ${orientation === 'landscape'},
)

${pages.join('\n\n#pagebreak()\n\n')}
`

    // Compile with Typst
    let pdfBuffer: Buffer
    try {
      pdfBuffer = execSync('typst compile --format pdf - -', {
        input: typstContent,
        cwd: tempDir, // Run in temp dir so relative paths work
        maxBuffer: 100 * 1024 * 1024, // 100MB limit for large sets
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

    // Create filename for download
    const filename = `soroban-flashcards-${range}.pdf`

    // Return PDF directly as download
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error generating flashcards:', error)

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
      { error: 'Failed to generate flashcards', message: errorMessage },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Check if Typst is available
    execSync('typst --version', { encoding: 'utf8' })

    return NextResponse.json({
      status: 'healthy',
      generator: 'typescript-typst',
      dependencies: {
        typst: true,
        python: false, // No longer needed!
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Typst not available',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
