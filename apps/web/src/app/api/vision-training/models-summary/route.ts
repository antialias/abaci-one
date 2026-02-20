import fs from 'fs'
import path from 'path'
import { withAuth } from '@/lib/auth/withAuth'

// Force dynamic rendering - this route reads from disk which changes at runtime
export const dynamic = 'force-dynamic'

// Data directories for each model type
const COLUMN_CLASSIFIER_DIR = path.join(process.cwd(), 'data/vision-training/collected')
const BOUNDARY_DETECTOR_DIR = path.join(process.cwd(), 'data/vision-training/boundary-frames')

type DataQuality = 'none' | 'insufficient' | 'minimal' | 'good' | 'excellent'

interface ModelSummary {
  totalImages?: number
  totalFrames?: number
  hasData: boolean
  dataQuality: DataQuality
}

interface ModelsSummaryResponse {
  columnClassifier: ModelSummary & { totalImages: number }
  boundaryDetector: ModelSummary & { totalFrames: number }
}

/**
 * Calculate data quality based on count and minimum requirements
 */
function calculateColumnClassifierQuality(totalImages: number, digitCounts: number[]): DataQuality {
  if (totalImages === 0) return 'none'

  const minCount = Math.min(...digitCounts)
  const avgCount = totalImages / 10

  if (totalImages < 50 || minCount < 3) return 'insufficient'
  if (totalImages < 200 || minCount < 10) return 'minimal'
  if (totalImages < 500 || avgCount < 40) return 'good'
  return 'excellent'
}

function calculateBoundaryDetectorQuality(totalFrames: number): DataQuality {
  if (totalFrames === 0) return 'none'
  if (totalFrames < 50) return 'insufficient'
  if (totalFrames < 200) return 'minimal'
  if (totalFrames < 500) return 'good'
  return 'excellent'
}

/**
 * GET /api/vision-training/models-summary
 *
 * Returns a summary of available training data for all model types.
 * Used by the model selection card in the training wizard.
 */
export const GET = withAuth(
  async () => {
    try {
      // --- Column Classifier Summary ---
      let columnTotalImages = 0
      const digitCounts: number[] = []

      if (fs.existsSync(COLUMN_CLASSIFIER_DIR)) {
        for (let d = 0; d <= 9; d++) {
          const digitDir = path.join(COLUMN_CLASSIFIER_DIR, String(d))
          let count = 0

          if (fs.existsSync(digitDir)) {
            const files = fs.readdirSync(digitDir).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
            count = files.length
          }

          digitCounts.push(count)
          columnTotalImages += count
        }
      } else {
        // Initialize with zeros for all digits
        for (let i = 0; i < 10; i++) {
          digitCounts.push(0)
        }
      }

      const columnClassifier: ModelsSummaryResponse['columnClassifier'] = {
        totalImages: columnTotalImages,
        hasData: columnTotalImages > 0,
        dataQuality: calculateColumnClassifierQuality(columnTotalImages, digitCounts),
      }

      // --- Boundary Detector Summary ---
      let boundaryTotalFrames = 0

      if (fs.existsSync(BOUNDARY_DETECTOR_DIR)) {
        // Count all frame images (organized by device subdirectories)
        const entries = fs.readdirSync(BOUNDARY_DETECTOR_DIR, {
          withFileTypes: true,
        })

        for (const entry of entries) {
          if (entry.isDirectory()) {
            // Device subdirectory
            const deviceDir = path.join(BOUNDARY_DETECTOR_DIR, entry.name)
            const files = fs.readdirSync(deviceDir).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
            boundaryTotalFrames += files.length
          } else if (/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
            // Direct file in boundary-frames directory
            boundaryTotalFrames++
          }
        }
      }

      const boundaryDetector: ModelsSummaryResponse['boundaryDetector'] = {
        totalFrames: boundaryTotalFrames,
        hasData: boundaryTotalFrames > 0,
        dataQuality: calculateBoundaryDetectorQuality(boundaryTotalFrames),
      }

      return Response.json({
        columnClassifier,
        boundaryDetector,
      } satisfies ModelsSummaryResponse)
    } catch (error) {
      console.error('[vision-training/models-summary] Error:', error)
      return Response.json({ error: 'Failed to read model summaries' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
