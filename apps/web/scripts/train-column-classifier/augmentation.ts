/**
 * Image augmentation utilities for synthetic training data
 *
 * Applies various transformations to increase dataset diversity
 */

import sharp from "sharp";
import type { AugmentationConfig } from "./types";

/**
 * Seeded random number generator for reproducibility
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  /** Generate a random number in [0, 1) */
  next(): number {
    // Simple LCG algorithm
    this.seed = (this.seed * 1103515245 + 12345) & 0x7fffffff;
    return this.seed / 0x7fffffff;
  }

  /** Generate a random number in [min, max] */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Generate a random integer in [min, max] */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** Pick a random item from an array */
  pick<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Return true with given probability */
  probability(p: number): boolean {
    return this.next() < p;
  }
}

export interface AugmentationResult {
  /** Augmented image buffer */
  buffer: Buffer;
  /** Applied augmentation parameters */
  params: {
    rotation: number;
    scale: number;
    brightness: number;
    noiseApplied: boolean;
    backgroundColor: string;
    blurRadius: number;
  };
}

/**
 * Apply augmentations to an SVG image
 *
 * @param svgContent - The SVG string
 * @param config - Augmentation configuration
 * @param outputWidth - Target output width
 * @param outputHeight - Target output height
 * @param rng - Seeded random number generator
 * @returns Augmented image buffer and applied parameters
 */
export async function augmentImage(
  svgContent: string,
  config: AugmentationConfig,
  outputWidth: number,
  outputHeight: number,
  rng: SeededRandom,
): Promise<AugmentationResult> {
  // Generate random augmentation parameters
  const rotation = rng.range(-config.rotationRange, config.rotationRange);
  const scale = rng.range(config.scaleRange[0], config.scaleRange[1]);
  const brightness = rng.range(
    config.brightnessRange[0],
    config.brightnessRange[1],
  );
  const backgroundColor = rng.pick(config.backgroundColors);
  const applyBlur = rng.probability(config.blurProbability);
  const blurRadius = applyBlur ? rng.range(0.5, config.maxBlurRadius) : 0;
  const applyNoise = rng.probability(0.5); // 50% chance of noise

  // Convert hex color to RGB
  const bgRgb = hexToRgb(backgroundColor);

  // Calculate scaled dimensions
  const scaledWidth = Math.round(outputWidth * scale * 1.2); // Extra margin for rotation
  const scaledHeight = Math.round(outputHeight * scale * 1.2);

  // Start with the SVG
  let pipeline = sharp(Buffer.from(svgContent))
    .resize(scaledWidth, scaledHeight, {
      fit: "contain",
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 },
    })
    .rotate(rotation, {
      background: { r: bgRgb.r, g: bgRgb.g, b: bgRgb.b, alpha: 1 },
    })
    .extract({
      left: Math.round((scaledWidth - outputWidth) / 2),
      top: Math.round((scaledHeight - outputHeight) / 2),
      width: outputWidth,
      height: outputHeight,
    })
    .modulate({ brightness });

  // Apply blur if selected
  if (blurRadius > 0) {
    pipeline = pipeline.blur(blurRadius);
  }

  // Convert to grayscale for training (reduces complexity, focuses on shape)
  pipeline = pipeline.grayscale();

  // Get the buffer
  let buffer = await pipeline.png().toBuffer();

  // Apply noise if selected
  if (applyNoise && config.noiseStdDev > 0) {
    buffer = await addGaussianNoise(buffer, config.noiseStdDev, rng);
  }

  return {
    buffer,
    params: {
      rotation,
      scale,
      brightness,
      noiseApplied: applyNoise,
      backgroundColor,
      blurRadius,
    },
  };
}

/**
 * Add Gaussian noise to an image
 */
async function addGaussianNoise(
  imageBuffer: Buffer,
  stdDev: number,
  rng: SeededRandom,
): Promise<Buffer> {
  const { data, info } = await sharp(imageBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);

  for (let i = 0; i < pixels.length; i++) {
    // Box-Muller transform for Gaussian noise
    const u1 = rng.next();
    const u2 = rng.next();
    const noise =
      Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * stdDev;

    // Clamp to valid range
    pixels[i] = Math.max(0, Math.min(255, Math.round(pixels[i] + noise)));
  }

  return sharp(Buffer.from(pixels), {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  })
    .png()
    .toBuffer();
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 255, g: 255, b: 255 }; // Default to white
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Generate a batch of augmented images from a single SVG
 *
 * @param svgContent - The SVG string
 * @param count - Number of augmented images to generate
 * @param config - Augmentation configuration
 * @param outputWidth - Target output width
 * @param outputHeight - Target output height
 * @param seed - Random seed for reproducibility
 * @returns Array of augmented image results
 */
export async function generateAugmentedBatch(
  svgContent: string,
  count: number,
  config: AugmentationConfig,
  outputWidth: number,
  outputHeight: number,
  seed: number,
): Promise<AugmentationResult[]> {
  const rng = new SeededRandom(seed);
  const results: AugmentationResult[] = [];

  for (let i = 0; i < count; i++) {
    const result = await augmentImage(
      svgContent,
      config,
      outputWidth,
      outputHeight,
      rng,
    );
    results.push(result);
  }

  return results;
}
