/**
 * Frame Processor for Abacus Vision
 *
 * Handles slicing video frames into column strips based on calibration grid.
 */

import type { CalibrationGrid, ROI } from "@/types/vision";

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
    Math.round(roi.height),
  );
}

/**
 * Slice a ROI image into individual column strips
 *
 * @param roiImageData - The extracted ROI image data
 * @param calibration - Calibration grid with column dividers
 * @returns Array of ImageData, one per column (left to right)
 */
export function sliceIntoColumns(
  roiImageData: ImageData,
  calibration: CalibrationGrid,
): ImageData[] {
  const { width, height } = roiImageData;
  const { columnDividers, columnCount } = calibration;

  // Create an offscreen canvas for slicing
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Put the ROI image on the canvas
  ctx.putImageData(roiImageData, 0, 0);

  const columns: ImageData[] = [];

  // Calculate column boundaries
  const boundaries = [0, ...columnDividers, 1];

  for (let i = 0; i < columnCount; i++) {
    const startX = Math.round(boundaries[i] * width);
    const endX = Math.round(boundaries[i + 1] * width);
    const colWidth = endX - startX;

    if (colWidth <= 0) continue;

    // Extract column strip
    const columnData = ctx.getImageData(startX, 0, colWidth, height);
    columns.push(columnData);
  }

  return columns;
}

/**
 * Convert ImageData to grayscale
 *
 * @param imageData - Color image data
 * @returns Grayscale image data
 */
export function toGrayscale(imageData: ImageData): ImageData {
  const data = new Uint8ClampedArray(imageData.data);

  for (let i = 0; i < data.length; i += 4) {
    // Luminance formula: 0.299R + 0.587G + 0.114B
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );
    data[i] = gray; // R
    data[i + 1] = gray; // G
    data[i + 2] = gray; // B
    // Alpha unchanged
  }

  return new ImageData(data, imageData.width, imageData.height);
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
  targetHeight: number,
): ImageData {
  // Create source canvas
  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = imageData.width;
  srcCanvas.height = imageData.height;
  const srcCtx = srcCanvas.getContext("2d")!;
  srcCtx.putImageData(imageData, 0, 0);

  // Create destination canvas with target size
  const dstCanvas = document.createElement("canvas");
  dstCanvas.width = targetWidth;
  dstCanvas.height = targetHeight;
  const dstCtx = dstCanvas.getContext("2d")!;

  // Use high-quality scaling
  dstCtx.imageSmoothingEnabled = true;
  dstCtx.imageSmoothingQuality = "high";

  // Draw scaled image
  dstCtx.drawImage(srcCanvas, 0, 0, targetWidth, targetHeight);

  return dstCtx.getImageData(0, 0, targetWidth, targetHeight);
}

/**
 * Process a video frame for classification
 *
 * @param video - Video element with camera feed
 * @param calibration - Calibration grid
 * @param columnWidth - Target column width for model input
 * @param columnHeight - Target column height for model input
 * @returns Array of preprocessed column ImageData ready for classification
 */
export function processVideoFrame(
  video: HTMLVideoElement,
  calibration: CalibrationGrid,
  columnWidth: number = 64,
  columnHeight: number = 128,
): ImageData[] {
  // Create canvas for video frame
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw video frame
  ctx.drawImage(video, 0, 0);

  // Extract ROI
  const roiData = extractROI(ctx, calibration.roi);

  // Slice into columns
  const columns = sliceIntoColumns(roiData, calibration);

  // Preprocess each column
  return columns.map((col) => {
    // Convert to grayscale
    const gray = toGrayscale(col);
    // Resize to model input size
    return resizeImageData(gray, columnWidth, columnHeight);
  });
}

/**
 * Calculate pixel difference between two frames for motion detection
 *
 * @param frame1 - First frame ImageData
 * @param frame2 - Second frame ImageData
 * @returns Ratio of changed pixels (0-1)
 */
export function calculateFrameDiff(
  frame1: ImageData,
  frame2: ImageData,
): number {
  if (frame1.width !== frame2.width || frame1.height !== frame2.height) {
    return 1; // Different sizes = assume motion
  }

  const threshold = 30; // Pixel difference threshold
  let changedPixels = 0;
  const totalPixels = frame1.width * frame1.height;

  for (let i = 0; i < frame1.data.length; i += 4) {
    // Compare grayscale values (use red channel since we convert to grayscale)
    const diff = Math.abs(frame1.data[i] - frame2.data[i]);
    if (diff > threshold) {
      changedPixels++;
    }
  }

  return changedPixels / totalPixels;
}

/**
 * Combine column digits into a full number
 *
 * @param digits - Array of digits (left to right, highest place value first)
 * @returns The combined number
 */
export function digitsToNumber(digits: number[]): number {
  if (digits.length === 0) return 0;

  let result = 0;
  for (const digit of digits) {
    result = result * 10 + digit;
  }
  return result;
}

/**
 * Get minimum confidence from classification results
 *
 * @param confidences - Array of confidence values
 * @returns Minimum confidence
 */
export function getMinConfidence(confidences: number[]): number {
  if (confidences.length === 0) return 0;
  return Math.min(...confidences);
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
  columnHeight: number = 128,
): ImageData[] {
  // Create canvas for image frame
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d")!;

  // Draw image frame
  ctx.drawImage(image, 0, 0);

  let roiData: ImageData;

  if (calibration) {
    // Extract ROI using calibration
    roiData = extractROI(ctx, calibration.roi);
  } else {
    // No calibration - use entire image as ROI (already cropped by phone)
    roiData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // Create a synthetic calibration for slicing if none provided
  const sliceCalibration: CalibrationGrid = calibration ?? {
    roi: { x: 0, y: 0, width: canvas.width, height: canvas.height },
    columnCount,
    columnDividers: Array.from(
      { length: columnCount - 1 },
      (_, i) => (i + 1) / columnCount,
    ),
    rotation: 0,
  };

  // Slice into columns
  const columns = sliceIntoColumns(roiData, sliceCalibration);

  // Preprocess each column
  return columns.map((col) => {
    // Convert to grayscale
    const gray = toGrayscale(col);
    // Resize to model input size
    return resizeImageData(gray, columnWidth, columnHeight);
  });
}
