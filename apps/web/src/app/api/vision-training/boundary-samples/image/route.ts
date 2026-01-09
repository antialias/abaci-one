import fs from 'fs'
import path from 'path'
import type { NextRequest } from 'next/server'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

const BOUNDARY_DETECTOR_DIR = path.join(process.cwd(), 'data/vision-training/boundary-frames')

/**
 * GET /api/vision-training/boundary-samples/image
 *
 * Serve a boundary sample image.
 *
 * Query params:
 * - deviceId: Device directory (default: "default")
 * - baseName: Base filename (without extension)
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams
    const deviceId = searchParams.get('deviceId') || 'default'
    const baseName = searchParams.get('baseName')

    if (!baseName) {
      return new Response('Missing baseName', { status: 400 })
    }

    // Validate baseName to prevent path traversal
    if (baseName.includes('/') || baseName.includes('\\') || baseName.includes('..')) {
      return new Response('Invalid baseName', { status: 400 })
    }

    // Validate deviceId to prevent path traversal
    if (deviceId.includes('/') || deviceId.includes('\\') || deviceId.includes('..')) {
      return new Response('Invalid deviceId', { status: 400 })
    }

    const imagePath = path.join(BOUNDARY_DETECTOR_DIR, deviceId, `${baseName}.png`)

    if (!fs.existsSync(imagePath)) {
      return new Response('Image not found', { status: 404 })
    }

    const imageBuffer = fs.readFileSync(imagePath)

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[boundary-samples/image] Error:', error)
    return new Response('Failed to serve image', { status: 500 })
  }
}
