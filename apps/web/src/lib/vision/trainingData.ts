/**
 * Vision Training Data Collection
 *
 * Utilities for collecting abacus column images for training the column classifier model.
 * Images are saved in the format expected by the training pipeline.
 */

/**
 * Request body for the training data collection API
 */
export interface TrainingDataRequest {
  /** Array of column images, one per column (left to right) */
  columns: ColumnImageData[];
  /** The correct answer (validated by the app) */
  correctAnswer: number;
  /** Player ID for attribution */
  playerId: string;
  /** Session ID for grouping */
  sessionId: string;
}

/**
 * A single column image with metadata
 */
export interface ColumnImageData {
  /** Column index (0 = leftmost/highest place value) */
  columnIndex: number;
  /** Base64-encoded PNG image data (64x128 grayscale) */
  imageData: string;
}

/**
 * Response from the training data collection API
 */
export interface TrainingDataResponse {
  /** Whether the save was successful */
  success: boolean;
  /** Number of column images saved */
  savedCount: number;
  /** Error message if any */
  error?: string;
}

/**
 * Convert a number to an array of digit labels for each column
 *
 * @param value - The number to convert
 * @param columnCount - Number of columns (pads with leading zeros if needed)
 * @returns Array of digits, one per column (leftmost first)
 */
export function valueToDigitLabels(
  value: number,
  columnCount: number,
): number[] {
  const valueStr = Math.abs(value).toString();
  const padded = valueStr.padStart(columnCount, "0");
  return padded.split("").map(Number);
}

/**
 * Convert ImageData to a base64-encoded PNG string
 *
 * @param imageData - The ImageData to convert
 * @returns Base64-encoded PNG data URL (without the data:image/png;base64, prefix)
 */
export function imageDataToBase64Png(imageData: ImageData): string {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext("2d")!;
  ctx.putImageData(imageData, 0, 0);

  // Get base64 PNG data
  const dataUrl = canvas.toDataURL("image/png");
  // Remove the "data:image/png;base64," prefix
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}
