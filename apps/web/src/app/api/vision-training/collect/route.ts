import fs from 'fs/promises'
import path from 'path'
import { type NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import type { TrainingDataRequest } from '@/lib/vision/trainingData'
import { valueToDigitLabels } from '@/lib/vision/trainingData'
import { withAuth } from '@/lib/auth/withAuth'

/**
 * Directory where collected training data is stored
 * Format: data/vision-training/collected/{digit}/{uuid}.png
 */
const TRAINING_DATA_DIR = path.join(process.cwd(), 'data', 'vision-training', 'collected')

/**
 * POST /api/vision-training/collect
 *
 * Saves column images for training the column classifier model.
 * Images are organized by digit (0-9) in subdirectories.
 */
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body: TrainingDataRequest = await request.json()
    const { columns, correctAnswer, playerId, sessionId } = body

    // Validate input
    if (!columns || columns.length === 0) {
      return NextResponse.json(
        { success: false, savedCount: 0, error: 'No columns provided' },
        { status: 400 }
      )
    }

    if (correctAnswer < 0) {
      return NextResponse.json(
        { success: false, savedCount: 0, error: 'Invalid correct answer' },
        { status: 400 }
      )
    }

    // Convert the correct answer to digit labels for each column
    const digitLabels = valueToDigitLabels(correctAnswer, columns.length)

    // Ensure all digit directories exist
    const digitDirs = new Set(digitLabels.map((d) => d.toString()))
    await Promise.all(
      Array.from(digitDirs).map(async (digit) => {
        const dir = path.join(TRAINING_DATA_DIR, digit)
        await fs.mkdir(dir, { recursive: true })
      })
    )

    // Save each column image
    let savedCount = 0
    const timestamp = Date.now()

    for (let i = 0; i < columns.length; i++) {
      const column = columns[i]
      const digit = digitLabels[i]

      // Skip if imageData is missing
      if (!column.imageData) {
        console.warn(`[vision-training] Column ${i} missing imageData, skipping`)
        continue
      }

      // Generate unique filename with metadata
      // Format: {timestamp}_{playerId}_{sessionId}_{columnIndex}_{uuid}.png
      const filename = `${timestamp}_${playerId.slice(0, 8)}_${sessionId.slice(0, 8)}_col${i}_${randomUUID().slice(0, 8)}.png`
      const filepath = path.join(TRAINING_DATA_DIR, digit.toString(), filename)

      // Decode base64 and save as PNG
      try {
        const buffer = Buffer.from(column.imageData, 'base64')
        await fs.writeFile(filepath, buffer)
        savedCount++
      } catch (writeError) {
        console.error(`[vision-training] Failed to write column ${i}:`, writeError)
      }
    }

    console.log(
      `[vision-training] Saved ${savedCount}/${columns.length} columns for answer ${correctAnswer} (player: ${playerId.slice(0, 8)}, session: ${sessionId.slice(0, 8)})`
    )

    return NextResponse.json({ success: true, savedCount })
  } catch (error) {
    console.error('[vision-training] Error saving training data:', error)
    return NextResponse.json(
      { success: false, savedCount: 0, error: 'Failed to save training data' },
      { status: 500 }
    )
  }
}, { role: 'admin' })
