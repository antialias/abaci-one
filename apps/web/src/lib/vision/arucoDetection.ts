/**
 * ArUco Marker Detection for automatic abacus calibration
 *
 * Uses js-aruco2 pure JavaScript library to detect fiducial markers placed on
 * the corners of a physical abacus for automatic perspective calibration.
 *
 * Marker IDs:
 * - 0: Top-left corner
 * - 1: Top-right corner
 * - 2: Bottom-right corner
 * - 3: Bottom-left corner
 *
 * We use the ARUCO dictionary (7x7 markers, IDs 0-1022) for reliable detection.
 */

import type { Point, QuadCorners } from '@/types/vision'

// js-aruco2 types
interface ArucoMarker {
  id: number
  corners: Array<{ x: number; y: number }>
}

interface ArucoDetector {
  detect: (imageData: ImageData) => ArucoMarker[]
}

interface ArucoDictionary {
  generateSVG: (id: number) => string
}

// Global AR namespace from js-aruco2
interface ARNamespace {
  Detector: new (options?: {
    dictionaryName?: string
    maxHammingDistance?: number
  }) => ArucoDetector
  Dictionary: new (dictionaryName: string) => ArucoDictionary
}

declare global {
  interface Window {
    AR?: ARNamespace
  }
}

let arucoLoadPromise: Promise<void> | null = null
let arucoLoaded = false

/**
 * Load js-aruco2 library dynamically
 */
export async function loadAruco(): Promise<void> {
  if (arucoLoaded) return
  if (arucoLoadPromise) return arucoLoadPromise

  arucoLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('js-aruco2 requires browser environment'))
      return
    }

    // Check if already loaded
    if (window.AR) {
      arucoLoaded = true
      resolve()
      return
    }

    // Load cv.js first (dependency)
    const cvScript = document.createElement('script')
    cvScript.src = '/js-aruco2/cv.js'
    cvScript.async = true

    cvScript.onload = () => {
      // Then load aruco.js
      const arucoScript = document.createElement('script')
      arucoScript.src = '/js-aruco2/aruco.js'
      arucoScript.async = true

      arucoScript.onload = () => {
        if (window.AR) {
          arucoLoaded = true
          console.log('[ArUco] js-aruco2 loaded successfully')
          resolve()
        } else {
          reject(new Error('js-aruco2 failed to initialize'))
        }
      }

      arucoScript.onerror = () => {
        reject(new Error('Failed to load js-aruco2/aruco.js'))
      }

      document.head.appendChild(arucoScript)
    }

    cvScript.onerror = () => {
      reject(new Error('Failed to load js-aruco2/cv.js'))
    }

    document.head.appendChild(cvScript)
  })

  return arucoLoadPromise
}

/** Corner ID assignments for abacus calibration */
export const MARKER_IDS = {
  TOP_LEFT: 0,
  TOP_RIGHT: 1,
  BOTTOM_RIGHT: 2,
  BOTTOM_LEFT: 3,
} as const

/** Result of marker detection */
export interface MarkerDetectionResult {
  /** Whether all 4 corner markers were detected */
  allMarkersFound: boolean
  /** Number of markers detected (0-4) */
  markersFound: number
  /** Detected marker positions by ID */
  markers: Map<number, MarkerCorners>
  /** Computed quad corners if all markers found */
  quadCorners: QuadCorners | null
}

/** Corner positions for a single ArUco marker */
export interface MarkerCorners {
  /** Top-left corner of the marker */
  topLeft: Point
  /** Top-right corner of the marker */
  topRight: Point
  /** Bottom-right corner of the marker */
  bottomRight: Point
  /** Bottom-left corner of the marker */
  bottomLeft: Point
  /** Center of the marker */
  center: Point
}

let detector: ArucoDetector | null = null
let dictionary: ArucoDictionary | null = null
let isInitialized = false

/**
 * Check if ArUco detection is available
 */
export function isArucoAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.AR && typeof window.AR.Detector === 'function'
}

/**
 * Initialize the ArUco detector
 */
export function initArucoDetector(): boolean {
  if (isInitialized && detector) {
    return true
  }

  if (!isArucoAvailable()) {
    console.warn('[ArUco] js-aruco2 not loaded yet')
    return false
  }

  try {
    detector = new window.AR!.Detector({ dictionaryName: 'ARUCO' })
    dictionary = new window.AR!.Dictionary('ARUCO')
    isInitialized = true
    console.log('[ArUco] Detector initialized successfully')
    return true
  } catch (err) {
    console.error('[ArUco] Failed to initialize detector:', err)
    return false
  }
}

/**
 * Clean up ArUco detector resources
 */
export function cleanupArucoDetector(): void {
  detector = null
  dictionary = null
  isInitialized = false
}

/**
 * Extract corner positions from js-aruco2 marker
 */
function extractMarkerCorners(marker: ArucoMarker): MarkerCorners {
  // js-aruco2 corners are in order: TL, TR, BR, BL
  const corners = marker.corners
  const topLeft = { x: corners[0].x, y: corners[0].y }
  const topRight = { x: corners[1].x, y: corners[1].y }
  const bottomRight = { x: corners[2].x, y: corners[2].y }
  const bottomLeft = { x: corners[3].x, y: corners[3].y }

  const center = {
    x: (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4,
    y: (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4,
  }

  return { topLeft, topRight, bottomRight, bottomLeft, center }
}

/**
 * Get the inner corner of a marker (the corner closest to abacus center)
 * based on which position the marker is placed at
 */
function getInnerCorner(marker: MarkerCorners, markerId: number): Point {
  switch (markerId) {
    case MARKER_IDS.TOP_LEFT:
      return marker.bottomRight // Inner corner is bottom-right
    case MARKER_IDS.TOP_RIGHT:
      return marker.bottomLeft // Inner corner is bottom-left
    case MARKER_IDS.BOTTOM_RIGHT:
      return marker.topLeft // Inner corner is top-left
    case MARKER_IDS.BOTTOM_LEFT:
      return marker.topRight // Inner corner is top-right
    default:
      return marker.center
  }
}

/**
 * Detect ArUco markers in a video frame
 */
export function detectMarkers(
  video: HTMLVideoElement,
  canvas?: HTMLCanvasElement
): MarkerDetectionResult {
  const result: MarkerDetectionResult = {
    allMarkersFound: false,
    markersFound: 0,
    markers: new Map(),
    quadCorners: null,
  }

  if (!detector) {
    if (!initArucoDetector()) {
      return result
    }
  }

  if (!detector) return result

  // Create temporary canvas if not provided
  const tempCanvas = canvas || document.createElement('canvas')
  tempCanvas.width = video.videoWidth
  tempCanvas.height = video.videoHeight

  const ctx = tempCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return result

  // Draw video frame to canvas
  ctx.drawImage(video, 0, 0)
  const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)

  try {
    // Detect markers using js-aruco2
    const markers = detector.detect(imageData)

    // Filter to only our corner markers (IDs 0-3)
    const cornerMarkers = markers.filter(
      (m) =>
        m.id === MARKER_IDS.TOP_LEFT ||
        m.id === MARKER_IDS.TOP_RIGHT ||
        m.id === MARKER_IDS.BOTTOM_RIGHT ||
        m.id === MARKER_IDS.BOTTOM_LEFT
    )

    result.markersFound = cornerMarkers.length

    for (const marker of cornerMarkers) {
      const markerCorners = extractMarkerCorners(marker)
      result.markers.set(marker.id, markerCorners)
    }

    // Check if all 4 corner markers were found
    const hasAllMarkers =
      result.markers.has(MARKER_IDS.TOP_LEFT) &&
      result.markers.has(MARKER_IDS.TOP_RIGHT) &&
      result.markers.has(MARKER_IDS.BOTTOM_RIGHT) &&
      result.markers.has(MARKER_IDS.BOTTOM_LEFT)

    if (hasAllMarkers) {
      result.allMarkersFound = true

      // Get marker centers - more reliable than corners for orientation
      const tlMarker = result.markers.get(MARKER_IDS.TOP_LEFT)!
      const trMarker = result.markers.get(MARKER_IDS.TOP_RIGHT)!
      const brMarker = result.markers.get(MARKER_IDS.BOTTOM_RIGHT)!
      const blMarker = result.markers.get(MARKER_IDS.BOTTOM_LEFT)!

      // Use marker centers to define the quad
      // Desk View camera shows a 180° rotated view (flipped both vertically and horizontally)
      // So marker 0 (physical top-left) appears at bottom-right in the image, etc.
      result.quadCorners = {
        topLeft: brMarker.center,
        topRight: blMarker.center,
        bottomRight: tlMarker.center,
        bottomLeft: trMarker.center,
      }
    }
  } catch (err) {
    console.error('[ArUco] Detection error:', err)
  }

  return result
}

/**
 * Generate SVG for an ArUco marker using js-aruco2's built-in generator
 */
export function generateMarkerSVG(markerId: number, size: number = 100): string {
  // Initialize dictionary if needed
  if (!dictionary) {
    if (!isArucoAvailable()) {
      // Fallback: return placeholder SVG if library not loaded
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="white" stroke="black" stroke-width="2"/>
  <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="middle" font-size="12">${markerId}</text>
</svg>`
    }
    dictionary = new window.AR!.Dictionary('ARUCO')
  }

  try {
    // Get SVG from js-aruco2
    const svg = dictionary!.generateSVG(markerId)

    // The generated SVG may need size adjustment
    // Parse and resize the SVG
    const parser = new DOMParser()
    const doc = parser.parseFromString(svg, 'image/svg+xml')
    const svgElement = doc.documentElement

    svgElement.setAttribute('width', String(size))
    svgElement.setAttribute('height', String(size))

    return new XMLSerializer().serializeToString(svgElement)
  } catch (err) {
    console.error('[ArUco] Failed to generate marker SVG:', err)
    // Fallback
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="white" stroke="black" stroke-width="2"/>
  <text x="${size / 2}" y="${size / 2}" text-anchor="middle" dominant-baseline="middle" font-size="12">${markerId}</text>
</svg>`
  }
}

/**
 * Get label for marker position
 */
export function getMarkerPositionLabel(markerId: number): string {
  switch (markerId) {
    case MARKER_IDS.TOP_LEFT:
      return 'Top Left'
    case MARKER_IDS.TOP_RIGHT:
      return 'Top Right'
    case MARKER_IDS.BOTTOM_RIGHT:
      return 'Bottom Right'
    case MARKER_IDS.BOTTOM_LEFT:
      return 'Bottom Left'
    default:
      return `Marker ${markerId}`
  }
}
