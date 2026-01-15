/**
 * TensorFlow.js Column Classifier
 *
 * Lazy-loads the TensorFlow.js model for abacus column digit classification.
 * Follows the lazy-loading pattern from useDocumentDetection.ts.
 */

// TensorFlow.js types (dynamically imported)
type TFLite = typeof import('@tensorflow/tfjs')
type LayersModel = import('@tensorflow/tfjs').LayersModel
type GraphModel = import('@tensorflow/tfjs').GraphModel

// Model types we support
type SupportedModel = LayersModel | GraphModel

// Model configuration
const MODEL_PATH = '/models/abacus-column-classifier/model.json'
const INPUT_WIDTH = 64
const INPUT_HEIGHT = 128

// Two-head model outputs (heaven bead + earth beads)
const NUM_EARTH_CLASSES = 5 // Earth beads: 0-4

// Cached model and TensorFlow instance
let tfInstance: TFLite | null = null
let modelInstance: SupportedModel | null = null
let modelLoadPromise: Promise<SupportedModel | null> | null = null
let modelCheckFailed = false // Track if model doesn't exist
let isGraphModel = false // Track model type for inference

/**
 * Lazy load TensorFlow.js
 */
async function loadTensorFlow(): Promise<TFLite> {
  if (tfInstance) return tfInstance

  // Dynamic import for code splitting
  const tf = await import('@tensorflow/tfjs')

  // Use WebGL backend for GPU acceleration
  await tf.setBackend('webgl')
  await tf.ready()

  tfInstance = tf
  return tf
}

/**
 * Check if the model file exists before attempting to load it
 */
async function checkModelExists(): Promise<boolean> {
  if (modelCheckFailed) return false

  try {
    const response = await fetch(MODEL_PATH, { method: 'HEAD' })
    if (!response.ok) {
      modelCheckFailed = true
      return false
    }
    return true
  } catch {
    modelCheckFailed = true
    return false
  }
}

/**
 * Lazy load the classification model
 * Returns null if model doesn't exist (not yet trained)
 */
async function loadModel(): Promise<SupportedModel | null> {
  if (modelInstance) return modelInstance
  if (modelCheckFailed) return null

  // Prevent multiple simultaneous loads
  if (modelLoadPromise) return modelLoadPromise

  modelLoadPromise = (async () => {
    // Check if model exists before trying to load
    const exists = await checkModelExists()
    if (!exists) {
      console.warn(
        '[ColumnClassifier] Model not found at',
        MODEL_PATH,
        '- ML classification disabled. Vision will work in manual mode only.'
      )
      return null
    }

    const tf = await loadTensorFlow()
    const startTime = performance.now()

    // Try loading as GraphModel first (from SavedModel export), then LayersModel (from Keras export)
    let model: SupportedModel | null = null

    try {
      model = await tf.loadGraphModel(MODEL_PATH)
      isGraphModel = true
    } catch {
      try {
        model = await tf.loadLayersModel(MODEL_PATH)
        isGraphModel = false

        // Verify this is a two-head model for LayersModel
        if ((model as LayersModel).outputs.length !== 2) {
          console.error('[ColumnClassifier] Model has wrong architecture, expected 2 outputs')
          modelCheckFailed = true
          return null
        }
      } catch (err) {
        console.error('[ColumnClassifier] Failed to load model:', err)
        modelLoadPromise = null
        modelCheckFailed = true
        return null
      }
    }

    const loadTime = performance.now() - startTime
    console.log(`[ColumnClassifier] Model loaded in ${loadTime.toFixed(0)}ms`)

    modelInstance = model
    return model
  })()

  return modelLoadPromise
}

/**
 * Preprocess an image for classification
 *
 * @param imageData - Raw image data from canvas
 * @returns Preprocessed tensor ready for inference
 */
async function preprocessImage(imageData: ImageData): Promise<import('@tensorflow/tfjs').Tensor4D> {
  const tf = await loadTensorFlow()

  // Convert ImageData to tensor
  const tensor = tf.browser.fromPixels(imageData, 1) // Grayscale

  // Resize to model input size
  const resized = tf.image.resizeBilinear(tensor, [INPUT_HEIGHT, INPUT_WIDTH])

  // Normalize to [0,1]. The model has an internal Rescaling layer that converts
  // to [-1,1] for MobileNetV2, so we don't need to do that here.
  const normalized = resized.div(255)

  // Add batch dimension
  const batched = normalized.expandDims(0) as import('@tensorflow/tfjs').Tensor4D

  // Clean up intermediate tensors
  tensor.dispose()
  resized.dispose()
  normalized.dispose()

  return batched
}

/** Bead position result from two-head model */
export interface BeadPositionResult {
  /** Heaven bead position: 0 (down) or 1 (up) */
  heaven: number
  /** Earth beads count: 0-4 */
  earth: number
  /** Confidence of heaven prediction (0-1) */
  heavenConfidence: number
  /** Confidence of earth prediction (0-1) */
  earthConfidence: number
}

export interface ClassificationResult {
  /** Predicted digit (0-9), derived from heaven * 5 + earth */
  digit: number
  /** Overall confidence score (0-1) */
  confidence: number
  /** Bead position details */
  beadPosition: BeadPositionResult
}

/**
 * Convert bead positions to digit
 * digit = heaven * 5 + earth
 */
function beadsToDigit(heaven: number, earth: number): number {
  return heaven * 5 + earth
}

/**
 * Extract heaven and earth outputs from model prediction.
 * Handles both LayersModel (array output) and GraphModel (named output) formats.
 */
function extractOutputs(
  output:
    | import('@tensorflow/tfjs').Tensor
    | import('@tensorflow/tfjs').Tensor[]
    | Record<string, import('@tensorflow/tfjs').Tensor>
): {
  heavenOutput: import('@tensorflow/tfjs').Tensor
  earthOutput: import('@tensorflow/tfjs').Tensor
} {
  // GraphModel returns named outputs: { output_0: heaven, output_1: earth }
  if (!Array.isArray(output) && typeof output === 'object' && 'output_0' in output) {
    const namedOutputs = output as Record<string, import('@tensorflow/tfjs').Tensor>
    return {
      heavenOutput: namedOutputs['output_0'],
      earthOutput: namedOutputs['output_1'],
    }
  }

  // LayersModel returns array: detect which is heaven vs earth based on shape
  // Heaven: [batch, 1] - binary sigmoid
  // Earth: [batch, 5] - 5-class softmax
  if (Array.isArray(output)) {
    const shape0Last = output[0].shape[output[0].shape.length - 1]
    const shape1Last = output[1].shape[output[1].shape.length - 1]

    if (shape0Last === 1 && shape1Last === 5) {
      return { heavenOutput: output[0], earthOutput: output[1] }
    } else if (shape0Last === 5 && shape1Last === 1) {
      return { heavenOutput: output[1], earthOutput: output[0] }
    } else {
      throw new Error(
        `[ColumnClassifier] Cannot determine heaven/earth outputs from shapes: ${shape0Last}, ${shape1Last}`
      )
    }
  }

  throw new Error('[ColumnClassifier] Unexpected output format from model')
}

/**
 * Classify a single column image
 *
 * @param imageData - Grayscale image data of a single abacus column
 * @returns Classification result with digit and bead positions, or null if model not available
 */
export async function classifyColumn(imageData: ImageData): Promise<ClassificationResult | null> {
  const model = await loadModel()
  if (!model) return null

  // Preprocess
  const input = await preprocessImage(imageData)

  // Run inference - two-head model outputs heaven and earth
  const output = model.predict(input)
  const { heavenOutput, earthOutput } = extractOutputs(
    output as
      | import('@tensorflow/tfjs').Tensor
      | import('@tensorflow/tfjs').Tensor[]
      | Record<string, import('@tensorflow/tfjs').Tensor>
  )

  const heavenProb = await heavenOutput.data()
  const earthProbs = await earthOutput.data()

  // Heaven: sigmoid output, threshold at 0.5
  const heavenConfidence = heavenProb[0]
  const heaven = heavenConfidence > 0.5 ? 1 : 0

  // Earth: softmax output, find max
  let earthConfidence = 0
  let earth = 0
  for (let i = 0; i < NUM_EARTH_CLASSES; i++) {
    if (earthProbs[i] > earthConfidence) {
      earthConfidence = earthProbs[i]
      earth = i
    }
  }

  // Derive digit from bead positions
  const digit = beadsToDigit(heaven, earth)

  // Overall confidence: geometric mean of both heads
  // Adjust heaven confidence to be distance from 0.5 (uncertainty)
  const adjustedHeavenConf = Math.abs(heavenConfidence - 0.5) * 2 // 0-1 scale
  const confidence = Math.sqrt(adjustedHeavenConf * earthConfidence)

  // Clean up tensors
  input.dispose()
  heavenOutput.dispose()
  earthOutput.dispose()

  return {
    digit,
    confidence,
    beadPosition: {
      heaven,
      earth,
      heavenConfidence,
      earthConfidence,
    },
  }
}

/**
 * Classify multiple column images in a batch
 *
 * @param columnImages - Array of grayscale image data for each column
 * @returns Array of classification results, or null if model not available
 */
export async function classifyColumns(
  columnImages: ImageData[]
): Promise<ClassificationResult[] | null> {
  if (columnImages.length === 0) return []

  const model = await loadModel()
  if (!model) return null

  const tf = await loadTensorFlow()

  // Preprocess all images and stack into a batch
  const preprocessed = await Promise.all(columnImages.map((img) => preprocessImage(img)))
  const batch = tf.concat(preprocessed, 0)

  // Run inference on batch - two-head model outputs heaven and earth
  const output = model.predict(batch)
  const { heavenOutput, earthOutput } = extractOutputs(
    output as
      | import('@tensorflow/tfjs').Tensor
      | import('@tensorflow/tfjs').Tensor[]
      | Record<string, import('@tensorflow/tfjs').Tensor>
  )

  const allHeavenProbs = await heavenOutput.data()
  const allEarthProbs = await earthOutput.data()

  // Parse results
  const results: ClassificationResult[] = []

  for (let i = 0; i < columnImages.length; i++) {
    // Heaven: sigmoid output (shape [batch, 1] flattened)
    const heavenConfidence = allHeavenProbs[i]
    const heaven = heavenConfidence > 0.5 ? 1 : 0

    // Earth: softmax output (shape [batch, 5] flattened)
    const earthStart = i * NUM_EARTH_CLASSES
    const earthProbs = Array.from(allEarthProbs.slice(earthStart, earthStart + NUM_EARTH_CLASSES))

    let earthConfidence = 0
    let earth = 0
    for (let j = 0; j < NUM_EARTH_CLASSES; j++) {
      if (earthProbs[j] > earthConfidence) {
        earthConfidence = earthProbs[j]
        earth = j
      }
    }

    // Derive digit and confidence
    const digit = beadsToDigit(heaven, earth)
    const adjustedHeavenConf = Math.abs(heavenConfidence - 0.5) * 2
    const confidence = Math.sqrt(adjustedHeavenConf * earthConfidence)

    results.push({
      digit,
      confidence,
      beadPosition: {
        heaven,
        earth,
        heavenConfidence,
        earthConfidence,
      },
    })
  }

  // Clean up tensors
  heavenOutput.dispose()
  earthOutput.dispose()
  preprocessed.forEach((t) => t.dispose())
  batch.dispose()

  return results
}

/**
 * Check if the model is currently loaded
 */
export function isModelLoaded(): boolean {
  return modelInstance !== null
}

/**
 * Check if model loading has failed (model doesn't exist)
 */
export function isModelUnavailable(): boolean {
  return modelCheckFailed
}

/**
 * Preload the model (for eager initialization)
 * Returns true if model loaded successfully, false if unavailable
 */
export async function preloadModel(): Promise<boolean> {
  const model = await loadModel()
  return model !== null
}

/**
 * Dispose of the model to free memory
 */
export function disposeModel(): void {
  if (modelInstance) {
    modelInstance.dispose()
    modelInstance = null
    modelLoadPromise = null
  }
}

/**
 * Reset the model state to allow retrying after a failure
 * Useful when the model file has been updated and we want to reload
 */
export function resetModelState(): void {
  if (modelInstance) {
    modelInstance.dispose()
  }
  modelInstance = null
  modelLoadPromise = null
  modelCheckFailed = false
}

/**
 * Get model input dimensions
 */
export function getModelInputSize(): { width: number; height: number } {
  return { width: INPUT_WIDTH, height: INPUT_HEIGHT }
}
