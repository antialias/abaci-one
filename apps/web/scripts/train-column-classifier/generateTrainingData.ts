#!/usr/bin/env npx tsx
/**
 * Generate synthetic training data for the abacus column classifier
 *
 * This script:
 * 1. Renders single-column abacus SVGs for digits 0-9 using AbacusStatic
 * 2. Applies data augmentation (rotation, scale, brightness, noise)
 * 3. Generates ~5000 samples per digit (50,000 total) across various styles
 * 4. Outputs grayscale PNG images (64x128) organized by digit
 *
 * Usage:
 *   npx tsx scripts/train-column-classifier/generateTrainingData.ts [options]
 *
 * Options:
 *   --samples <n>    Number of samples per digit (default: 5000)
 *   --output <dir>   Output directory (default: ./training-data/column-classifier)
 *   --seed <n>       Random seed for reproducibility
 *   --dry-run        Print config without generating
 */

import fs from 'fs'
import path from 'path'
import { parseArgs } from 'util'
import { renderColumnSVG } from './renderColumn'
import { SeededRandom, augmentImage } from './augmentation'
import {
  type GenerationConfig,
  type GenerationProgress,
  type GeneratedSample,
  DEFAULT_GENERATION_CONFIG,
  ABACUS_STYLE_VARIANTS,
} from './types'

// Parse command line arguments
const { values } = parseArgs({
  options: {
    samples: { type: 'string', short: 's' },
    output: { type: 'string', short: 'o' },
    seed: { type: 'string' },
    'dry-run': { type: 'boolean' },
  },
})

// Build configuration
const config: GenerationConfig = {
  ...DEFAULT_GENERATION_CONFIG,
  samplesPerDigit: values.samples
    ? parseInt(values.samples, 10)
    : DEFAULT_GENERATION_CONFIG.samplesPerDigit,
  outputDir: values.output || DEFAULT_GENERATION_CONFIG.outputDir,
  seed: values.seed ? parseInt(values.seed, 10) : undefined,
}

// Progress tracking
const progress: GenerationProgress = {
  total: config.samplesPerDigit * 10, // 10 digits
  completed: 0,
  currentDigit: 0,
  errors: [],
}

/**
 * Generate training data for a single digit
 */
async function generateDigitSamples(
  digit: number,
  config: GenerationConfig,
  rng: SeededRandom
): Promise<GeneratedSample[]> {
  const samples: GeneratedSample[] = []
  const digitDir = path.join(config.outputDir, digit.toString())

  // Create digit directory
  fs.mkdirSync(digitDir, { recursive: true })

  // Distribute samples across style variants
  const stylesCount = ABACUS_STYLE_VARIANTS.length
  const samplesPerStyle = Math.ceil(config.samplesPerDigit / stylesCount)

  let sampleIndex = 0

  for (const style of ABACUS_STYLE_VARIANTS) {
    // Generate base SVG for this style
    const svgContent = renderColumnSVG(digit, style)

    // Generate augmented samples for this style
    const samplesForThisStyle = Math.min(samplesPerStyle, config.samplesPerDigit - sampleIndex)

    for (let i = 0; i < samplesForThisStyle; i++) {
      try {
        const result = await augmentImage(
          svgContent,
          config.augmentation,
          config.outputWidth,
          config.outputHeight,
          rng
        )

        // Generate filename with metadata
        const filename = `${digit}_${style.name}_${sampleIndex.toString().padStart(5, '0')}.png`
        const filePath = path.join(digitDir, filename)

        // Save image
        fs.writeFileSync(filePath, result.buffer)

        samples.push({
          filePath,
          digit,
          augmentation: result.params,
        })

        sampleIndex++
        progress.completed++

        // Progress update every 100 samples
        if (progress.completed % 100 === 0) {
          const pct = ((progress.completed / progress.total) * 100).toFixed(1)
          process.stdout.write(`\rProgress: ${pct}% (${progress.completed}/${progress.total})`)
        }
      } catch (error) {
        const errorMsg = `Error generating sample ${sampleIndex} for digit ${digit}: ${error}`
        progress.errors.push(errorMsg)
        console.error(`\n${errorMsg}`)
      }
    }
  }

  return samples
}

/**
 * Main generation function
 */
async function generateAllTrainingData(): Promise<void> {
  console.log('=== Abacus Column Classifier Training Data Generator ===\n')
  console.log('Configuration:')
  console.log(`  Samples per digit: ${config.samplesPerDigit}`)
  console.log(`  Total samples: ${config.samplesPerDigit * 10}`)
  console.log(`  Output size: ${config.outputWidth}x${config.outputHeight}`)
  console.log(`  Output directory: ${config.outputDir}`)
  console.log(`  Style variants: ${ABACUS_STYLE_VARIANTS.length}`)
  console.log(`  Random seed: ${config.seed || 'random'}`)
  console.log()

  if (values['dry-run']) {
    console.log('Dry run - no files generated')
    console.log('\nStyle variants:')
    ABACUS_STYLE_VARIANTS.forEach((style) => {
      console.log(`  - ${style.name}: ${style.beadShape}, ${style.colorScheme}`)
    })
    return
  }

  // Create output directory
  fs.mkdirSync(config.outputDir, { recursive: true })

  // Initialize RNG
  const rng = new SeededRandom(config.seed)

  const allSamples: GeneratedSample[] = []
  const startTime = Date.now()

  console.log('Generating samples...\n')

  // Generate samples for each digit
  for (let digit = 0; digit <= 9; digit++) {
    progress.currentDigit = digit
    console.log(`\nGenerating digit ${digit}...`)

    const samples = await generateDigitSamples(digit, config, rng)
    allSamples.push(...samples)
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log('\n\n=== Generation Complete ===')
  console.log(`Total samples generated: ${allSamples.length}`)
  console.log(`Duration: ${duration}s`)
  console.log(`Output directory: ${config.outputDir}`)

  if (progress.errors.length > 0) {
    console.log(`\nErrors encountered: ${progress.errors.length}`)
    progress.errors.slice(0, 5).forEach((err) => console.log(`  - ${err}`))
    if (progress.errors.length > 5) {
      console.log(`  ... and ${progress.errors.length - 5} more`)
    }
  }

  // Generate metadata file
  const metadata = {
    generatedAt: new Date().toISOString(),
    config: {
      samplesPerDigit: config.samplesPerDigit,
      outputWidth: config.outputWidth,
      outputHeight: config.outputHeight,
      seed: config.seed,
      augmentation: config.augmentation,
    },
    styleVariants: ABACUS_STYLE_VARIANTS,
    totalSamples: allSamples.length,
    samplesPerDigit: Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [i, allSamples.filter((s) => s.digit === i).length])
    ),
    errors: progress.errors,
  }

  const metadataPath = path.join(config.outputDir, 'metadata.json')
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  console.log(`\nMetadata saved to: ${metadataPath}`)

  // Generate labels CSV
  const labelsPath = path.join(config.outputDir, 'labels.csv')
  const labelsContent = ['filename,digit,style,rotation,scale,brightness']
    .concat(
      allSamples.map((s) => {
        const filename = path.basename(s.filePath)
        const style = filename.split('_')[1]
        return `${filename},${s.digit},${style},${s.augmentation.rotation.toFixed(2)},${s.augmentation.scale.toFixed(2)},${s.augmentation.brightness.toFixed(2)}`
      })
    )
    .join('\n')
  fs.writeFileSync(labelsPath, labelsContent)
  console.log(`Labels CSV saved to: ${labelsPath}`)
}

// Run the generator
generateAllTrainingData().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
