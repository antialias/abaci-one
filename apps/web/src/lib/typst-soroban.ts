// TypeScript module for generating Soroban SVGs using typst.ts
// This replaces the Python bridge with a browser-native solution

// Try different import approach for Next.js compatibility
let $typst: any = null

async function getTypstRenderer() {
  if ($typst) return $typst

  try {
    // Try the ES module import first
    const typstModule = await import('@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs')
    $typst = typstModule.$typst
    return $typst
  } catch (error) {
    console.warn('ES module import failed, trying alternative:', error)

    try {
      // Fallback to dynamic import
      const typstModule = await import('@myriaddreamin/typst.ts')
      $typst = typstModule
      return $typst
    } catch (fallbackError) {
      console.error('All typst.ts import methods failed:', fallbackError)
      throw new Error('Failed to load typst.ts renderer')
    }
  }
}

// We'll load the template content via an API endpoint or inline it here
// For now, let's create a minimal template with the draw-soroban function

export interface SorobanConfig {
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
}

// Cache for compiled templates to avoid recompilation
const templateCache = new Map<string, Promise<string>>()

// Lazy-loaded template content
let flashcardsTemplate: string | null = null

async function getFlashcardsTemplate(): Promise<string> {
  if (flashcardsTemplate) {
    return flashcardsTemplate
  }

  try {
    const response = await fetch('/api/typst-template')
    const data = await response.json()

    if (data.success) {
      flashcardsTemplate = data.template
      return flashcardsTemplate
    } else {
      throw new Error(data.error || 'Failed to load template')
    }
  } catch (error) {
    console.error('Failed to fetch typst template:', error)
    throw new Error('Template loading failed')
  }
}

async function getTypstTemplate(config: SorobanConfig): Promise<string> {
  const template = await getFlashcardsTemplate()

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
    transparent = false
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

export async function generateSorobanSVG(config: SorobanConfig): Promise<string> {
  try {
    // Create a cache key based on the configuration
    const cacheKey = JSON.stringify(config)

    // Check if we have a cached result
    if (templateCache.has(cacheKey)) {
      return await templateCache.get(cacheKey)!
    }

    // Generate the SVG using the server-side API
    const response = await fetch('/api/typst-svg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || 'SVG generation failed')
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'SVG generation failed')
    }

    const svg = data.svg

    // Cache the result
    templateCache.set(cacheKey, Promise.resolve(svg))

    // Clean up the cache if it gets too large (keep last 50 entries)
    if (templateCache.size > 50) {
      const entries = Array.from(templateCache.entries())
      const toKeep = entries.slice(-25) // Keep last 25
      templateCache.clear()
      toKeep.forEach(([key, value]) => templateCache.set(key, value))
    }

    return svg
  } catch (error) {
    console.error('Failed to generate Soroban SVG with typst.ts:', error)
    throw new Error(`SVG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function generateSorobanPreview(
  numbers: number[],
  config: Omit<SorobanConfig, 'number'>
): Promise<Array<{ number: number; svg: string }>> {
  const results = await Promise.allSettled(
    numbers.map(async (number) => ({
      number,
      svg: await generateSorobanSVG({ ...config, number })
    }))
  )

  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    } else {
      console.error(`Failed to generate SVG for number ${numbers[index]}:`, result.reason)
      return {
        number: numbers[index],
        svg: `<svg width="200" height="300" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
          <rect x="10" y="10" width="180" height="280" fill="none" stroke="#ccc" stroke-width="2"/>
          <line x1="20" y1="150" x2="180" y2="150" stroke="#ccc" stroke-width="2"/>
          <text x="100" y="160" text-anchor="middle" font-size="24" fill="#666">Generation Error</text>
          <text x="100" y="180" text-anchor="middle" font-size="16" fill="#999">${numbers[index]}</text>
        </svg>`
      }
    }
  })
}