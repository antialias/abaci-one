'use client'

/**
 * Just adds the script tag - no waiting for initialization.
 */
export function addOpenCVScript(): boolean {
  console.log('[addScript] addOpenCVScript called')

  if (typeof window === 'undefined') {
    console.log('[addScript] window is undefined')
    return false
  }

  const existingScript = document.querySelector('script[src="/opencv.js"]')
  if (existingScript) {
    console.log('[addScript] script already exists')
    return true
  }

  console.log('[addScript] creating script element')
  const script = document.createElement('script')
  script.src = '/opencv.js'
  script.async = true

  console.log('[addScript] appending to head')
  document.head.appendChild(script)

  console.log('[addScript] done')
  return true
}
