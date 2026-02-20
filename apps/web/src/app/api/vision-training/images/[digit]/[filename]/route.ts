import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'
import { deleteColumnClassifierSample } from '@/lib/vision/trainingDataDeletion'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * Directory where collected training data is stored
 */
const TRAINING_DATA_DIR = path.join(process.cwd(), 'data', 'vision-training', 'collected')

/**
 * GET /api/vision-training/images/[digit]/[filename]
 *
 * Serves a training image file.
 */
export const GET = withAuth(async (_request, { params }) => {
  try {
    const { digit, filename } = (await params) as { digit: string; filename: string }

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
}, { role: 'admin' })

/**
 * PATCH /api/vision-training/images/[digit]/[filename]
 *
 * Reclassifies a training image by moving it to a different digit folder.
 * Body: { newDigit: number }
 */
export const PATCH = withAuth(async (request, { params }) => {
  try {
    const { digit, filename } = (await params) as { digit: string; filename: string }
    const body = await request.json()
    const { newDigit } = body

    // Validate current digit
    if (!/^[0-9]$/.test(digit)) {
      return NextResponse.json({ error: 'Invalid current digit' }, { status: 400 })
    }

    // Validate new digit
    if (
      typeof newDigit !== 'number' ||
      newDigit < 0 ||
      newDigit > 9 ||
      !Number.isInteger(newDigit)
    ) {
      return NextResponse.json({ error: 'Invalid new digit' }, { status: 400 })
    }

    // Validate filename (prevent path traversal)
    if (filename.includes('..') || filename.includes('/') || !filename.endsWith('.png')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    // No-op if same digit
    if (String(newDigit) === digit) {
      return NextResponse.json({
        success: true,
        reclassified: false,
        message: 'Same digit',
      })
    }

    const srcPath = path.join(TRAINING_DATA_DIR, digit, filename)
    const destDir = path.join(TRAINING_DATA_DIR, String(newDigit))
    const destPath = path.join(destDir, filename)

    // Ensure destination directory exists
    await fs.mkdir(destDir, { recursive: true })

    try {
      // Move the file
      await fs.rename(srcPath, destPath)
      return NextResponse.json({
        success: true,
        reclassified: true,
        oldDigit: parseInt(digit, 10),
        newDigit,
        filename,
        newImageUrl: `/api/vision-training/images/${newDigit}/${filename}`,
      })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 })
      }
      throw error
    }
  } catch (error) {
    console.error('[vision-training] Error reclassifying image:', error)
    return NextResponse.json({ error: 'Failed to reclassify image' }, { status: 500 })
  }
}, { role: 'admin' })

/**
 * DELETE /api/vision-training/images/[digit]/[filename]
 *
 * Deletes a training image file and records to tombstone.
 */
export const DELETE = withAuth(async (_request, { params }) => {
  try {
    const { digit, filename } = (await params) as { digit: string; filename: string }

    // Validate digit format (detailed validation in shared function)
    if (!/^[0-9]$/.test(digit)) {
      return NextResponse.json({ error: 'Invalid digit' }, { status: 400 })
    }

    const result = await deleteColumnClassifierSample(parseInt(digit, 10), filename)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    if (!result.deleted) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      deleted: filename,
      tombstoneRecorded: result.tombstoneRecorded,
      warning: result.tombstoneRecorded ? undefined : result.error,
    })
  } catch (error) {
    console.error('[vision-training] Error deleting image:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}, { role: 'admin' })
