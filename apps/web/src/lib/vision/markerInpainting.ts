/**
 * Marker Inpainting Utility
 *
 * Removes ArUco markers from images for boundary detector training.
 * The model should learn to detect abacus boundaries by visual characteristics,
 * not by the presence of markers.
 *
 * Uses a simple blur-based inpainting approach:
 * 1. Identify marker regions from corner positions
 * 2. Replace each marker region with blurred surrounding context
 */

import type { QuadCorners, Point } from "@/types/vision";

/**
 * Marker size as a fraction of image width (ArUco markers are typically ~5% of frame)
 */
const DEFAULT_MARKER_SIZE_RATIO = 0.06;

/**
 * Blur radius as multiplier of marker size
 */
const BLUR_RADIUS_MULTIPLIER = 0.3;

/**
 * Sample radius as multiplier of marker size (for sampling surrounding pixels)
 */
const SAMPLE_RADIUS_MULTIPLIER = 1.2;

interface MarkerRegion {
  /** Center X in pixels */
  cx: number;
  /** Center Y in pixels */
  cy: number;
  /** Half-width in pixels */
  hw: number;
  /** Half-height in pixels */
  hh: number;
}

/**
 * Calculate the bounding region for a marker corner
 */
function getMarkerRegion(
  corner: Point,
  imageWidth: number,
  imageHeight: number,
  markerSizeRatio: number = DEFAULT_MARKER_SIZE_RATIO,
): MarkerRegion {
  // Denormalize if coordinates are in 0-1 range
  const cx = corner.x <= 1 ? corner.x * imageWidth : corner.x;
  const cy = corner.y <= 1 ? corner.y * imageHeight : corner.y;

  // Calculate marker size based on image dimensions
  const markerSize = Math.min(imageWidth, imageHeight) * markerSizeRatio;
  const hw = markerSize / 2;
  const hh = markerSize / 2;

  return { cx, cy, hw, hh };
}

/**
 * Sample the average color from a ring around a region (excluding the center)
 */
function sampleSurroundingColor(
  imageData: ImageData,
  region: MarkerRegion,
  sampleRadiusMult: number = SAMPLE_RADIUS_MULTIPLIER,
): { r: number; g: number; b: number } {
  const { cx, cy, hw, hh } = region;
  const sampleHw = hw * sampleRadiusMult;
  const sampleHh = hh * sampleRadiusMult;

  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  let r = 0,
    g = 0,
    b = 0,
    count = 0;

  // Sample pixels in the outer ring
  const left = Math.max(0, Math.floor(cx - sampleHw));
  const right = Math.min(width - 1, Math.ceil(cx + sampleHw));
  const top = Math.max(0, Math.floor(cy - sampleHh));
  const bottom = Math.min(height - 1, Math.ceil(cy + sampleHh));

  const innerLeft = Math.floor(cx - hw);
  const innerRight = Math.ceil(cx + hw);
  const innerTop = Math.floor(cy - hh);
  const innerBottom = Math.ceil(cy + hh);

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      // Skip pixels inside the marker region
      if (
        x >= innerLeft &&
        x <= innerRight &&
        y >= innerTop &&
        y <= innerBottom
      ) {
        continue;
      }

      const idx = (y * width + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      count++;
    }
  }

  if (count === 0) {
    return { r: 128, g: 128, b: 128 }; // Default gray
  }

  return {
    r: Math.round(r / count),
    g: Math.round(g / count),
    b: Math.round(b / count),
  };
}

/**
 * Apply a simple blur/fill to a region using surrounding colors
 * with a gradual falloff from edges
 */
function fillRegionWithGradient(
  imageData: ImageData,
  region: MarkerRegion,
  surroundingColor: { r: number; g: number; b: number },
): void {
  const { cx, cy, hw, hh } = region;
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;

  const left = Math.max(0, Math.floor(cx - hw));
  const right = Math.min(width - 1, Math.ceil(cx + hw));
  const top = Math.max(0, Math.floor(cy - hh));
  const bottom = Math.min(height - 1, Math.ceil(cy + hh));

  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      const idx = (y * width + x) * 4;

      // Calculate distance from center as fraction (0 at center, 1 at edge)
      const dx = (x - cx) / hw;
      const dy = (y - cy) / hh;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only fill inside an ellipse
      if (dist <= 1) {
        // Blend factor: more blending near center, less near edges
        const blend = Math.cos((dist * Math.PI) / 2); // 1 at center, 0 at edge

        // Get original pixel
        const origR = data[idx];
        const origG = data[idx + 1];
        const origB = data[idx + 2];

        // Blend with surrounding color
        data[idx] = Math.round(
          origR * (1 - blend) + surroundingColor.r * blend,
        );
        data[idx + 1] = Math.round(
          origG * (1 - blend) + surroundingColor.g * blend,
        );
        data[idx + 2] = Math.round(
          origB * (1 - blend) + surroundingColor.b * blend,
        );
        // Alpha unchanged
      }
    }
  }
}

/**
 * Remove markers from an image by inpainting the marker regions
 *
 * @param canvas - Canvas element with the source image
 * @param corners - Normalized corner positions (0-1 range)
 * @param markerSizeRatio - Size of markers as fraction of image width
 * @returns New canvas with markers removed
 */
export function inpaintMarkers(
  canvas: HTMLCanvasElement,
  corners: QuadCorners,
  markerSizeRatio: number = DEFAULT_MARKER_SIZE_RATIO,
): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  const width = canvas.width;
  const height = canvas.height;

  // Create output canvas
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) {
    throw new Error("Failed to get output canvas context");
  }

  // Copy source to output
  outputCtx.drawImage(canvas, 0, 0);

  // Get image data for manipulation
  const imageData = outputCtx.getImageData(0, 0, width, height);

  // Process each corner
  const cornerList: Point[] = [
    corners.topLeft,
    corners.topRight,
    corners.bottomLeft,
    corners.bottomRight,
  ];

  for (const corner of cornerList) {
    const region = getMarkerRegion(corner, width, height, markerSizeRatio);
    const surroundingColor = sampleSurroundingColor(imageData, region);
    fillRegionWithGradient(imageData, region, surroundingColor);
  }

  // Write back
  outputCtx.putImageData(imageData, 0, 0);

  return outputCanvas;
}

/**
 * Remove markers from an ImageData object
 *
 * @param imageData - Source image data
 * @param corners - Normalized corner positions (0-1 range)
 * @param markerSizeRatio - Size of markers as fraction of image width
 * @returns New ImageData with markers removed
 */
export function inpaintMarkersImageData(
  imageData: ImageData,
  corners: QuadCorners,
  markerSizeRatio: number = DEFAULT_MARKER_SIZE_RATIO,
): ImageData {
  const width = imageData.width;
  const height = imageData.height;

  // Clone the image data
  const outputData = new ImageData(
    new Uint8ClampedArray(imageData.data),
    width,
    height,
  );

  // Process each corner
  const cornerList: Point[] = [
    corners.topLeft,
    corners.topRight,
    corners.bottomLeft,
    corners.bottomRight,
  ];

  for (const corner of cornerList) {
    const region = getMarkerRegion(corner, width, height, markerSizeRatio);
    const surroundingColor = sampleSurroundingColor(outputData, region);
    fillRegionWithGradient(outputData, region, surroundingColor);
  }

  return outputData;
}

/**
 * Convert image data to base64 PNG with markers inpainted
 *
 * @param imageData - Source image data
 * @param corners - Normalized corner positions (0-1 range)
 * @param markerSizeRatio - Size of markers as fraction of image width
 * @returns Base64 encoded PNG string (without data URL prefix)
 */
export function inpaintToBase64Png(
  imageData: ImageData,
  corners: QuadCorners,
  markerSizeRatio: number = DEFAULT_MARKER_SIZE_RATIO,
): string {
  const inpainted = inpaintMarkersImageData(
    imageData,
    corners,
    markerSizeRatio,
  );

  // Create canvas to convert to PNG
  const canvas = document.createElement("canvas");
  canvas.width = inpainted.width;
  canvas.height = inpainted.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.putImageData(inpainted, 0, 0);

  // Convert to base64
  const dataUrl = canvas.toDataURL("image/png");
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}
