'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hook for document detection using OpenCV.js directly
 *
 * Features:
 * - Lazy loads OpenCV.js (~8MB) only when first used
 * - Multi-quad tracking: detects ALL quadrilaterals, not just the largest
 * - Scores quads by: size, aspect ratio, and temporal stability
 * - Filters out small quads (likely printed on page) vs page-sized quads
 * - Provides highlightDocument for drawing detected quad on overlay
 * - Provides extractDocument for cropping/deskewing captured image
 */

// OpenCV.js types (minimal interface for what we use)
interface CVMat {
  delete: () => void
  data32S: Int32Array
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
  dilate: (
    src: CVMat,
    dst: CVMat,
    kernel: CVMat,
    anchor: CVPoint,
    iterations: number
  ) => void
  findContours: (
    src: CVMat,
    contours: CVMatVector,
    hierarchy: CVMat,
    mode: number,
    method: number
  ) => void
  contourArea: (contour: CVMat) => number
  arcLength: (contour: CVMat, closed: boolean) => number
  approxPolyDP: (
    contour: CVMat,
    approx: CVMat,
    epsilon: number,
    closed: boolean
  ) => void
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
  warpAffine: (
    src: CVMat,
    dst: CVMat,
    M: CVMat,
    size: CVSize,
    flags?: number,
    borderMode?: number,
    borderValue?: unknown
  ) => void
  getRotationMatrix2D: (center: CVPoint, angle: number, scale: number) => CVMat
  rotate: (src: CVMat, dst: CVMat, rotateCode: number) => void
  countNonZero: (src: CVMat) => number
  matFromArray: (
    rows: number,
    cols: number,
    type: number,
    data: number[]
  ) => CVMat
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

/** Represents a detected quadrilateral with corner points */
interface DetectedQuad {
  corners: Array<{ x: number; y: number }>
  area: number
  aspectRatio: number
  // Unique ID based on approximate center position
  centerId: string
}

/** Tracked quad candidate with history */
interface TrackedQuad {
  id: string
  corners: Array<{ x: number; y: number }>
  area: number
  aspectRatio: number
  /** How many frames this quad has been seen */
  frameCount: number
  /** Last frame number when this quad was seen */
  lastSeenFrame: number
  /** Stability score based on corner consistency */
  stabilityScore: number
  /** History of corner positions for stability calculation */
  cornerHistory: Array<Array<{ x: number; y: number }>>
}

export interface DocumentDetectionDebugInfo {
  /** Time taken to load OpenCV in ms */
  loadTimeMs: number | null
  /** Last detection attempt time in ms */
  lastDetectionMs: number | null
  /** Number of quads detected this frame */
  quadsDetected: number
  /** Number of tracked quad candidates */
  trackedQuads: number
  /** Best quad's stability score */
  bestQuadStability: number
  /** Best quad's frame count */
  bestQuadFrameCount: number
  /** Last error message from detection */
  lastDetectionError: string | null
}

/** Number of frames to track quad history */
const HISTORY_LENGTH = 10
/** Minimum frames a quad must be seen to be considered stable */
const MIN_FRAMES_FOR_STABLE = 3
/** Minimum frames for "locked" state */
const LOCKED_FRAME_COUNT = 5
/** Maximum distance (as % of frame diagonal) for quads to be considered "same" */
const QUAD_MATCH_THRESHOLD = 0.08
/** Minimum area as % of frame for a quad to be considered page-sized */
const MIN_AREA_RATIO = 0.15
/** Maximum area as % of frame (filter out frame edges detected as quad) */
const MAX_AREA_RATIO = 0.95
/** Expected aspect ratios for documents (width/height) */
const EXPECTED_ASPECT_RATIOS = [
  8.5 / 11, // US Letter portrait
  11 / 8.5, // US Letter landscape
  1 / Math.sqrt(2), // A4 portrait
  Math.sqrt(2), // A4 landscape
  1, // Square
]
/** How close aspect ratio must be to expected (tolerance) */
const ASPECT_RATIO_TOLERANCE = 0.3

export interface UseDocumentDetectionReturn {
  /** Whether OpenCV is still loading */
  isLoading: boolean
  /** Error message if loading failed */
  error: string | null
  /** Whether scanner is ready to use */
  isReady: boolean
  /** Whether detection is currently stable (good time to capture) */
  isStable: boolean
  /** Whether detection is locked (very stable, ideal to capture) */
  isLocked: boolean
  /** Debug information for troubleshooting */
  debugInfo: DocumentDetectionDebugInfo
  /** OpenCV reference for external use (e.g., DocumentAdjuster) */
  cv: unknown
  /**
   * Get the current best quad's corner positions
   * Returns null if no quad is detected
   */
  getBestQuadCorners: () => Array<{ x: number; y: number }> | null
  /**
   * Capture the current video frame as a canvas
   * Returns null if capture fails
   */
  captureSourceFrame: (video: HTMLVideoElement) => HTMLCanvasElement | null
  /**
   * Draw detected document edges on overlay canvas
   * Returns true if document was detected, false otherwise
   */
  highlightDocument: (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement
  ) => boolean
  /**
   * Extract and deskew the detected document
   * Returns canvas with cropped document, or null if extraction failed
   */
  extractDocument: (video: HTMLVideoElement) => HTMLCanvasElement | null
}

export function useDocumentDetection(): UseDocumentDetectionReturn {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cvRef = useRef<CV | null>(null)

  // Multi-quad tracking
  const trackedQuadsRef = useRef<Map<string, TrackedQuad>>(new Map())
  const frameCountRef = useRef(0)
  const bestQuadRef = useRef<TrackedQuad | null>(null)
  const lastStableFrameRef = useRef<HTMLCanvasElement | null>(null)

  // Debug info tracking
  const [debugInfo, setDebugInfo] = useState<DocumentDetectionDebugInfo>({
    loadTimeMs: null,
    lastDetectionMs: null,
    quadsDetected: 0,
    trackedQuads: 0,
    bestQuadStability: 0,
    bestQuadFrameCount: 0,
    lastDetectionError: null,
  })
  const loadStartTimeRef = useRef<number>(Date.now())

  // Lazy load OpenCV.js
  useEffect(() => {
    let mounted = true

    // Helper to check if OpenCV is fully initialized
    const isOpenCVReady = (): boolean => {
      const cv = (window as unknown as { cv?: { imread?: unknown } }).cv
      return !!(cv && typeof cv.imread === 'function')
    }

    async function loadOpenCV() {
      try {
        if (typeof window !== 'undefined') {
          if (!isOpenCVReady()) {
            const existingScript = document.querySelector(
              'script[src="/opencv.js"]'
            )

            if (!existingScript) {
              await new Promise<void>((resolve, reject) => {
                const script = document.createElement('script')
                script.src = '/opencv.js'
                script.async = true

                script.onload = () => {
                  const checkReady = () => {
                    if (isOpenCVReady()) {
                      resolve()
                    } else {
                      const cv = (
                        window as unknown as {
                          cv?: { onRuntimeInitialized?: () => void }
                        }
                      ).cv
                      if (cv) {
                        const previousCallback = cv.onRuntimeInitialized
                        cv.onRuntimeInitialized = () => {
                          previousCallback?.()
                          resolve()
                        }
                      } else {
                        reject(new Error('OpenCV.js loaded but cv not found'))
                      }
                    }
                  }
                  checkReady()
                }

                script.onerror = () =>
                  reject(new Error('Failed to load OpenCV.js'))
                document.head.appendChild(script)
              })
            } else {
              await new Promise<void>((resolve, reject) => {
                const maxWait = 30000
                const startTime = Date.now()

                const checkReady = () => {
                  if (isOpenCVReady()) {
                    resolve()
                  } else if (Date.now() - startTime > maxWait) {
                    reject(new Error('OpenCV.js loading timed out'))
                  } else {
                    const cv = (
                      window as unknown as {
                        cv?: { onRuntimeInitialized?: () => void }
                      }
                    ).cv
                    if (cv) {
                      const previousCallback = cv.onRuntimeInitialized
                      cv.onRuntimeInitialized = () => {
                        previousCallback?.()
                        resolve()
                      }
                    } else {
                      setTimeout(checkReady, 100)
                    }
                  }
                }
                checkReady()
              })
            }
          }
        }

        if (!mounted) return

        // Store OpenCV reference
        cvRef.current = (window as unknown as { cv: CV }).cv
        const loadTime = Date.now() - loadStartTimeRef.current
        setDebugInfo((prev) => ({ ...prev, loadTimeMs: loadTime }))
        setIsLoading(false)
      } catch (err) {
        if (!mounted) return
        console.error('Failed to load OpenCV:', err)
        setError(
          err instanceof Error ? err.message : 'Failed to load OpenCV'
        )
        setIsLoading(false)
      }
    }

    loadOpenCV()

    return () => {
      mounted = false
    }
  }, [])

  // Reusable canvas for video frame capture
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Helper to capture video frame to canvas
  const captureVideoFrame = useCallback(
    (video: HTMLVideoElement): HTMLCanvasElement | null => {
      if (!video.videoWidth || !video.videoHeight) return null

      if (!frameCanvasRef.current) {
        frameCanvasRef.current = document.createElement('canvas')
      }
      const frameCanvas = frameCanvasRef.current

      if (
        frameCanvas.width !== video.videoWidth ||
        frameCanvas.height !== video.videoHeight
      ) {
        frameCanvas.width = video.videoWidth
        frameCanvas.height = video.videoHeight
      }

      const ctx = frameCanvas.getContext('2d')
      if (!ctx) return null

      ctx.drawImage(video, 0, 0)
      return frameCanvas
    },
    []
  )

  // Calculate distance between two points
  const distance = useCallback(
    (p1: { x: number; y: number }, p2: { x: number; y: number }): number => {
      return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
    },
    []
  )

  // Order corners: top-left, top-right, bottom-right, bottom-left
  const orderCorners = useCallback(
    (
      corners: Array<{ x: number; y: number }>
    ): Array<{ x: number; y: number }> => {
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
      const ordered = []
      for (let i = 0; i < 4; i++) {
        ordered.push(sorted[(topLeftIdx + i) % 4])
      }

      return ordered
    },
    []
  )

  // Check if aspect ratio is document-like
  const isDocumentAspectRatio = useCallback((ratio: number): boolean => {
    return EXPECTED_ASPECT_RATIOS.some(
      (expected) => Math.abs(ratio - expected) < ASPECT_RATIO_TOLERANCE
    )
  }, [])

  // Generate a stable ID for a quad based on its center position
  const getQuadCenterId = useCallback(
    (
      corners: Array<{ x: number; y: number }>,
      frameWidth: number,
      frameHeight: number
    ): string => {
      const cx = corners.reduce((s, c) => s + c.x, 0) / 4
      const cy = corners.reduce((s, c) => s + c.y, 0) / 4
      // Quantize to grid cells (10x10 grid)
      const gridX = Math.floor((cx / frameWidth) * 10)
      const gridY = Math.floor((cy / frameHeight) * 10)
      return `${gridX},${gridY}`
    },
    []
  )

  // Check if two quads are similar (same document)
  const quadsMatch = useCallback(
    (
      q1: Array<{ x: number; y: number }>,
      q2: Array<{ x: number; y: number }>,
      frameDiagonal: number
    ): boolean => {
      const threshold = frameDiagonal * QUAD_MATCH_THRESHOLD
      let totalDist = 0
      for (let i = 0; i < 4; i++) {
        totalDist += distance(q1[i], q2[i])
      }
      return totalDist / 4 < threshold
    },
    [distance]
  )

  // Calculate corner stability (how much corners move between frames)
  const calculateCornerStability = useCallback(
    (history: Array<Array<{ x: number; y: number }>>): number => {
      if (history.length < 2) return 0

      let totalVariance = 0
      for (let corner = 0; corner < 4; corner++) {
        const xs = history.map((h) => h[corner].x)
        const ys = history.map((h) => h[corner].y)
        const meanX = xs.reduce((a, b) => a + b, 0) / xs.length
        const meanY = ys.reduce((a, b) => a + b, 0) / ys.length
        const varX =
          xs.reduce((a, b) => a + (b - meanX) ** 2, 0) / xs.length
        const varY =
          ys.reduce((a, b) => a + (b - meanY) ** 2, 0) / ys.length
        totalVariance += Math.sqrt(varX + varY)
      }

      // Convert variance to stability score (lower variance = higher stability)
      // Normalize: variance of 0 = stability 1, variance of 50+ = stability 0
      const avgVariance = totalVariance / 4
      return Math.max(0, 1 - avgVariance / 50)
    },
    []
  )

  // Find all quadrilaterals in the frame using OpenCV
  const findAllQuads = useCallback(
    (frameCanvas: HTMLCanvasElement): DetectedQuad[] => {
      const cv = cvRef.current
      if (!cv) return []

      const quads: DetectedQuad[] = []
      const frameArea = frameCanvas.width * frameCanvas.height
      const frameDiagonal = Math.sqrt(
        frameCanvas.width ** 2 + frameCanvas.height ** 2
      )

      // OpenCV processing
      let src: CVMat | null = null
      let gray: CVMat | null = null
      let blurred: CVMat | null = null
      let edges: CVMat | null = null
      let contours: CVMatVector | null = null
      let hierarchy: CVMat | null = null

      try {
        src = cv.imread(frameCanvas)
        gray = new cv.Mat()
        blurred = new cv.Mat()
        edges = new cv.Mat()

        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

        // Blur to reduce noise
        cv.GaussianBlur(
          gray,
          blurred,
          new cv.Size(5, 5),
          0,
          0,
          cv.BORDER_DEFAULT
        )

        // Edge detection
        cv.Canny(blurred, edges, 50, 150)

        // Dilate edges to connect gaps
        const kernel = new cv.Mat()
        cv.dilate(edges, edges, kernel, { x: -1, y: -1 } as CVPoint, 1)
        kernel.delete()

        // Find contours
        contours = new cv.MatVector()
        hierarchy = new cv.Mat()
        cv.findContours(
          edges,
          contours,
          hierarchy,
          cv.RETR_LIST,
          cv.CHAIN_APPROX_SIMPLE
        )

        // Process each contour
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i)
          const area = cv.contourArea(contour)
          const areaRatio = area / frameArea

          // Skip if too small or too large
          if (areaRatio < MIN_AREA_RATIO || areaRatio > MAX_AREA_RATIO) {
            continue
          }

          // Approximate to polygon
          const approx = new cv.Mat()
          const perimeter = cv.arcLength(contour, true)
          cv.approxPolyDP(contour, approx, 0.02 * perimeter, true)

          // Check if it's a quadrilateral
          if (approx.rows === 4) {
            // Extract corners
            const corners: Array<{ x: number; y: number }> = []
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
            if (isDocumentAspectRatio(aspectRatio)) {
              quads.push({
                corners: orderedCorners,
                area,
                aspectRatio,
                centerId: getQuadCenterId(
                  orderedCorners,
                  frameCanvas.width,
                  frameCanvas.height
                ),
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
    },
    [distance, orderCorners, isDocumentAspectRatio, getQuadCenterId]
  )

  // Update tracked quads with new detections
  const updateTrackedQuads = useCallback(
    (
      detectedQuads: DetectedQuad[],
      frameWidth: number,
      frameHeight: number
    ): TrackedQuad | null => {
      const currentFrame = frameCountRef.current++
      const trackedQuads = trackedQuadsRef.current
      const frameDiagonal = Math.sqrt(frameWidth ** 2 + frameHeight ** 2)

      // Mark all tracked quads as not seen this frame
      const seenIds = new Set<string>()

      // Match detected quads to tracked quads
      for (const detected of detectedQuads) {
        let matched = false

        for (const [id, tracked] of trackedQuads) {
          if (
            !seenIds.has(id) &&
            quadsMatch(detected.corners, tracked.corners, frameDiagonal)
          ) {
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
            tracked.stabilityScore = calculateCornerStability(
              tracked.cornerHistory
            )
            seenIds.add(id)
            matched = true
            break
          }
        }

        if (!matched) {
          // New quad - start tracking
          const newId = `quad_${currentFrame}_${Math.random().toString(36).slice(2, 8)}`
          trackedQuads.set(newId, {
            id: newId,
            corners: detected.corners,
            area: detected.area,
            aspectRatio: detected.aspectRatio,
            frameCount: 1,
            lastSeenFrame: currentFrame,
            stabilityScore: 0,
            cornerHistory: [detected.corners],
          })
          seenIds.add(newId)
        }
      }

      // Remove quads not seen for a while
      for (const [id, tracked] of trackedQuads) {
        if (currentFrame - tracked.lastSeenFrame > 3) {
          trackedQuads.delete(id)
        }
      }

      // Find best quad (highest score = frameCount * stability * area)
      let bestQuad: TrackedQuad | null = null
      let bestScore = 0

      for (const tracked of trackedQuads.values()) {
        // Only consider quads seen recently
        if (currentFrame - tracked.lastSeenFrame > 2) continue

        // Score: prioritize stability and longevity, then area
        const score =
          tracked.frameCount *
          (0.5 + tracked.stabilityScore) *
          Math.sqrt(tracked.area)

        if (score > bestScore) {
          bestScore = score
          bestQuad = tracked
        }
      }

      bestQuadRef.current = bestQuad
      return bestQuad
    },
    [quadsMatch, calculateCornerStability]
  )

  // Draw quad on overlay canvas
  const drawQuad = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      corners: Array<{ x: number; y: number }>,
      color: string,
      lineWidth: number
    ) => {
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
    },
    []
  )

  const highlightDocument = useCallback(
    (video: HTMLVideoElement, overlayCanvas: HTMLCanvasElement): boolean => {
      const cv = cvRef.current
      if (!cv) return false

      const startTime = performance.now()

      try {
        const frameCanvas = captureVideoFrame(video)
        if (!frameCanvas) {
          setDebugInfo((prev) => ({
            ...prev,
            lastDetectionError: 'Failed to capture video frame',
          }))
          return false
        }

        // Resize overlay to match video
        if (
          overlayCanvas.width !== video.videoWidth ||
          overlayCanvas.height !== video.videoHeight
        ) {
          overlayCanvas.width = video.videoWidth
          overlayCanvas.height = video.videoHeight
        }

        const overlayCtx = overlayCanvas.getContext('2d')
        if (!overlayCtx) return false

        // Clear overlay
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)

        // Find all quads in this frame
        const detectedQuads = findAllQuads(frameCanvas)

        // Update tracking and get best quad
        const bestQuad = updateTrackedQuads(
          detectedQuads,
          frameCanvas.width,
          frameCanvas.height
        )

        const detectionTime = performance.now() - startTime

        // Draw all detected quads (faded) for debugging
        for (const quad of detectedQuads) {
          if (bestQuad && quad.centerId === bestQuad.id) continue
          drawQuad(overlayCtx, quad.corners, 'rgba(100, 100, 100, 0.3)', 2)
        }

        // Draw best quad with color based on stability
        if (bestQuad) {
          const isStable = bestQuad.frameCount >= MIN_FRAMES_FOR_STABLE
          const isLocked = bestQuad.frameCount >= LOCKED_FRAME_COUNT

          let color: string
          let lineWidth: number

          if (isLocked && bestQuad.stabilityScore > 0.5) {
            color = 'rgba(0, 255, 100, 0.95)'
            lineWidth = 6
            // Save stable frame
            if (!lastStableFrameRef.current) {
              lastStableFrameRef.current = document.createElement('canvas')
            }
            lastStableFrameRef.current.width = frameCanvas.width
            lastStableFrameRef.current.height = frameCanvas.height
            const stableCtx = lastStableFrameRef.current.getContext('2d')
            stableCtx?.drawImage(frameCanvas, 0, 0)
          } else if (isStable) {
            color = 'rgba(100, 255, 100, 0.85)'
            lineWidth = 5
          } else {
            color = 'rgba(255, 200, 0, 0.8)'
            lineWidth = 4
          }

          drawQuad(overlayCtx, bestQuad.corners, color, lineWidth)
        }

        // Update debug info
        setDebugInfo((prev) => ({
          ...prev,
          lastDetectionMs: Math.round(detectionTime),
          quadsDetected: detectedQuads.length,
          trackedQuads: trackedQuadsRef.current.size,
          bestQuadStability: bestQuad?.stabilityScore ?? 0,
          bestQuadFrameCount: bestQuad?.frameCount ?? 0,
          lastDetectionError: null,
        }))

        return !!bestQuad
      } catch (err) {
        setDebugInfo((prev) => ({
          ...prev,
          lastDetectionError:
            err instanceof Error ? err.message : 'Unknown error',
        }))
        return false
      }
    },
    [captureVideoFrame, findAllQuads, updateTrackedQuads, drawQuad]
  )

  /**
   * Analyze document orientation and return rotation needed (0, 90, 180, 270)
   * Uses edge detection to find dominant text line direction
   * and content density to detect upside-down orientation
   */
  const analyzeOrientation = useCallback(
    (canvas: HTMLCanvasElement): 0 | 90 | 180 | 270 => {
      const cv = cvRef.current
      if (!cv) return 0

      let src: CVMat | null = null
      let gray: CVMat | null = null
      let edges: CVMat | null = null

      try {
        src = cv.imread(canvas)
        gray = new cv.Mat()
        edges = new cv.Mat()

        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

        // Apply Canny edge detection
        cv.Canny(gray, edges, 50, 150)

        const width = edges.cols
        const height = edges.rows

        // Sample horizontal and vertical edge strips to determine orientation
        // For text documents, horizontal lines (text) should dominate
        let horizontalEdges = 0
        let verticalEdges = 0

        // Sample middle section of the image (avoid margins)
        const marginX = Math.floor(width * 0.1)
        const marginY = Math.floor(height * 0.1)
        const sampleHeight = height - 2 * marginY

        // Count edge pixels in horizontal strips vs vertical strips
        // Use a simple row/column scan approach
        const edgeData = new Uint8Array(
          (edges as unknown as { data: ArrayBuffer }).data
        )

        // Count horizontal edge continuity (text lines are horizontal)
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

        // Count vertical edge continuity
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

        // Determine if we need 90° rotation
        // If vertical edges significantly dominate, text is probably sideways
        const ratio = horizontalEdges / (verticalEdges + 1)
        let rotation: 0 | 90 | 180 | 270 = 0

        if (ratio < 0.5) {
          // Vertical edges dominate - rotate 90° clockwise
          rotation = 90
        } else if (ratio > 2) {
          // Horizontal edges dominate - correct orientation (or 180°)
          rotation = 0
        }

        // Now check if upside down by comparing content density
        // Top of document usually has more content (headers, titles)
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
    },
    []
  )

  /**
   * Rotate a canvas by the specified degrees (0, 90, 180, 270)
   */
  const rotateCanvas = useCallback(
    (canvas: HTMLCanvasElement, degrees: 0 | 90 | 180 | 270): HTMLCanvasElement => {
      if (degrees === 0) return canvas

      const cv = cvRef.current
      if (!cv) return canvas

      let src: CVMat | null = null
      let dst: CVMat | null = null

      try {
        src = cv.imread(canvas)
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
          outputCanvas.width = canvas.height
          outputCanvas.height = canvas.width
        } else {
          outputCanvas.width = canvas.width
          outputCanvas.height = canvas.height
        }

        cv.imshow(outputCanvas, dst)
        return outputCanvas
      } catch (err) {
        console.warn('Canvas rotation failed:', err)
        return canvas
      } finally {
        src?.delete()
        dst?.delete()
      }
    },
    []
  )

  const extractDocument = useCallback(
    (video: HTMLVideoElement): HTMLCanvasElement | null => {
      const cv = cvRef.current
      const bestQuad = bestQuadRef.current
      if (!cv || !bestQuad) return null

      try {
        // Use stable frame if available, otherwise capture current
        const sourceCanvas =
          lastStableFrameRef.current &&
          bestQuad.frameCount >= LOCKED_FRAME_COUNT
            ? lastStableFrameRef.current
            : captureVideoFrame(video)

        if (!sourceCanvas) return null

        const corners = bestQuad.corners

        // Calculate output dimensions (maintain aspect ratio)
        const width1 = distance(corners[0], corners[1])
        const width2 = distance(corners[3], corners[2])
        const height1 = distance(corners[0], corners[3])
        const height2 = distance(corners[1], corners[2])
        const outputWidth = Math.round((width1 + width2) / 2)
        const outputHeight = Math.round((height1 + height2) / 2)

        // Create source points matrix
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

        // Create destination points matrix
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

        // Get perspective transform
        const M = cv.getPerspectiveTransform(srcPts, dstPts)

        // Read source image
        const src = cv.imread(sourceCanvas)

        // Create output mat
        const dst = new cv.Mat()

        // Apply perspective warp
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

        // Auto-rotate based on content analysis
        const rotation = analyzeOrientation(outputCanvas)
        if (rotation !== 0) {
          console.log(`Auto-rotating document by ${rotation}°`)
          return rotateCanvas(outputCanvas, rotation)
        }

        return outputCanvas
      } catch (err) {
        console.warn('Document extraction failed:', err)
        return null
      }
    },
    [captureVideoFrame, distance, analyzeOrientation, rotateCanvas]
  )

  // Compute derived state
  const bestQuad = bestQuadRef.current
  const isStable = bestQuad ? bestQuad.frameCount >= MIN_FRAMES_FOR_STABLE : false
  const isLocked =
    bestQuad &&
    bestQuad.frameCount >= LOCKED_FRAME_COUNT &&
    bestQuad.stabilityScore > 0.5

  // Get current best quad corners
  const getBestQuadCorners = useCallback((): Array<{ x: number; y: number }> | null => {
    const quad = bestQuadRef.current
    if (!quad) return null
    return [...quad.corners]
  }, [])

  // Capture source frame (expose captureVideoFrame)
  const captureSourceFrame = useCallback(
    (video: HTMLVideoElement): HTMLCanvasElement | null => {
      const frame = captureVideoFrame(video)
      if (!frame) return null
      // Return a copy so caller can keep it
      const copy = document.createElement('canvas')
      copy.width = frame.width
      copy.height = frame.height
      const ctx = copy.getContext('2d')
      ctx?.drawImage(frame, 0, 0)
      return copy
    },
    [captureVideoFrame]
  )

  return {
    isLoading,
    error,
    isReady: !isLoading && !error && cvRef.current !== null,
    isStable,
    isLocked: !!isLocked,
    debugInfo,
    cv: cvRef.current,
    getBestQuadCorners,
    captureSourceFrame,
    highlightDocument,
    extractDocument,
  }
}

export default useDocumentDetection
