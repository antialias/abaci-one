/**
 * Capture a screenshot from a canvas element, scaled down for transmission.
 *
 * Used by both voice and text chat to send visual context to the AI.
 */
export function captureScreenshot(
  canvas: HTMLCanvasElement,
  width = 512,
  height = 384,
): string | null {
  try {
    const offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height
    const ctx = offscreen.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(canvas, 0, 0, width, height)
    return offscreen.toDataURL('image/png')
  } catch {
    return null
  }
}
