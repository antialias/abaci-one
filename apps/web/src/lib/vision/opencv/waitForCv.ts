'use client'

/**
 * Wait for window.cv to be ready using a Promise.
 */
export async function waitForCv(timeoutMs: number = 10000): Promise<boolean> {
  console.log('[waitForCv] waitForCv called')

  if (typeof window === 'undefined') {
    console.log('[waitForCv] window is undefined')
    return false
  }

  // Check if already ready
  const cv = (window as unknown as { cv?: { imread?: unknown } }).cv
  if (cv && typeof cv.imread === 'function') {
    console.log('[waitForCv] already ready')
    return true
  }

  console.log('[waitForCv] not ready, starting to poll')

  // Poll until ready
  return new Promise<boolean>((resolve) => {
    const startTime = Date.now()
    let checkCount = 0

    const check = () => {
      checkCount++
      const cv = (window as unknown as { cv?: { imread?: unknown } }).cv
      const ready = !!(cv && typeof cv.imread === 'function')

      if (checkCount <= 5 || checkCount % 20 === 0) {
        console.log(`[waitForCv] check #${checkCount}, ready=${ready}`)
      }

      if (ready) {
        console.log(`[waitForCv] ready after ${checkCount} checks`)
        resolve(true)
      } else if (Date.now() - startTime > timeoutMs) {
        console.log('[waitForCv] timed out')
        resolve(false)
      } else {
        setTimeout(check, 100)
      }
    }

    check()
  })
}
