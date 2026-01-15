/**
 * TensorFlow.js Boundary Detector
 *
 * Lazy-loads the TensorFlow.js model for detecting abacus boundaries
 * (quadrilateral corners) without requiring ArUco markers.
 */

import type { QuadCorners, Point } from "@/types/vision";

// TensorFlow.js types (dynamically imported)
type TFLite = typeof import("@tensorflow/tfjs");
type LayersModel = import("@tensorflow/tfjs").LayersModel;
type GraphModel = import("@tensorflow/tfjs").GraphModel;

// Model types we support
type SupportedModel = LayersModel | GraphModel;

// Model configuration
const MODEL_PATH = "/models/abacus-boundary-detector/model.json";
const PREPROCESSING_PATH =
  "/models/abacus-boundary-detector/preprocessing.json";
const INPUT_SIZE = 224; // MobileNetV2 standard input size

// Preprocessing configuration (loaded from model directory)
interface PreprocessingConfig {
  edge_enhance?: boolean;
  inpaint_markers?: boolean;
  input_size?: number;
  // New heatmap + DSNT model fields
  model_type?: "direct" | "heatmap_dsnt";
  heatmap_size?: number; // e.g., 56 for 56x56 heatmaps
  num_corners?: number; // always 4 for quadrilateral
}

// Cached model and TensorFlow instance
let tfInstance: TFLite | null = null;
let modelInstance: SupportedModel | null = null;
let modelLoadPromise: Promise<SupportedModel | null> | null = null;
let modelCheckFailed = false;
let isGraphModel = false;
let preprocessingConfig: PreprocessingConfig | null = null;

/**
 * Lazy load TensorFlow.js
 */
async function loadTensorFlow(): Promise<TFLite> {
  if (tfInstance) return tfInstance;

  const tf = await import("@tensorflow/tfjs");
  await tf.setBackend("webgl");
  await tf.ready();

  tfInstance = tf;
  return tf;
}

/**
 * Load preprocessing configuration from the model directory
 */
async function loadPreprocessingConfig(): Promise<PreprocessingConfig | null> {
  if (preprocessingConfig) return preprocessingConfig;

  try {
    const response = await fetch(PREPROCESSING_PATH);
    if (!response.ok) {
      console.warn(
        "[BoundaryDetector] No preprocessing.json found, using defaults",
      );
      return null;
    }
    preprocessingConfig = await response.json();
    console.log(
      "[BoundaryDetector] Loaded preprocessing config:",
      preprocessingConfig,
    );
    return preprocessingConfig;
  } catch {
    console.warn(
      "[BoundaryDetector] Failed to load preprocessing.json, using defaults",
    );
    return null;
  }
}

/**
 * Apply Sobel edge detection using TensorFlow.js operations (runs on GPU)
 *
 * This preprocessing helps the model focus on structural edges (like the abacus frame)
 * rather than colors, textures, and background clutter.
 */
async function applySobelEdges(
  tensor: import("@tensorflow/tfjs").Tensor3D,
): Promise<import("@tensorflow/tfjs").Tensor3D> {
  const tf = await loadTensorFlow();

  // Convert to grayscale using luminance formula: 0.299*R + 0.587*G + 0.114*B
  const weights = tf.tensor1d([0.299, 0.587, 0.114]);
  const gray = tf.sum(tf.mul(tensor, weights), -1); // Shape: [H, W]

  // Sobel kernels (need to be 4D for conv2d: [filterH, filterW, inChannels, outChannels])
  const sobelX = tf.tensor4d(
    [
      [-1, 0, 1],
      [-2, 0, 2],
      [-1, 0, 1],
    ].flat(),
    [3, 3, 1, 1],
  );
  const sobelY = tf.tensor4d(
    [
      [-1, -2, -1],
      [0, 0, 0],
      [1, 2, 1],
    ].flat(),
    [3, 3, 1, 1],
  );

  // Add batch and channel dimensions for conv2d: [1, H, W, 1]
  const grayBatched = gray
    .expandDims(0)
    .expandDims(-1) as import("@tensorflow/tfjs").Tensor4D;

  // Apply Sobel filters
  const gradX = tf.conv2d(grayBatched, sobelX, 1, "same");
  const gradY = tf.conv2d(grayBatched, sobelY, 1, "same");

  // Compute gradient magnitude
  const magnitude = tf.sqrt(tf.add(tf.square(gradX), tf.square(gradY)));

  // Normalize to [0, 1] range
  const maxVal = magnitude.max();
  const normalized = tf.div(magnitude, maxVal.add(1e-7)); // Add epsilon to avoid division by zero

  // Remove batch dimension and convert to 3-channel: [H, W, 3]
  const squeezed = normalized.squeeze([
    0, 3,
  ]) as import("@tensorflow/tfjs").Tensor2D;
  const edges3ch = tf.stack(
    [squeezed, squeezed, squeezed],
    -1,
  ) as import("@tensorflow/tfjs").Tensor3D;

  // Clean up intermediate tensors
  weights.dispose();
  gray.dispose();
  sobelX.dispose();
  sobelY.dispose();
  grayBatched.dispose();
  gradX.dispose();
  gradY.dispose();
  magnitude.dispose();
  maxVal.dispose();
  normalized.dispose();
  squeezed.dispose();

  return edges3ch;
}

/**
 * DSNT: Differentiable Spatial to Numerical Transform
 *
 * Converts heatmaps to normalized coordinates using soft-argmax.
 * This is the inference-time version of the DSNT layer used in training.
 *
 * @param heatmaps - Tensor of shape [batch, height, width, num_keypoints]
 * @param temperature - Softmax temperature (higher = sharper peaks)
 * @returns Tensor of shape [batch, num_keypoints, 2] with (x, y) coordinates in [0, 1]
 */
async function dsntDecode(
  heatmaps: import("@tensorflow/tfjs").Tensor4D,
  temperature: number = 10,
): Promise<import("@tensorflow/tfjs").Tensor3D> {
  const tf = await loadTensorFlow();

  // heatmaps shape: [batch, height, width, num_keypoints]
  const [batchSize, height, width, numKeypoints] = heatmaps.shape;

  // Create normalized coordinate grids [0, 1]
  // x_coords: [height, width] where each row is [0, 1/(w-1), 2/(w-1), ..., 1]
  // y_coords: [height, width] where each column is [0, 1/(h-1), 2/(h-1), ..., 1]
  const xRange = tf.linspace(0, 1, width);
  const yRange = tf.linspace(0, 1, height);

  // Create meshgrid - TF.js meshgrid returns Tensor1D[] but actually produces 2D tensors
  const meshResult = tf.meshgrid(xRange, yRange);
  const xGrid = meshResult[0] as unknown as import("@tensorflow/tfjs").Tensor2D;
  const yGrid = meshResult[1] as unknown as import("@tensorflow/tfjs").Tensor2D;

  // Reshape for broadcasting: [1, height, width, 1]
  const xCoords = xGrid.reshape([1, height, width, 1]);
  const yCoords = yGrid.reshape([1, height, width, 1]);

  // Apply softmax to each heatmap channel (spatial softmax)
  // Reshape to [batch * numKeypoints, height * width] for softmax, then back
  const heatmapsReshaped = heatmaps.transpose([0, 3, 1, 2]); // [batch, keypoints, h, w]
  const heatmapsFlat = heatmapsReshaped.reshape([
    batchSize * numKeypoints,
    height * width,
  ]);

  // Scale by temperature before softmax (higher temp = sharper distribution)
  const heatmapsScaled = heatmapsFlat.mul(temperature);
  const heatmapsSoftmax = tf.softmax(heatmapsScaled, 1);

  // Reshape back to [batch, keypoints, height, width], then [batch, height, width, keypoints]
  const heatmapsNorm = heatmapsSoftmax
    .reshape([batchSize, numKeypoints, height, width])
    .transpose([0, 2, 3, 1]); // Back to [batch, h, w, keypoints]

  // Compute expected x and y values (weighted sum of coordinates)
  // result: [batch, 1, 1, keypoints] for each coordinate
  const xExpected = tf.sum(tf.mul(heatmapsNorm, xCoords), [1, 2]); // [batch, keypoints]
  const yExpected = tf.sum(tf.mul(heatmapsNorm, yCoords), [1, 2]); // [batch, keypoints]

  // Stack to get [batch, keypoints, 2] with (x, y) pairs
  const coordinates = tf.stack(
    [xExpected, yExpected],
    2,
  ) as import("@tensorflow/tfjs").Tensor3D;

  // Clean up intermediate tensors
  xRange.dispose();
  yRange.dispose();
  xGrid.dispose();
  yGrid.dispose();
  xCoords.dispose();
  yCoords.dispose();
  heatmapsReshaped.dispose();
  heatmapsFlat.dispose();
  heatmapsScaled.dispose();
  heatmapsSoftmax.dispose();
  heatmapsNorm.dispose();
  xExpected.dispose();
  yExpected.dispose();

  return coordinates;
}

/**
 * Check if the model file exists before attempting to load it
 */
async function checkModelExists(): Promise<boolean> {
  if (modelCheckFailed) return false;

  try {
    const response = await fetch(MODEL_PATH, { method: "HEAD" });
    if (!response.ok) {
      modelCheckFailed = true;
      return false;
    }
    return true;
  } catch {
    modelCheckFailed = true;
    return false;
  }
}

/**
 * Lazy load the boundary detection model
 * Returns null if model doesn't exist (not yet trained)
 */
async function loadModel(): Promise<SupportedModel | null> {
  console.log("[BoundaryDetector] loadModel called");
  if (modelInstance) {
    console.log("[BoundaryDetector] Returning cached model instance");
    return modelInstance;
  }
  if (modelCheckFailed) {
    console.log(
      "[BoundaryDetector] Model check previously failed, returning null",
    );
    return null;
  }

  if (modelLoadPromise) {
    console.log("[BoundaryDetector] Returning existing load promise");
    return modelLoadPromise;
  }

  modelLoadPromise = (async () => {
    console.log("[BoundaryDetector] Checking if model exists...");
    const exists = await checkModelExists();
    if (!exists) {
      console.warn(
        "[BoundaryDetector] Model not found at",
        MODEL_PATH,
        "- Marker-free calibration disabled. Train the boundary detector first.",
      );
      return null;
    }
    console.log(
      "[BoundaryDetector] Model file exists, loading preprocessing config...",
    );

    // Load preprocessing config (non-blocking, defaults to no edge enhancement)
    await loadPreprocessingConfig();

    console.log("[BoundaryDetector] Loading TensorFlow.js...");

    const tf = await loadTensorFlow();
    console.log(
      "[BoundaryDetector] TensorFlow.js loaded, attempting to load model...",
    );
    const startTime = performance.now();

    let model: SupportedModel | null = null;

    // Try loading as graph model first (preferred format)
    try {
      console.log("[BoundaryDetector] Trying loadGraphModel...");
      model = await tf.loadGraphModel(MODEL_PATH);
      isGraphModel = true;
      console.log("[BoundaryDetector] Successfully loaded as GraphModel");
    } catch (graphErr) {
      console.warn("[BoundaryDetector] loadGraphModel failed:", graphErr);
      // Fall back to layers model
      try {
        console.log("[BoundaryDetector] Trying loadLayersModel...");
        model = await tf.loadLayersModel(MODEL_PATH);
        isGraphModel = false;
        console.log("[BoundaryDetector] Successfully loaded as LayersModel");
      } catch (layersErr) {
        console.error(
          "[BoundaryDetector] loadLayersModel also failed:",
          layersErr,
        );
        console.error(
          "[BoundaryDetector] Failed to load model with either method",
        );
        modelLoadPromise = null;
        modelCheckFailed = true;
        return null;
      }
    }

    const loadTime = performance.now() - startTime;
    console.log(
      `[BoundaryDetector] Model loaded in ${loadTime.toFixed(0)}ms, isGraphModel=${isGraphModel}`,
    );

    // Log model info
    if (model) {
      if (isGraphModel) {
        const graphModel = model as GraphModel;
        console.log("[BoundaryDetector] GraphModel inputs:", graphModel.inputs);
        console.log(
          "[BoundaryDetector] GraphModel outputs:",
          graphModel.outputs,
        );
      } else {
        const layersModel = model as LayersModel;
        console.log(
          "[BoundaryDetector] LayersModel inputs:",
          layersModel.inputs,
        );
        console.log(
          "[BoundaryDetector] LayersModel outputs:",
          layersModel.outputs,
        );
      }
    }

    modelInstance = model;
    return model;
  })();

  return modelLoadPromise;
}

/**
 * Preprocess an image for boundary detection
 *
 * @param imageData - Raw image data from canvas
 * @returns Preprocessed tensor ready for inference
 */
async function preprocessImage(
  imageData: ImageData,
): Promise<import("@tensorflow/tfjs").Tensor4D> {
  const tf = await loadTensorFlow();

  // Convert ImageData to tensor (RGB)
  const tensor = tf.browser.fromPixels(imageData, 3);

  // Resize to model input size
  const resized = tf.image.resizeBilinear(tensor, [
    INPUT_SIZE,
    INPUT_SIZE,
  ]) as import("@tensorflow/tfjs").Tensor3D;

  // Normalize to [0,1] first
  let normalized = resized.div(255) as import("@tensorflow/tfjs").Tensor3D;

  // Apply Sobel edge detection if the model was trained with it
  if (preprocessingConfig?.edge_enhance) {
    console.log("[BoundaryDetector] Applying Sobel edge enhancement");
    const edges = await applySobelEdges(normalized);
    normalized.dispose();
    normalized = edges;
  }

  // Add batch dimension
  const batched = normalized.expandDims(
    0,
  ) as import("@tensorflow/tfjs").Tensor4D;

  // Clean up intermediate tensors
  tensor.dispose();
  resized.dispose();
  normalized.dispose();

  return batched;
}

/**
 * Result of boundary detection
 */
export interface BoundaryDetectionResult {
  /** Detected corners in normalized coordinates (0-1) */
  corners: QuadCorners;
  /** Confidence score (0-1) based on prediction consistency */
  confidence: number;
}

/**
 * Detect abacus boundary corners from an image
 *
 * @param imageData - RGB image data from video frame
 * @returns Detection result with corners, or null if model not available
 */
export async function detectBoundary(
  imageData: ImageData,
): Promise<BoundaryDetectionResult | null> {
  console.log(
    "[BoundaryDetector] detectBoundary called, imageData size:",
    imageData.width,
    "x",
    imageData.height,
  );

  const model = await loadModel();
  if (!model) {
    console.log("[BoundaryDetector] Model not available, returning null");
    return null;
  }

  // Preprocess
  console.log("[BoundaryDetector] Preprocessing image...");
  const input = await preprocessImage(imageData);
  console.log("[BoundaryDetector] Input tensor shape:", input.shape);

  // Debug: verify input normalization (use tf.min/max to avoid stack overflow on large arrays)
  const tf = await loadTensorFlow();
  const inputMin = (await tf.min(input).data())[0];
  const inputMax = (await tf.max(input).data())[0];
  const inputMean = (await tf.mean(input).data())[0];
  console.log(
    `[BoundaryDetector] Input stats: min=${inputMin.toFixed(4)}, max=${inputMax.toFixed(4)}, mean=${inputMean.toFixed(4)} (expected: 0-1 range)`,
  );

  // Run inference
  console.log(
    "[BoundaryDetector] Running inference, isGraphModel:",
    isGraphModel,
  );
  let output: import("@tensorflow/tfjs").Tensor;

  if (isGraphModel) {
    const graphModel = model as GraphModel;
    console.log("[BoundaryDetector] Using GraphModel.predict()");
    output = graphModel.predict(input) as import("@tensorflow/tfjs").Tensor;
  } else {
    const layersModel = model as LayersModel;
    console.log("[BoundaryDetector] Using LayersModel.predict()");
    output = layersModel.predict(input) as import("@tensorflow/tfjs").Tensor;
  }

  console.log("[BoundaryDetector] Output tensor shape:", output.shape);

  let corners: QuadCorners;

  // Determine model type from preprocessing config or output shape
  const modelType = preprocessingConfig?.model_type ?? "direct";
  const isHeatmapModel =
    modelType === "heatmap_dsnt" || output.shape.length === 4;

  if (isHeatmapModel) {
    // Heatmap + DSNT model: output is [batch, height, width, 4]
    console.log("[BoundaryDetector] Using heatmap + DSNT decoding");

    // Apply DSNT to convert heatmaps to coordinates
    const heatmaps = output as import("@tensorflow/tfjs").Tensor4D;

    // Debug: log heatmap statistics to diagnose detection issues (use tf.min/max to avoid stack overflow)
    const minVal = (await tf.min(heatmaps).data())[0];
    const maxVal = (await tf.max(heatmaps).data())[0];
    const meanVal = (await tf.mean(heatmaps).data())[0];
    console.log(
      `[BoundaryDetector] Heatmap stats: min=${minVal.toFixed(4)}, max=${maxVal.toFixed(4)}, mean=${meanVal.toFixed(4)}`,
    );

    // Log per-corner max values and diagnose (use tf.min/max to avoid stack overflow)
    const [_, h, w, numCorners] = heatmaps.shape;
    const cornerMaxes: number[] = [];
    for (let c = 0; c < numCorners; c++) {
      const cornerHeatmap = tf.slice(heatmaps, [0, 0, 0, c], [1, h, w, 1]);
      const cornerMax = (await tf.max(cornerHeatmap).data())[0];
      const cornerMean = (await tf.mean(cornerHeatmap).data())[0];
      cornerMaxes.push(cornerMax);
      console.log(
        `[BoundaryDetector] Corner ${c} heatmap: max=${cornerMax.toFixed(4)}, mean=${cornerMean.toFixed(4)}, ratio=${(cornerMax / cornerMean).toFixed(1)}x`,
      );
      cornerHeatmap.dispose();
    }

    // Diagnostic summary
    const avgCornerMax =
      cornerMaxes.reduce((a, b) => a + b, 0) / cornerMaxes.length;
    if (avgCornerMax < 0.1) {
      console.warn(
        `[BoundaryDetector] ⚠️ DIAGNOSIS: Heatmap peaks are very weak (avg max=${avgCornerMax.toFixed(4)}). Model may not be detecting corners in this image.`,
      );
    } else if (maxVal - minVal < 0.1) {
      console.warn(
        `[BoundaryDetector] ⚠️ DIAGNOSIS: Heatmaps are nearly flat (range=${(maxVal - minVal).toFixed(4)}). No clear corner detections.`,
      );
    } else {
      console.log(
        `[BoundaryDetector] ✓ Heatmaps look reasonable (avg max=${avgCornerMax.toFixed(4)}, range=${(maxVal - minVal).toFixed(4)})`,
      );
    }

    const coords = await dsntDecode(heatmaps);

    // coords shape: [batch, 4, 2] where each keypoint is (x, y)
    const coordsData = await coords.data();
    console.log(
      "[BoundaryDetector] DSNT decoded coordinates:",
      Array.from(coordsData),
    );

    // Parse corners - order: topLeft, topRight, bottomLeft, bottomRight
    corners = {
      topLeft: { x: coordsData[0], y: coordsData[1] },
      topRight: { x: coordsData[2], y: coordsData[3] },
      bottomLeft: { x: coordsData[4], y: coordsData[5] },
      bottomRight: { x: coordsData[6], y: coordsData[7] },
    };

    coords.dispose();
  } else {
    // Direct regression model: output is [batch, 8]
    console.log("[BoundaryDetector] Using direct coordinate output");

    const predictions = await output.data();
    console.log("[BoundaryDetector] Raw predictions:", Array.from(predictions));

    // Parse corner coordinates
    // Training data order: topLeft, topRight, bottomLeft, bottomRight
    corners = {
      topLeft: { x: predictions[0], y: predictions[1] },
      topRight: { x: predictions[2], y: predictions[3] },
      bottomLeft: { x: predictions[4], y: predictions[5] },
      bottomRight: { x: predictions[6], y: predictions[7] },
    };
  }

  console.log("[BoundaryDetector] Parsed corners:", corners);

  // Compute confidence based on geometric validity
  const confidence = computeConfidence(corners);
  console.log("[BoundaryDetector] Confidence:", confidence);

  // Clean up tensors
  input.dispose();
  output.dispose();

  return { corners, confidence };
}

/**
 * Compute a confidence score based on geometric validity of detected corners
 *
 * Valid abacus boundaries should form a convex quadrilateral.
 * Note: Due to perspective distortion, corners may not form a perfect rectangle.
 * The top may be wider/narrower than the bottom, etc.
 */
function computeConfidence(corners: QuadCorners): number {
  let confidence = 1.0;

  // Check that corners are in valid range (0-1)
  const allCorners = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];
  for (const corner of allCorners) {
    if (corner.x < 0 || corner.x > 1 || corner.y < 0 || corner.y > 1) {
      confidence *= 0.5;
    }
  }

  // Check basic ordering within each edge (allows for perspective):
  // - topLeft.x should be less than topRight.x (top edge goes left to right)
  // - bottomLeft.x should be less than bottomRight.x (bottom edge goes left to right)
  // - topLeft.y should be less than bottomLeft.y OR topRight.y less than bottomRight.y
  //   (at least one side should have top above bottom - allows for tilted cameras)
  if (corners.topLeft.x >= corners.topRight.x) confidence *= 0.7;
  if (corners.bottomLeft.x >= corners.bottomRight.x) confidence *= 0.7;

  // Check that the quadrilateral has some vertical extent
  // (either left side or right side should have top above bottom)
  const leftVertical = corners.bottomLeft.y - corners.topLeft.y;
  const rightVertical = corners.bottomRight.y - corners.topRight.y;
  if (leftVertical <= 0 && rightVertical <= 0) {
    // Both sides are inverted - definitely wrong
    confidence *= 0.5;
  }

  // Check for minimum size (quadrilateral shouldn't be tiny)
  const topWidth = Math.abs(corners.topRight.x - corners.topLeft.x);
  const bottomWidth = Math.abs(corners.bottomRight.x - corners.bottomLeft.x);
  const avgWidth = (topWidth + bottomWidth) / 2;
  const avgHeight = (Math.abs(leftVertical) + Math.abs(rightVertical)) / 2;

  if (avgWidth < 0.05 || avgHeight < 0.05) {
    // Too small - likely a failed detection
    confidence *= 0.3;
  }

  // Check that quadrilateral is convex using cross product
  // A convex quadrilateral has all cross products with the same sign
  const isConvex = checkConvexity(corners);
  if (!isConvex) {
    confidence *= 0.6;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Check if a quadrilateral is convex using cross products
 */
function checkConvexity(corners: QuadCorners): boolean {
  const points = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];

  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % 4];
    const p3 = points[(i + 2) % 4];

    // Cross product of vectors (p1->p2) and (p2->p3)
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x);

    if (i === 0) {
      sign = Math.sign(cross);
    } else if (Math.sign(cross) !== sign && cross !== 0) {
      return false; // Not convex
    }
  }
  return true;
}

/**
 * Denormalize corners from [0,1] to pixel coordinates
 */
export function denormalizeCorners(
  corners: QuadCorners,
  width: number,
  height: number,
): QuadCorners {
  const denormalize = (p: Point): Point => ({
    x: p.x * width,
    y: p.y * height,
  });

  return {
    topLeft: denormalize(corners.topLeft),
    topRight: denormalize(corners.topRight),
    bottomRight: denormalize(corners.bottomRight),
    bottomLeft: denormalize(corners.bottomLeft),
  };
}

/**
 * Normalize corners from pixel coordinates to [0,1]
 */
export function normalizeCorners(
  corners: QuadCorners,
  width: number,
  height: number,
): QuadCorners {
  const normalize = (p: Point): Point => ({
    x: p.x / width,
    y: p.y / height,
  });

  return {
    topLeft: normalize(corners.topLeft),
    topRight: normalize(corners.topRight),
    bottomRight: normalize(corners.bottomRight),
    bottomLeft: normalize(corners.bottomLeft),
  };
}

/**
 * Check if the model is currently loaded
 */
export function isModelLoaded(): boolean {
  return modelInstance !== null;
}

/**
 * Check if model loading has failed (model doesn't exist)
 */
export function isModelUnavailable(): boolean {
  return modelCheckFailed;
}

/**
 * Preload the model (for eager initialization)
 * Returns true if model loaded successfully, false if unavailable
 */
export async function preloadModel(): Promise<boolean> {
  const model = await loadModel();
  return model !== null;
}

/**
 * Dispose of the model to free memory
 */
export function disposeModel(): void {
  if (modelInstance) {
    modelInstance.dispose();
    modelInstance = null;
    modelLoadPromise = null;
  }
}

/**
 * Reset the model state to allow retrying after a failure
 * Useful when the model file has been updated
 */
export function resetModelState(): void {
  if (modelInstance) {
    modelInstance.dispose();
  }
  modelInstance = null;
  modelLoadPromise = null;
  modelCheckFailed = false;
  preprocessingConfig = null;
}

/**
 * Get model input dimensions
 */
export function getModelInputSize(): { width: number; height: number } {
  return { width: INPUT_SIZE, height: INPUT_SIZE };
}

/**
 * Check if edge enhancement preprocessing is enabled for the loaded model
 */
export function isEdgeEnhanceEnabled(): boolean {
  return preprocessingConfig?.edge_enhance ?? false;
}

/**
 * Get the current preprocessing configuration
 */
export function getPreprocessingConfig(): PreprocessingConfig | null {
  return preprocessingConfig;
}

/**
 * Get the model type (direct regression vs heatmap+DSNT)
 */
export function getModelType(): "direct" | "heatmap_dsnt" | null {
  return preprocessingConfig?.model_type ?? null;
}

/**
 * Check if the model uses heatmap + DSNT architecture
 */
export function isHeatmapModel(): boolean {
  return preprocessingConfig?.model_type === "heatmap_dsnt";
}
