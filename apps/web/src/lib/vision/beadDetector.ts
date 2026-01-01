/**
 * Traditional CV-based bead detection for abacus columns
 *
 * Uses edge detection and contour analysis instead of ML.
 * Works by detecting the reckoning bar and analyzing bead positions
 * relative to it.
 */

export interface BeadAnalysis {
  /** Detected digit value (0-9) */
  digit: number
  /** Confidence based on detection clarity */
  confidence: number
  /** Position of reckoning bar (0-1, relative to column height) */
  reckoningBarPosition: number
  /** Number of beads detected above bar */
  heavenBeadsDetected: number
  /** Whether heaven bead is active (touching bar) */
  heavenActive: boolean
  /** Number of beads detected below bar */
  earthBeadsDetected: number
  /** Number of active earth beads (touching bar) */
  earthActiveCount: number
}

/**
 * Analyze a single column image to detect bead positions
 *
 * @param imageData - Grayscale image data of a single column
 * @returns Analysis result with detected digit
 */
export function analyzeColumn(imageData: ImageData): BeadAnalysis {
  const { width, height, data } = imageData

  // Step 1: Create vertical intensity profile (average each row)
  const rowIntensities = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      sum += data[idx] // Use red channel (grayscale)
    }
    rowIntensities[y] = sum / width
  }

  // Step 2: Find reckoning bar (darkest horizontal region)
  // The bar is typically a dark horizontal line in the middle third
  const searchStart = Math.floor(height * 0.25)
  const searchEnd = Math.floor(height * 0.75)

  let darkestRow = searchStart
  let darkestValue = 255

  // Use a sliding window to find the darkest band
  const windowSize = Math.max(3, Math.floor(height * 0.03))
  for (let y = searchStart; y < searchEnd - windowSize; y++) {
    let windowSum = 0
    for (let i = 0; i < windowSize; i++) {
      windowSum += rowIntensities[y + i]
    }
    const windowAvg = windowSum / windowSize
    if (windowAvg < darkestValue) {
      darkestValue = windowAvg
      darkestRow = y + Math.floor(windowSize / 2)
    }
  }

  const reckoningBarPosition = darkestRow / height

  // Step 3: Analyze heaven section (above bar)
  // Find peaks in intensity (beads are darker than background)
  const heavenStart = 0
  const heavenEnd = darkestRow - windowSize
  const heavenPeaks = findPeaks(rowIntensities, heavenStart, heavenEnd, height)

  // Heaven bead is active if it's close to the reckoning bar
  const heavenActiveThreshold = height * 0.15 // Within 15% of bar
  const heavenActive =
    heavenPeaks.length > 0 &&
    darkestRow - heavenPeaks[heavenPeaks.length - 1] < heavenActiveThreshold

  // Step 4: Analyze earth section (below bar)
  const earthStart = darkestRow + windowSize
  const earthEnd = height
  const earthPeaks = findPeaks(rowIntensities, earthStart, earthEnd, height)

  // Earth beads are active if they're close to the reckoning bar
  const earthActiveCount = earthPeaks.filter(
    (peak) => peak - darkestRow < heavenActiveThreshold
  ).length

  // Step 5: Calculate digit value
  // Heaven bead = 5, each earth bead = 1
  const heavenValue = heavenActive ? 5 : 0
  const earthValue = Math.min(earthActiveCount, 4) // Max 4 earth beads
  const digit = heavenValue + earthValue

  // Step 6: Calculate confidence based on detection quality
  // Higher confidence if we found expected number of beads and clear bar
  const expectedHeavenBeads = 1
  const expectedEarthBeads = 4
  const heavenConfidence = heavenPeaks.length === expectedHeavenBeads ? 1.0 : 0.5
  const earthConfidence =
    earthPeaks.length >= expectedEarthBeads ? 1.0 : earthPeaks.length / expectedEarthBeads
  const barContrast = (255 - darkestValue) / 255 // How dark is the bar?

  const confidence = (heavenConfidence + earthConfidence + barContrast) / 3

  return {
    digit,
    confidence,
    reckoningBarPosition,
    heavenBeadsDetected: heavenPeaks.length,
    heavenActive,
    earthBeadsDetected: earthPeaks.length,
    earthActiveCount,
  }
}

/**
 * Find peaks (local minima = dark beads) in intensity profile
 */
function findPeaks(
  intensities: Float32Array,
  start: number,
  end: number,
  totalHeight: number
): number[] {
  const peaks: number[] = []
  const minPeakDistance = Math.floor(totalHeight * 0.05) // Min 5% height between peaks
  const threshold = calculateAdaptiveThreshold(intensities, start, end)

  let lastPeak = -minPeakDistance * 2

  for (let y = start + 2; y < end - 2; y++) {
    const current = intensities[y]

    // Local minimum (darker than neighbors)
    if (
      current < intensities[y - 1] &&
      current < intensities[y + 1] &&
      current < intensities[y - 2] &&
      current < intensities[y + 2] &&
      current < threshold &&
      y - lastPeak >= minPeakDistance
    ) {
      peaks.push(y)
      lastPeak = y
    }
  }

  return peaks
}

/**
 * Calculate adaptive threshold for peak detection
 */
function calculateAdaptiveThreshold(intensities: Float32Array, start: number, end: number): number {
  let sum = 0
  let min = 255
  let max = 0

  for (let y = start; y < end; y++) {
    sum += intensities[y]
    min = Math.min(min, intensities[y])
    max = Math.max(max, intensities[y])
  }

  const avg = sum / (end - start)

  // Threshold halfway between average and minimum
  return (avg + min) / 2
}

/**
 * Analyze multiple columns
 */
export function analyzeColumns(columnImages: ImageData[]): BeadAnalysis[] {
  return columnImages.map(analyzeColumn)
}

/**
 * Convert bead analyses to digits
 */
export function analysesToDigits(analyses: BeadAnalysis[]): {
  digits: number[]
  confidences: number[]
  minConfidence: number
} {
  const digits = analyses.map((a) => a.digit)
  const confidences = analyses.map((a) => a.confidence)
  const minConfidence = confidences.length > 0 ? Math.min(...confidences) : 0

  return { digits, confidences, minConfidence }
}

/**
 * Convert digits to number
 */
export function digitsToNumber(digits: number[]): number {
  if (digits.length === 0) return 0
  return digits.reduce((acc, d) => acc * 10 + d, 0)
}
