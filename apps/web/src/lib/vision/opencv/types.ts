/**
 * OpenCV.js Type Definitions
 *
 * Minimal interface for the OpenCV.js functions we use for quad detection
 * and perspective transformation.
 */

export interface CVMat {
  delete: () => void
  data32S: Int32Array
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
  dilate: (src: CVMat, dst: CVMat, kernel: CVMat, anchor: CVPoint, iterations: number) => void
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
  CHAIN_APPROX_SIMPLE: number
  CV_32FC2: number
  INTER_LINEAR: number
  BORDER_CONSTANT: number
  ROTATE_90_CLOCKWISE: number
  ROTATE_180: number
  ROTATE_90_COUNTERCLOCKWISE: number
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
