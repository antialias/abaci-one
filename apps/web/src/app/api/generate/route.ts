import { SorobanGenerator } from '@soroban/core'
import { type NextRequest, NextResponse } from 'next/server'
import path from 'path'

// Global generator instance for better performance
let generator: SorobanGenerator | null = null

async function getGenerator() {
  if (!generator) {
    // Point to the core package in our monorepo
    const corePackagePath = path.join(process.cwd(), '../../packages/core')
    generator = new SorobanGenerator(corePackagePath)

    // Note: SorobanGenerator from @soroban/core doesn't have initialize method
    // It uses one-shot mode by default
  }
  return generator
}

export async function POST(request: NextRequest) {
  try {
    const config = await request.json()

    // Debug: log the received config
    console.log('📥 Received config:', JSON.stringify(config, null, 2))

    // Ensure range is set with a default
    if (!config.range) {
      console.log('⚠️ No range provided, using default: 0-99')
      config.range = '0-99'
    }

    // Get generator instance
    const gen = await getGenerator()

    // Check dependencies before generating
    const deps = await gen.checkDependencies?.()
    if (deps && (!deps.python || !deps.typst)) {
      return NextResponse.json(
        {
          error: 'Missing system dependencies',
          details: {
            python: deps.python ? '✅ Available' : '❌ Missing Python 3',
            typst: deps.typst ? '✅ Available' : '❌ Missing Typst',
            qpdf: deps.qpdf ? '✅ Available' : '⚠️ Missing qpdf (optional)',
          },
        },
        { status: 500 }
      )
    }

    // Generate flashcards using Python via TypeScript bindings
    console.log('🚀 Generating flashcards with config:', JSON.stringify(config, null, 2))
    const result = await gen.generate(config)

    // SorobanGenerator.generate() returns PDF data directly as Buffer
    if (!Buffer.isBuffer(result)) {
      throw new Error(`Expected PDF Buffer from generator, got: ${typeof result}`)
    }
    const pdfBuffer = result
    // Create filename for download
    const filename = `soroban-flashcards-${config.range || 'cards'}.pdf`

    // Return PDF directly as download
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('❌ Generation failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to generate flashcards',
        details: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 }
    )
  }
}

// Helper functions to calculate metadata
function _calculateCardCount(range: string, step: number): number {
  if (range.includes('-')) {
    const [start, end] = range.split('-').map((n) => parseInt(n, 10) || 0)
    return Math.floor((end - start + 1) / step)
  }

  if (range.includes(',')) {
    return range.split(',').length
  }

  return 1
}

function _generateNumbersFromRange(range: string, step: number): number[] {
  if (range.includes('-')) {
    const [start, end] = range.split('-').map((n) => parseInt(n, 10) || 0)
    const numbers: number[] = []
    for (let i = start; i <= end; i += step) {
      numbers.push(i)
      if (numbers.length >= 100) break // Limit to prevent huge arrays
    }
    return numbers
  }

  if (range.includes(',')) {
    return range.split(',').map((n) => parseInt(n.trim(), 10) || 0)
  }

  return [parseInt(range, 10) || 0]
}

// Health check endpoint
export async function GET() {
  try {
    const gen = await getGenerator()
    const deps = (await gen.checkDependencies?.()) || { python: true, typst: true, qpdf: true }

    return NextResponse.json({
      status: 'healthy',
      dependencies: deps,
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
