/**
 * Marker Masking Utility
 *
 * Masks ArUco markers in images to prevent the model from "cheating"
 * by learning to detect markers instead of the actual abacus frame.
 *
 * Used during training data visualization and preprocessing.
 */

import {
  loadAruco,
  initArucoDetector,
  MARKER_IDS,
  type MarkerCorners,
} from "./arucoDetection";

// Re-export the ArUco marker interface for use by consumers
export type { MarkerCorners };

interface ArucoMarker {
  id: number;
  corners: Array<{ x: number; y: number }>;
}

interface ArucoDetector {
  detect: (imageData: ImageData) => ArucoMarker[];
}

/**
 * Result of marker masking operation
 */
export interface MarkerMaskingResult {
  /** The masked image as a data URL */
  maskedImageUrl: string;
  /** Number of markers that were masked */
  markersMasked: number;
  /** Detected marker positions (for visualization) */
  markerPositions: MarkerCorners[];
  /** Original image dimensions */
  width: number;
  height: number;
}

/**
 * Fill type for masked regions
 */
export type MaskFillType = "noise" | "gray" | "localMean";

/**
 * Extract corner positions from js-aruco2 marker
 */
function extractMarkerCorners(marker: ArucoMarker): MarkerCorners {
  const corners = marker.corners;
  const topLeft = { x: corners[0].x, y: corners[0].y };
  const topRight = { x: corners[1].x, y: corners[1].y };
  const bottomRight = { x: corners[2].x, y: corners[2].y };
  const bottomLeft = { x: corners[3].x, y: corners[3].y };

  const center = {
    x: (topLeft.x + topRight.x + bottomRight.x + bottomLeft.x) / 4,
    y: (topLeft.y + topRight.y + bottomRight.y + bottomLeft.y) / 4,
  };

  return { topLeft, topRight, bottomRight, bottomLeft, center };
}

/**
 * Get bounding box of a marker with optional padding
 */
function getMarkerBounds(
  marker: MarkerCorners,
  padding: number = 0,
): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const xs = [
    marker.topLeft.x,
    marker.topRight.x,
    marker.bottomRight.x,
    marker.bottomLeft.x,
  ];
  const ys = [
    marker.topLeft.y,
    marker.topRight.y,
    marker.bottomRight.y,
    marker.bottomLeft.y,
  ];

  return {
    minX: Math.min(...xs) - padding,
    minY: Math.min(...ys) - padding,
    maxX: Math.max(...xs) + padding,
    maxY: Math.max(...ys) + padding,
  };
}

/**
 * Fill a polygon region with noise
 */
function fillPolygonWithNoise(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  marker: MarkerCorners,
  padding: number = 5,
): void {
  const bounds = getMarkerBounds(marker, padding);
  const { minX, minY, maxX, maxY } = bounds;

  // Clamp to image bounds
  const startX = Math.max(0, Math.floor(minX));
  const startY = Math.max(0, Math.floor(minY));
  const endX = Math.min(imageData.width, Math.ceil(maxX));
  const endY = Math.min(imageData.height, Math.ceil(maxY));

  // Create polygon path for hit testing
  const path = new Path2D();
  path.moveTo(marker.topLeft.x, marker.topLeft.y);
  path.lineTo(marker.topRight.x, marker.topRight.y);
  path.lineTo(marker.bottomRight.x, marker.bottomRight.y);
  path.lineTo(marker.bottomLeft.x, marker.bottomLeft.y);
  path.closePath();

  // Expand the path slightly for padding
  const expandedPath = new Path2D();
  const cx = marker.center.x;
  const cy = marker.center.y;
  const scale = 1 + padding / 50; // Approximate scaling

  expandedPath.moveTo(
    cx + (marker.topLeft.x - cx) * scale,
    cy + (marker.topLeft.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.topRight.x - cx) * scale,
    cy + (marker.topRight.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.bottomRight.x - cx) * scale,
    cy + (marker.bottomRight.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.bottomLeft.x - cx) * scale,
    cy + (marker.bottomLeft.y - cy) * scale,
  );
  expandedPath.closePath();

  // Fill pixels within the expanded polygon with noise
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (ctx.isPointInPath(expandedPath, x, y)) {
        const idx = (y * imageData.width + x) * 4;
        // Random noise with some base gray
        const noise = Math.random() * 80 + 88; // 88-168 range (grayish noise)
        imageData.data[idx] = noise;
        imageData.data[idx + 1] = noise;
        imageData.data[idx + 2] = noise;
        // Keep alpha at 255
      }
    }
  }
}

/**
 * Fill a polygon region with solid gray
 */
function fillPolygonWithGray(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  marker: MarkerCorners,
  padding: number = 5,
): void {
  const bounds = getMarkerBounds(marker, padding);
  const { minX, minY, maxX, maxY } = bounds;

  const startX = Math.max(0, Math.floor(minX));
  const startY = Math.max(0, Math.floor(minY));
  const endX = Math.min(imageData.width, Math.ceil(maxX));
  const endY = Math.min(imageData.height, Math.ceil(maxY));

  const cx = marker.center.x;
  const cy = marker.center.y;
  const scale = 1 + padding / 50;

  const expandedPath = new Path2D();
  expandedPath.moveTo(
    cx + (marker.topLeft.x - cx) * scale,
    cy + (marker.topLeft.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.topRight.x - cx) * scale,
    cy + (marker.topRight.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.bottomRight.x - cx) * scale,
    cy + (marker.bottomRight.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.bottomLeft.x - cx) * scale,
    cy + (marker.bottomLeft.y - cy) * scale,
  );
  expandedPath.closePath();

  const gray = 128;

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (ctx.isPointInPath(expandedPath, x, y)) {
        const idx = (y * imageData.width + x) * 4;
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
      }
    }
  }
}

/**
 * Fill a polygon region with local mean color (from surrounding pixels)
 */
function fillPolygonWithLocalMean(
  ctx: CanvasRenderingContext2D,
  imageData: ImageData,
  marker: MarkerCorners,
  padding: number = 5,
): void {
  const bounds = getMarkerBounds(marker, padding);
  const { minX, minY, maxX, maxY } = bounds;

  const startX = Math.max(0, Math.floor(minX));
  const startY = Math.max(0, Math.floor(minY));
  const endX = Math.min(imageData.width, Math.ceil(maxX));
  const endY = Math.min(imageData.height, Math.ceil(maxY));

  // Calculate mean color from border pixels
  let sumR = 0,
    sumG = 0,
    sumB = 0,
    count = 0;

  // Sample from border region
  const borderWidth = 10;
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const isInBorder =
        x < startX + borderWidth ||
        x >= endX - borderWidth ||
        y < startY + borderWidth ||
        y >= endY - borderWidth;

      if (isInBorder) {
        const idx = (y * imageData.width + x) * 4;
        sumR += imageData.data[idx];
        sumG += imageData.data[idx + 1];
        sumB += imageData.data[idx + 2];
        count++;
      }
    }
  }

  const meanR = count > 0 ? sumR / count : 128;
  const meanG = count > 0 ? sumG / count : 128;
  const meanB = count > 0 ? sumB / count : 128;

  const cx = marker.center.x;
  const cy = marker.center.y;
  const scale = 1 + padding / 50;

  const expandedPath = new Path2D();
  expandedPath.moveTo(
    cx + (marker.topLeft.x - cx) * scale,
    cy + (marker.topLeft.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.topRight.x - cx) * scale,
    cy + (marker.topRight.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.bottomRight.x - cx) * scale,
    cy + (marker.bottomRight.y - cy) * scale,
  );
  expandedPath.lineTo(
    cx + (marker.bottomLeft.x - cx) * scale,
    cy + (marker.bottomLeft.y - cy) * scale,
  );
  expandedPath.closePath();

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      if (ctx.isPointInPath(expandedPath, x, y)) {
        const idx = (y * imageData.width + x) * 4;
        // Add slight noise to local mean to prevent solid color pattern
        const noiseAmount = 15;
        imageData.data[idx] = Math.min(
          255,
          Math.max(0, meanR + (Math.random() - 0.5) * noiseAmount),
        );
        imageData.data[idx + 1] = Math.min(
          255,
          Math.max(0, meanG + (Math.random() - 0.5) * noiseAmount),
        );
        imageData.data[idx + 2] = Math.min(
          255,
          Math.max(0, meanB + (Math.random() - 0.5) * noiseAmount),
        );
      }
    }
  }
}

/**
 * Load an image from a URL into a canvas
 */
async function loadImageToCanvas(imageSrc: string): Promise<{
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0);
      resolve({ canvas, ctx });
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${imageSrc}`));
    };

    img.src = imageSrc;
  });
}

/**
 * Detect and mask ArUco markers in an image
 *
 * @param imageSrc - URL of the image to process
 * @param fillType - How to fill masked regions: 'noise', 'gray', or 'localMean'
 * @param markerPadding - Pixels of padding around each marker to mask
 * @returns Promise resolving to masking result with data URL
 */
export async function maskMarkersInImage(
  imageSrc: string,
  fillType: MaskFillType = "noise",
  markerPadding: number = 10,
): Promise<MarkerMaskingResult> {
  // Ensure ArUco library is loaded
  await loadAruco();
  initArucoDetector();

  // Load image
  const { canvas, ctx } = await loadImageToCanvas(imageSrc);

  // Get image data for marker detection
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Detect markers
  const AR = (
    window as { AR?: { Detector: new (options?: object) => ArucoDetector } }
  ).AR;
  if (!AR) {
    throw new Error("ArUco library not loaded");
  }

  const detector = new AR.Detector({ dictionaryName: "ARUCO" });
  const markers = detector.detect(imageData);

  // Filter to our corner markers (IDs 0-3)
  const cornerMarkers = markers.filter(
    (m) =>
      m.id === MARKER_IDS.TOP_LEFT ||
      m.id === MARKER_IDS.TOP_RIGHT ||
      m.id === MARKER_IDS.BOTTOM_RIGHT ||
      m.id === MARKER_IDS.BOTTOM_LEFT,
  );

  const markerPositions: MarkerCorners[] = [];

  // Mask each detected marker
  for (const marker of cornerMarkers) {
    const markerCorners = extractMarkerCorners(marker);
    markerPositions.push(markerCorners);

    switch (fillType) {
      case "noise":
        fillPolygonWithNoise(ctx, imageData, markerCorners, markerPadding);
        break;
      case "gray":
        fillPolygonWithGray(ctx, imageData, markerCorners, markerPadding);
        break;
      case "localMean":
        fillPolygonWithLocalMean(ctx, imageData, markerCorners, markerPadding);
        break;
    }
  }

  // Put modified image data back to canvas
  ctx.putImageData(imageData, 0, 0);

  // Convert to data URL
  const maskedImageUrl = canvas.toDataURL("image/png");

  return {
    maskedImageUrl,
    markersMasked: cornerMarkers.length,
    markerPositions,
    width: canvas.width,
    height: canvas.height,
  };
}

/**
 * Check if ArUco masking is available
 */
export function isMarkerMaskingAvailable(): boolean {
  return typeof window !== "undefined";
}
