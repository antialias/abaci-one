import fs from 'fs/promises'
import path from 'path'

/**
 * Shared training data deletion utilities.
 *
 * All training data deletion should go through these functions to ensure
 * deletions are recorded in tombstone files (preventing re-sync from production).
 */

// Base paths for training data
const VISION_TRAINING_DIR = path.join(process.cwd(), 'data/vision-training')
const COLUMN_CLASSIFIER_DIR = path.join(VISION_TRAINING_DIR, 'collected')
const BOUNDARY_DETECTOR_DIR = path.join(VISION_TRAINING_DIR, 'boundary-frames')

// Tombstone file paths
const COLUMN_CLASSIFIER_TOMBSTONE = path.join(COLUMN_CLASSIFIER_DIR, '.deleted')
const BOUNDARY_DETECTOR_TOMBSTONE = path.join(BOUNDARY_DETECTOR_DIR, '.deleted')

export interface DeletionResult {
  success: boolean
  /** True if file was deleted (false if it didn't exist) */
  deleted: boolean
  /** True if deletion was recorded to tombstone */
  tombstoneRecorded: boolean
  /** Error message if something went wrong */
  error?: string
}

/**
 * Record a deletion to a tombstone file.
 *
 * The tombstone file is a simple newline-delimited list of relative paths.
 * These paths are excluded during rsync from production.
 *
 * @param tombstonePath - Path to the tombstone file
 * @param relativePath - Relative path of the deleted file (e.g., "3/filename.png")
 * @returns True if recorded successfully, false otherwise
 */
async function recordToTombstone(tombstonePath: string, relativePath: string): Promise<boolean> {
  try {
    // Ensure parent directory exists
    await fs.mkdir(path.dirname(tombstonePath), { recursive: true })
    // Append to tombstone file
    await fs.appendFile(tombstonePath, `${relativePath}\n`)
    return true
  } catch (error) {
    console.error('[trainingDataDeletion] Failed to record to tombstone:', error)
    return false
  }
}

/**
 * Delete a column classifier training sample.
 *
 * Deletes the PNG file and records the deletion to the tombstone file
 * to prevent re-syncing from production.
 *
 * @param digit - The digit label (0-9)
 * @param filename - The filename (e.g., "1234567890_player_session_col0_uuid.png")
 */
export async function deleteColumnClassifierSample(
  digit: number,
  filename: string
): Promise<DeletionResult> {
  // Validate inputs
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    return { success: false, deleted: false, tombstoneRecorded: false, error: 'Invalid digit' }
  }
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { success: false, deleted: false, tombstoneRecorded: false, error: 'Invalid filename' }
  }
  if (!filename.endsWith('.png')) {
    return {
      success: false,
      deleted: false,
      tombstoneRecorded: false,
      error: 'Filename must end with .png',
    }
  }

  const filePath = path.join(COLUMN_CLASSIFIER_DIR, String(digit), filename)
  const relativePath = `${digit}/${filename}`

  let deleted = false
  let tombstoneRecorded = false

  // Try to delete the file
  try {
    await fs.unlink(filePath)
    deleted = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist - that's fine, still record to tombstone
      // (in case it exists on production)
    } else {
      return {
        success: false,
        deleted: false,
        tombstoneRecorded: false,
        error: `Failed to delete file: ${(error as Error).message}`,
      }
    }
  }

  // Record to tombstone (even if file didn't exist locally - it might exist on production)
  tombstoneRecorded = await recordToTombstone(COLUMN_CLASSIFIER_TOMBSTONE, relativePath)

  return {
    success: true,
    deleted,
    tombstoneRecorded,
    error: tombstoneRecorded ? undefined : 'Warning: deletion not recorded to tombstone',
  }
}

/**
 * Delete a boundary detector training sample.
 *
 * Deletes the image file (PNG or JPG) and its JSON annotation,
 * and records the deletion to the tombstone file.
 *
 * @param deviceId - The device subdirectory (e.g., "default", "passive-practice-remote")
 * @param baseName - The base filename without extension (e.g., "1234567890_abc123")
 */
export async function deleteBoundaryDetectorSample(
  deviceId: string,
  baseName: string
): Promise<DeletionResult> {
  // Validate inputs
  if (!deviceId || deviceId.includes('..') || deviceId.includes('/') || deviceId.includes('\\')) {
    return { success: false, deleted: false, tombstoneRecorded: false, error: 'Invalid deviceId' }
  }
  if (!baseName || baseName.includes('..') || baseName.includes('/') || baseName.includes('\\')) {
    return { success: false, deleted: false, tombstoneRecorded: false, error: 'Invalid baseName' }
  }

  const deviceDir = path.join(BOUNDARY_DETECTOR_DIR, deviceId)
  const pngPath = path.join(deviceDir, `${baseName}.png`)
  const jpgPath = path.join(deviceDir, `${baseName}.jpg`)
  const jsonPath = path.join(deviceDir, `${baseName}.json`)

  let deleted = false
  let imageExtension: 'png' | 'jpg' | null = null

  // Try to delete PNG version
  try {
    await fs.unlink(pngPath)
    deleted = true
    imageExtension = 'png'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      return {
        success: false,
        deleted: false,
        tombstoneRecorded: false,
        error: `Failed to delete PNG: ${(error as Error).message}`,
      }
    }
  }

  // Try to delete JPG version
  try {
    await fs.unlink(jpgPath)
    deleted = true
    imageExtension = 'jpg'
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      return {
        success: false,
        deleted: false,
        tombstoneRecorded: false,
        error: `Failed to delete JPG: ${(error as Error).message}`,
      }
    }
  }

  // Try to delete JSON annotation
  try {
    await fs.unlink(jsonPath)
    deleted = true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      // Log but don't fail - the image is the primary file
      console.error('[trainingDataDeletion] Failed to delete JSON:', error)
    }
  }

  // Record to tombstone
  // We record both PNG and JPG patterns to be safe
  let tombstoneRecorded = false
  const pngRelativePath = `${deviceId}/${baseName}.png`
  const jpgRelativePath = `${deviceId}/${baseName}.jpg`

  // Record the actual extension if known, otherwise record both
  if (imageExtension === 'png') {
    tombstoneRecorded = await recordToTombstone(BOUNDARY_DETECTOR_TOMBSTONE, pngRelativePath)
  } else if (imageExtension === 'jpg') {
    tombstoneRecorded = await recordToTombstone(BOUNDARY_DETECTOR_TOMBSTONE, jpgRelativePath)
  } else {
    // Unknown extension - record both to be safe
    const pngRecorded = await recordToTombstone(BOUNDARY_DETECTOR_TOMBSTONE, pngRelativePath)
    const jpgRecorded = await recordToTombstone(BOUNDARY_DETECTOR_TOMBSTONE, jpgRelativePath)
    tombstoneRecorded = pngRecorded || jpgRecorded
  }

  return {
    success: true,
    deleted,
    tombstoneRecorded,
    error: tombstoneRecorded ? undefined : 'Warning: deletion not recorded to tombstone',
  }
}

/**
 * Read the list of deleted files from a tombstone.
 *
 * @param modelType - Which model's tombstone to read
 * @returns Set of relative paths that have been deleted
 */
export async function readTombstone(
  modelType: 'column-classifier' | 'boundary-detector'
): Promise<Set<string>> {
  const tombstonePath =
    modelType === 'column-classifier' ? COLUMN_CLASSIFIER_TOMBSTONE : BOUNDARY_DETECTOR_TOMBSTONE

  try {
    const content = await fs.readFile(tombstonePath, 'utf-8')
    const lines = content.split('\n').filter((line) => line.trim())
    return new Set(lines)
  } catch {
    // File doesn't exist yet - no deletions recorded
    return new Set()
  }
}
