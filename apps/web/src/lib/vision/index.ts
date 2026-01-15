/**
 * Vision processing utilities for physical abacus detection
 *
 * @module lib/vision
 */

export {
  classifyColumn,
  classifyColumns,
  isModelLoaded,
  preloadModel,
  disposeModel,
  getModelInputSize,
  type ClassificationResult,
} from "./columnClassifier";

export {
  extractROI,
  sliceIntoColumns,
  toGrayscale,
  resizeImageData,
  processVideoFrame,
  calculateFrameDiff,
  digitsToNumber,
  getMinConfidence,
} from "./frameProcessor";
