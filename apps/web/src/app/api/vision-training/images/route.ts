import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

/**
 * Directory where collected training data is stored
 */
const TRAINING_DATA_DIR = path.join(process.cwd(), 'data', 'vision-training', 'collected')

/**
 * Parsed image metadata from filename
 */
export interface TrainingImageMeta {
  /** Full filename */
  filename: string
  /** Digit label (0-9) */
  digit: number
  /** Unix timestamp when collected */
  timestamp: number
  /** Player ID (first 8 chars) */
  playerId: string
  /** Session ID (first 8 chars) */
  sessionId: string
  /** Column index in the abacus */
  columnIndex: number
  /** URL to fetch the image */
  imageUrl: string
}

/**
 * Parse filename to extract metadata
 * Format: {timestamp}_{playerId}_{sessionId}_col{index}_{uuid}.png
 */
function parseFilename(filename: string, digit: number): TrainingImageMeta | null {
  const match = filename.match(/^(\d+)_([^_]+)_([^_]+)_col(\d+)_([^.]+)\.png$/)
  if (!match) return null

  const [, timestampStr, playerId, sessionId, colIndexStr] = match

  return {
    filename,
    digit,
    timestamp: parseInt(timestampStr, 10),
    playerId,
    sessionId,
    columnIndex: parseInt(colIndexStr, 10),
    imageUrl: `/api/vision-training/images/${digit}/${filename}`,
  }
}

/**
 * GET /api/vision-training/images
 *
 * Lists all collected training images with metadata.
 * Query params:
 *   - digit: Filter by digit (0-9)
 *   - playerId: Filter by player ID prefix
 *   - sessionId: Filter by session ID prefix
 */
export async function GET(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url)
    const filterDigit = url.searchParams.get('digit')
    const filterPlayerId = url.searchParams.get('playerId')
    const filterSessionId = url.searchParams.get('sessionId')

    const images: TrainingImageMeta[] = []

    // Check if directory exists
    try {
      await fs.access(TRAINING_DATA_DIR)
    } catch {
      return NextResponse.json({ images: [], total: 0 })
    }

    // Iterate through digit directories
    const digits =
      filterDigit !== null ? [filterDigit] : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

    for (const digit of digits) {
      const digitDir = path.join(TRAINING_DATA_DIR, digit)

      try {
        const files = await fs.readdir(digitDir)

        for (const filename of files) {
          if (!filename.endsWith('.png')) continue

          const meta = parseFilename(filename, parseInt(digit, 10))
          if (!meta) continue

          // Apply filters
          if (filterPlayerId && !meta.playerId.startsWith(filterPlayerId)) continue
          if (filterSessionId && !meta.sessionId.startsWith(filterSessionId)) continue

          images.push(meta)
        }
      } catch {
        // Directory doesn't exist or can't be read - skip
      }
    }

    // Sort by timestamp descending (newest first)
    images.sort((a, b) => b.timestamp - a.timestamp)

    return NextResponse.json({
      images,
      total: images.length,
    })
  } catch (error) {
    console.error('[vision-training] Error listing images:', error)
    return NextResponse.json({ error: 'Failed to list images' }, { status: 500 })
  }
}
