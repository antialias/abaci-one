/**
 * Types for synthetic training data generation
 */

export interface AugmentationConfig {
  /** Rotation range in degrees [-angle, +angle] */
  rotationRange: number
  /** Scale range [minScale, maxScale] */
  scaleRange: [number, number]
  /** Brightness range [minBrightness, maxBrightness] where 1.0 = no change */
  brightnessRange: [number, number]
  /** Gaussian noise standard deviation (0-255) */
  noiseStdDev: number
  /** Background color variations (array of CSS colors) */
  backgroundColors: string[]
  /** Probability of adding blur (0-1) */
  blurProbability: number
  /** Max blur radius in pixels */
  maxBlurRadius: number
}

export interface GenerationConfig {
  /** Number of samples per digit (0-9) */
  samplesPerDigit: number
  /** Output image width in pixels */
  outputWidth: number
  /** Output image height in pixels */
  outputHeight: number
  /** Output format */
  format: 'png' | 'jpeg'
  /** Quality for jpeg (0-100) */
  quality: number
  /** Augmentation settings */
  augmentation: AugmentationConfig
  /** Output directory */
  outputDir: string
  /** Random seed for reproducibility (optional) */
  seed?: number
}

export interface GeneratedSample {
  /** File path to the generated image */
  filePath: string
  /** Digit represented (0-9) */
  digit: number
  /** Applied augmentation parameters */
  augmentation: {
    rotation: number
    scale: number
    brightness: number
    noiseApplied: boolean
    backgroundColor: string
    blurRadius: number
  }
}

export interface GenerationProgress {
  /** Total samples to generate */
  total: number
  /** Samples generated so far */
  completed: number
  /** Current digit being generated */
  currentDigit: number
  /** Errors encountered */
  errors: string[]
}

export interface AbacusStyleVariant {
  /** Variant name */
  name: string
  /** Bead shape */
  beadShape: 'circle' | 'diamond' | 'square'
  /** Color scheme */
  colorScheme: 'monochrome' | 'place-value' | 'alternating' | 'heaven-earth'
  /** Scale factor */
  scaleFactor: number
}

export const DEFAULT_AUGMENTATION: AugmentationConfig = {
  rotationRange: 5, // ±5 degrees
  scaleRange: [0.9, 1.1],
  brightnessRange: [0.8, 1.2],
  noiseStdDev: 10,
  backgroundColors: [
    '#ffffff', // white
    '#f5f5f5', // light gray
    '#fafafa', // off-white
    '#fff8e7', // cream
    '#f0f9ff', // light blue tint
    '#f0fdf4', // light green tint
    '#fefce8', // light yellow tint
  ],
  blurProbability: 0.1,
  maxBlurRadius: 1.5,
}

export const DEFAULT_GENERATION_CONFIG: GenerationConfig = {
  samplesPerDigit: 5000,
  outputWidth: 64,
  outputHeight: 128,
  format: 'png',
  quality: 90,
  augmentation: DEFAULT_AUGMENTATION,
  outputDir: './training-data/column-classifier',
}

export const ABACUS_STYLE_VARIANTS: AbacusStyleVariant[] = [
  {
    name: 'circle-mono',
    beadShape: 'circle',
    colorScheme: 'monochrome',
    scaleFactor: 1.0,
  },
  {
    name: 'diamond-mono',
    beadShape: 'diamond',
    colorScheme: 'monochrome',
    scaleFactor: 1.0,
  },
  {
    name: 'square-mono',
    beadShape: 'square',
    colorScheme: 'monochrome',
    scaleFactor: 1.0,
  },
  {
    name: 'circle-heaven-earth',
    beadShape: 'circle',
    colorScheme: 'heaven-earth',
    scaleFactor: 1.0,
  },
  {
    name: 'diamond-heaven-earth',
    beadShape: 'diamond',
    colorScheme: 'heaven-earth',
    scaleFactor: 1.0,
  },
  {
    name: 'circle-place-value',
    beadShape: 'circle',
    colorScheme: 'place-value',
    scaleFactor: 1.0,
  },
]
