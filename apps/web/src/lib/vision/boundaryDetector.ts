/**
 * TensorFlow.js Boundary Detector
 *
 * Lazy-loads the TensorFlow.js model for detecting abacus boundaries
 * (quadrilateral corners) without requiring ArUco markers.
 */

import type { QuadCorners, Point } from '@/types/vision'

// TensorFlow.js types (dynamically imported)
type TFLite = typeof import('@tensorflow/tfjs')
type LayersModel = import('@tensorflow/tfjs').LayersModel
type GraphModel = import('@tensorflow/tfjs').GraphModel

// Model types we support
type SupportedModel = LayersModel | GraphModel

// Model configuration
const MODEL_PATH = '/models/abacus-boundary-detector/model.json'
const INPUT_SIZE = 224 // MobileNetV2 standard input size

// Cached model and TensorFlow instance
let tfInstance: TFLite | null = null
let modelInstance: SupportedModel | null = null
let modelLoadPromise: Promise<SupportedModel | null> | null = null
let modelCheckFailed = false
let isGraphModel = false

/**
 * Lazy load TensorFlow.js
 */
async function loadTensorFlow(): Promise<TFLite> {
  if (tfInstance) return tfInstance

  const tf = await import('@tensorflow/tfjs')
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
 * Lazy load the boundary detection model
 * Returns null if model doesn't exist (not yet trained)
 */
async function loadModel(): Promise<SupportedModel | null> {
  console.log('[BoundaryDetector] loadModel called')
  if (modelInstance) {
    console.log('[BoundaryDetector] Returning cached model instance')
    return modelInstance
  }
  if (modelCheckFailed) {
    console.log('[BoundaryDetector] Model check previously failed, returning null')
    return null
  }

  if (modelLoadPromise) {
    console.log('[BoundaryDetector] Returning existing load promise')
    return modelLoadPromise
  }

  modelLoadPromise = (async () => {
    console.log('[BoundaryDetector] Checking if model exists...')
    const exists = await checkModelExists()
    if (!exists) {
      console.warn(
        '[BoundaryDetector] Model not found at',
        MODEL_PATH,
        '- Marker-free calibration disabled. Train the boundary detector first.'
      )
      return null
    }
    console.log('[BoundaryDetector] Model file exists, loading TensorFlow.js...')

    const tf = await loadTensorFlow()
    console.log('[BoundaryDetector] TensorFlow.js loaded, attempting to load model...')
    const startTime = performance.now()

    let model: SupportedModel | null = null

    // Try loading as graph model first (preferred format)
    try {
      console.log('[BoundaryDetector] Trying loadGraphModel...')
      model = await tf.loadGraphModel(MODEL_PATH)
      isGraphModel = true
      console.log('[BoundaryDetector] Successfully loaded as GraphModel')
    } catch (graphErr) {
      console.warn('[BoundaryDetector] loadGraphModel failed:', graphErr)
      // Fall back to layers model
      try {
        console.log('[BoundaryDetector] Trying loadLayersModel...')
        model = await tf.loadLayersModel(MODEL_PATH)
        isGraphModel = false
        console.log('[BoundaryDetector] Successfully loaded as LayersModel')
      } catch (layersErr) {
        console.error('[BoundaryDetector] loadLayersModel also failed:', layersErr)
        console.error('[BoundaryDetector] Failed to load model with either method')
        modelLoadPromise = null
        modelCheckFailed = true
        return null
      }
    }

    const loadTime = performance.now() - startTime
    console.log(`[BoundaryDetector] Model loaded in ${loadTime.toFixed(0)}ms, isGraphModel=${isGraphModel}`)

    // Log model info
    if (model) {
      if (isGraphModel) {
        const graphModel = model as GraphModel
        console.log('[BoundaryDetector] GraphModel inputs:', graphModel.inputs)
        console.log('[BoundaryDetector] GraphModel outputs:', graphModel.outputs)
      } else {
        const layersModel = model as LayersModel
        console.log('[BoundaryDetector] LayersModel inputs:', layersModel.inputs)
        console.log('[BoundaryDetector] LayersModel outputs:', layersModel.outputs)
      }
    }

    modelInstance = model
    return model
  })()

  return modelLoadPromise
}

/**
 * Preprocess an image for boundary detection
 *
 * @param imageData - Raw image data from canvas
 * @returns Preprocessed tensor ready for inference
 */
async function preprocessImage(imageData: ImageData): Promise<import('@tensorflow/tfjs').Tensor4D> {
  const tf = await loadTensorFlow()

  // Convert ImageData to tensor (RGB)
  const tensor = tf.browser.fromPixels(imageData, 3)

  // Resize to model input size
  const resized = tf.image.resizeBilinear(tensor, [INPUT_SIZE, INPUT_SIZE])

  // Normalize to [0,1] - the model has an internal Rescaling layer
  const normalized = resized.div(255)

  // Add batch dimension
  const batched = normalized.expandDims(0) as import('@tensorflow/tfjs').Tensor4D

  // Clean up intermediate tensors
  tensor.dispose()
  resized.dispose()
  normalized.dispose()

  return batched
}

/**
 * Result of boundary detection
 */
export interface BoundaryDetectionResult {
  /** Detected corners in normalized coordinates (0-1) */
  corners: QuadCorners
  /** Confidence score (0-1) based on prediction consistency */
  confidence: number
}

/**
 * Detect abacus boundary corners from an image
 *
 * @param imageData - RGB image data from video frame
 * @returns Detection result with corners, or null if model not available
 */
export async function detectBoundary(
  imageData: ImageData
): Promise<BoundaryDetectionResult | null> {
  console.log('[BoundaryDetector] detectBoundary called, imageData size:', imageData.width, 'x', imageData.height)

  const model = await loadModel()
  if (!model) {
    console.log('[BoundaryDetector] Model not available, returning null')
    return null
  }

  // Preprocess
  console.log('[BoundaryDetector] Preprocessing image...')
  const input = await preprocessImage(imageData)
  console.log('[BoundaryDetector] Input tensor shape:', input.shape)

  // Run inference - outputs 8 values: [tl_x, tl_y, tr_x, tr_y, br_x, br_y, bl_x, bl_y]
  console.log('[BoundaryDetector] Running inference, isGraphModel:', isGraphModel)
  let output: import('@tensorflow/tfjs').Tensor

  if (isGraphModel) {
    // GraphModel uses execute() or predict()
    const graphModel = model as GraphModel
    console.log('[BoundaryDetector] Using GraphModel.predict()')
    output = graphModel.predict(input) as import('@tensorflow/tfjs').Tensor
  } else {
    // LayersModel uses predict()
    const layersModel = model as LayersModel
    console.log('[BoundaryDetector] Using LayersModel.predict()')
    output = layersModel.predict(input) as import('@tensorflow/tfjs').Tensor
  }

  console.log('[BoundaryDetector] Output tensor shape:', output.shape)
  const predictions = await output.data()
  console.log('[BoundaryDetector] Raw predictions:', Array.from(predictions))

  // Parse corner coordinates
  // Training data order: topLeft, topRight, bottomLeft, bottomRight
  const corners: QuadCorners = {
    topLeft: { x: predictions[0], y: predictions[1] },
    topRight: { x: predictions[2], y: predictions[3] },
    bottomLeft: { x: predictions[4], y: predictions[5] },
    bottomRight: { x: predictions[6], y: predictions[7] },
  }
  console.log('[BoundaryDetector] Parsed corners:', corners)

  // Compute confidence based on geometric validity
  const confidence = computeConfidence(corners)
  console.log('[BoundaryDetector] Confidence:', confidence)

  // Clean up tensors
  input.dispose()
  output.dispose()

  return { corners, confidence }
}

/**
 * Compute a confidence score based on geometric validity of detected corners
 *
 * Valid abacus boundaries should form a convex quadrilateral.
 * Note: Due to perspective distortion, corners may not form a perfect rectangle.
 * The top may be wider/narrower than the bottom, etc.
 */
function computeConfidence(corners: QuadCorners): number {
  let confidence = 1.0

  // Check that corners are in valid range (0-1)
  const allCorners = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]
  for (const corner of allCorners) {
    if (corner.x < 0 || corner.x > 1 || corner.y < 0 || corner.y > 1) {
      confidence *= 0.5
    }
  }

  // Check basic ordering within each edge (allows for perspective):
  // - topLeft.x should be less than topRight.x (top edge goes left to right)
  // - bottomLeft.x should be less than bottomRight.x (bottom edge goes left to right)
  // - topLeft.y should be less than bottomLeft.y OR topRight.y less than bottomRight.y
  //   (at least one side should have top above bottom - allows for tilted cameras)
  if (corners.topLeft.x >= corners.topRight.x) confidence *= 0.7
  if (corners.bottomLeft.x >= corners.bottomRight.x) confidence *= 0.7

  // Check that the quadrilateral has some vertical extent
  // (either left side or right side should have top above bottom)
  const leftVertical = corners.bottomLeft.y - corners.topLeft.y
  const rightVertical = corners.bottomRight.y - corners.topRight.y
  if (leftVertical <= 0 && rightVertical <= 0) {
    // Both sides are inverted - definitely wrong
    confidence *= 0.5
  }

  // Check for minimum size (quadrilateral shouldn't be tiny)
  const topWidth = Math.abs(corners.topRight.x - corners.topLeft.x)
  const bottomWidth = Math.abs(corners.bottomRight.x - corners.bottomLeft.x)
  const avgWidth = (topWidth + bottomWidth) / 2
  const avgHeight = (Math.abs(leftVertical) + Math.abs(rightVertical)) / 2

  if (avgWidth < 0.05 || avgHeight < 0.05) {
    // Too small - likely a failed detection
    confidence *= 0.3
  }

  // Check that quadrilateral is convex using cross product
  // A convex quadrilateral has all cross products with the same sign
  const isConvex = checkConvexity(corners)
  if (!isConvex) {
    confidence *= 0.6
  }

  return Math.max(0, Math.min(1, confidence))
}

/**
 * Check if a quadrilateral is convex using cross products
 */
function checkConvexity(corners: QuadCorners): boolean {
  const points = [corners.topLeft, corners.topRight, corners.bottomRight, corners.bottomLeft]

  let sign = 0
  for (let i = 0; i < 4; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % 4]
    const p3 = points[(i + 2) % 4]

    // Cross product of vectors (p1->p2) and (p2->p3)
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x)

    if (i === 0) {
      sign = Math.sign(cross)
    } else if (Math.sign(cross) !== sign && cross !== 0) {
      return false // Not convex
    }
  }
  return true
}

/**
 * Denormalize corners from [0,1] to pixel coordinates
 */
export function denormalizeCorners(
  corners: QuadCorners,
  width: number,
  height: number
): QuadCorners {
  const denormalize = (p: Point): Point => ({
    x: p.x * width,
    y: p.y * height,
  })

  return {
    topLeft: denormalize(corners.topLeft),
    topRight: denormalize(corners.topRight),
    bottomRight: denormalize(corners.bottomRight),
    bottomLeft: denormalize(corners.bottomLeft),
  }
}

/**
 * Normalize corners from pixel coordinates to [0,1]
 */
export function normalizeCorners(corners: QuadCorners, width: number, height: number): QuadCorners {
  const normalize = (p: Point): Point => ({
    x: p.x / width,
    y: p.y / height,
  })

  return {
    topLeft: normalize(corners.topLeft),
    topRight: normalize(corners.topRight),
    bottomRight: normalize(corners.bottomRight),
    bottomLeft: normalize(corners.bottomLeft),
  }
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
 * Useful when the model file has been updated
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
  return { width: INPUT_SIZE, height: INPUT_SIZE }
}
