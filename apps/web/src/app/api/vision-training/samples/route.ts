import fs from 'fs'
import path from 'path'
import type { NextRequest } from 'next/server'

// Force dynamic rendering - this route reads from disk which changes at runtime
export const dynamic = 'force-dynamic'

// Data directories for each model type
const COLUMN_CLASSIFIER_DIR = path.join(process.cwd(), 'data/vision-training/collected')
const BOUNDARY_DETECTOR_DIR = path.join(process.cwd(), 'data/vision-training/boundary-frames')

type DataQuality = 'none' | 'insufficient' | 'minimal' | 'good' | 'excellent'

interface DigitSample {
  count: number
  samplePath: string | null
  // For background tiling - random selection of image paths
  tilePaths: string[]
}

// Column classifier response (digit images)
interface ColumnClassifierSamplesResponse {
  type: 'column-classifier'
  digits: Record<number, DigitSample>
  totalImages: number
  hasData: boolean
  dataQuality: DataQuality
}

// Boundary detector response (full frame images)
interface BoundaryDetectorSamplesResponse {
  type: 'boundary-detector'
  totalFrames: number
  hasData: boolean
  dataQuality: DataQuality
  deviceCount: number
  samplePaths: string[]
}

type SamplesResponse = ColumnClassifierSamplesResponse | BoundaryDetectorSamplesResponse

/**
 * GET /api/vision-training/samples?type=column-classifier|boundary-detector
 *
 * Returns sample data for the specified model type.
 * - column-classifier: Returns digit images (0-9) with counts
 * - boundary-detector: Returns frame images with corner annotations
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams
  const modelType = searchParams.get('type') || 'column-classifier'

  try {
    if (modelType === 'boundary-detector') {
      return getBoundaryDetectorSamples()
    }
    return getColumnClassifierSamples()
  } catch (error) {
    console.error('[vision-training/samples] Error:', error)
    return Response.json({ error: 'Failed to read training samples' }, { status: 500 })
  }
}

/**
 * Get column classifier samples (digit images)
 */
function getColumnClassifierSamples(): Response {
  const digits: Record<number, DigitSample> = {}
  let totalImages = 0

  // Initialize all digits
  for (let d = 0; d <= 9; d++) {
    digits[d] = { count: 0, samplePath: null, tilePaths: [] }
  }

  // Check if data directory exists
  if (!fs.existsSync(COLUMN_CLASSIFIER_DIR)) {
    return Response.json({
      type: 'column-classifier',
      digits,
      totalImages: 0,
      hasData: false,
      dataQuality: 'none',
    } satisfies ColumnClassifierSamplesResponse)
  }

  // Scan each digit directory
  for (let d = 0; d <= 9; d++) {
    const digitDir = path.join(COLUMN_CLASSIFIER_DIR, String(d))

    if (!fs.existsSync(digitDir)) {
      continue
    }

    const files = fs
      .readdirSync(digitDir)
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort() // Consistent ordering

    const count = files.length
    totalImages += count

    if (count > 0) {
      // Pick a representative sample (middle of the list for variety)
      const sampleIndex = Math.floor(count / 2)
      const sampleFile = files[sampleIndex]

      // Pick random files for background tiling (up to 5 per digit)
      const tileCount = Math.min(5, count)
      const tileIndices = new Set<number>()
      while (tileIndices.size < tileCount) {
        tileIndices.add(Math.floor(Math.random() * count))
      }
      const tilePaths = Array.from(tileIndices).map(
        (i) => `/api/vision-training/images/${d}/${files[i]}`
      )

      digits[d] = {
        count,
        samplePath: `/api/vision-training/images/${d}/${sampleFile}`,
        tilePaths,
      }
    }
  }

  // Determine data quality based on total and distribution
  let dataQuality: DataQuality = 'none'
  const digitCounts = Object.values(digits).map((d) => d.count)
  const minCount = Math.min(...digitCounts)
  const avgCount = totalImages / 10

  if (totalImages === 0) {
    dataQuality = 'none'
  } else if (totalImages < 50 || minCount < 3) {
    dataQuality = 'insufficient'
  } else if (totalImages < 200 || minCount < 10) {
    dataQuality = 'minimal'
  } else if (totalImages < 500 || avgCount < 40) {
    dataQuality = 'good'
  } else {
    dataQuality = 'excellent'
  }

  return Response.json({
    type: 'column-classifier',
    digits,
    totalImages,
    hasData: totalImages > 0,
    dataQuality,
  } satisfies ColumnClassifierSamplesResponse)
}

/**
 * Get boundary detector samples (frame images with corners)
 */
function getBoundaryDetectorSamples(): Response {
  let totalFrames = 0
  let deviceCount = 0
  const samplePaths: string[] = []

  // Check if data directory exists
  if (!fs.existsSync(BOUNDARY_DETECTOR_DIR)) {
    return Response.json({
      type: 'boundary-detector',
      totalFrames: 0,
      hasData: false,
      dataQuality: 'none',
      deviceCount: 0,
      samplePaths: [],
    } satisfies BoundaryDetectorSamplesResponse)
  }

  // Scan the boundary frames directory
  // Expected structure: boundary-frames/{device-id}/{frame-timestamp}.png
  // Each frame should have a corresponding .json file with corner annotations
  const entries = fs.readdirSync(BOUNDARY_DETECTOR_DIR, {
    withFileTypes: true,
  })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Device subdirectory
      deviceCount++
      const deviceDir = path.join(BOUNDARY_DETECTOR_DIR, entry.name)
      const files = fs.readdirSync(deviceDir).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))

      totalFrames += files.length

      // Pick a sample image from this device
      if (files.length > 0 && samplePaths.length < 5) {
        const sampleFile = files[Math.floor(files.length / 2)]
        samplePaths.push(`/api/vision-training/boundary-images/${entry.name}/${sampleFile}`)
      }
    } else if (/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
      // Direct file in boundary-frames directory (no device subdirectory)
      totalFrames++
      if (samplePaths.length < 5) {
        samplePaths.push(`/api/vision-training/boundary-images/${entry.name}`)
      }
    }
  }

  // Determine data quality
  let dataQuality: DataQuality = 'none'
  if (totalFrames === 0) {
    dataQuality = 'none'
  } else if (totalFrames < 50) {
    dataQuality = 'insufficient'
  } else if (totalFrames < 200) {
    dataQuality = 'minimal'
  } else if (totalFrames < 500) {
    dataQuality = 'good'
  } else {
    dataQuality = 'excellent'
  }

  return Response.json({
    type: 'boundary-detector',
    totalFrames,
    hasData: totalFrames > 0,
    dataQuality,
    deviceCount,
    samplePaths,
  } satisfies BoundaryDetectorSamplesResponse)
}
