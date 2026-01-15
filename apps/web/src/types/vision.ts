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
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A point in 2D space (video coordinates)
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Four corners of a quadrilateral for perspective-aware ROI
 * Allows independent positioning of each corner to match camera perspective
 */
export interface QuadCorners {
  /** Top-left corner */
  topLeft: Point;
  /** Top-right corner */
  topRight: Point;
  /** Bottom-left corner */
  bottomLeft: Point;
  /** Bottom-right corner */
  bottomRight: Point;
}

/**
 * Margins to trim from the ROI edges before slicing columns.
 * Useful when ArUco markers are positioned at frame corners
 * but columns are inset from the frame.
 */
export interface ColumnMargins {
  /** Fraction of width to trim from left (0-0.5, default 0) */
  left: number;
  /** Fraction of width to trim from right (0-0.5, default 0) */
  right: number;
  /** Fraction of height to trim from top (0-0.5, default 0) */
  top: number;
  /** Fraction of height to trim from bottom (0-0.5, default 0) */
  bottom: number;
}

/**
 * Calibration grid defining how to slice the video feed into columns
 */
export interface CalibrationGrid {
  /** Bounding box in video coordinates (legacy - for backward compat) */
  roi: ROI;
  /** Four corners of the quadrilateral ROI (preferred) */
  corners?: QuadCorners;
  /** Number of abacus columns to detect */
  columnCount: number;
  /** Column divider positions as fractions (0-1) within ROI */
  columnDividers: number[];
  /** Rotation angle in degrees (for skewed cameras) - deprecated, use corners instead */
  rotation: number;
  /** Margins to trim from edges before slicing (for frame inset) */
  margins?: ColumnMargins;
}

/**
 * Stored calibration data in localStorage
 */
export interface StoredCalibration {
  version: 1;
  grid: CalibrationGrid;
  createdAt: string;
  deviceId: string;
}

/**
 * Result of classifying a single column
 */
export interface ColumnClassificationResult {
  digit: number;
  confidence: number;
}

/**
 * Result of classifying all columns in a frame
 */
export interface FrameClassificationResult {
  digits: number[];
  confidences: number[];
  timestamp: number;
}

/**
 * Calibration mode options
 * - "auto": Uses ArUco markers for automatic corner detection
 * - "manual": User drags corner handles manually
 * - "marker-free": Uses ML model to detect abacus boundaries (no markers needed)
 */
export type CalibrationMode = "auto" | "manual" | "marker-free";

/**
 * ArUco marker detection status
 */
export interface MarkerDetectionStatus {
  /** Whether ArUco detection is available */
  isAvailable: boolean;
  /** Whether all 4 markers are currently detected */
  allMarkersFound: boolean;
  /** Number of markers currently detected (0-4) */
  markersFound: number;
  /** Which marker IDs are currently detected */
  detectedIds: number[];
}

/**
 * State returned by useAbacusVision hook
 */
export interface AbacusVisionState {
  // Vision state
  isEnabled: boolean;
  isCalibrated: boolean;
  isDetecting: boolean;
  currentDetectedValue: number | null;
  confidence: number;
  columnConfidences: number[];

  // Classifier state
  isClassifierLoading: boolean;
  isClassifierReady: boolean;
  classifierError: string | null;

  // Camera state
  isCameraLoading: boolean;
  videoStream: MediaStream | null;
  cameraError: string | null;
  selectedDeviceId: string | null;
  availableDevices: MediaDeviceInfo[];
  isDeskViewDetected: boolean;
  facingMode: "user" | "environment";
  isTorchOn: boolean;
  isTorchAvailable: boolean;

  // Calibration state
  calibrationGrid: CalibrationGrid | null;
  isCalibrating: boolean;
  calibrationMode: CalibrationMode;
  markerDetection: MarkerDetectionStatus;

  // Boundary detector state (marker-free mode)
  boundaryDetector: {
    isReady: boolean;
    isLoading: boolean;
    isUnavailable: boolean;
    confidence: number;
    consecutiveFrames: number;
  };

  // Stability state
  isHandDetected: boolean;
  consecutiveFrames: number;
}

/**
 * Actions returned by useAbacusVision hook
 */
export interface AbacusVisionActions {
  /** Start the camera and vision processing */
  enable: () => Promise<void>;
  /** Stop the camera and vision processing */
  disable: () => void;
  /** Enter manual calibration mode */
  startCalibration: () => void;
  /** Save calibration and exit calibration mode */
  finishCalibration: (grid: CalibrationGrid) => void;
  /** Cancel calibration without saving */
  cancelCalibration: () => void;
  /** Select a specific camera device */
  selectCamera: (deviceId: string) => void;
  /** Clear saved calibration */
  resetCalibration: () => void;
  /** Set calibration mode (auto uses ArUco markers, manual uses drag handles) */
  setCalibrationMode: (mode: CalibrationMode) => void;
  /** Flip between front and back camera */
  flipCamera: () => Promise<void>;
  /** Toggle torch on/off */
  toggleTorch: () => Promise<void>;
}

/**
 * Combined state and actions from useAbacusVision
 */
export type UseAbacusVisionReturn = AbacusVisionState & AbacusVisionActions;

/**
 * Configuration for frame stability detection
 */
export interface FrameStabilityConfig {
  /** Minimum consecutive frames showing same value to consider stable */
  minConsecutiveFrames: number;
  /** Minimum confidence threshold for a valid detection */
  minConfidence: number;
  /** Pixel change ratio threshold for detecting hand motion */
  handMotionThreshold: number;
}

/**
 * Default stability configuration
 */
export const DEFAULT_STABILITY_CONFIG: FrameStabilityConfig = {
  minConsecutiveFrames: 3, // 600ms at 5fps inference rate
  minConfidence: 0.5, // Lower threshold - model confidence is often 60-80%
  handMotionThreshold: 0.3,
};

/**
 * Patterns to detect Desk View camera by device label
 */
export const DESK_VIEW_PATTERNS = [
  "desk view",
  "continuity camera",
  "iphone camera",
];

/**
 * localStorage key for calibration data
 */
export const CALIBRATION_STORAGE_KEY = "abacus-vision-calibration";
