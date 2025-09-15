// TypeScript module for generating Soroban SVGs using typst.ts
// This replaces the Python bridge with a browser-native solution

// Browser-side typst.ts rendering
let $typst: any = null
let isLoading = false

async function getTypstRenderer() {
  if ($typst) return $typst

  // Prevent multiple concurrent initializations
  if (isLoading) {
    // Wait for the current initialization to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if ($typst) return $typst
    throw new Error('typst.ts initialization failed')
  }

  isLoading = true

  try {
    console.log('🚀 Loading typst.ts WASM in browser...')

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Not in browser environment')
    }

    // Try multiple import strategies for maximum compatibility
    let typstModule
    try {
      // Primary import method
      typstModule = await import('@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs')
      $typst = typstModule.$typst
    } catch (importError) {
      console.log('Primary import failed, trying alternative...')
      // Alternative import method
      typstModule = await import('@myriaddreamin/typst.ts')
      $typst = typstModule.$typst || typstModule.default?.$typst
    }

    if (!$typst) {
      throw new Error('typst.ts renderer not found in module')
    }

    // Test the renderer with a minimal example
    console.log('🧪 Testing typst.ts renderer...')
    await $typst.svg({ mainContent: '#set page(width: 10pt, height: 10pt)\n' })

    console.log('✅ typst.ts WASM loaded and tested successfully!')
    return $typst

  } catch (error) {
    console.error('❌ Failed to load typst.ts WASM:', error)
    $typst = null
    throw new Error(`Browser typst.ts initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    isLoading = false
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
  coloredNumerals?: boolean
  enableServerFallback?: boolean
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
    transparent = false,
    coloredNumerals = false,
    enableServerFallback = false
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

    // Try browser-side generation first, fallback to server if it fails
    const generationPromise = generateSVGWithFallback(config)

    // Cache the promise to prevent duplicate generations
    templateCache.set(cacheKey, generationPromise)

    // Clean up the cache if it gets too large (keep last 50 entries)
    if (templateCache.size > 50) {
      const entries = Array.from(templateCache.entries())
      const toKeep = entries.slice(-25) // Keep last 25
      templateCache.clear()
      toKeep.forEach(([key, value]) => templateCache.set(key, value))
    }

    return await generationPromise

  } catch (error) {
    console.error('Failed to generate Soroban SVG with typst.ts:', error)
    throw new Error(`SVG generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Track if browser-side generation has been attempted and failed
let browserGenerationAvailable: boolean | null = null

// Function to reset browser availability detection (useful for debugging)
export function resetBrowserGenerationStatus() {
  browserGenerationAvailable = null
  $typst = null
  isLoading = false
  console.log('🔄 Reset browser generation status - will retry on next generation')
}

async function generateSVGWithFallback(config: SorobanConfig): Promise<string> {
  console.log('🔍 generateSVGWithFallback called for number:', config.number)
  console.log('🔍 browserGenerationAvailable status:', browserGenerationAvailable)
  console.log('🔍 enableServerFallback:', config.enableServerFallback)

  // If we know browser generation is available, always use it
  if (browserGenerationAvailable === true) {
    console.log('🎯 Using confirmed browser-side generation')
    return await generateSVGInBrowser(config)
  }

  // If we know browser generation is not available and server fallback is disabled, throw error
  if (browserGenerationAvailable === false && !config.enableServerFallback) {
    console.error('❌ Browser-side generation unavailable and server fallback disabled')
    throw new Error('Browser-side SVG generation failed and server fallback is disabled. Enable server fallback or fix browser WASM loading.')
  }

  // If we know browser generation is not available, skip to server (only if fallback enabled)
  if (browserGenerationAvailable === false && config.enableServerFallback) {
    console.log('🔄 Using server fallback (browser unavailable)')
    return await generateSVGOnServer(config)
  }

  // First attempt - try browser-side generation
  try {
    console.log('🚀 Attempting browser-side generation for number:', config.number)
    const result = await generateSVGInBrowser(config)
    browserGenerationAvailable = true
    console.log('✅ Browser-side generation successful! Will use for future requests.')
    return result
  } catch (browserError) {
    console.warn('❌ Browser-side generation failed for number:', config.number, browserError)
    browserGenerationAvailable = false

    // Only fall back to server if explicitly enabled
    if (config.enableServerFallback) {
      try {
        console.log('🔄 Falling back to server-side generation for number:', config.number)
        return await generateSVGOnServer(config)
      } catch (serverError) {
        console.error('❌ Both browser and server generation failed for number:', config.number)
        throw new Error(`SVG generation failed: ${serverError instanceof Error ? serverError.message : 'Unknown error'}`)
      }
    } else {
      console.error('❌ Browser-side generation failed and server fallback disabled for number:', config.number)
      throw new Error(`Browser-side SVG generation failed: ${browserError instanceof Error ? browserError.message : 'Unknown error'}. Enable server fallback or fix browser WASM loading.`)
    }
  }
}

async function generateSVGInBrowser(config: SorobanConfig): Promise<string> {
  // Load typst.ts renderer
  const $typst = await getTypstRenderer()

  // Get the template content
  const template = await getFlashcardsTemplate()

  // Create the complete Typst document
  const typstContent = await getTypstTemplate(config)

  console.log('🎨 Generating SVG in browser for number:', config.number)

  // Generate SVG using typst.ts in the browser
  const svg = await $typst.svg({ mainContent: typstContent })

  console.log('✅ Generated browser SVG, length:', svg.length)

  return svg
}

async function generateSVGOnServer(config: SorobanConfig): Promise<string> {
  // Fallback to server-side API generation
  const response = await fetch('/api/typst-svg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || 'Server SVG generation failed')
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Server SVG generation failed')
  }

  console.log('🔄 Generated SVG on server, length:', data.svg.length)
  return data.svg
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