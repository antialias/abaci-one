/**
 * OpenCV.js Lazy Loader
 *
 * Handles lazy loading of OpenCV.js (~8MB) with caching and error handling.
 * Non-React module - can be used directly or wrapped in a hook.
 */

import type { CV, WindowWithOpenCV } from './types'

/** Singleton state for OpenCV loading */
let cvInstance: CV | null = null
let loadPromise: Promise<CV> | null = null
let loadError: Error | null = null

/**
 * Check if OpenCV is fully initialized and ready to use
 */
export function isOpenCVReady(): boolean {
  const win = window as unknown as WindowWithOpenCV
  return !!(win.cv && typeof win.cv.imread === 'function')
}

/**
 * Get the OpenCV instance if already loaded
 */
export function getOpenCV(): CV | null {
  return cvInstance
}

/**
 * Get any error that occurred during loading
 */
export function getOpenCVError(): Error | null {
  return loadError
}

/**
 * Check if OpenCV is currently loading
 */
export function isOpenCVLoading(): boolean {
  return loadPromise !== null && cvInstance === null && loadError === null
}

/**
 * Load OpenCV.js lazily. Returns a promise that resolves to the CV instance.
 * Subsequent calls return the same promise/instance.
 *
 * @param scriptUrl - URL to load OpenCV.js from (default: '/opencv.js')
 * @param timeout - Maximum time to wait for OpenCV to initialize (default: 30000ms)
 */
export async function loadOpenCV(
  scriptUrl: string = '/opencv.js',
  timeout: number = 30000
): Promise<CV> {
  // Already loaded
  if (cvInstance) return cvInstance

  // Already loading
  if (loadPromise) return loadPromise

  // Start loading
  loadPromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('OpenCV.js can only be loaded in a browser environment')
    }

    const win = window as unknown as WindowWithOpenCV

    // Check if already initialized
    if (isOpenCVReady()) {
      cvInstance = win.cv as CV
      return cvInstance
    }

    // Check if script is already in DOM
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`)

    if (!existingScript) {
      // Load the script
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = scriptUrl
        script.async = true

        const timeoutId = setTimeout(() => {
          reject(new Error(`OpenCV.js loading timed out after ${timeout}ms`))
        }, timeout)

        script.onload = () => {
          clearTimeout(timeoutId)
          waitForInitialization(resolve, reject, timeout)
        }

        script.onerror = () => {
          clearTimeout(timeoutId)
          reject(new Error(`Failed to load OpenCV.js from ${scriptUrl}`))
        }

        document.head.appendChild(script)
      })
    } else {
      // Script exists, wait for initialization
      await new Promise<void>((resolve, reject) => {
        waitForInitialization(resolve, reject, timeout)
      })
    }

    cvInstance = win.cv as CV
    return cvInstance
  })()

  try {
    return await loadPromise
  } catch (err) {
    loadError = err instanceof Error ? err : new Error('Failed to load OpenCV')
    loadPromise = null
    throw loadError
  }
}

/**
 * Wait for OpenCV runtime to initialize
 */
function waitForInitialization(
  resolve: () => void,
  reject: (err: Error) => void,
  timeout: number
): void {
  const startTime = Date.now()

  const checkReady = () => {
    if (isOpenCVReady()) {
      resolve()
      return
    }

    if (Date.now() - startTime > timeout) {
      reject(new Error(`OpenCV.js initialization timed out after ${timeout}ms`))
      return
    }

    const win = window as unknown as WindowWithOpenCV
    if (win.cv) {
      // OpenCV object exists but not fully initialized - hook into callback
      const previousCallback = win.cv.onRuntimeInitialized
      win.cv.onRuntimeInitialized = () => {
        previousCallback?.()
        resolve()
      }
    } else {
      // Keep polling
      setTimeout(checkReady, 100)
    }
  }

  checkReady()
}

/**
 * Reset the loader state (for testing)
 */
export function resetOpenCVLoader(): void {
  cvInstance = null
  loadPromise = null
  loadError = null
}
