/**
 * Quad Detector
 *
 * Core quadrilateral detection logic using OpenCV.js.
 * Finds document-like quadrilaterals in images using edge detection and contour analysis.
 *
 * This is a pure module with no React dependencies - can be used directly
 * or wrapped in hooks for React components.
 */

import type { CV, CVMat, CVMatVector, CVPoint } from "./opencv/types";

// ============================================================================
// Types
// ============================================================================

/** A 2D point */
export interface Point {
  x: number;
  y: number;
}

/** A detected quadrilateral */
export interface DetectedQuad {
  /** Corner points ordered: top-left, top-right, bottom-right, bottom-left */
  corners: [Point, Point, Point, Point];
  /** Area in pixels */
  area: number;
  /** Aspect ratio (max dimension / min dimension) */
  aspectRatio: number;
}

/** Debug info for a candidate polygon (not necessarily a quad) */
export interface DebugPolygon {
  /** All vertices of the polygon */
  vertices: Point[];
  /** Convex hull vertices (if computed) */
  hullVertices?: Point[];
  /** Number of vertices */
  vertexCount: number;
  /** Area in pixels */
  area: number;
  /** Area ratio relative to frame */
  areaRatio: number;
  /** Why this polygon was rejected (or 'accepted' if it became a quad) */
  status:
    | "accepted"
    | "too_small"
    | "too_large"
    | "too_few_vertices"
    | "too_many_vertices"
    | "bad_aspect_ratio"
    | "corner_extraction_failed";
  /** Aspect ratio if computed */
  aspectRatio?: number;
}

/** Preprocessing strategy */
export type PreprocessingStrategy =
  | "standard"
  | "enhanced"
  | "adaptive"
  | "multi";

/** Configuration for quad detection */
export interface QuadDetectorConfig {
  /** Minimum area as fraction of frame (0-1). Default: 0.15 */
  minAreaRatio: number;
  /** Maximum area as fraction of frame (0-1). Default: 0.95 */
  maxAreaRatio: number;
  /** How close aspect ratio must be to expected ratios. Default: 0.3 */
  aspectRatioTolerance: number;
  /** Expected document aspect ratios. Default: letter/A4/square */
  expectedAspectRatios: number[];
  /** Canny edge detection thresholds [low, high]. Default: [50, 150] */
  cannyThresholds: [number, number];
  /** Polygon approximation epsilon as fraction of perimeter. Default: 0.02 */
  approxEpsilon: number;
  /** Gaussian blur kernel size (odd number). Default: 5 */
  blurSize: number;
  /** Maximum vertices to consider when finding corners (for rounded rectangles). Default: 8 */
  maxVerticesForCornerFit: number;
  /** Minimum internal angle (degrees) for a vertex to be considered a corner. Default: 60 */
  minCornerAngle: number;
  /** Preprocessing strategy. Default: 'multi' */
  preprocessing: PreprocessingStrategy;
  /** Enable histogram equalization for contrast enhancement. Default: true */
  enableHistogramEqualization: boolean;
  /** Use adaptive thresholding instead of/in addition to Canny. Default: true */
  enableAdaptiveThreshold: boolean;
  /** Adaptive threshold block size (odd number). Default: 11 */
  adaptiveBlockSize: number;
  /** Adaptive threshold constant. Default: 2 */
  adaptiveC: number;
  /** Use morphological gradient for edge enhancement. Default: true */
  enableMorphGradient: boolean;
  /** Use bilateral filter for noise reduction (slower but preserves edges). Default: false */
  enableBilateralFilter: boolean;
  /** Enable Hough line detection as fallback for finger occlusion. Default: true */
  enableHoughLines: boolean;
  /** Hough line detection threshold (minimum votes). Default: 50 */
  houghThreshold: number;
  /** Minimum line length for Hough detection. Default: 50 */
  houghMinLineLength: number;
  /** Maximum gap between line segments to merge. Default: 10 */
  houghMaxLineGap: number;
  /** Angle tolerance (degrees) for grouping parallel lines. Default: 10 */
  houghAngleTolerance: number;
}

/** Default configuration */
export const DEFAULT_QUAD_DETECTOR_CONFIG: QuadDetectorConfig = {
  minAreaRatio: 0.15,
  maxAreaRatio: 0.95,
  aspectRatioTolerance: 0.3,
  expectedAspectRatios: [
    8.5 / 11, // US Letter portrait
    11 / 8.5, // US Letter landscape
    1 / Math.sqrt(2), // A4 portrait
    Math.sqrt(2), // A4 landscape
    1, // Square
  ],
  cannyThresholds: [50, 150],
  approxEpsilon: 0.02,
  blurSize: 5,
  maxVerticesForCornerFit: 8,
  minCornerAngle: 60,
  // Enhanced preprocessing options
  preprocessing: "multi",
  enableHistogramEqualization: true,
  enableAdaptiveThreshold: true,
  adaptiveBlockSize: 11,
  adaptiveC: 2,
  enableMorphGradient: true,
  enableBilateralFilter: false, // Slower, enable if needed
  // Hough line detection options
  enableHoughLines: true,
  houghThreshold: 50,
  houghMinLineLength: 50,
  houghMaxLineGap: 10,
  houghAngleTolerance: 10,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate Euclidean distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

/**
 * Order corners consistently: top-left, top-right, bottom-right, bottom-left
 * Uses angle from centroid and sum of coordinates to find top-left
 */
export function orderCorners(corners: Point[]): [Point, Point, Point, Point] {
  if (corners.length !== 4) {
    throw new Error("orderCorners requires exactly 4 points");
  }

  // Find centroid
  const cx = corners.reduce((s, c) => s + c.x, 0) / 4;
  const cy = corners.reduce((s, c) => s + c.y, 0) / 4;

  // Sort by angle from centroid (counter-clockwise from positive x-axis)
  const sorted = [...corners].sort((a, b) => {
    const angleA = Math.atan2(a.y - cy, a.x - cx);
    const angleB = Math.atan2(b.y - cy, b.x - cx);
    return angleA - angleB;
  });

  // Find top-left (smallest x+y sum)
  let topLeftIdx = 0;
  let minSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < minSum) {
      minSum = sum;
      topLeftIdx = i;
    }
  }

  // Rotate array so top-left is first
  const ordered: Point[] = [];
  for (let i = 0; i < 4; i++) {
    ordered.push(sorted[(topLeftIdx + i) % 4]);
  }

  return ordered as [Point, Point, Point, Point];
}

/**
 * Check if an aspect ratio matches any expected document ratio
 */
export function isDocumentAspectRatio(
  ratio: number,
  expectedRatios: number[],
  tolerance: number,
): boolean {
  return expectedRatios.some(
    (expected) => Math.abs(ratio - expected) < tolerance,
  );
}

/**
 * Calculate the internal angle at a vertex (in degrees)
 * Given three consecutive points: prev -> current -> next
 */
export function vertexAngle(prev: Point, current: Point, next: Point): number {
  const v1 = { x: prev.x - current.x, y: prev.y - current.y };
  const v2 = { x: next.x - current.x, y: next.y - current.y };

  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2);

  if (mag1 === 0 || mag2 === 0) return 180;

  const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/**
 * Find the 4 best corners from a polygon with more than 4 vertices.
 * Uses internal angle to identify the most "corner-like" vertices.
 *
 * This handles cases where fingers occlude document edges, creating
 * extra vertices that should be ignored.
 */
export function extractBestCorners(
  vertices: Point[],
  minCornerAngle: number,
): [Point, Point, Point, Point] | null {
  if (vertices.length < 4) return null;

  // Calculate the internal angle at each vertex
  const vertexScores: Array<{ point: Point; angle: number; index: number }> =
    [];

  for (let i = 0; i < vertices.length; i++) {
    const prev = vertices[(i - 1 + vertices.length) % vertices.length];
    const curr = vertices[i];
    const next = vertices[(i + 1) % vertices.length];
    const angle = vertexAngle(prev, curr, next);
    vertexScores.push({ point: curr, angle, index: i });
  }

  // Filter to vertices with angles sharp enough to be corners
  // (internal angle < 180 - minCornerAngle means it's a convex corner)
  const cornerCandidates = vertexScores.filter(
    (v) => v.angle < 180 - minCornerAngle,
  );

  if (cornerCandidates.length < 4) {
    // Not enough corner candidates - fall back to 4 sharpest angles
    vertexScores.sort((a, b) => a.angle - b.angle);
    const fourSharpest = vertexScores.slice(0, 4);
    // Sort by original index to maintain polygon order
    fourSharpest.sort((a, b) => a.index - b.index);
    return fourSharpest.map((v) => v.point) as [Point, Point, Point, Point];
  }

  // If we have exactly 4 candidates, use them
  if (cornerCandidates.length === 4) {
    cornerCandidates.sort((a, b) => a.index - b.index);
    return cornerCandidates.map((v) => v.point) as [Point, Point, Point, Point];
  }

  // More than 4 candidates - find the 4 that form the best quadrilateral
  // Strategy: pick 4 with sharpest angles while maintaining good spacing
  cornerCandidates.sort((a, b) => a.angle - b.angle);

  // Start with the 4 sharpest, but ensure they're well-distributed
  const selected = cornerCandidates.slice(0, 4);
  selected.sort((a, b) => a.index - b.index);

  return selected.map((v) => v.point) as [Point, Point, Point, Point];
}

// ============================================================================
// Hough Line Detection Functions
// ============================================================================

/** A line segment represented by two endpoints */
interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Angle in radians (-PI/2 to PI/2) */
  angle: number;
  /** Length of the segment */
  length: number;
}

/**
 * Calculate the angle of a line segment (in radians, -PI/2 to PI/2)
 * Normalized so nearly horizontal lines have angle ~0, vertical lines have angle ~PI/2
 */
function lineAngle(x1: number, y1: number, x2: number, y2: number): number {
  let angle = Math.atan2(y2 - y1, x2 - x1);
  // Normalize to -PI/2 to PI/2 (treat lines going opposite directions as same)
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;
  return angle;
}

/**
 * Find the intersection point of two lines (extended infinitely)
 * Returns null if lines are parallel
 */
function lineIntersection(
  line1: LineSegment,
  line2: LineSegment,
): Point | null {
  const x1 = line1.x1,
    y1 = line1.y1,
    x2 = line1.x2,
    y2 = line1.y2;
  const x3 = line2.x1,
    y3 = line2.y1,
    x4 = line2.x2,
    y4 = line2.y2;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Lines are parallel if denominator is ~0
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;

  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  };
}

/**
 * Group lines by angle into roughly parallel sets.
 * For a document, we expect 4 groups: 2 pairs of parallel edges.
 */
function groupLinesByAngle(
  lines: LineSegment[],
  toleranceRadians: number,
): LineSegment[][] {
  if (lines.length === 0) return [];

  // Sort lines by angle
  const sorted = [...lines].sort((a, b) => a.angle - b.angle);

  const groups: LineSegment[][] = [];
  let currentGroup: LineSegment[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const angleDiff = Math.abs(sorted[i].angle - sorted[i - 1].angle);

    if (angleDiff <= toleranceRadians) {
      currentGroup.push(sorted[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [sorted[i]];
    }
  }
  groups.push(currentGroup);

  // Handle wrap-around (lines at -PI/2 and PI/2 are actually parallel)
  if (groups.length >= 2) {
    const firstAngle = groups[0][0].angle;
    const lastAngle = groups[groups.length - 1][0].angle;

    // If first and last groups are actually parallel (wrap-around)
    if (
      Math.abs(lastAngle - firstAngle - Math.PI) <= toleranceRadians ||
      Math.abs(lastAngle - firstAngle + Math.PI) <= toleranceRadians
    ) {
      groups[0] = [...groups[groups.length - 1], ...groups[0]];
      groups.pop();
    }
  }

  return groups;
}

/**
 * Get the "best" line from a group of parallel lines.
 * Prefers longer lines and lines closer to the center of mass.
 */
function getBestLineFromGroup(lines: LineSegment[]): LineSegment {
  if (lines.length === 1) return lines[0];

  // Weight by length - longer lines are more reliable
  let totalWeight = 0;
  let weightedX1 = 0,
    weightedY1 = 0,
    weightedX2 = 0,
    weightedY2 = 0;

  for (const line of lines) {
    const weight = line.length;
    totalWeight += weight;
    weightedX1 += line.x1 * weight;
    weightedY1 += line.y1 * weight;
    weightedX2 += line.x2 * weight;
    weightedY2 += line.y2 * weight;
  }

  if (totalWeight === 0) return lines[0];

  return {
    x1: weightedX1 / totalWeight,
    y1: weightedY1 / totalWeight,
    x2: weightedX2 / totalWeight,
    y2: weightedY2 / totalWeight,
    angle: lines[0].angle, // Use representative angle
    length: Math.max(...lines.map((l) => l.length)),
  };
}

/**
 * Find the 4 dominant line groups that could form a document quadrilateral.
 * Returns 4 representative lines (2 roughly horizontal, 2 roughly vertical).
 */
function findDominantLines(
  lines: LineSegment[],
  toleranceRadians: number,
): LineSegment[] | null {
  // Group by angle
  const groups = groupLinesByAngle(lines, toleranceRadians);

  // We need at least 4 groups, or 2 groups with enough lines to split
  if (groups.length < 2) return null;

  // Sort groups by total line length (more reliable groups first)
  const groupsWithScore = groups.map((group) => ({
    group,
    totalLength: group.reduce((sum, l) => sum + l.length, 0),
    avgAngle: group.reduce((sum, l) => sum + l.angle, 0) / group.length,
  }));
  groupsWithScore.sort((a, b) => b.totalLength - a.totalLength);

  // We need to find 4 lines forming 2 pairs of roughly parallel lines
  // For a document, we expect 2 angle directions (~0° and ~90°)
  const dominantLines: LineSegment[] = [];

  // Take the 2 most prominent angle directions
  const direction1 = groupsWithScore[0];
  let direction2 = groupsWithScore.find(
    (g) =>
      Math.abs(Math.abs(g.avgAngle - direction1.avgAngle) - Math.PI / 2) <
      toleranceRadians * 2,
  );

  if (!direction2 && groupsWithScore.length > 1) {
    // No perpendicular group found, just take second largest
    direction2 = groupsWithScore[1];
  }

  if (!direction2) return null;

  // From direction1, we need 2 lines (opposite edges of document)
  // Split lines by position (which side of the image center they're on)
  const splitGroup = (
    group: LineSegment[],
  ): [LineSegment, LineSegment] | null => {
    if (group.length < 2) {
      // Only one line - can't form two edges
      return null;
    }

    // Sort by distance from origin along perpendicular direction
    const isVertical = Math.abs(group[0].angle) > Math.PI / 4;

    const sorted = [...group].sort((a, b) => {
      if (isVertical) {
        // For vertical lines, sort by x position
        return (a.x1 + a.x2) / 2 - (b.x1 + b.x2) / 2;
      } else {
        // For horizontal lines, sort by y position
        return (a.y1 + a.y2) / 2 - (b.y1 + b.y2) / 2;
      }
    });

    // Take the first and last as the two edges
    return [
      getBestLineFromGroup([sorted[0]]),
      getBestLineFromGroup([sorted[sorted.length - 1]]),
    ];
  };

  const dir1Lines = splitGroup(direction1.group);
  const dir2Lines = splitGroup(direction2.group);

  if (!dir1Lines || !dir2Lines) return null;

  dominantLines.push(dir1Lines[0], dir1Lines[1], dir2Lines[0], dir2Lines[1]);

  return dominantLines;
}

/**
 * Detect quadrilateral corners using Hough line transform.
 * Works even when fingers occlude parts of the document edges.
 *
 * @param cv - OpenCV instance
 * @param edges - Edge-detected image (8-bit single channel)
 * @param cfg - Configuration
 * @param frameWidth - Width of the frame
 * @param frameHeight - Height of the frame
 * @returns Detected quad or null
 */
function detectQuadFromHoughLines(
  cv: CV,
  edges: CVMat,
  cfg: QuadDetectorConfig,
  frameWidth: number,
  frameHeight: number,
): DetectedQuad | null {
  const lines = new cv.Mat();

  try {
    // Detect line segments using probabilistic Hough transform
    cv.HoughLinesP(
      edges,
      lines,
      1, // rho: distance resolution in pixels
      Math.PI / 180, // theta: angle resolution in radians
      cfg.houghThreshold,
      cfg.houghMinLineLength,
      cfg.houghMaxLineGap,
    );

    if (lines.rows === 0) return null;

    // Convert to LineSegment array
    const lineSegments: LineSegment[] = [];
    for (let i = 0; i < lines.rows; i++) {
      const x1 = lines.data32S[i * 4];
      const y1 = lines.data32S[i * 4 + 1];
      const x2 = lines.data32S[i * 4 + 2];
      const y2 = lines.data32S[i * 4 + 3];

      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

      // Filter very short lines
      if (length < cfg.houghMinLineLength) continue;

      lineSegments.push({
        x1,
        y1,
        x2,
        y2,
        angle: lineAngle(x1, y1, x2, y2),
        length,
      });
    }

    if (lineSegments.length < 4) return null;

    // Find 4 dominant lines forming the document edges
    const toleranceRadians = (cfg.houghAngleTolerance * Math.PI) / 180;
    const dominantLines = findDominantLines(lineSegments, toleranceRadians);

    if (!dominantLines || dominantLines.length !== 4) return null;

    // Find corners as intersections of adjacent lines
    // We have 4 lines - need to find which pairs are adjacent (perpendicular)
    const isRoughlyPerpendicular = (
      l1: LineSegment,
      l2: LineSegment,
    ): boolean => {
      const angleDiff = Math.abs(l1.angle - l2.angle);
      return (
        Math.abs(angleDiff - Math.PI / 2) < toleranceRadians * 2 ||
        Math.abs(angleDiff + Math.PI / 2) < toleranceRadians * 2
      );
    };

    // Group lines by direction
    const group1: LineSegment[] = [];
    const group2: LineSegment[] = [];

    group1.push(dominantLines[0]);
    for (let i = 1; i < 4; i++) {
      if (!isRoughlyPerpendicular(dominantLines[0], dominantLines[i])) {
        group1.push(dominantLines[i]);
      } else {
        group2.push(dominantLines[i]);
      }
    }

    if (group1.length !== 2 || group2.length !== 2) {
      // Couldn't properly separate into perpendicular pairs
      return null;
    }

    // Find 4 corners as intersections
    const corners: Point[] = [];
    for (const line1 of group1) {
      for (const line2 of group2) {
        const intersection = lineIntersection(line1, line2);
        if (intersection) {
          // Check intersection is within frame bounds (with some margin)
          const margin = Math.min(frameWidth, frameHeight) * 0.1;
          if (
            intersection.x >= -margin &&
            intersection.x <= frameWidth + margin &&
            intersection.y >= -margin &&
            intersection.y <= frameHeight + margin
          ) {
            corners.push(intersection);
          }
        }
      }
    }

    if (corners.length !== 4) return null;

    // Order corners and validate
    const orderedCorners = orderCorners(corners);

    // Calculate area
    const width = distance(orderedCorners[0], orderedCorners[1]);
    const height = distance(orderedCorners[1], orderedCorners[2]);
    const area = width * height * 0.95; // Approximate area (assuming near-rectangle)
    const frameArea = frameWidth * frameHeight;
    const areaRatio = area / frameArea;

    // Validate area
    if (areaRatio < cfg.minAreaRatio || areaRatio > cfg.maxAreaRatio) {
      return null;
    }

    // Calculate and validate aspect ratio
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    if (
      !isDocumentAspectRatio(
        aspectRatio,
        cfg.expectedAspectRatios,
        cfg.aspectRatioTolerance,
      )
    ) {
      return null;
    }

    return {
      corners: orderedCorners,
      area,
      aspectRatio,
    };
  } finally {
    lines.delete();
  }
}

// ============================================================================
// Preprocessing Functions
// ============================================================================

/**
 * Apply standard preprocessing: grayscale -> blur -> Canny
 */
function preprocessStandard(
  cv: CV,
  gray: CVMat,
  edges: CVMat,
  cfg: QuadDetectorConfig,
): void {
  const blurred = new cv.Mat();

  try {
    // Blur to reduce noise
    cv.GaussianBlur(
      gray,
      blurred,
      new cv.Size(cfg.blurSize, cfg.blurSize),
      0,
      0,
      cv.BORDER_DEFAULT,
    );

    // Canny edge detection
    cv.Canny(blurred, edges, cfg.cannyThresholds[0], cfg.cannyThresholds[1]);
  } finally {
    blurred.delete();
  }
}

/**
 * Apply enhanced preprocessing: histogram equalization -> blur -> Canny with multiple thresholds
 */
function preprocessEnhanced(
  cv: CV,
  gray: CVMat,
  edges: CVMat,
  cfg: QuadDetectorConfig,
): void {
  const equalized = new cv.Mat();
  const blurred = new cv.Mat();
  const edges1 = new cv.Mat();
  const edges2 = new cv.Mat();

  try {
    // Histogram equalization for contrast enhancement
    if (cfg.enableHistogramEqualization) {
      cv.equalizeHist(gray, equalized);
    } else {
      gray.copyTo(equalized);
    }

    // Blur to reduce noise
    cv.GaussianBlur(
      equalized,
      blurred,
      new cv.Size(cfg.blurSize, cfg.blurSize),
      0,
      0,
      cv.BORDER_DEFAULT,
    );

    // Try Canny with original thresholds
    cv.Canny(blurred, edges1, cfg.cannyThresholds[0], cfg.cannyThresholds[1]);

    // Try Canny with lower thresholds for low contrast images
    cv.Canny(
      blurred,
      edges2,
      cfg.cannyThresholds[0] / 2,
      cfg.cannyThresholds[1] / 2,
    );

    // Combine edges
    cv.bitwise_or(edges1, edges2, edges);
  } finally {
    equalized.delete();
    blurred.delete();
    edges1.delete();
    edges2.delete();
  }
}

/**
 * Apply adaptive preprocessing: histogram equalization -> adaptive threshold + morphological gradient
 */
function preprocessAdaptive(
  cv: CV,
  gray: CVMat,
  edges: CVMat,
  cfg: QuadDetectorConfig,
): void {
  const equalized = new cv.Mat();
  const blurred = new cv.Mat();
  const adaptiveEdges = new cv.Mat();
  const morphEdges = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

  try {
    // Histogram equalization
    if (cfg.enableHistogramEqualization) {
      cv.equalizeHist(gray, equalized);
    } else {
      gray.copyTo(equalized);
    }

    // Slight blur
    cv.GaussianBlur(
      equalized,
      blurred,
      new cv.Size(cfg.blurSize, cfg.blurSize),
      0,
      0,
      cv.BORDER_DEFAULT,
    );

    // Adaptive threshold
    if (cfg.enableAdaptiveThreshold) {
      cv.adaptiveThreshold(
        blurred,
        adaptiveEdges,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        cfg.adaptiveBlockSize,
        cfg.adaptiveC,
      );
      // Invert so edges are white
      cv.threshold(
        adaptiveEdges,
        adaptiveEdges,
        127,
        255,
        cv.THRESH_BINARY_INV,
      );
    }

    // Morphological gradient (dilation - erosion = edges)
    if (cfg.enableMorphGradient) {
      cv.morphologyEx(blurred, morphEdges, cv.MORPH_GRADIENT, kernel);
      // Threshold the gradient
      cv.threshold(morphEdges, morphEdges, 30, 255, cv.THRESH_BINARY);
    }

    // Combine results
    if (cfg.enableAdaptiveThreshold && cfg.enableMorphGradient) {
      cv.bitwise_or(adaptiveEdges, morphEdges, edges);
    } else if (cfg.enableAdaptiveThreshold) {
      adaptiveEdges.copyTo(edges);
    } else if (cfg.enableMorphGradient) {
      morphEdges.copyTo(edges);
    } else {
      // Fallback to standard Canny
      cv.Canny(blurred, edges, cfg.cannyThresholds[0], cfg.cannyThresholds[1]);
    }
  } finally {
    equalized.delete();
    blurred.delete();
    adaptiveEdges.delete();
    morphEdges.delete();
    kernel.delete();
  }
}

/**
 * Apply multi-strategy preprocessing: combines multiple approaches
 * This is the most robust for varying lighting conditions
 */
function preprocessMulti(
  cv: CV,
  gray: CVMat,
  edges: CVMat,
  cfg: QuadDetectorConfig,
): void {
  const equalized = new cv.Mat();
  const blurred = new cv.Mat();
  const cannyEdges = new cv.Mat();
  const cannyLowEdges = new cv.Mat();
  const adaptiveEdges = new cv.Mat();
  const morphEdges = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  const combined = new cv.Mat();

  try {
    // Step 1: Histogram equalization
    if (cfg.enableHistogramEqualization) {
      cv.equalizeHist(gray, equalized);
    } else {
      gray.copyTo(equalized);
    }

    // Step 2: Gaussian blur
    cv.GaussianBlur(
      equalized,
      blurred,
      new cv.Size(cfg.blurSize, cfg.blurSize),
      0,
      0,
      cv.BORDER_DEFAULT,
    );

    // Strategy A: Standard Canny
    cv.Canny(
      blurred,
      cannyEdges,
      cfg.cannyThresholds[0],
      cfg.cannyThresholds[1],
    );

    // Strategy B: Low-threshold Canny (catches faint edges)
    cv.Canny(
      blurred,
      cannyLowEdges,
      cfg.cannyThresholds[0] / 3,
      cfg.cannyThresholds[1] / 3,
    );

    // Combine Canny results
    cv.bitwise_or(cannyEdges, cannyLowEdges, combined);

    // Strategy C: Adaptive threshold (good for uneven lighting)
    if (cfg.enableAdaptiveThreshold) {
      cv.adaptiveThreshold(
        blurred,
        adaptiveEdges,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY_INV,
        cfg.adaptiveBlockSize,
        cfg.adaptiveC,
      );
      cv.bitwise_or(combined, adaptiveEdges, combined);
    }

    // Strategy D: Morphological gradient (good for low contrast)
    if (cfg.enableMorphGradient) {
      cv.morphologyEx(blurred, morphEdges, cv.MORPH_GRADIENT, kernel);
      cv.threshold(morphEdges, morphEdges, 20, 255, cv.THRESH_BINARY);
      cv.bitwise_or(combined, morphEdges, combined);
    }

    // Copy result
    combined.copyTo(edges);
  } finally {
    equalized.delete();
    blurred.delete();
    cannyEdges.delete();
    cannyLowEdges.delete();
    adaptiveEdges.delete();
    morphEdges.delete();
    kernel.delete();
    combined.delete();
  }
}

/**
 * Preprocess image for edge detection based on selected strategy
 */
function preprocessImage(
  cv: CV,
  gray: CVMat,
  edges: CVMat,
  cfg: QuadDetectorConfig,
): void {
  try {
    switch (cfg.preprocessing) {
      case "standard":
        preprocessStandard(cv, gray, edges, cfg);
        break;
      case "enhanced":
        preprocessEnhanced(cv, gray, edges, cfg);
        break;
      case "adaptive":
        preprocessAdaptive(cv, gray, edges, cfg);
        break;
      case "multi":
      default:
        preprocessMulti(cv, gray, edges, cfg);
        break;
    }
  } catch (err) {
    // If preprocessing fails, fall back to simple Canny
    console.warn("Preprocessing failed, falling back to simple Canny:", err);
    const blurred = new cv.Mat();
    try {
      cv.GaussianBlur(
        gray,
        blurred,
        new cv.Size(5, 5),
        0,
        0,
        cv.BORDER_DEFAULT,
      );
      cv.Canny(blurred, edges, 50, 150);
    } finally {
      blurred.delete();
    }
  }
}

// ============================================================================
// Quad Detector
// ============================================================================

/**
 * Create a quad detector instance
 *
 * @param cv - OpenCV.js instance
 * @param config - Optional configuration overrides
 */
export function createQuadDetector(
  cv: CV,
  config: Partial<QuadDetectorConfig> = {},
) {
  const cfg: QuadDetectorConfig = {
    ...DEFAULT_QUAD_DETECTOR_CONFIG,
    ...config,
  };

  // Validate and sanitize parameters to prevent OpenCV errors
  // Blur size must be odd and >= 1
  if (cfg.blurSize < 1) cfg.blurSize = 1;
  if (cfg.blurSize % 2 === 0) cfg.blurSize += 1;

  // Adaptive block size must be odd and >= 3
  if (cfg.adaptiveBlockSize < 3) cfg.adaptiveBlockSize = 3;
  if (cfg.adaptiveBlockSize % 2 === 0) cfg.adaptiveBlockSize += 1;

  // Canny thresholds must be positive and low < high
  if (cfg.cannyThresholds[0] < 1) cfg.cannyThresholds[0] = 1;
  if (cfg.cannyThresholds[1] < 1) cfg.cannyThresholds[1] = 1;
  if (cfg.cannyThresholds[0] >= cfg.cannyThresholds[1]) {
    cfg.cannyThresholds[1] = cfg.cannyThresholds[0] + 50;
  }

  /**
   * Detect all document-like quadrilaterals in an image
   *
   * @param source - Canvas or ImageData to process
   * @returns Array of detected quads, sorted by area (largest first)
   */
  function detect(source: HTMLCanvasElement): DetectedQuad[] {
    const quads: DetectedQuad[] = [];
    const frameArea = source.width * source.height;

    // OpenCV matrices (need cleanup)
    let src: CVMat | null = null;
    let gray: CVMat | null = null;
    let edges: CVMat | null = null;
    let contours: CVMatVector | null = null;
    let hierarchy: CVMat | null = null;

    try {
      // Read image
      src = cv.imread(source);
      gray = new cv.Mat();
      edges = new cv.Mat();

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply preprocessing based on selected strategy
      preprocessImage(cv, gray, edges, cfg);

      // Dilate edges to connect gaps
      const kernel = new cv.Mat();
      cv.dilate(edges, edges, kernel, { x: -1, y: -1 } as CVPoint, 1);
      kernel.delete();

      // Find contours
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );

      // Process each contour
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        const areaRatio = area / frameArea;

        // Skip if too small or too large
        if (areaRatio < cfg.minAreaRatio || areaRatio > cfg.maxAreaRatio) {
          continue;
        }

        // Approximate to polygon
        const approx = new cv.Mat();
        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, cfg.approxEpsilon * perimeter, true);

        let corners: [Point, Point, Point, Point] | null = null;

        if (approx.rows === 4) {
          // Perfect quadrilateral - extract corners directly
          const pts: Point[] = [];
          for (let j = 0; j < 4; j++) {
            pts.push({
              x: approx.data32S[j * 2],
              y: approx.data32S[j * 2 + 1],
            });
          }
          corners = orderCorners(pts);
        } else if (
          approx.rows > 4 &&
          approx.rows <= cfg.maxVerticesForCornerFit
        ) {
          // Polygon with extra vertices (likely finger occlusion)
          // Use convex hull to remove concave intrusions, then extract 4 best corners
          const hull = new cv.Mat();
          cv.convexHull(contour, hull, false, true);

          // Extract hull points
          const hullPoints: Point[] = [];
          for (let j = 0; j < hull.rows; j++) {
            hullPoints.push({
              x: hull.data32S[j * 2],
              y: hull.data32S[j * 2 + 1],
            });
          }
          hull.delete();

          if (hullPoints.length >= 4) {
            // Try to find 4 best corners from convex hull
            const extracted = extractBestCorners(
              hullPoints,
              cfg.minCornerAngle,
            );
            if (extracted) {
              corners = orderCorners(extracted);
            }
          }
        }

        if (corners) {
          // Calculate aspect ratio
          const width = distance(corners[0], corners[1]);
          const height = distance(corners[1], corners[2]);
          const aspectRatio = Math.max(width, height) / Math.min(width, height);

          // Check if aspect ratio is document-like
          if (
            isDocumentAspectRatio(
              aspectRatio,
              cfg.expectedAspectRatios,
              cfg.aspectRatioTolerance,
            )
          ) {
            quads.push({
              corners,
              area,
              aspectRatio,
            });
          }
        }

        approx.delete();
      }

      // If no quads found via contours, try Hough line detection
      if (quads.length === 0 && cfg.enableHoughLines && edges) {
        const houghQuad = detectQuadFromHoughLines(
          cv,
          edges,
          cfg,
          source.width,
          source.height,
        );
        if (houghQuad) {
          quads.push(houghQuad);
        }
      }
    } finally {
      // Clean up OpenCV memory
      src?.delete();
      gray?.delete();
      edges?.delete();
      contours?.delete();
      hierarchy?.delete();
    }

    // Sort by area (largest first)
    quads.sort((a, b) => b.area - a.area);

    return quads;
  }

  /**
   * Detect the single best quad in an image
   *
   * @param source - Canvas to process
   * @returns Best quad or null if none found
   */
  function detectBest(source: HTMLCanvasElement): DetectedQuad | null {
    const quads = detect(source);
    return quads.length > 0 ? quads[0] : null;
  }

  /**
   * Detect quads with debug info about all candidate polygons.
   * Use this to understand why detection is failing.
   *
   * @param source - Canvas to process
   * @returns Quads and debug info about all candidates
   */
  function detectWithDebug(source: HTMLCanvasElement): {
    quads: DetectedQuad[];
    debugPolygons: DebugPolygon[];
  } {
    const quads: DetectedQuad[] = [];
    const debugPolygons: DebugPolygon[] = [];
    const frameArea = source.width * source.height;

    // OpenCV matrices (need cleanup)
    let src: CVMat | null = null;
    let gray: CVMat | null = null;
    let edges: CVMat | null = null;
    let contours: CVMatVector | null = null;
    let hierarchy: CVMat | null = null;

    try {
      // Read image
      src = cv.imread(source);
      gray = new cv.Mat();
      edges = new cv.Mat();

      // Convert to grayscale
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // Apply preprocessing based on selected strategy
      preprocessImage(cv, gray, edges, cfg);

      // Dilate edges to connect gaps
      const kernel = new cv.Mat();
      cv.dilate(edges, edges, kernel, { x: -1, y: -1 } as CVPoint, 1);
      kernel.delete();

      // Find contours
      contours = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(
        edges,
        contours,
        hierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );

      // Process each contour
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);
        const areaRatio = area / frameArea;

        // Approximate to polygon
        const approx = new cv.Mat();
        const perimeter = cv.arcLength(contour, true);
        cv.approxPolyDP(contour, approx, cfg.approxEpsilon * perimeter, true);

        // Extract vertices for debug
        const vertices: Point[] = [];
        for (let j = 0; j < approx.rows; j++) {
          vertices.push({
            x: approx.data32S[j * 2],
            y: approx.data32S[j * 2 + 1],
          });
        }

        const debugInfo: DebugPolygon = {
          vertices,
          vertexCount: approx.rows,
          area,
          areaRatio,
          status: "accepted", // Will be updated if rejected
        };

        // Skip if too small or too large
        if (areaRatio < cfg.minAreaRatio) {
          debugInfo.status = "too_small";
          debugPolygons.push(debugInfo);
          approx.delete();
          continue;
        }

        if (areaRatio > cfg.maxAreaRatio) {
          debugInfo.status = "too_large";
          debugPolygons.push(debugInfo);
          approx.delete();
          continue;
        }

        let corners: [Point, Point, Point, Point] | null = null;

        if (approx.rows === 4) {
          // Perfect quadrilateral - extract corners directly
          const pts: Point[] = [];
          for (let j = 0; j < 4; j++) {
            pts.push({
              x: approx.data32S[j * 2],
              y: approx.data32S[j * 2 + 1],
            });
          }
          corners = orderCorners(pts);
        } else if (approx.rows < 4) {
          debugInfo.status = "too_few_vertices";
          debugPolygons.push(debugInfo);
          approx.delete();
          continue;
        } else if (approx.rows > cfg.maxVerticesForCornerFit) {
          debugInfo.status = "too_many_vertices";
          debugPolygons.push(debugInfo);
          approx.delete();
          continue;
        } else {
          // Polygon with extra vertices (likely finger occlusion)
          // Use convex hull to remove concave intrusions, then extract 4 best corners
          const hull = new cv.Mat();
          cv.convexHull(contour, hull, false, true);

          // Extract hull points
          const hullPoints: Point[] = [];
          for (let j = 0; j < hull.rows; j++) {
            hullPoints.push({
              x: hull.data32S[j * 2],
              y: hull.data32S[j * 2 + 1],
            });
          }
          hull.delete();

          debugInfo.hullVertices = hullPoints;

          if (hullPoints.length >= 4) {
            // Try to find 4 best corners from convex hull
            const extracted = extractBestCorners(
              hullPoints,
              cfg.minCornerAngle,
            );
            if (extracted) {
              corners = orderCorners(extracted);
            } else {
              debugInfo.status = "corner_extraction_failed";
              debugPolygons.push(debugInfo);
              approx.delete();
              continue;
            }
          } else {
            debugInfo.status = "too_few_vertices";
            debugPolygons.push(debugInfo);
            approx.delete();
            continue;
          }
        }

        if (corners) {
          // Calculate aspect ratio
          const width = distance(corners[0], corners[1]);
          const height = distance(corners[1], corners[2]);
          const aspectRatio = Math.max(width, height) / Math.min(width, height);
          debugInfo.aspectRatio = aspectRatio;

          // Check if aspect ratio is document-like
          if (
            isDocumentAspectRatio(
              aspectRatio,
              cfg.expectedAspectRatios,
              cfg.aspectRatioTolerance,
            )
          ) {
            debugInfo.status = "accepted";
            quads.push({
              corners,
              area,
              aspectRatio,
            });
          } else {
            debugInfo.status = "bad_aspect_ratio";
          }
        }

        debugPolygons.push(debugInfo);
        approx.delete();
      }

      // If no quads found via contours, try Hough line detection
      if (quads.length === 0 && cfg.enableHoughLines && edges) {
        const houghQuad = detectQuadFromHoughLines(
          cv,
          edges,
          cfg,
          source.width,
          source.height,
        );
        if (houghQuad) {
          quads.push(houghQuad);
          // Add a debug polygon for the Hough-detected quad
          debugPolygons.push({
            vertices: [...houghQuad.corners],
            vertexCount: 4,
            area: houghQuad.area,
            areaRatio: houghQuad.area / frameArea,
            status: "accepted",
            aspectRatio: houghQuad.aspectRatio,
          });
        }
      }
    } finally {
      // Clean up OpenCV memory
      src?.delete();
      gray?.delete();
      edges?.delete();
      contours?.delete();
      hierarchy?.delete();
    }

    // Sort by area (largest first)
    quads.sort((a, b) => b.area - a.area);
    debugPolygons.sort((a, b) => b.area - a.area);

    return { quads, debugPolygons };
  }

  return {
    detect,
    detectBest,
    detectWithDebug,
    config: cfg,
  };
}

export type QuadDetector = ReturnType<typeof createQuadDetector>;
