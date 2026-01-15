/**
 * Quad Detection Library
 *
 * A general-purpose quadrilateral detection system using OpenCV.js.
 * Designed for document scanning, but works for any rectangular object detection.
 *
 * Features:
 * - Lazy loads OpenCV.js (~8MB) only when first used
 * - Single-frame detection for static images
 * - Multi-frame tracking for camera feeds with stability scoring
 * - Perspective transform extraction
 * - Auto-rotation based on content analysis
 *
 * Usage:
 *
 * // Static image detection
 * const detector = await QuadDetector.load()
 * const result = detector.detect(canvas)
 * if (result.bestQuad) {
 *   const extracted = detector.extract(canvas, result.bestQuad.corners)
 * }
 *
 * // Camera feed with tracking
 * const detector = await QuadDetector.load()
 * const tracker = new QuadTracker(detector)
 * // In animation loop:
 * const frame = captureVideoFrame(video)
 * const result = tracker.processFrame(frame)
 * tracker.drawOverlay(overlayCanvas, result)
 */

// =============================================================================
// Types
// =============================================================================

export interface Corner {
  x: number
  y: number
}

export interface DetectedQuad {
  /** Ordered corners: top-left, top-right, bottom-right, bottom-left */
  corners: Corner[]
  /** Area in pixels */
  area: number
  /** Aspect ratio (width/height or height/width, whichever is larger) */
  aspectRatio: number
  /** Unique ID based on center position (for tracking) */
  centerId: string
}

export interface TrackedQuad extends DetectedQuad {
  /** Unique tracking ID */
  id: string
  /** Number of frames this quad has been seen */
  frameCount: number
  /** Last frame number when this quad was seen */
  lastSeenFrame: number
  /** Stability score (0-1) based on corner consistency */
  stabilityScore: number
  /** History of corner positions */
  cornerHistory: Corner[][]
}

export interface QuadDetectionOptions {
  /** Minimum area as ratio of frame (default: 0.15) */
  minAreaRatio?: number
  /** Maximum area as ratio of frame (default: 0.95) */
  maxAreaRatio?: number
  /** Aspect ratio tolerance (default: 0.3) */
  aspectRatioTolerance?: number
  /** Expected aspect ratios to accept (default: letter, A4, square) */
  expectedAspectRatios?: number[]
  /** Canny edge detection thresholds (default: [50, 150]) */
  cannyThresholds?: [number, number]
  /** Gaussian blur kernel size (default: 5) */
  blurSize?: number
}

export interface QuadDetectionResult {
  /** Whether any valid quads were detected */
  detected: boolean
  /** All detected quads, sorted by area (largest first) */
  quads: DetectedQuad[]
  /** The best (largest) quad, or null if none detected */
  bestQuad: DetectedQuad | null
}

export interface TrackedQuadResult extends QuadDetectionResult {
  /** All tracked quads with history */
  trackedQuads: TrackedQuad[]
  /** Best tracked quad with stability info */
  bestTrackedQuad: TrackedQuad | null
  /** Whether detection is stable (good time to capture) */
  isStable: boolean
  /** Whether detection is locked (very stable, ideal to capture) */
  isLocked: boolean
}

// =============================================================================
// OpenCV Types (minimal interface)
// =============================================================================

interface CVMat {
  delete: () => void
  data32S: Int32Array
  data: ArrayBuffer
  rows: number
  cols: number
}

interface CVMatVector {
  size: () => number
  get: (i: number) => CVMat
  delete: () => void
}

interface CVSize {
  width: number
  height: number
}

interface CVPoint {
  x: number
  y: number
}

interface CV {
  Mat: new () => CVMat
  MatVector: new () => CVMatVector
  Size: new (w: number, h: number) => CVSize
  Scalar: new (r?: number, g?: number, b?: number, a?: number) => unknown
  imread: (canvas: HTMLCanvasElement) => CVMat
  imshow: (canvas: HTMLCanvasElement, mat: CVMat) => void
  cvtColor: (src: CVMat, dst: CVMat, code: number) => void
  GaussianBlur: (
    src: CVMat,
    dst: CVMat,
    size: CVSize,
    sigmaX: number,
    sigmaY: number,
    borderType: number
  ) => void
  Canny: (src: CVMat, dst: CVMat, t1: number, t2: number) => void
  dilate: (src: CVMat, dst: CVMat, kernel: CVMat, anchor: CVPoint, iterations: number) => void
  findContours: (
    src: CVMat,
    contours: CVMatVector,
    hierarchy: CVMat,
    mode: number,
    method: number
  ) => void
  contourArea: (contour: CVMat) => number
  arcLength: (contour: CVMat, closed: boolean) => number
  approxPolyDP: (contour: CVMat, approx: CVMat, epsilon: number, closed: boolean) => void
  getPerspectiveTransform: (src: CVMat, dst: CVMat) => CVMat
  warpPerspective: (
    src: CVMat,
    dst: CVMat,
    M: CVMat,
    size: CVSize,
    flags: number,
    borderMode: number,
    borderValue: unknown
  ) => void
  rotate: (src: CVMat, dst: CVMat, rotateCode: number) => void
  matFromArray: (rows: number, cols: number, type: number, data: number[]) => CVMat
  COLOR_RGBA2GRAY: number
  BORDER_DEFAULT: number
  RETR_LIST: number
  CHAIN_APPROX_SIMPLE: number
  CV_32FC2: number
  INTER_LINEAR: number
  BORDER_CONSTANT: number
  ROTATE_90_CLOCKWISE: number
  ROTATE_180: number
  ROTATE_90_COUNTERCLOCKWISE: number
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_OPTIONS: Required<QuadDetectionOptions> = {
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
  blurSize: 5,
}

// Tracking constants
const HISTORY_LENGTH = 10
const MIN_FRAMES_FOR_STABLE = 3
const LOCKED_FRAME_COUNT = 5
const QUAD_MATCH_THRESHOLD = 0.08

// =============================================================================
// Utility Functions
// =============================================================================

/** Calculate Euclidean distance between two points */
export function distance(p1: Corner, p2: Corner): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

/** Order corners consistently: top-left, top-right, bottom-right, bottom-left */
export function orderCorners(corners: Corner[]): Corner[] {
  if (corners.length !== 4) return corners

  // Find centroid
  const cx = corners.reduce((s, c) => s + c.x, 0) / 4
  const cy = corners.reduce((s, c) => s + c.y, 0) / 4

  // Sort by angle from centroid
  const sorted = [...corners].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx)
    const angleB = Math.atan2(b.y - cy, b.x - cx)
    return angleA - angleB
  })

  // Find top-left (smallest x+y)
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
  const ordered: Corner[] = []
  for (let i = 0; i < 4; i++) {
    ordered.push(sorted[(topLeftIdx + i) % 4])
  }

  return ordered
}

/** Load an image file into a canvas */
export async function loadImageToCanvas(
  source: File | Blob | string
): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = typeof source === 'string' ? source : URL.createObjectURL(source)
    const shouldRevoke = typeof source !== 'string'

    img.onload = () => {
      if (shouldRevoke) URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve(canvas)
    }

    img.onerror = () => {
      if (shouldRevoke) URL.revokeObjectURL(url)
      resolve(null)
    }

    img.src = url
  })
}

/** Capture a video element's current frame to a canvas */
export function captureVideoFrame(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (!video.videoWidth || !video.videoHeight) return null

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(video, 0, 0)
  return canvas
}

/** Get fallback corners (full image bounds) */
export function getFallbackCorners(width: number, height: number): Corner[] {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

// =============================================================================
// QuadDetector Class
// =============================================================================

/**
 * Core quad detection using OpenCV.js
 *
 * Singleton pattern - use QuadDetector.load() to get an instance.
 * OpenCV is lazy-loaded only when first needed.
 */
export class QuadDetector {
  private static instance: QuadDetector | null = null
  private static loadPromise: Promise<QuadDetector> | null = null

  private cv: CV

  private constructor(cv: CV) {
    this.cv = cv
  }

  /**
   * Load OpenCV and get a QuadDetector instance.
   * Safe to call multiple times - returns same instance after first load.
   */
  static async load(): Promise<QuadDetector> {
    if (QuadDetector.instance) return QuadDetector.instance

    if (QuadDetector.loadPromise) {
      return QuadDetector.loadPromise
    }

    QuadDetector.loadPromise = (async () => {
      const cv = await loadOpenCV()
      QuadDetector.instance = new QuadDetector(cv)
      return QuadDetector.instance
    })()

    return QuadDetector.loadPromise
  }

  /** Check if OpenCV is loaded */
  static isLoaded(): boolean {
    return QuadDetector.instance !== null
  }

  /** Get the loaded instance (or null if not loaded) */
  static getInstance(): QuadDetector | null {
    return QuadDetector.instance
  }

  /** Get the OpenCV reference (for advanced use cases) */
  getCV(): CV {
    return this.cv
  }

  /**
   * Detect quadrilaterals in an image.
   *
   * @param source - Canvas containing the image to analyze
   * @param options - Detection options (thresholds, expected aspect ratios, etc.)
   * @returns Detection result with all found quads and the best one
   */
  detect(source: HTMLCanvasElement, options?: QuadDetectionOptions): QuadDetectionResult {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    const quads = this.findAllQuads(source, opts)

    return {
      detected: quads.length > 0,
      quads,
      bestQuad: quads[0] ?? null,
    }
  }

  /**
   * Extract a quadrilateral region using perspective transform.
   *
   * @param source - Source canvas
   * @param corners - Four corners defining the quad to extract
   * @returns New canvas with the extracted, perspective-corrected region
   */
  extract(source: HTMLCanvasElement, corners: Corner[]): HTMLCanvasElement {
    const cv = this.cv

    // Calculate output dimensions
    const width1 = distance(corners[0], corners[1])
    const width2 = distance(corners[3], corners[2])
    const height1 = distance(corners[0], corners[3])
    const height2 = distance(corners[1], corners[2])
    const outputWidth = Math.round((width1 + width2) / 2)
    const outputHeight = Math.round((height1 + height2) / 2)

    // Create transform matrices
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners[0].x,
      corners[0].y,
      corners[1].x,
      corners[1].y,
      corners[2].x,
      corners[2].y,
      corners[3].x,
      corners[3].y,
    ])

    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      outputWidth,
      0,
      outputWidth,
      outputHeight,
      0,
      outputHeight,
    ])

    const M = cv.getPerspectiveTransform(srcPts, dstPts)
    const src = cv.imread(source)
    const dst = new cv.Mat()

    cv.warpPerspective(
      src,
      dst,
      M,
      new cv.Size(outputWidth, outputHeight),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar()
    )

    // Create output canvas
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = outputWidth
    outputCanvas.height = outputHeight
    cv.imshow(outputCanvas, dst)

    // Clean up
    srcPts.delete()
    dstPts.delete()
    M.delete()
    src.delete()
    dst.delete()

    return outputCanvas
  }

  /**
   * Analyze document orientation and determine rotation needed.
   *
   * Uses edge detection to find dominant text line direction
   * and content density to detect upside-down orientation.
   *
   * @param source - Canvas to analyze
   * @returns Degrees to rotate (0, 90, 180, or 270)
   */
  analyzeOrientation(source: HTMLCanvasElement): 0 | 90 | 180 | 270 {
    const cv = this.cv
    let src: CVMat | null = null
    let gray: CVMat | null = null
    let edges: CVMat | null = null

    try {
      src = cv.imread(source)
      gray = new cv.Mat()
      edges = new cv.Mat()

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
      cv.Canny(gray, edges, 50, 150)

      const width = edges.cols
      const height = edges.rows

      // Sample middle section (avoid margins)
      const marginX = Math.floor(width * 0.1)
      const marginY = Math.floor(height * 0.1)
      const sampleHeight = height - 2 * marginY

      const edgeData = new Uint8Array(edges.data)

      // Count horizontal vs vertical edge continuity
      let horizontalEdges = 0
      let verticalEdges = 0

      // Horizontal scan
      for (let y = marginY; y < height - marginY; y += 5) {
        let runLength = 0
        for (let x = marginX; x < width - marginX; x++) {
          if (edgeData[y * width + x] > 0) {
            runLength++
          } else {
            if (runLength > 10) horizontalEdges += runLength
            runLength = 0
          }
        }
        if (runLength > 10) horizontalEdges += runLength
      }

      // Vertical scan
      for (let x = marginX; x < width - marginX; x += 5) {
        let runLength = 0
        for (let y = marginY; y < height - marginY; y++) {
          if (edgeData[y * width + x] > 0) {
            runLength++
          } else {
            if (runLength > 10) verticalEdges += runLength
            runLength = 0
          }
        }
        if (runLength > 10) verticalEdges += runLength
      }

      // Determine if 90° rotation needed
      const ratio = horizontalEdges / (verticalEdges + 1)
      let rotation: 0 | 90 | 180 | 270 = 0

      if (ratio < 0.5) {
        rotation = 90 // Vertical edges dominate - text is sideways
      }

      // Check for upside-down by comparing top/bottom content density
      const topThird = Math.floor(sampleHeight / 3)
      let topDensity = 0
      let bottomDensity = 0

      for (let y = marginY; y < marginY + topThird; y++) {
        for (let x = marginX; x < width - marginX; x += 3) {
          if (edgeData[y * width + x] > 0) topDensity++
        }
      }

      for (let y = height - marginY - topThird; y < height - marginY; y++) {
        for (let x = marginX; x < width - marginX; x += 3) {
          if (edgeData[y * width + x] > 0) bottomDensity++
        }
      }

      // If bottom has significantly more content, probably upside down
      if (bottomDensity > topDensity * 1.5) {
        rotation = rotation === 0 ? 180 : rotation === 90 ? 270 : rotation
      }

      return rotation
    } catch (err) {
      console.warn('Orientation analysis failed:', err)
      return 0
    } finally {
      src?.delete()
      gray?.delete()
      edges?.delete()
    }
  }

  /**
   * Rotate a canvas by the specified degrees.
   *
   * @param source - Canvas to rotate
   * @param degrees - Rotation amount (0, 90, 180, or 270)
   * @returns New rotated canvas (or same canvas if degrees is 0)
   */
  rotate(source: HTMLCanvasElement, degrees: 0 | 90 | 180 | 270): HTMLCanvasElement {
    if (degrees === 0) return source

    const cv = this.cv
    let src: CVMat | null = null
    let dst: CVMat | null = null

    try {
      src = cv.imread(source)
      dst = new cv.Mat()

      const rotateCode =
        degrees === 90
          ? cv.ROTATE_90_CLOCKWISE
          : degrees === 180
            ? cv.ROTATE_180
            : cv.ROTATE_90_COUNTERCLOCKWISE

      cv.rotate(src, dst, rotateCode)

      const outputCanvas = document.createElement('canvas')
      if (degrees === 90 || degrees === 270) {
        outputCanvas.width = source.height
        outputCanvas.height = source.width
      } else {
        outputCanvas.width = source.width
        outputCanvas.height = source.height
      }

      cv.imshow(outputCanvas, dst)
      return outputCanvas
    } catch (err) {
      console.warn('Canvas rotation failed:', err)
      return source
    } finally {
      src?.delete()
      dst?.delete()
    }
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private findAllQuads(
    canvas: HTMLCanvasElement,
    opts: Required<QuadDetectionOptions>
  ): DetectedQuad[] {
    const cv = this.cv
    const quads: DetectedQuad[] = []
    const frameArea = canvas.width * canvas.height

    let src: CVMat | null = null
    let gray: CVMat | null = null
    let blurred: CVMat | null = null
    let edges: CVMat | null = null
    let contours: CVMatVector | null = null
    let hierarchy: CVMat | null = null

    try {
      src = cv.imread(canvas)
      gray = new cv.Mat()
      blurred = new cv.Mat()
      edges = new cv.Mat()

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

      // Blur to reduce noise
      cv.GaussianBlur(
        gray,
        blurred,
        new cv.Size(opts.blurSize, opts.blurSize),
        0,
        0,
        cv.BORDER_DEFAULT
      )

      // Edge detection
      cv.Canny(blurred, edges, opts.cannyThresholds[0], opts.cannyThresholds[1])

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
        if (areaRatio < opts.minAreaRatio || areaRatio > opts.maxAreaRatio) {
          continue
        }

        // Approximate to polygon
        const approx = new cv.Mat()
        const perimeter = cv.arcLength(contour, true)
        cv.approxPolyDP(contour, approx, 0.02 * perimeter, true)

        // Check if it's a quadrilateral
        if (approx.rows === 4) {
          // Extract corners
          const corners: Corner[] = []
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

          // Check if aspect ratio is acceptable
          const isValidAspectRatio = opts.expectedAspectRatios.some(
            (expected) => Math.abs(aspectRatio - expected) < opts.aspectRatioTolerance
          )

          if (isValidAspectRatio) {
            quads.push({
              corners: orderedCorners,
              area,
              aspectRatio,
              centerId: this.getQuadCenterId(orderedCorners, canvas.width, canvas.height),
            })
          }
        }

        approx.delete()
      }
    } finally {
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

  private getQuadCenterId(corners: Corner[], frameWidth: number, frameHeight: number): string {
    const cx = corners.reduce((s, c) => s + c.x, 0) / 4
    const cy = corners.reduce((s, c) => s + c.y, 0) / 4
    const gridX = Math.floor((cx / frameWidth) * 10)
    const gridY = Math.floor((cy / frameHeight) * 10)
    return `${gridX},${gridY}`
  }
}

// =============================================================================
// QuadTracker Class
// =============================================================================

/**
 * Multi-frame quad tracker for camera feeds.
 *
 * Tracks detected quads across frames and provides stability scoring.
 * Use this when you need smooth, stable detection from a video stream.
 */
export class QuadTracker {
  private detector: QuadDetector
  private trackedQuads: Map<string, TrackedQuad> = new Map()
  private frameCount = 0
  private bestQuad: TrackedQuad | null = null
  private lastStableFrame: HTMLCanvasElement | null = null
  private options: Required<QuadDetectionOptions>

  constructor(detector: QuadDetector, options?: QuadDetectionOptions) {
    this.detector = detector
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  /**
   * Process a video frame and update tracking.
   *
   * @param frame - Canvas containing the current video frame
   * @returns Tracking result with stability information
   */
  processFrame(frame: HTMLCanvasElement): TrackedQuadResult {
    const result = this.detector.detect(frame, this.options)
    const bestTrackedQuad = this.updateTracking(result.quads, frame.width, frame.height)

    // Save stable frame
    if (bestTrackedQuad && this.isQuadLocked(bestTrackedQuad)) {
      if (!this.lastStableFrame) {
        this.lastStableFrame = document.createElement('canvas')
      }
      this.lastStableFrame.width = frame.width
      this.lastStableFrame.height = frame.height
      const ctx = this.lastStableFrame.getContext('2d')
      ctx?.drawImage(frame, 0, 0)
    }

    return {
      detected: result.detected,
      quads: result.quads,
      bestQuad: result.bestQuad,
      trackedQuads: Array.from(this.trackedQuads.values()),
      bestTrackedQuad,
      isStable: bestTrackedQuad ? bestTrackedQuad.frameCount >= MIN_FRAMES_FOR_STABLE : false,
      isLocked: bestTrackedQuad ? this.isQuadLocked(bestTrackedQuad) : false,
    }
  }

  /**
   * Draw detection overlay on a canvas.
   *
   * @param overlayCanvas - Canvas to draw on (will be resized to match frame)
   * @param result - Tracking result from processFrame
   * @param frameWidth - Width to resize canvas to (optional)
   * @param frameHeight - Height to resize canvas to (optional)
   */
  drawOverlay(
    overlayCanvas: HTMLCanvasElement,
    result: TrackedQuadResult,
    frameWidth?: number,
    frameHeight?: number
  ): void {
    if (frameWidth && frameHeight) {
      if (overlayCanvas.width !== frameWidth || overlayCanvas.height !== frameHeight) {
        overlayCanvas.width = frameWidth
        overlayCanvas.height = frameHeight
      }
    }

    const ctx = overlayCanvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

    // Draw all detected quads (faded)
    for (const quad of result.quads) {
      if (result.bestTrackedQuad && quad.centerId === result.bestTrackedQuad.id) continue
      this.drawQuad(ctx, quad.corners, 'rgba(100, 100, 100, 0.3)', 2)
    }

    // Draw best quad with color based on stability
    if (result.bestTrackedQuad) {
      const { color, lineWidth } = this.getQuadStyle(result.bestTrackedQuad)
      this.drawQuad(ctx, result.bestTrackedQuad.corners, color, lineWidth)
    }
  }

  /** Reset tracking state */
  reset(): void {
    this.trackedQuads.clear()
    this.frameCount = 0
    this.bestQuad = null
    this.lastStableFrame = null
  }

  /** Get current best quad corners (or null if none) */
  getBestCorners(): Corner[] | null {
    return this.bestQuad ? [...this.bestQuad.corners] : null
  }

  /** Get the last stable frame (when detection was locked) */
  getLastStableFrame(): HTMLCanvasElement | null {
    return this.lastStableFrame
  }

  /** Update detection options */
  setOptions(options: QuadDetectionOptions): void {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // ---------------------------------------------------------------------------
  // Private methods
  // ---------------------------------------------------------------------------

  private updateTracking(
    detectedQuads: DetectedQuad[],
    frameWidth: number,
    frameHeight: number
  ): TrackedQuad | null {
    const currentFrame = this.frameCount++
    const frameDiagonal = Math.sqrt(frameWidth ** 2 + frameHeight ** 2)
    const seenIds = new Set<string>()

    // Match detected quads to tracked quads
    for (const detected of detectedQuads) {
      let matched = false

      for (const [id, tracked] of this.trackedQuads) {
        if (!seenIds.has(id) && this.quadsMatch(detected.corners, tracked.corners, frameDiagonal)) {
          // Update existing tracked quad
          tracked.corners = detected.corners
          tracked.area = detected.area
          tracked.aspectRatio = detected.aspectRatio
          tracked.frameCount++
          tracked.lastSeenFrame = currentFrame
          tracked.cornerHistory.push(detected.corners)
          if (tracked.cornerHistory.length > HISTORY_LENGTH) {
            tracked.cornerHistory.shift()
          }
          tracked.stabilityScore = this.calculateStability(tracked.cornerHistory)
          seenIds.add(id)
          matched = true
          break
        }
      }

      if (!matched) {
        // New quad - start tracking
        const newId = `quad_${currentFrame}_${Math.random().toString(36).slice(2, 8)}`
        this.trackedQuads.set(newId, {
          ...detected,
          id: newId,
          frameCount: 1,
          lastSeenFrame: currentFrame,
          stabilityScore: 0,
          cornerHistory: [detected.corners],
        })
        seenIds.add(newId)
      }
    }

    // Remove quads not seen recently
    for (const [id, tracked] of this.trackedQuads) {
      if (currentFrame - tracked.lastSeenFrame > 3) {
        this.trackedQuads.delete(id)
      }
    }

    // Find best quad
    let bestQuad: TrackedQuad | null = null
    let bestScore = 0

    for (const tracked of this.trackedQuads.values()) {
      if (currentFrame - tracked.lastSeenFrame > 2) continue

      const score = tracked.frameCount * (0.5 + tracked.stabilityScore) * Math.sqrt(tracked.area)
      if (score > bestScore) {
        bestScore = score
        bestQuad = tracked
      }
    }

    this.bestQuad = bestQuad
    return bestQuad
  }

  private quadsMatch(q1: Corner[], q2: Corner[], frameDiagonal: number): boolean {
    const threshold = frameDiagonal * QUAD_MATCH_THRESHOLD
    let totalDist = 0
    for (let i = 0; i < 4; i++) {
      totalDist += distance(q1[i], q2[i])
    }
    return totalDist / 4 < threshold
  }

  private calculateStability(history: Corner[][]): number {
    if (history.length < 2) return 0

    let totalVariance = 0
    for (let corner = 0; corner < 4; corner++) {
      const xs = history.map((h) => h[corner].x)
      const ys = history.map((h) => h[corner].y)
      const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
      const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
      const varX = xs.reduce((a, b) => a + (b - meanX) ** 2, 0) / xs.length
      const varY = ys.reduce((a, b) => a + (b - meanY) ** 2, 0) / ys.length
      totalVariance += Math.sqrt(varX + varY)
    }

    const avgVariance = totalVariance / 4
    return Math.max(0, 1 - avgVariance / 50)
  }

  private isQuadLocked(quad: TrackedQuad): boolean {
    return quad.frameCount >= LOCKED_FRAME_COUNT && quad.stabilityScore > 0.5
  }

  private getQuadStyle(quad: TrackedQuad): {
    color: string
    lineWidth: number
  } {
    const isStable = quad.frameCount >= MIN_FRAMES_FOR_STABLE
    const isLocked = this.isQuadLocked(quad)

    if (isLocked) {
      return { color: 'rgba(0, 255, 100, 0.95)', lineWidth: 6 }
    } else if (isStable) {
      return { color: 'rgba(100, 255, 100, 0.85)', lineWidth: 5 }
    } else {
      return { color: 'rgba(255, 200, 0, 0.8)', lineWidth: 4 }
    }
  }

  private drawQuad(
    ctx: CanvasRenderingContext2D,
    corners: Corner[],
    color: string,
    lineWidth: number
  ): void {
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y)
    }
    ctx.closePath()
    ctx.stroke()

    // Draw corner circles
    ctx.fillStyle = color
    for (const corner of corners) {
      ctx.beginPath()
      ctx.arc(corner.x, corner.y, lineWidth * 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

// =============================================================================
// OpenCV Loader
// =============================================================================

let loadPromise: Promise<CV> | null = null

async function loadOpenCV(): Promise<CV> {
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    const existingCV = (window as unknown as { cv?: CV & { imread?: unknown } }).cv
    if (existingCV && typeof existingCV.imread === 'function') {
      resolve(existingCV as CV)
      return
    }

    // Check for existing script
    const existingScript = document.querySelector('script[src="/opencv.js"]')
    if (existingScript) {
      waitForOpenCV(resolve, reject)
      return
    }

    // Load script
    const script = document.createElement('script')
    script.src = '/opencv.js'
    script.async = true

    script.onload = () => waitForOpenCV(resolve, reject)
    script.onerror = () => reject(new Error('Failed to load OpenCV.js'))

    document.head.appendChild(script)
  })

  return loadPromise
}

function waitForOpenCV(resolve: (cv: CV) => void, reject: (err: Error) => void): void {
  const maxWait = 30000
  const startTime = Date.now()

  const checkReady = () => {
    const cv = (window as unknown as { cv?: CV & { imread?: unknown } }).cv
    if (cv && typeof cv.imread === 'function') {
      resolve(cv as CV)
      return
    }

    if (Date.now() - startTime > maxWait) {
      reject(new Error('OpenCV.js loading timed out'))
      return
    }

    const windowCV = (window as unknown as { cv?: { onRuntimeInitialized?: () => void } }).cv
    if (windowCV) {
      const previousCallback = windowCV.onRuntimeInitialized
      windowCV.onRuntimeInitialized = () => {
        previousCallback?.()
        resolve(windowCV as unknown as CV)
      }
    } else {
      setTimeout(checkReady, 100)
    }
  }

  checkReady()
}
