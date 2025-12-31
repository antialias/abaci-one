/**
 * Perspective Transform utilities using OpenCV.js
 *
 * Provides functions to rectify a quadrilateral region from a video frame
 * into a rectangle, correcting for camera perspective distortion.
 */

import type { QuadCorners } from '@/types/vision'

// OpenCV.js types (minimal subset we need)
declare global {
  interface Window {
    cv: {
      Mat: new (rows?: number, cols?: number, type?: number) => CvMat
      matFromImageData: (imageData: ImageData) => CvMat
      matFromArray: (rows: number, cols: number, type: number, data: number[]) => CvMat
      CV_8UC4: number
      CV_32FC1: number
      CV_32FC2: number
      getPerspectiveTransform: (src: CvMat, dst: CvMat) => CvMat
      warpPerspective: (
        src: CvMat,
        dst: CvMat,
        M: CvMat,
        dsize: { width: number; height: number },
        flags?: number,
        borderMode?: number,
        borderValue?: unknown
      ) => void
      cvtColor: (src: CvMat, dst: CvMat, code: number) => void
      COLOR_RGBA2RGB: number
      COLOR_RGB2RGBA: number
      INTER_LINEAR: number
      BORDER_CONSTANT: number
      onRuntimeInitialized?: () => void
    }
  }

  interface CvMat {
    rows: number
    cols: number
    data: Uint8Array
    data32F: Float32Array
    delete: () => void
  }
}

let opencvLoaded = false
let opencvLoadPromise: Promise<void> | null = null

/**
 * Load OpenCV.js dynamically
 */
export async function loadOpenCV(): Promise<void> {
  if (opencvLoaded) return

  if (opencvLoadPromise) {
    return opencvLoadPromise
  }

  opencvLoadPromise = new Promise<void>((resolve, reject) => {
    // Check if already loaded
    if (typeof window !== 'undefined' && window.cv && window.cv.Mat) {
      opencvLoaded = true
      resolve()
      return
    }

    // Load the script
    const script = document.createElement('script')
    script.src = '/opencv.js'
    script.async = true

    script.onload = () => {
      // OpenCV.js uses a callback when ready
      if (window.cv && window.cv.onRuntimeInitialized !== undefined) {
        window.cv.onRuntimeInitialized = () => {
          opencvLoaded = true
          resolve()
        }
      } else {
        // Fallback: poll for cv.Mat availability
        const checkReady = setInterval(() => {
          if (window.cv && window.cv.Mat) {
            clearInterval(checkReady)
            opencvLoaded = true
            resolve()
          }
        }, 100)

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkReady)
          if (!opencvLoaded) {
            reject(new Error('OpenCV.js failed to initialize'))
          }
        }, 10000)
      }
    }

    script.onerror = () => {
      reject(new Error('Failed to load OpenCV.js'))
    }

    document.head.appendChild(script)
  })

  return opencvLoadPromise
}

/**
 * Check if OpenCV is loaded and ready
 */
export function isOpenCVReady(): boolean {
  return opencvLoaded && typeof window !== 'undefined' && !!window.cv?.Mat
}

export interface RectifyOptions {
  /** Output width (default: calculated from quad aspect ratio) */
  outputWidth?: number
  /** Output height (default: calculated from quad aspect ratio) */
  outputHeight?: number
}

/**
 * Rectify a quadrilateral region from video to a rectangle
 *
 * @param video - Source video element
 * @param corners - Quadrilateral corners in video coordinates
 * @param canvas - Destination canvas for rectified output
 * @param options - Output size options
 */
export function rectifyQuadrilateral(
  video: HTMLVideoElement,
  corners: QuadCorners,
  canvas: HTMLCanvasElement,
  options: RectifyOptions = {}
): boolean {
  if (!isOpenCVReady()) {
    console.warn('[perspectiveTransform] OpenCV not ready')
    return false
  }

  const cv = window.cv

  // Calculate default output dimensions based on quad size
  const topWidth = Math.hypot(
    corners.topRight.x - corners.topLeft.x,
    corners.topRight.y - corners.topLeft.y
  )
  const bottomWidth = Math.hypot(
    corners.bottomRight.x - corners.bottomLeft.x,
    corners.bottomRight.y - corners.bottomLeft.y
  )
  const leftHeight = Math.hypot(
    corners.bottomLeft.x - corners.topLeft.x,
    corners.bottomLeft.y - corners.topLeft.y
  )
  const rightHeight = Math.hypot(
    corners.bottomRight.x - corners.topRight.x,
    corners.bottomRight.y - corners.topRight.y
  )

  const avgWidth = (topWidth + bottomWidth) / 2
  const avgHeight = (leftHeight + rightHeight) / 2

  const outputWidth = options.outputWidth ?? Math.round(avgWidth)
  const outputHeight = options.outputHeight ?? Math.round(avgHeight)

  // Set canvas size
  canvas.width = outputWidth
  canvas.height = outputHeight

  // Create temporary canvas to capture video frame
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = video.videoWidth
  tempCanvas.height = video.videoHeight
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) return false

  // Draw video frame
  tempCtx.drawImage(video, 0, 0)
  const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)

  // Create OpenCV matrices
  let srcMat: CvMat | null = null
  let dstMat: CvMat | null = null
  let srcPoints: CvMat | null = null
  let dstPoints: CvMat | null = null
  let transformMatrix: CvMat | null = null

  try {
    // Source image
    srcMat = cv.matFromImageData(imageData)

    // Source points - swap diagonally for webcam orientation
    // Screen topLeft → physical bottomRight, etc.
    // Order matches destination: TL, TR, BR, BL (physical/output positions)
    srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      corners.bottomRight.x,
      corners.bottomRight.y, // screen BR → output TL
      corners.bottomLeft.x,
      corners.bottomLeft.y, // screen BL → output TR
      corners.topLeft.x,
      corners.topLeft.y, // screen TL → output BR
      corners.topRight.x,
      corners.topRight.y, // screen TR → output BL
    ])

    // Destination points (rectangle corners) - map to standard rectangle
    // Order: TL, TR, BR, BL (matching source points order)
    dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0, // TL → top-left of output
      outputWidth,
      0, // TR → top-right of output
      outputWidth,
      outputHeight, // BR → bottom-right of output
      0,
      outputHeight, // BL → bottom-left of output
    ])

    // Calculate perspective transform matrix
    transformMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints)

    // Create output matrix
    dstMat = new cv.Mat(outputHeight, outputWidth, cv.CV_8UC4)

    // Apply perspective warp
    cv.warpPerspective(
      srcMat,
      dstMat,
      transformMatrix,
      { width: outputWidth, height: outputHeight },
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT
    )

    // Copy result to canvas
    const outputCtx = canvas.getContext('2d')
    if (!outputCtx) return false

    const outputData = new ImageData(new Uint8ClampedArray(dstMat.data), outputWidth, outputHeight)
    outputCtx.putImageData(outputData, 0, 0)

    return true
  } catch (err) {
    console.error('[perspectiveTransform] Error:', err)
    return false
  } finally {
    // Clean up OpenCV matrices
    srcMat?.delete()
    dstMat?.delete()
    srcPoints?.delete()
    dstPoints?.delete()
    transformMatrix?.delete()
  }
}

/**
 * Create a rectified frame processor that continuously updates a canvas
 *
 * @param video - Source video element
 * @param corners - Quadrilateral corners
 * @param canvas - Output canvas
 * @param options - Rectify options
 * @returns Stop function
 */
export function createRectifiedFrameLoop(
  video: HTMLVideoElement,
  corners: QuadCorners,
  canvas: HTMLCanvasElement,
  options: RectifyOptions = {}
): () => void {
  let running = true
  let animationId: number | null = null

  const processFrame = () => {
    if (!running) return

    if (video.readyState >= 2) {
      // HAVE_CURRENT_DATA
      rectifyQuadrilateral(video, corners, canvas, options)
    }

    animationId = requestAnimationFrame(processFrame)
  }

  processFrame()

  return () => {
    running = false
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
    }
  }
}
