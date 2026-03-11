import { type NextRequest, NextResponse } from 'next/server'
import type { AbacusStaticConfig } from '@soroban/abacus-react/static'
import sharp from 'sharp'
import { renderAbacusSvg } from '@/lib/abacus-image/render'

export const dynamic = 'force-dynamic'

const MAX_VALUE = 9_999_999_999 // 10 billion - 1 (10 columns max)
const DEFAULT_WIDTH = 400

function parseBoolean(val: string | null): boolean | undefined {
  if (val === null) return undefined
  return val === 'true' || val === '1'
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  // Required: value
  const valueStr = params.get('value')
  if (!valueStr) {
    return NextResponse.json({ error: 'Missing required parameter: value' }, { status: 400 })
  }

  const value = parseInt(valueStr, 10)
  if (isNaN(value) || value < 0 || value > MAX_VALUE) {
    return NextResponse.json(
      { error: `value must be an integer between 0 and ${MAX_VALUE}` },
      { status: 400 }
    )
  }

  // Format
  const format = params.get('format') ?? 'svg'
  if (format !== 'svg' && format !== 'png') {
    return NextResponse.json({ error: 'format must be "svg" or "png"' }, { status: 400 })
  }

  // Optional display params
  const columnsParam = params.get('columns')
  const columns: AbacusStaticConfig['columns'] =
    columnsParam === null || columnsParam === 'auto' ? 'auto' : parseInt(columnsParam, 10)

  if (typeof columns === 'number' && (isNaN(columns) || columns < 1 || columns > 13)) {
    return NextResponse.json({ error: 'columns must be between 1 and 13' }, { status: 400 })
  }

  const colorScheme = (params.get('colorScheme') ??
    'place-value') as AbacusStaticConfig['colorScheme']
  const validColorSchemes = ['monochrome', 'place-value', 'alternating', 'heaven-earth']
  if (!validColorSchemes.includes(colorScheme!)) {
    return NextResponse.json(
      { error: `colorScheme must be one of: ${validColorSchemes.join(', ')}` },
      { status: 400 }
    )
  }

  const colorPalette = (params.get('colorPalette') ??
    'default') as AbacusStaticConfig['colorPalette']
  const validPalettes = ['default', 'pastel', 'vibrant', 'earth-tones']
  if (!validPalettes.includes(colorPalette!)) {
    return NextResponse.json(
      { error: `colorPalette must be one of: ${validPalettes.join(', ')}` },
      { status: 400 }
    )
  }

  const beadShape = (params.get('beadShape') ?? 'circle') as AbacusStaticConfig['beadShape']
  const validShapes = ['circle', 'diamond', 'square']
  if (!validShapes.includes(beadShape!)) {
    return NextResponse.json(
      { error: `beadShape must be one of: ${validShapes.join(', ')}` },
      { status: 400 }
    )
  }

  const hideInactiveBeads = parseBoolean(params.get('hideInactiveBeads')) ?? false
  const compact = parseBoolean(params.get('compact')) ?? false
  const showNumbers = parseBoolean(params.get('showNumbers')) ?? true

  const widthParam = params.get('width')
  const width = widthParam ? parseInt(widthParam, 10) : DEFAULT_WIDTH
  if (isNaN(width) || width < 50 || width > 2000) {
    return NextResponse.json({ error: 'width must be between 50 and 2000' }, { status: 400 })
  }

  // Render SVG
  const svgString = renderAbacusSvg({
    value,
    columns,
    beadShape,
    colorScheme,
    colorPalette,
    showNumbers,
    hideInactiveBeads,
    compact,
  })

  if (format === 'svg') {
    return new NextResponse(svgString, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }

  // PNG: use sharp to convert
  const pngBuffer = await sharp(Buffer.from(svgString)).resize({ width }).png().toBuffer()

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
