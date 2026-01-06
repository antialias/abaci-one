import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

/**
 * Directory where collected training data is stored
 */
const TRAINING_DATA_DIR = path.join(process.cwd(), 'data', 'vision-training', 'collected')

interface RouteParams {
  params: Promise<{
    digit: string
    filename: string
  }>
}

/**
 * GET /api/vision-training/images/[digit]/[filename]
 *
 * Serves a training image file.
 */
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  try {
    const { digit, filename } = await params

    // Validate digit
    if (!/^[0-9]$/.test(digit)) {
      return NextResponse.json({ error: 'Invalid digit' }, { status: 400 })
    }

    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.png')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const filePath = path.join(TRAINING_DATA_DIR, digit, filename)

    try {
      const data = await fs.readFile(filePath)
      return new NextResponse(new Uint8Array(data), {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    } catch {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('[vision-training] Error serving image:', error)
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 })
  }
}
