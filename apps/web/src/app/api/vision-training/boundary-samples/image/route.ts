import fs from 'fs'
import path from 'path'
import { withAuth } from '@/lib/auth/withAuth'

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
export const GET = withAuth(async (request) => {
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

    // Try PNG first, then JPG (passive captures from phone are JPEG)
    const pngPath = path.join(BOUNDARY_DETECTOR_DIR, deviceId, `${baseName}.png`)
    const jpgPath = path.join(BOUNDARY_DETECTOR_DIR, deviceId, `${baseName}.jpg`)

    let imagePath: string
    let contentType: string

    if (fs.existsSync(pngPath)) {
      imagePath = pngPath
      contentType = 'image/png'
    } else if (fs.existsSync(jpgPath)) {
      imagePath = jpgPath
      contentType = 'image/jpeg'
    } else {
      return new Response('Image not found', { status: 404 })
    }

    const imageBuffer = fs.readFileSync(imagePath)

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('[boundary-samples/image] Error:', error)
    return new Response('Failed to serve image', { status: 500 })
  }
}, { role: 'admin' })
