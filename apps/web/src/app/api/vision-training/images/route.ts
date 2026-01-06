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
 * Filter criteria for bulk operations
 */
interface FilterCriteria {
  digit?: string
  playerId?: string
  sessionId?: string
  beforeTimestamp?: number
  afterTimestamp?: number
}

/**
 * Apply filters and collect matching images
 */
async function collectMatchingImages(filters: FilterCriteria): Promise<TrainingImageMeta[]> {
  const images: TrainingImageMeta[] = []

  // Check if directory exists
  try {
    await fs.access(TRAINING_DATA_DIR)
  } catch {
    return []
  }

  // Iterate through digit directories
  const digits =
    filters.digit !== undefined
      ? [filters.digit]
      : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

  for (const digit of digits) {
    const digitDir = path.join(TRAINING_DATA_DIR, digit)

    try {
      const files = await fs.readdir(digitDir)

      for (const filename of files) {
        if (!filename.endsWith('.png')) continue

        const meta = parseFilename(filename, parseInt(digit, 10))
        if (!meta) continue

        // Apply filters
        if (filters.playerId && !meta.playerId.startsWith(filters.playerId)) continue
        if (filters.sessionId && !meta.sessionId.startsWith(filters.sessionId)) continue
        if (filters.beforeTimestamp && meta.timestamp >= filters.beforeTimestamp) continue
        if (filters.afterTimestamp && meta.timestamp <= filters.afterTimestamp) continue

        images.push(meta)
      }
    } catch {
      // Directory doesn't exist or can't be read - skip
    }
  }

  return images
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
    const filters: FilterCriteria = {
      digit: url.searchParams.get('digit') ?? undefined,
      playerId: url.searchParams.get('playerId') ?? undefined,
      sessionId: url.searchParams.get('sessionId') ?? undefined,
    }

    const images = await collectMatchingImages(filters)

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

/**
 * DELETE /api/vision-training/images
 *
 * Bulk delete training images matching filter criteria.
 * Body (JSON):
 *   - digit: Filter by digit (0-9)
 *   - playerId: Filter by player ID prefix
 *   - sessionId: Filter by session ID prefix
 *   - beforeTimestamp: Delete images before this timestamp (exclusive)
 *   - afterTimestamp: Delete images after this timestamp (exclusive)
 *   - filenames: Optional array of specific filenames to delete (with digit)
 *   - confirm: Must be true to actually delete (safety check)
 *
 * If no filters are provided and confirm is true, deletes ALL images.
 */
export async function DELETE(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()

    const {
      digit,
      playerId,
      sessionId,
      beforeTimestamp,
      afterTimestamp,
      filenames,
      confirm,
    }: {
      digit?: string
      playerId?: string
      sessionId?: string
      beforeTimestamp?: number
      afterTimestamp?: number
      filenames?: { digit: number; filename: string }[]
      confirm?: boolean
    } = body

    // If specific filenames provided, delete those
    if (filenames && filenames.length > 0) {
      if (!confirm) {
        return NextResponse.json({
          preview: true,
          count: filenames.length,
          message: `Would delete ${filenames.length} specified images. Set confirm=true to proceed.`,
        })
      }

      let deleted = 0
      const errors: string[] = []

      for (const { digit: d, filename } of filenames) {
        // Validate
        if (!/^[0-9]$/.test(String(d))) {
          errors.push(`Invalid digit for ${filename}`)
          continue
        }
        if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.png')) {
          errors.push(`Invalid filename: ${filename}`)
          continue
        }

        const filePath = path.join(TRAINING_DATA_DIR, String(d), filename)
        try {
          await fs.unlink(filePath)
          deleted++
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            errors.push(`Failed to delete ${filename}: ${(error as Error).message}`)
          }
        }
      }

      return NextResponse.json({
        success: true,
        deleted,
        errors: errors.length > 0 ? errors : undefined,
      })
    }

    // Build filter criteria
    const filters: FilterCriteria = {
      digit,
      playerId,
      sessionId,
      beforeTimestamp,
      afterTimestamp,
    }

    // Collect matching images
    const images = await collectMatchingImages(filters)

    // If no confirm, return preview
    if (!confirm) {
      return NextResponse.json({
        preview: true,
        count: images.length,
        message: `Would delete ${images.length} images matching filters. Set confirm=true to proceed.`,
        filters,
      })
    }

    // Actually delete
    let deleted = 0
    const errors: string[] = []

    for (const img of images) {
      const filePath = path.join(TRAINING_DATA_DIR, String(img.digit), img.filename)
      try {
        await fs.unlink(filePath)
        deleted++
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          errors.push(`Failed to delete ${img.filename}: ${(error as Error).message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[vision-training] Error deleting images:', error)
    return NextResponse.json({ error: 'Failed to delete images' }, { status: 500 })
  }
}

/**
 * PATCH /api/vision-training/images
 *
 * Bulk reclassify training images.
 * Body (JSON):
 *   - images: Array of { digit: number, filename: string } to reclassify
 *   - newDigit: Target digit (0-9)
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json()

    const {
      images,
      newDigit,
    }: {
      images: { digit: number; filename: string }[]
      newDigit: number
    } = body

    // Validate newDigit
    if (
      typeof newDigit !== 'number' ||
      newDigit < 0 ||
      newDigit > 9 ||
      !Number.isInteger(newDigit)
    ) {
      return NextResponse.json({ error: 'Invalid new digit' }, { status: 400 })
    }

    // Validate images array
    if (!Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'No images provided' }, { status: 400 })
    }

    // Ensure destination directory exists
    const destDir = path.join(TRAINING_DATA_DIR, String(newDigit))
    await fs.mkdir(destDir, { recursive: true })

    let reclassified = 0
    let skipped = 0
    const errors: string[] = []

    for (const { digit, filename } of images) {
      // Validate digit
      if (typeof digit !== 'number' || digit < 0 || digit > 9 || !Number.isInteger(digit)) {
        errors.push(`Invalid digit for ${filename}`)
        continue
      }

      // Validate filename
      if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.png')) {
        errors.push(`Invalid filename: ${filename}`)
        continue
      }

      // Skip if same digit
      if (digit === newDigit) {
        skipped++
        continue
      }

      const srcPath = path.join(TRAINING_DATA_DIR, String(digit), filename)
      const destPath = path.join(destDir, filename)

      try {
        await fs.rename(srcPath, destPath)
        reclassified++
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          errors.push(`Image not found: ${filename}`)
        } else {
          errors.push(`Failed to reclassify ${filename}: ${(error as Error).message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      reclassified,
      skipped,
      newDigit,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('[vision-training] Error reclassifying images:', error)
    return NextResponse.json({ error: 'Failed to reclassify images' }, { status: 500 })
  }
}
