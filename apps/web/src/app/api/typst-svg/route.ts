import { NextRequest, NextResponse } from 'next/server'
import { $typst } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs'
import fs from 'fs'
import path from 'path'

export interface TypstSVGRequest {
  number: number
  beadShape?: 'diamond' | 'circle' | 'square'
  colorScheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating'
  colorPalette?: 'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature'
  hideInactiveBeads?: boolean
  showEmptyColumns?: boolean
  columns?: number | 'auto'
  scaleFactor?: number
  width?: string
  height?: string
  fontSize?: string
  fontFamily?: string
  transparent?: boolean
  coloredNumerals?: boolean
}

// Cache for template content
let flashcardsTemplate: string | null = null

async function getFlashcardsTemplate(): Promise<string> {
  if (flashcardsTemplate) {
    return flashcardsTemplate
  }

  try {
    const templatesDir = path.join(process.cwd(), '../../packages/core/templates')
    flashcardsTemplate = fs.readFileSync(path.join(templatesDir, 'flashcards.typ'), 'utf-8')
    return flashcardsTemplate
  } catch (error) {
    console.error('Failed to load flashcards template:', error)
    throw new Error('Template loading failed')
  }
}

function createTypstContent(config: TypstSVGRequest, template: string): string {
  const {
    number,
    beadShape = 'diamond',
    colorScheme = 'place-value',
    colorPalette = 'default',
    hideInactiveBeads = false,
    showEmptyColumns = false,
    columns = 'auto',
    scaleFactor = 1.0,
    width = '120pt',
    height = '160pt',
    fontSize = '48pt',
    fontFamily = 'DejaVu Sans',
    transparent = false,
    coloredNumerals = false
  } = config

  return `
${template}

#set page(
  width: ${width},
  height: ${height},
  margin: 0pt,
  fill: ${transparent ? 'none' : 'white'}
)

#set text(font: "${fontFamily}", size: ${fontSize}, fallback: true)

#align(center + horizon)[
  #box(
    width: ${width} - 2 * (${width} * 0.05),
    height: ${height} - 2 * (${height} * 0.05)
  )[
    #align(center + horizon)[
      #scale(x: ${scaleFactor * 100}%, y: ${scaleFactor * 100}%)[
        #draw-soroban(
          ${number},
          columns: ${columns},
          show-empty: ${showEmptyColumns},
          hide-inactive: ${hideInactiveBeads},
          bead-shape: "${beadShape}",
          color-scheme: "${colorScheme}",
          color-palette: "${colorPalette}",
          base-size: 1.0
        )
      ]
    ]
  ]
]
`
}

export async function POST(request: NextRequest) {
  try {
    const config: TypstSVGRequest = await request.json()

    console.log('🎨 Generating typst.ts SVG for number:', config.number)

    // Load template
    const template = await getFlashcardsTemplate()

    // Create typst content
    const typstContent = createTypstContent(config, template)

    // Generate SVG using typst.ts
    const svg = await $typst.svg({ mainContent: typstContent })

    console.log('✅ Generated typst.ts SVG, length:', svg.length)

    return NextResponse.json({
      svg,
      success: true,
      number: config.number
    })

  } catch (error) {
    console.error('❌ Typst SVG generation failed:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      },
      { status: 500 }
    )
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    endpoint: 'typst-svg',
    message: 'Typst.ts SVG generation API is running'
  })
}