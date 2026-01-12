'use client'

/**
 * Simple async function - just a delay, no OpenCV.
 * Testing if the freeze is about async functions in general.
 */
export async function simpleDelay(ms: number): Promise<string> {
  console.log('[simpleAsync] simpleDelay called with', ms)
  await new Promise(resolve => setTimeout(resolve, ms))
  console.log('[simpleAsync] delay complete')
  return 'done'
}
