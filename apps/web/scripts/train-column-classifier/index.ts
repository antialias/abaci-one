/**
 * Column Classifier Training Data Generator
 *
 * This module generates synthetic training data for the TensorFlow.js
 * abacus column digit classifier used by AbacusVisionBridge.
 *
 * Usage:
 *   npx tsx scripts/train-column-classifier/generateTrainingData.ts
 *
 * See README.md for full documentation.
 */

export * from "./types";
export {
  renderColumnSVG,
  generateAllDigitSVGs,
  getColumnDimensions,
} from "./renderColumn";
export {
  SeededRandom,
  augmentImage,
  generateAugmentedBatch,
  type AugmentationResult,
} from "./augmentation";
