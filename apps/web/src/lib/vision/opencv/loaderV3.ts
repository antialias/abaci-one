'use client'

/**
 * OpenCV.js Loader v3 - NO module-level state, NO type imports.
 * Exactly like the working addScript + waitForCv but combined.
 */

function isReady(): boolean {
  if (typeof window === 'undefined') return false
  const cv = (window as unknown as { cv?: { imread?: unknown } }).cv
  return !!(cv && typeof cv.imread === 'function')
}

function addScript(): void {
  if (typeof window === 'undefined') return
  const existingScript = document.querySelector('script[src="/opencv.js"]')
  if (existingScript) return
  const script = document.createElement('script')
  script.src = '/opencv.js'
  script.async = true
  document.head.appendChild(script)
}

function waitForReady(timeoutMs: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isReady()) {
      resolve()
      return
    }
    const startTime = Date.now()
    const check = () => {
      if (isReady()) {
        resolve()
      } else if (Date.now() - startTime > timeoutMs) {
        reject(new Error('OpenCV.js initialization timed out'))
      } else {
        setTimeout(check, 50)
      }
    }
    check()
  })
}

// NO module-level state - returns fresh each time
export async function loadOpenCVv3(): Promise<unknown> {
  // If already ready, return immediately
  if (isReady()) {
    return (window as unknown as { cv: unknown }).cv
  }

  // Add script and wait
  addScript()
  await waitForReady()
  return (window as unknown as { cv: unknown }).cv
}
