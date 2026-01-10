import type { QuadCorners } from '@/types/vision'

/** Channel name for cross-tab boundary sample notifications */
export const BOUNDARY_SAMPLE_CHANNEL = 'boundary-sample-saved'

export interface SaveBoundarySampleParams {
  /** Base64 image data (PNG or JPEG, without data URL prefix) */
  imageData: string
  /** Corner coordinates in pixel space */
  corners: QuadCorners
  /** Frame width in pixels */
  frameWidth: number
  /** Frame height in pixels */
  frameHeight: number
  /** Optional device ID for organizing captures */
  deviceId?: string
  /** Optional session ID (for passive captures during practice) */
  sessionId?: string
  /** Optional player ID (for passive captures during practice) */
  playerId?: string
}

export interface SaveBoundarySampleResult {
  success: boolean
  savedTo?: string
  error?: string
}

/**
 * Normalize corner coordinates from pixel space to 0-1 range
 */
export function normalizeCorners(corners: QuadCorners, width: number, height: number): QuadCorners {
  return {
    topLeft: {
      x: corners.topLeft.x / width,
      y: corners.topLeft.y / height,
    },
    topRight: {
      x: corners.topRight.x / width,
      y: corners.topRight.y / height,
    },
    bottomLeft: {
      x: corners.bottomLeft.x / width,
      y: corners.bottomLeft.y / height,
    },
    bottomRight: {
      x: corners.bottomRight.x / width,
      y: corners.bottomRight.y / height,
    },
  }
}

/**
 * Strip data URL prefix from base64 string if present
 */
export function stripDataUrlPrefix(data: string): string {
  if (data.startsWith('data:')) {
    const commaIndex = data.indexOf(',')
    if (commaIndex > 0) {
      return data.substring(commaIndex + 1)
    }
  }
  return data
}

/**
 * Save a boundary frame sample for training.
 *
 * This is the core function used by both:
 * - BoundaryDataCapture (explicit capture in vision training)
 * - Passive capture during practice sessions
 *
 * @param params - The sample data to save
 * @returns Promise with success/error status
 */
export async function saveBoundarySample(
  params: SaveBoundarySampleParams
): Promise<SaveBoundarySampleResult> {
  const { imageData, corners, frameWidth, frameHeight, deviceId, sessionId, playerId } = params

  // Normalize corners from pixel coordinates to 0-1 range
  const normalizedCorners = normalizeCorners(corners, frameWidth, frameHeight)

  // Validate normalized corners are in valid range
  const allCorners = [
    normalizedCorners.topLeft,
    normalizedCorners.topRight,
    normalizedCorners.bottomLeft,
    normalizedCorners.bottomRight,
  ]
  for (const corner of allCorners) {
    if (corner.x < 0 || corner.x > 1 || corner.y < 0 || corner.y > 1) {
      return {
        success: false,
        error: `Corner out of bounds: (${corner.x}, ${corner.y})`,
      }
    }
  }

  // Strip data URL prefix if present
  const cleanImageData = stripDataUrlPrefix(imageData)

  try {
    const response = await fetch('/api/vision-training/boundary-samples', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageData: cleanImageData,
        corners: normalizedCorners,
        frameWidth,
        frameHeight,
        deviceId,
        sessionId,
        playerId,
      }),
    })

    const result = await response.json()

    if (result.success) {
      // Broadcast to other tabs that a new sample was saved
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const channel = new BroadcastChannel(BOUNDARY_SAMPLE_CHANNEL)
          channel.postMessage({
            type: 'sample-saved',
            savedTo: result.savedTo,
            deviceId,
            sessionId,
            playerId,
            timestamp: Date.now(),
          })
          channel.close()
        } catch {
          // BroadcastChannel may not be available in some contexts
        }
      }
      return { success: true, savedTo: result.savedTo }
    } else {
      return { success: false, error: result.error || 'Failed to save' }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}
