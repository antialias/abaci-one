/**
 * Quad Detector
 *
 * Core quadrilateral detection logic using OpenCV.js.
 * Finds document-like quadrilaterals in images using edge detection and contour analysis.
 *
 * This is a pure module with no React dependencies - can be used directly
 * or wrapped in hooks for React components.
 */

import type { CV, CVMat, CVMatVector, CVPoint } from './opencv/types'

// ============================================================================
// Types
// ============================================================================

/** A 2D point */
export interface Point {
  x: number
  y: number
}

/** A detected quadrilateral */
export interface DetectedQuad {
  /** Corner points ordered: top-left, top-right, bottom-right, bottom-left */
  corners: [Point, Point, Point, Point]
  /** Area in pixels */
  area: number
  /** Aspect ratio (max dimension / min dimension) */
  aspectRatio: number
}

/** Configuration for quad detection */
export interface QuadDetectorConfig {
  /** Minimum area as fraction of frame (0-1). Default: 0.15 */
  minAreaRatio: number
  /** Maximum area as fraction of frame (0-1). Default: 0.95 */
  maxAreaRatio: number
  /** How close aspect ratio must be to expected ratios. Default: 0.3 */
  aspectRatioTolerance: number
  /** Expected document aspect ratios. Default: letter/A4/square */
  expectedAspectRatios: number[]
  /** Canny edge detection thresholds [low, high]. Default: [50, 150] */
  cannyThresholds: [number, number]
  /** Polygon approximation epsilon as fraction of perimeter. Default: 0.02 */
  approxEpsilon: number
  /** Gaussian blur kernel size (odd number). Default: 5 */
  blurSize: number
}

/** Default configuration */
export const DEFAULT_QUAD_DETECTOR_CONFIG: QuadDetectorConfig = {
  minAreaRatio: 0.15,
  maxAreaRatio: 0.95,
  aspectRatioTolerance: 0.3,
  expectedAspectRatios: [
    8.5 / 11, // US Letter portrait
    11 / 8.5, // US Letter landscape
    1 / Math.sqrt(2), // A4 portrait
    Math.sqrt(2), // A4 landscape
    1, // Square
  ],
  cannyThresholds: [50, 150],
  approxEpsilon: 0.02,
  blurSize: 5,
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate Euclidean distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

/**
 * Order corners consistently: top-left, top-right, bottom-right, bottom-left
 * Uses angle from centroid and sum of coordinates to find top-left
 */
export function orderCorners(corners: Point[]): [Point, Point, Point, Point] {
  if (corners.length !== 4) {
    throw new Error('orderCorners requires exactly 4 points')
  }

  // Find centroid
  const cx = corners.reduce((s, c) => s + c.x, 0) / 4
  const cy = corners.reduce((s, c) => s + c.y, 0) / 4

  // Sort by angle from centroid (counter-clockwise from positive x-axis)
  const sorted = [...corners].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx)
    const angleB = Math.atan2(b.y - cy, b.x - cx)
    return angleA - angleB
  })

  // Find top-left (smallest x+y sum)
  let topLeftIdx = 0
  let minSum = Infinity
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y
    if (sum < minSum) {
      minSum = sum
      topLeftIdx = i
    }
  }

  // Rotate array so top-left is first
  const ordered: Point[] = []
  for (let i = 0; i < 4; i++) {
    ordered.push(sorted[(topLeftIdx + i) % 4])
  }

  return ordered as [Point, Point, Point, Point]
}

/**
 * Check if an aspect ratio matches any expected document ratio
 */
export function isDocumentAspectRatio(
  ratio: number,
  expectedRatios: number[],
  tolerance: number
): boolean {
  return expectedRatios.some((expected) => Math.abs(ratio - expected) < tolerance)
}

// ============================================================================
// Quad Detector
// ============================================================================

/**
 * Create a quad detector instance
 *
 * @param cv - OpenCV.js instance
 * @param config - Optional configuration overrides
 */
export function createQuadDetector(cv: CV, config: Partial<QuadDetectorConfig> = {}) {
  const cfg: QuadDetectorConfig = { ...DEFAULT_QUAD_DETECTOR_CONFIG, ...config }

  /**
   * Detect all document-like quadrilaterals in an image
   *
   * @param source - Canvas or ImageData to process
   * @returns Array of detected quads, sorted by area (largest first)
   */
  function detect(source: HTMLCanvasElement): DetectedQuad[] {
    const quads: DetectedQuad[] = []
    const frameArea = source.width * source.height

    // OpenCV matrices (need cleanup)
    let src: CVMat | null = null
    let gray: CVMat | null = null
    let blurred: CVMat | null = null
    let edges: CVMat | null = null
    let contours: CVMatVector | null = null
    let hierarchy: CVMat | null = null

    try {
      // Read image
      src = cv.imread(source)
      gray = new cv.Mat()
      blurred = new cv.Mat()
      edges = new cv.Mat()

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

      // Blur to reduce noise
      cv.GaussianBlur(
        gray,
        blurred,
        new cv.Size(cfg.blurSize, cfg.blurSize),
        0,
        0,
        cv.BORDER_DEFAULT
      )

      // Edge detection
      cv.Canny(blurred, edges, cfg.cannyThresholds[0], cfg.cannyThresholds[1])

      // Dilate edges to connect gaps
      const kernel = new cv.Mat()
      cv.dilate(edges, edges, kernel, { x: -1, y: -1 } as CVPoint, 1)
      kernel.delete()

      // Find contours
      contours = new cv.MatVector()
      hierarchy = new cv.Mat()
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE)

      // Process each contour
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i)
        const area = cv.contourArea(contour)
        const areaRatio = area / frameArea

        // Skip if too small or too large
        if (areaRatio < cfg.minAreaRatio || areaRatio > cfg.maxAreaRatio) {
          continue
        }

        // Approximate to polygon
        const approx = new cv.Mat()
        const perimeter = cv.arcLength(contour, true)
        cv.approxPolyDP(contour, approx, cfg.approxEpsilon * perimeter, true)

        // Check if it's a quadrilateral
        if (approx.rows === 4) {
          // Extract corners
          const corners: Point[] = []
          for (let j = 0; j < 4; j++) {
            corners.push({
              x: approx.data32S[j * 2],
              y: approx.data32S[j * 2 + 1],
            })
          }

          // Order corners consistently
          const orderedCorners = orderCorners(corners)

          // Calculate aspect ratio
          const width = distance(orderedCorners[0], orderedCorners[1])
          const height = distance(orderedCorners[1], orderedCorners[2])
          const aspectRatio = Math.max(width, height) / Math.min(width, height)

          // Check if aspect ratio is document-like
          if (
            isDocumentAspectRatio(aspectRatio, cfg.expectedAspectRatios, cfg.aspectRatioTolerance)
          ) {
            quads.push({
              corners: orderedCorners,
              area,
              aspectRatio,
            })
          }
        }

        approx.delete()
      }
    } finally {
      // Clean up OpenCV memory
      src?.delete()
      gray?.delete()
      blurred?.delete()
      edges?.delete()
      contours?.delete()
      hierarchy?.delete()
    }

    // Sort by area (largest first)
    quads.sort((a, b) => b.area - a.area)

    return quads
  }

  /**
   * Detect the single best quad in an image
   *
   * @param source - Canvas to process
   * @returns Best quad or null if none found
   */
  function detectBest(source: HTMLCanvasElement): DetectedQuad | null {
    const quads = detect(source)
    return quads.length > 0 ? quads[0] : null
  }

  return {
    detect,
    detectBest,
    config: cfg,
  }
}

export type QuadDetector = ReturnType<typeof createQuadDetector>
