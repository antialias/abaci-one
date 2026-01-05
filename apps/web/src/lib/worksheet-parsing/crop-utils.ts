/**
 * Shared utilities for cropping images to bounding box regions.
 *
 * Used by:
 * - Server-side: parse-selected/route.ts (with sharp)
 * - Client-side: PhotoViewerEditor.tsx (with canvas)
 */

/** Default padding around bounding box (2% of image dimensions) */
export const CROP_PADDING = 0.02

/** Normalized bounding box (0-1 coordinates) */
export interface NormalizedBoundingBox {
  x: number
  y: number
  width: number
  height: number
}

/** Pixel-based crop region */
export interface CropRegion {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Calculate pixel-based crop region from normalized bounding box.
 * This is the shared algorithm used by both server (sharp) and client (canvas).
 *
 * @param box - Normalized bounding box (0-1 coordinates)
 * @param imageWidth - Actual image width in pixels
 * @param imageHeight - Actual image height in pixels
 * @param padding - Padding around the box as fraction of image (default: 0.02 = 2%)
 * @returns Pixel-based crop region clamped to image bounds
 */
export function calculateCropRegion(
  box: NormalizedBoundingBox,
  imageWidth: number,
  imageHeight: number,
  padding: number = CROP_PADDING
): CropRegion {
  // Convert normalized coordinates to pixels with padding
  const left = Math.max(0, Math.floor((box.x - padding) * imageWidth))
  const top = Math.max(0, Math.floor((box.y - padding) * imageHeight))
  const width = Math.min(imageWidth - left, Math.ceil((box.width + padding * 2) * imageWidth))
  const height = Math.min(imageHeight - top, Math.ceil((box.height + padding * 2) * imageHeight))

  return { left, top, width, height }
}

/**
 * Crop an image to a bounding box region using canvas (client-side).
 *
 * @param imageUrl - URL of the image to crop
 * @param box - Normalized bounding box (0-1 coordinates)
 * @param padding - Padding around the box as fraction of image (default: 0.02 = 2%)
 * @returns Promise resolving to cropped image as data URL
 */
export async function cropImageWithCanvas(
  imageUrl: string,
  box: NormalizedBoundingBox,
  padding: number = CROP_PADDING
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const { naturalWidth: imageWidth, naturalHeight: imageHeight } = img
      const region = calculateCropRegion(box, imageWidth, imageHeight, padding)

      // Create canvas and draw cropped region
      const canvas = document.createElement('canvas')
      canvas.width = region.width
      canvas.height = region.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(
        img,
        region.left,
        region.top,
        region.width,
        region.height,
        0,
        0,
        region.width,
        region.height
      )
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = imageUrl
  })
}
