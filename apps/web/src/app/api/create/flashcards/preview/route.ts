import { type NextRequest, NextResponse } from 'next/server'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import type { FlashcardFormState } from '@/app/create/flashcards/page'
import {
  generateFlashcardFront,
  generateFlashcardBack,
} from '@/utils/flashcards/generateFlashcardSvgs'

export const dynamic = 'force-dynamic'

/**
 * Parse range string to get numbers for preview (first page only)
 */
function parseRangeForPreview(range: string, step: number, cardsPerPage: number): number[] {
  const numbers: number[] = []

  if (range.includes('-')) {
    const [start, end] = range.split('-').map((n) => parseInt(n, 10))
    for (let i = start; i <= end && numbers.length < cardsPerPage; i += step) {
      numbers.push(i)
    }
  } else if (range.includes(',')) {
    const parts = range.split(',').map((n) => parseInt(n.trim(), 10))
    numbers.push(...parts.slice(0, cardsPerPage))
  } else {
    numbers.push(parseInt(range, 10))
  }

  return numbers.slice(0, cardsPerPage)
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null

  try {
    const body: FlashcardFormState = await request.json()
    const {
      range = '0-99',
      step = 1,
      cardsPerPage = 6,
      paperSize = 'us-letter',
      orientation = 'portrait',
      beadShape = 'diamond',
      colorScheme = 'place-value',
      colorPalette = 'default',
      hideInactiveBeads = false,
      showEmptyColumns = false,
      columns = 'auto',
      scaleFactor = 0.9,
      coloredNumerals = false,
    } = body

    // Dynamic import to avoid Next.js bundler issues
    const { renderToStaticMarkup } = await import('react-dom/server')

    // Create temp directory for SVG files
    tempDir = join(tmpdir(), `flashcards-preview-${Date.now()}-${Math.random()}`)
    mkdirSync(tempDir, { recursive: true })

    // Get numbers for first page only
    const numbers = parseRangeForPreview(range, step, cardsPerPage)

    if (numbers.length === 0) {
      return NextResponse.json({ error: 'No valid numbers in range' }, { status: 400 })
    }

    // Generate SVG files for each card (front and back)
    const config = {
      beadShape,
      colorScheme,
      colorPalette,
      hideInactiveBeads,
      showEmptyColumns,
      columns: columns === 'auto' ? 'auto' : Number(columns),
      scaleFactor,
      coloredNumerals,
    }

    for (let i = 0; i < numbers.length; i++) {
      const num = numbers[i]

      // Generate front (abacus)
      const frontElement = generateFlashcardFront(num, config)
      const frontSvg = renderToStaticMarkup(frontElement)
      writeFileSync(join(tempDir, `card_${i}_front.svg`), frontSvg)

      // Generate back (numeral)
      const backElement = generateFlashcardBack(num, config)
      const backSvg = renderToStaticMarkup(backElement)
      writeFileSync(join(tempDir, `card_${i}_back.svg`), backSvg)
    }

    // Calculate card dimensions based on paper size and orientation
    const paperDimensions = {
      'us-letter': { width: 8.5, height: 11 },
      a4: { width: 8.27, height: 11.69 },
      a3: { width: 11.69, height: 16.54 },
      a5: { width: 5.83, height: 8.27 },
    }

    const paper = paperDimensions[paperSize] || paperDimensions['us-letter']
    const [pageWidth, pageHeight] =
      orientation === 'landscape' ? [paper.height, paper.width] : [paper.width, paper.height]

    // Calculate grid layout (2 columns × 3 rows for 6 cards per page typically)
    const cols = 2
    const rows = Math.ceil(cardsPerPage / cols)
    const margin = 0.5 // inches
    const gutter = 0.2 // inches between cards

    const availableWidth = pageWidth - 2 * margin - gutter * (cols - 1)
    const availableHeight = pageHeight - 2 * margin - gutter * (rows - 1)
    const cardWidth = availableWidth / cols
    const cardHeight = availableHeight / rows

    // Generate Typst document with card grid
    const typstContent = `
#set page(
  paper: "${paperSize}",
  margin: (x: ${margin}in, y: ${margin}in),
  flipped: ${orientation === 'landscape'},
)

// Grid layout for flashcards preview (first page only)
#grid(
  columns: ${cols},
  rows: ${rows},
  column-gutter: ${gutter}in,
  row-gutter: ${gutter}in,
  ${numbers
    .map((_, i) => {
      return `  image("card_${i}_front.svg", width: ${cardWidth}in, height: ${cardHeight}in, fit: "contain"),`
    })
    .join('\n')}
)

// Add preview label
#place(
  top + right,
  dx: -0.5in,
  dy: 0.25in,
  text(10pt, fill: gray)[Preview (first ${numbers.length} cards)]
)
`

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
