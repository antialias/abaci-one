/**
 * OpenCV.js Module
 *
 * Provides type definitions and lazy loading for OpenCV.js
 */

export type { CV, CVMat, CVMatVector, CVPoint, CVSize, WindowWithOpenCV } from './types'

export {
  loadOpenCV,
  getOpenCV,
  getOpenCVError,
  isOpenCVLoading,
  isOpenCVReady,
  resetOpenCVLoader,
} from './loader'
