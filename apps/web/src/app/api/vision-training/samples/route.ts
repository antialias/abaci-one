import fs from 'fs'
import path from 'path'

// Force dynamic rendering - this route reads from disk which changes at runtime
export const dynamic = 'force-dynamic'

const DATA_DIR = path.join(process.cwd(), 'data/vision-training/collected')

interface DigitSample {
  count: number
  samplePath: string | null
  // For background tiling - random selection of image paths
  tilePaths: string[]
}

interface SamplesResponse {
  digits: Record<number, DigitSample>
  totalImages: number
  hasData: boolean
  dataQuality: 'none' | 'insufficient' | 'minimal' | 'good' | 'excellent'
}

/**
 * GET /api/vision-training/samples
 *
 * Returns sample images and counts for each digit (0-9).
 * Used for the training preview UI.
 */
export async function GET(): Promise<Response> {
  const digits: Record<number, DigitSample> = {}
  let totalImages = 0

  // Initialize all digits
  for (let d = 0; d <= 9; d++) {
    digits[d] = { count: 0, samplePath: null, tilePaths: [] }
  }

  try {
    // Check if data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      return Response.json({
        digits,
        totalImages: 0,
        hasData: false,
        dataQuality: 'none',
      } satisfies SamplesResponse)
    }

    // Scan each digit directory
    for (let d = 0; d <= 9; d++) {
      const digitDir = path.join(DATA_DIR, String(d))

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
    let dataQuality: SamplesResponse['dataQuality'] = 'none'
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
      digits,
      totalImages,
      hasData: totalImages > 0,
      dataQuality,
    } satisfies SamplesResponse)
  } catch (error) {
    console.error('[vision-training/samples] Error:', error)
    return Response.json({ error: 'Failed to read training samples' }, { status: 500 })
  }
}
