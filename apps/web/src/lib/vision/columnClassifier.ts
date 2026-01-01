/**
 * TensorFlow.js Column Classifier
 *
 * Lazy-loads the TensorFlow.js model for abacus column digit classification.
 * Follows the lazy-loading pattern from useDocumentDetection.ts.
 */

// TensorFlow.js types (dynamically imported)
type TFLite = typeof import('@tensorflow/tfjs')
type LayersModel = import('@tensorflow/tfjs').LayersModel

// Model configuration
const MODEL_PATH = '/models/abacus-column-classifier/model.json'
const INPUT_WIDTH = 64
const INPUT_HEIGHT = 128
const NUM_CLASSES = 10

// Cached model and TensorFlow instance
let tfInstance: TFLite | null = null
let modelInstance: LayersModel | null = null
let modelLoadPromise: Promise<LayersModel | null> | null = null
let modelCheckFailed = false // Track if model doesn't exist

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
async function loadModel(): Promise<LayersModel | null> {
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

    console.log('[ColumnClassifier] Loading model from', MODEL_PATH)
    const startTime = performance.now()

    try {
      // Load as LayersModel (exported from Keras)
      const model = await tf.loadLayersModel(MODEL_PATH)

      const loadTime = performance.now() - startTime
      console.log(`[ColumnClassifier] Model loaded in ${loadTime.toFixed(0)}ms`)

      modelInstance = model
      return model
    } catch (error) {
      console.error('[ColumnClassifier] Failed to load model:', error)
      modelLoadPromise = null
      modelCheckFailed = true
      return null
    }
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

  // Normalize to [0, 1]
  const normalized = resized.div(255)

  // Add batch dimension
  const batched = normalized.expandDims(0) as import('@tensorflow/tfjs').Tensor4D

  // Clean up intermediate tensors
  tensor.dispose()
  resized.dispose()
  normalized.dispose()

  return batched
}

export interface ClassificationResult {
  /** Predicted digit (0-9) */
  digit: number
  /** Confidence score (0-1) */
  confidence: number
  /** All class probabilities */
  probabilities: number[]
}

/**
 * Classify a single column image
 *
 * @param imageData - Grayscale image data of a single abacus column
 * @returns Classification result with digit and confidence, or null if model not available
 */
export async function classifyColumn(imageData: ImageData): Promise<ClassificationResult | null> {
  const model = await loadModel()
  if (!model) return null

  const tf = await loadTensorFlow()

  // Preprocess
  const input = await preprocessImage(imageData)

  // Run inference
  const output = model.predict(input) as import('@tensorflow/tfjs').Tensor

  // Get probabilities
  const probabilities = await output.data()

  // Find predicted class
  let maxProb = 0
  let predictedDigit = 0
  for (let i = 0; i < NUM_CLASSES; i++) {
    if (probabilities[i] > maxProb) {
      maxProb = probabilities[i]
      predictedDigit = i
    }
  }

  // Clean up tensors
  input.dispose()
  output.dispose()

  return {
    digit: predictedDigit,
    confidence: maxProb,
    probabilities: Array.from(probabilities),
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

  // Preprocess all images
  const preprocessed = await Promise.all(columnImages.map((img) => preprocessImage(img)))

  // Stack into a batch
  const batch = tf.concat(preprocessed, 0)

  // Run inference on batch
  const output = model.predict(batch) as import('@tensorflow/tfjs').Tensor

  // Get all probabilities
  const allProbs = await output.data()

  // Parse results
  const results: ClassificationResult[] = []
  for (let i = 0; i < columnImages.length; i++) {
    const start = i * NUM_CLASSES
    const probs = Array.from(allProbs.slice(start, start + NUM_CLASSES))

    let maxProb = 0
    let predictedDigit = 0
    for (let j = 0; j < NUM_CLASSES; j++) {
      if (probs[j] > maxProb) {
        maxProb = probs[j]
        predictedDigit = j
      }
    }

    results.push({
      digit: predictedDigit,
      confidence: maxProb,
      probabilities: probs,
    })
  }

  // Clean up tensors
  preprocessed.forEach((t) => t.dispose())
  batch.dispose()
  output.dispose()

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
 * Get model input dimensions
 */
export function getModelInputSize(): { width: number; height: number } {
  return { width: INPUT_WIDTH, height: INPUT_HEIGHT }
}
