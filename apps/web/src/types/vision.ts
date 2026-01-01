/**
 * Types for the AbacusVisionBridge feature
 *
 * Enables students to control their digital abacus using a physical soroban
 * and camera (targeting Apple's Desk View).
 */

/**
 * Region of Interest (ROI) rectangle in video coordinates
 * @deprecated Use QuadCorners for perspective-aware calibration
 */
export interface ROI {
  x: number
  y: number
  width: number
  height: number
}

/**
 * A point in 2D space (video coordinates)
 */
export interface Point {
  x: number
  y: number
}

/**
 * Four corners of a quadrilateral for perspective-aware ROI
 * Allows independent positioning of each corner to match camera perspective
 */
export interface QuadCorners {
  /** Top-left corner */
  topLeft: Point
  /** Top-right corner */
  topRight: Point
  /** Bottom-left corner */
  bottomLeft: Point
  /** Bottom-right corner */
  bottomRight: Point
}

/**
 * Calibration grid defining how to slice the video feed into columns
 */
export interface CalibrationGrid {
  /** Bounding box in video coordinates (legacy - for backward compat) */
  roi: ROI
  /** Four corners of the quadrilateral ROI (preferred) */
  corners?: QuadCorners
  /** Number of abacus columns to detect */
  columnCount: number
  /** Column divider positions as fractions (0-1) within ROI */
  columnDividers: number[]
  /** Rotation angle in degrees (for skewed cameras) - deprecated, use corners instead */
  rotation: number
}

/**
 * Stored calibration data in localStorage
 */
export interface StoredCalibration {
  version: 1
  grid: CalibrationGrid
  createdAt: string
  deviceId: string
}

/**
 * Result of classifying a single column
 */
export interface ColumnClassificationResult {
  digit: number
  confidence: number
}

/**
 * Result of classifying all columns in a frame
 */
export interface FrameClassificationResult {
  digits: number[]
  confidences: number[]
  timestamp: number
}

/**
 * Calibration mode options
 */
export type CalibrationMode = 'manual' | 'auto'

/**
 * ArUco marker detection status
 */
export interface MarkerDetectionStatus {
  /** Whether ArUco detection is available */
  isAvailable: boolean
  /** Whether all 4 markers are currently detected */
  allMarkersFound: boolean
  /** Number of markers currently detected (0-4) */
  markersFound: number
  /** Which marker IDs are currently detected */
  detectedIds: number[]
}

/**
 * State returned by useAbacusVision hook
 */
export interface AbacusVisionState {
  // Vision state
  isEnabled: boolean
  isCalibrated: boolean
  isDetecting: boolean
  currentDetectedValue: number | null
  confidence: number
  columnConfidences: number[]

  // Camera state
  isCameraLoading: boolean
  videoStream: MediaStream | null
  cameraError: string | null
  selectedDeviceId: string | null
  availableDevices: MediaDeviceInfo[]
  isDeskViewDetected: boolean

  // Calibration state
  calibrationGrid: CalibrationGrid | null
  isCalibrating: boolean
  calibrationMode: CalibrationMode
  markerDetection: MarkerDetectionStatus

  // Stability state
  isHandDetected: boolean
  consecutiveFrames: number
}

/**
 * Actions returned by useAbacusVision hook
 */
export interface AbacusVisionActions {
  /** Start the camera and vision processing */
  enable: () => Promise<void>
  /** Stop the camera and vision processing */
  disable: () => void
  /** Enter manual calibration mode */
  startCalibration: () => void
  /** Save calibration and exit calibration mode */
  finishCalibration: (grid: CalibrationGrid) => void
  /** Cancel calibration without saving */
  cancelCalibration: () => void
  /** Select a specific camera device */
  selectCamera: (deviceId: string) => void
  /** Clear saved calibration */
  resetCalibration: () => void
  /** Set calibration mode (auto uses ArUco markers, manual uses drag handles) */
  setCalibrationMode: (mode: CalibrationMode) => void
}

/**
 * Combined state and actions from useAbacusVision
 */
export type UseAbacusVisionReturn = AbacusVisionState & AbacusVisionActions

/**
 * Configuration for frame stability detection
 */
export interface FrameStabilityConfig {
  /** Minimum consecutive frames showing same value to consider stable */
  minConsecutiveFrames: number
  /** Minimum confidence threshold for a valid detection */
  minConfidence: number
  /** Pixel change ratio threshold for detecting hand motion */
  handMotionThreshold: number
}

/**
 * Default stability configuration
 */
export const DEFAULT_STABILITY_CONFIG: FrameStabilityConfig = {
  minConsecutiveFrames: 10, // ~300ms at 30fps
  minConfidence: 0.7,
  handMotionThreshold: 0.3,
}

/**
 * Patterns to detect Desk View camera by device label
 */
export const DESK_VIEW_PATTERNS = ['desk view', 'continuity camera', 'iphone camera']

/**
 * localStorage key for calibration data
 */
export const CALIBRATION_STORAGE_KEY = 'abacus-vision-calibration'
