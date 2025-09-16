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
    const { getTemplatePath } = require('@soroban/templates')
    const templatePath = getTemplatePath('flashcards.typ')
    flashcardsTemplate = fs.readFileSync(templatePath, 'utf-8')
    return flashcardsTemplate
  } catch (error) {
    console.error('Failed to load flashcards template:', error)
    throw new Error('Template loading failed')
  }
}

function processBeadAnnotations(svg: string): string {
  // Process each bead link and add data attributes to the bead shapes
  return svg.replace(
    /<a[^>]*xlink:href="bead:\/\/([^"]*)"[^>]*>(.*?)<\/a>/gs,
    (match, beadId, content) => {
      // Parse the bead ID to extract metadata
      const parts = beadId.split('-')
      let beadType = ''
      let column = ''
      let position = ''
      let active = ''

      if (parts[0] === 'heaven') {
        beadType = 'heaven'
        column = parts[1].replace('col', '')
        active = parts[2].replace('active', '')
      } else if (parts[0] === 'earth') {
        beadType = 'earth'
        column = parts[1].replace('col', '')
        position = parts[2].replace('pos', '')
        active = parts[3].replace('active', '')
      }

      // Create data attribute string
      const dataAttrs = `data-bead-type="${beadType}" data-bead-column="${column}"${position ? ` data-bead-position="${position}"` : ''} data-bead-active="${active}"`

      // Find the actual bead shape path and add data attributes to it
      // Look for path elements that have the diamond shape pattern (M 0 0 M 8.4 0 L 16.8 6...)
      let processedContent = content.replace(
        /(<path[^>]*class="typst-shape"[^>]*d="M 0 0 M 8\.4 0 L 16\.8 6[^"]*"[^>]*)(\/?>)/g,
        `$1 ${dataAttrs}$2`
      )

      // Also add to any other path, rect, circle, or polygon elements as fallback
      processedContent = processedContent.replace(
        /(<(?:path|rect|circle|polygon)[^>]*class="(?!pseudo-link)[^"]*"[^>]*)(\/?>)/g,
        (shapeMatch, beforeClosing, closing) => {
          // Only add if data attributes aren't already present
          if (beforeClosing.includes('data-bead-type')) {
            return shapeMatch
          }
          return `${beforeClosing} ${dataAttrs}${closing}`
        }
      )

      // Return just the content without the <a> wrapper
      return processedContent
    }
  )
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
    const rawSvg = await $typst.svg({ mainContent: typstContent })

    // Post-process to convert bead annotations to data attributes
    const svg = processBeadAnnotations(rawSvg)

    console.log('✅ Generated and processed typst.ts SVG, length:', svg.length)

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