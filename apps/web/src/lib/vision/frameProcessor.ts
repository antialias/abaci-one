/**
 * Frame Processor for Abacus Vision
 *
 * Handles slicing video frames into column strips based on calibration grid.
 * Uses perspective transform when available for accurate column extraction.
 */

import type { CalibrationGrid, ColumnMargins, ROI } from '@/types/vision'
import { isOpenCVReady, rectifyQuadrilateral } from './perspectiveTransform'

/**
 * Default margins to apply when slicing columns.
 * These account for the typical frame/border area around abacus columns.
 *
 * Based on typical soroban layouts where ArUco markers are at frame corners
 * but the actual bead columns are inset from the frame edges.
 */
export const DEFAULT_COLUMN_MARGINS: ColumnMargins = {
  left: 0.06, // 6% trim from left edge
  right: 0.06, // 6% trim from right edge
  top: 0.02, // 2% trim from top (small since reckoning bar is usually inside)
  bottom: 0.02, // 2% trim from bottom
}

/**
 * Extract the Region of Interest from a video frame
 *
 * @param ctx - Canvas 2D context with the video frame drawn
 * @param roi - Region of interest coordinates
 * @returns ImageData for the ROI area
 */
export function extractROI(ctx: CanvasRenderingContext2D, roi: ROI): ImageData {
  return ctx.getImageData(
    Math.round(roi.x),
    Math.round(roi.y),
    Math.round(roi.width),
    Math.round(roi.height)
  )
}

/**
 * Slice a ROI image into individual column strips
 *
 * @param roiImageData - The extracted ROI image data
 * @param calibration - Calibration grid with column dividers and optional margins
 * @returns Array of ImageData, one per column (left to right)
 */
export function sliceIntoColumns(
  roiImageData: ImageData,
  calibration: CalibrationGrid
): ImageData[] {
  const { width, height } = roiImageData
  const { columnDividers, columnCount, margins } = calibration

  // Create an offscreen canvas for slicing
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // Put the ROI image on the canvas
  ctx.putImageData(roiImageData, 0, 0)

  // Apply margins to get the effective column area
  // Margins are fractions of width/height to trim from each edge
  // Use default margins if none specified (common for ArUco auto-calibration)
  const effectiveMargins = margins ?? DEFAULT_COLUMN_MARGINS
  const leftMargin = effectiveMargins.left
  const rightMargin = effectiveMargins.right
  const topMargin = effectiveMargins.top
  const bottomMargin = effectiveMargins.bottom

  // Calculate effective area after margins
  const effectiveLeft = Math.round(leftMargin * width)
  const effectiveRight = Math.round((1 - rightMargin) * width)
  const effectiveTop = Math.round(topMargin * height)
  const effectiveBottom = Math.round((1 - bottomMargin) * height)
  const effectiveWidth = effectiveRight - effectiveLeft
  const effectiveHeight = effectiveBottom - effectiveTop

  if (effectiveWidth <= 0 || effectiveHeight <= 0) {
    console.warn('[frameProcessor] Invalid margins result in zero-size area')
    return []
  }

  const columns: ImageData[] = []

  // Calculate column boundaries within the effective area
  const boundaries = [0, ...columnDividers, 1]

  for (let i = 0; i < columnCount; i++) {
    const startX = effectiveLeft + Math.round(boundaries[i] * effectiveWidth)
    const endX = effectiveLeft + Math.round(boundaries[i + 1] * effectiveWidth)
    const colWidth = endX - startX

    if (colWidth <= 0) continue

    // Extract column strip (use effective height for vertical cropping)
    const columnData = ctx.getImageData(startX, effectiveTop, colWidth, effectiveHeight)
    columns.push(columnData)
  }

  return columns
}

/**
 * Convert ImageData to grayscale
 *
 * @param imageData - Color image data
 * @returns Grayscale image data
 */
export function toGrayscale(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data)

  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula: 0.299R + 0.587G + 0.114B
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    data[i] = gray // R
    data[i + 1] = gray // G
    data[i + 2] = gray // B
    // Alpha unchanged
  }

  return new ImageData(data, imageData.width, imageData.height)
}

/**
 * Resize ImageData to target dimensions
 *
 * @param imageData - Source image data
 * @param targetWidth - Target width
 * @param targetHeight - Target height
 * @returns Resized image data
 */
export function resizeImageData(
  imageData: ImageData,
  targetWidth: number,
  targetHeight: number
): ImageData {
  // Create source canvas
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = imageData.width
  srcCanvas.height = imageData.height
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true })!
  srcCtx.putImageData(imageData, 0, 0)

  // Create destination canvas with target size
  const dstCanvas = document.createElement('canvas')
  dstCanvas.width = targetWidth
  dstCanvas.height = targetHeight
  const dstCtx = dstCanvas.getContext('2d', { willReadFrequently: true })!

  // Use high-quality scaling
  dstCtx.imageSmoothingEnabled = true
  dstCtx.imageSmoothingQuality = 'high'

  // Draw scaled image
  dstCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight)

  return dstCtx.getImageData(0, 0, targetWidth, targetHeight)
}

/**
 * Process a video frame for classification using perspective-correct extraction
 *
 * Uses OpenCV perspective transform when available to handle camera angle.
 * Falls back to bounding box extraction if OpenCV not loaded.
 *
 * @param video - Video element with camera feed
 * @param calibration - Calibration grid (should have corners for perspective correction)
 * @param columnWidth - Target column width for model input
 * @param columnHeight - Target column height for model input
 * @returns Array of preprocessed column ImageData ready for classification
 */
export function processVideoFrame(
  video: HTMLVideoElement,
  calibration: CalibrationGrid,
  columnWidth: number = 64,
  columnHeight: number = 128
): ImageData[] {
  let roiData: ImageData

  // Try perspective transform if corners available and OpenCV ready
  if (calibration.corners && isOpenCVReady()) {
    const rectifiedCanvas = document.createElement('canvas')
    const success = rectifyQuadrilateral(video, calibration.corners, rectifiedCanvas, {
      // Output size: use consistent dimensions for ML training
      // Width based on number of columns, height for proper aspect ratio
      outputWidth: calibration.columnCount * columnWidth,
      outputHeight: columnHeight,
      rotate180: true, // Desk View camera needs rotation
    })

    if (success) {
      const ctx = rectifiedCanvas.getContext('2d')!
      roiData = ctx.getImageData(0, 0, rectifiedCanvas.width, rectifiedCanvas.height)
    } else {
      // Fall back to bounding box method
      roiData = extractROIFromVideo(video, calibration.roi)
    }
  } else {
    // No corners or OpenCV not ready - use bounding box
    roiData = extractROIFromVideo(video, calibration.roi)
  }

  // Slice into columns using equal divisions (perspective already corrected)
  const syntheticCalibration: CalibrationGrid = {
    ...calibration,
    roi: { x: 0, y: 0, width: roiData.width, height: roiData.height },
  }
  const columns = sliceIntoColumns(roiData, syntheticCalibration)

  // Preprocess each column
  return columns.map((col) => {
    // Convert to grayscale
    const gray = toGrayscale(col)
    // Resize to model input size
    return resizeImageData(gray, columnWidth, columnHeight)
  })
}

/**
 * Helper to extract ROI from video using bounding box (legacy method)
 */
function extractROIFromVideo(video: HTMLVideoElement, roi: ROI): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(video, 0, 0)
  return extractROI(ctx, roi)
}

/**
 * Calculate pixel difference between two frames for motion detection
 *
 * @param frame1 - First frame ImageData
 * @param frame2 - Second frame ImageData
 * @returns Ratio of changed pixels (0-1)
 */
export function calculateFrameDiff(frame1: ImageData, frame2: ImageData): number {
  if (frame1.width !== frame2.width || frame1.height !== frame2.height) {
    return 1 // Different sizes = assume motion
  }

  const threshold = 30 // Pixel difference threshold
  let changedPixels = 0
  const totalPixels = frame1.width * frame1.height

  for (let i = 0; i < frame1.data.length; i += 4) {
    // Compare grayscale values (use red channel since we convert to grayscale)
    const diff = Math.abs(frame1.data[i] - frame2.data[i])
    if (diff > threshold) {
      changedPixels++
    }
  }

  return changedPixels / totalPixels
}

/**
 * Combine column digits into a full number
 *
 * @param digits - Array of digits (left to right, highest place value first)
 * @returns The combined number
 */
export function digitsToNumber(digits: number[]): number {
  if (digits.length === 0) return 0

  let result = 0
  for (const digit of digits) {
    result = result * 10 + digit
  }
  return result
}

/**
 * Get minimum confidence from classification results
 *
 * @param confidences - Array of confidence values
 * @returns Minimum confidence
 */
export function getMinConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0
  return Math.min(...confidences)
}

/**
 * Process an image frame for classification (for remote camera frames)
 *
 * @param image - Image element with the frame
 * @param calibration - Calibration grid (if null, assumes entire image is the abacus)
 * @param columnCount - Number of columns to slice into
 * @param columnWidth - Target column width for model input
 * @param columnHeight - Target column height for model input
 * @returns Array of preprocessed column ImageData ready for classification
 */
export function processImageFrame(
  image: HTMLImageElement,
  calibration: CalibrationGrid | null,
  columnCount: number,
  columnWidth: number = 64,
  columnHeight: number = 128
): ImageData[] {
  // Create canvas for image frame
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // Draw image frame
  ctx.drawImage(image, 0, 0)

  let roiData: ImageData

  if (calibration) {
    // Extract ROI using calibration
    roiData = extractROI(ctx, calibration.roi)
  } else {
    // No calibration - use entire image as ROI (already cropped by phone)
    roiData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  // Create a synthetic calibration for slicing if none provided
  // IMPORTANT: When calibration is null (e.g., already-rectified canvas),
  // use small margins - the rectified view includes the frame area between ArUco markers,
  // but actual bead columns are slightly inset from the markers.
  // Use smaller margins than default (2% instead of 6%) since rectification is more precise.
  const sliceCalibration: CalibrationGrid = calibration ?? {
    roi: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    columnCount,
    columnDividers: Array.from({ length: columnCount - 1 }, (_, i) => (i + 1) / columnCount),
    rotation: 0,
    margins: { left: 0.02, right: 0.02, top: 0.02, bottom: 0.02 }, // Small margins for rectified images
  }

  // Slice into columns
  const columns = sliceIntoColumns(roiData, sliceCalibration)

  // Preprocess each column
  return columns.map((col) => {
    // Convert to grayscale
    const gray = toGrayscale(col)
    // Resize to model input size
    return resizeImageData(gray, columnWidth, columnHeight)
  })
}
