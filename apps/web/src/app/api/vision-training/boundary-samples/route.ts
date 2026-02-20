import fs from 'fs'
import path from 'path'
import type { QuadCorners } from '@/types/vision'
import { deleteBoundaryDetectorSample } from '@/lib/vision/trainingDataDeletion'
import { withAuth } from '@/lib/auth/withAuth'

// Force dynamic rendering - this route writes to disk
export const dynamic = 'force-dynamic'

// Data directory for boundary detector training samples
const BOUNDARY_DETECTOR_DIR = path.join(process.cwd(), 'data/vision-training/boundary-frames')

interface BoundarySampleRequest {
  /** Base64 image data - PNG or JPEG (without data URL prefix) */
  imageData: string
  /** Normalized corner coordinates (0-1 range) */
  corners: QuadCorners
  /** Original frame width in pixels */
  frameWidth: number
  /** Original frame height in pixels */
  frameHeight: number
  /** Optional device identifier */
  deviceId?: string
  /** Optional practice session ID (for passive captures) */
  sessionId?: string
  /** Optional player/student ID (for passive captures) */
  playerId?: string
}

/**
 * Detect image format from base64 data
 * Returns 'png', 'jpeg', or 'unknown'
 */
function detectImageFormat(base64Data: string): 'png' | 'jpeg' | 'unknown' {
  // PNG magic bytes: 89 50 4E 47 (iVBORw0KGgo in base64)
  if (base64Data.startsWith('iVBORw0KGgo')) {
    return 'png'
  }
  // JPEG magic bytes: FF D8 FF (/9j/ in base64)
  if (base64Data.startsWith('/9j/')) {
    return 'jpeg'
  }
  return 'unknown'
}

/**
 * POST /api/vision-training/boundary-samples
 *
 * Save a frame with its marker corner annotations for boundary detector training.
 *
 * Expected body:
 * - imageData: Base64 PNG image (raw frame before perspective correction)
 * - corners: QuadCorners with normalized (0-1) coordinates
 * - frameWidth: Original frame width
 * - frameHeight: Original frame height
 * - deviceId: Optional identifier for the capture device
 */
export const POST = withAuth(
  async (request) => {
    try {
      const body: BoundarySampleRequest = await request.json()

      const { imageData, corners, frameWidth, frameHeight } = body

      // Validate required fields
      if (!imageData) {
        return Response.json({ success: false, error: 'Missing imageData' }, { status: 400 })
      }
      if (
        !corners?.topLeft ||
        !corners?.topRight ||
        !corners?.bottomLeft ||
        !corners?.bottomRight
      ) {
        return Response.json(
          { success: false, error: 'Missing or invalid corners' },
          { status: 400 }
        )
      }
      if (!frameWidth || !frameHeight) {
        return Response.json({ success: false, error: 'Missing frame dimensions' }, { status: 400 })
      }

      // Validate corner coordinates are in valid range
      const validateCorner = (p: { x: number; y: number }, name: string): string | null => {
        if (typeof p.x !== 'number' || typeof p.y !== 'number') {
          return `${name} must have numeric x and y`
        }
        if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
          return `${name} coordinates must be normalized (0-1 range)`
        }
        return null
      }

      for (const [name, corner] of Object.entries(corners)) {
        const error = validateCorner(corner as { x: number; y: number }, name)
        if (error) {
          return Response.json({ success: false, error }, { status: 400 })
        }
      }

      // Use device ID or "default" for directory organization
      const deviceId = body.deviceId || 'default'
      const deviceDir = path.join(BOUNDARY_DETECTOR_DIR, deviceId)

      // Ensure directory exists
      fs.mkdirSync(deviceDir, { recursive: true })

      // Detect image format and determine file extension
      const format = detectImageFormat(imageData)
      const extension = format === 'jpeg' ? 'jpg' : 'png' // Default to png for unknown

      // Generate unique filename with timestamp
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const baseName = `${timestamp}_${randomSuffix}`

      const imagePath = path.join(deviceDir, `${baseName}.${extension}`)
      const annotationPath = path.join(deviceDir, `${baseName}.json`)

      // Save the image
      const imageBuffer = Buffer.from(imageData, 'base64')
      fs.writeFileSync(imagePath, imageBuffer)

      // Save the annotation JSON
      const annotation = {
        corners,
        frameWidth,
        frameHeight,
        capturedAt: new Date().toISOString(),
        deviceId,
        sessionId: body.sessionId || null,
        playerId: body.playerId || null,
      }
      fs.writeFileSync(annotationPath, JSON.stringify(annotation, null, 2))

      return Response.json({
        success: true,
        savedTo: baseName,
      })
    } catch (error) {
      console.error('[boundary-samples] Error:', error)
      return Response.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save sample',
        },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)

interface BoundaryFrame {
  baseName: string
  deviceId: string
  imagePath: string
  capturedAt: string
  corners: QuadCorners
  frameWidth: number
  frameHeight: number
  sessionId: string | null
  playerId: string | null
}

/**
 * GET /api/vision-training/boundary-samples
 *
 * Get statistics about collected boundary samples.
 * Add ?list=true to get full list of frames with metadata.
 */
export const GET = withAuth(
  async (request) => {
    try {
      const searchParams = request.nextUrl.searchParams
      const listFrames = searchParams.get('list') === 'true'

      if (!fs.existsSync(BOUNDARY_DETECTOR_DIR)) {
        return Response.json({
          totalFrames: 0,
          deviceCount: 0,
          devices: [],
          frames: listFrames ? [] : undefined,
        })
      }

      const entries = fs.readdirSync(BOUNDARY_DETECTOR_DIR, {
        withFileTypes: true,
      })
      const devices: { id: string; frameCount: number }[] = []
      const frames: BoundaryFrame[] = []
      let totalFrames = 0

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const deviceId = entry.name
          const deviceDir = path.join(BOUNDARY_DETECTOR_DIR, deviceId)
          const files = fs
            .readdirSync(deviceDir)
            .filter((f) => f.endsWith('.png') || f.endsWith('.jpg'))
          const frameCount = files.length
          totalFrames += frameCount
          devices.push({ id: deviceId, frameCount })

          // If listing, load each frame's metadata
          if (listFrames) {
            for (const file of files) {
              const baseName = file.replace(/\.(png|jpg)$/, '')
              const annotationPath = path.join(deviceDir, `${baseName}.json`)

              let annotation = {
                corners: {
                  topLeft: { x: 0, y: 0 },
                  topRight: { x: 1, y: 0 },
                  bottomLeft: { x: 0, y: 1 },
                  bottomRight: { x: 1, y: 1 },
                },
                frameWidth: 0,
                frameHeight: 0,
                capturedAt: '',
                sessionId: null as string | null,
                playerId: null as string | null,
              }

              if (fs.existsSync(annotationPath)) {
                try {
                  annotation = JSON.parse(fs.readFileSync(annotationPath, 'utf-8'))
                } catch {
                  // Use defaults if JSON parse fails
                }
              }

              frames.push({
                baseName,
                deviceId,
                imagePath: `/api/vision-training/boundary-samples/image?deviceId=${deviceId}&baseName=${baseName}`,
                capturedAt: annotation.capturedAt || '',
                corners: annotation.corners,
                frameWidth: annotation.frameWidth,
                frameHeight: annotation.frameHeight,
                sessionId: annotation.sessionId || null,
                playerId: annotation.playerId || null,
              })
            }
          }
        } else if (entry.name.endsWith('.png')) {
          // Direct files in the root directory (legacy)
          totalFrames++
        }
      }

      // Sort frames by capturedAt descending (newest first)
      if (listFrames) {
        frames.sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || ''))
      }

      return Response.json({
        totalFrames,
        deviceCount: devices.length || (totalFrames > 0 ? 1 : 0),
        devices,
        frames: listFrames ? frames : undefined,
      })
    } catch (error) {
      console.error('[boundary-samples] GET Error:', error)
      return Response.json({ error: 'Failed to read boundary samples' }, { status: 500 })
    }
  },
  { role: 'admin' }
)

/**
 * DELETE /api/vision-training/boundary-samples
 *
 * Delete a specific boundary sample and record to tombstone.
 *
 * Query params:
 * - deviceId: Device directory (default: "default")
 * - baseName: Base filename (without extension)
 */
export const DELETE = withAuth(
  async (request) => {
    try {
      const searchParams = request.nextUrl.searchParams
      const deviceId = searchParams.get('deviceId') || 'default'
      const baseName = searchParams.get('baseName')

      if (!baseName) {
        return Response.json({ success: false, error: 'Missing baseName' }, { status: 400 })
      }

      const result = await deleteBoundaryDetectorSample(deviceId, baseName)

      if (!result.success) {
        return Response.json({ success: false, error: result.error }, { status: 400 })
      }

      if (!result.deleted) {
        return Response.json({ success: false, error: 'Sample not found' }, { status: 404 })
      }

      return Response.json({
        success: true,
        tombstoneRecorded: result.tombstoneRecorded,
        warning: result.tombstoneRecorded ? undefined : result.error,
      })
    } catch (error) {
      console.error('[boundary-samples] DELETE Error:', error)
      return Response.json({ success: false, error: 'Failed to delete sample' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
