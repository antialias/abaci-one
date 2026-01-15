/**
 * OpenCV.js Type Definitions
 *
 * Minimal interface for the OpenCV.js functions we use for quad detection
 * and perspective transformation.
 */

export interface CVMat {
  delete: () => void
  copyTo: (dst: CVMat) => void
  data32S: Int32Array
  data32F: Float32Array
  data: ArrayBuffer
  rows: number
  cols: number
}

export interface CVMatVector {
  size: () => number
  get: (i: number) => CVMat
  delete: () => void
}

export interface CVSize {
  width: number
  height: number
}

export interface CVPoint {
  x: number
  y: number
}

export interface CV {
  Mat: new () => CVMat
  MatVector: new () => CVMatVector
  Size: new (w: number, h: number) => CVSize
  Scalar: new (r?: number, g?: number, b?: number, a?: number) => unknown
  imread: (canvas: HTMLCanvasElement) => CVMat
  imshow: (canvas: HTMLCanvasElement, mat: CVMat) => void
  cvtColor: (src: CVMat, dst: CVMat, code: number) => void
  GaussianBlur: (
    src: CVMat,
    dst: CVMat,
    size: CVSize,
    sigmaX: number,
    sigmaY: number,
    borderType: number
  ) => void
  Canny: (src: CVMat, dst: CVMat, t1: number, t2: number) => void
  Sobel: (src: CVMat, dst: CVMat, ddepth: number, dx: number, dy: number, ksize?: number) => void
  addWeighted: (
    src1: CVMat,
    alpha: number,
    src2: CVMat,
    beta: number,
    gamma: number,
    dst: CVMat
  ) => void
  convertScaleAbs: (src: CVMat, dst: CVMat, alpha?: number, beta?: number) => void
  equalizeHist: (src: CVMat, dst: CVMat) => void
  adaptiveThreshold: (
    src: CVMat,
    dst: CVMat,
    maxValue: number,
    adaptiveMethod: number,
    thresholdType: number,
    blockSize: number,
    C: number
  ) => void
  threshold: (src: CVMat, dst: CVMat, thresh: number, maxval: number, type: number) => number
  bilateralFilter: (
    src: CVMat,
    dst: CVMat,
    d: number,
    sigmaColor: number,
    sigmaSpace: number,
    borderType?: number
  ) => void
  morphologyEx: (
    src: CVMat,
    dst: CVMat,
    op: number,
    kernel: CVMat,
    anchor?: CVPoint,
    iterations?: number
  ) => void
  getStructuringElement: (shape: number, ksize: CVSize, anchor?: CVPoint) => CVMat
  erode: (src: CVMat, dst: CVMat, kernel: CVMat, anchor?: CVPoint, iterations?: number) => void
  dilate: (src: CVMat, dst: CVMat, kernel: CVMat, anchor: CVPoint, iterations: number) => void
  bitwise_or: (src1: CVMat, src2: CVMat, dst: CVMat) => void
  bitwise_and: (src1: CVMat, src2: CVMat, dst: CVMat) => void
  findContours: (
    src: CVMat,
    contours: CVMatVector,
    hierarchy: CVMat,
    mode: number,
    method: number
  ) => void
  contourArea: (contour: CVMat) => number
  arcLength: (contour: CVMat, closed: boolean) => number
  approxPolyDP: (contour: CVMat, approx: CVMat, epsilon: number, closed: boolean) => void
  convexHull: (src: CVMat, dst: CVMat, clockwise: boolean, returnPoints: boolean) => void
  // Hough line detection
  HoughLinesP: (
    src: CVMat,
    lines: CVMat,
    rho: number,
    theta: number,
    threshold: number,
    minLineLength?: number,
    maxLineGap?: number
  ) => void
  getPerspectiveTransform: (src: CVMat, dst: CVMat) => CVMat
  warpPerspective: (
    src: CVMat,
    dst: CVMat,
    M: CVMat,
    size: CVSize,
    flags: number,
    borderMode: number,
    borderValue: unknown
  ) => void
  rotate: (src: CVMat, dst: CVMat, rotateCode: number) => void
  matFromArray: (rows: number, cols: number, type: number, data: number[]) => CVMat
  COLOR_RGBA2GRAY: number
  BORDER_DEFAULT: number
  RETR_LIST: number
  RETR_EXTERNAL: number
  CHAIN_APPROX_SIMPLE: number
  CV_32FC2: number
  CV_32SC4: number
  CV_8U: number
  CV_16S: number
  CV_64F: number
  INTER_LINEAR: number
  BORDER_CONSTANT: number
  ROTATE_90_CLOCKWISE: number
  ROTATE_180: number
  ROTATE_90_COUNTERCLOCKWISE: number
  // Threshold types
  THRESH_BINARY: number
  THRESH_BINARY_INV: number
  THRESH_OTSU: number
  // Adaptive threshold methods
  ADAPTIVE_THRESH_MEAN_C: number
  ADAPTIVE_THRESH_GAUSSIAN_C: number
  // Morphological operations
  MORPH_RECT: number
  MORPH_ELLIPSE: number
  MORPH_CROSS: number
  MORPH_OPEN: number
  MORPH_CLOSE: number
  MORPH_GRADIENT: number
  MORPH_DILATE: number
  MORPH_ERODE: number
}

/**
 * Window interface extension for OpenCV global
 */
export interface WindowWithOpenCV {
  cv?: CV & {
    onRuntimeInitialized?: () => void
    imread?: unknown
  }
}
