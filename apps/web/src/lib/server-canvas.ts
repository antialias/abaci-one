/**
 * Server-side canvas factory using @napi-rs/canvas.
 *
 * Registers the bundled Inter font at module load time so that
 * renderNumberLine() can produce identical output in Node.js.
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import path from 'node:path'
import fs from 'node:fs'

// Register Inter Variable font — try multiple paths for dev vs production
const candidates = [
  path.join(process.cwd(), 'src', 'lib', 'fonts', 'Inter-Variable.ttf'),
  path.join(process.cwd(), 'apps', 'web', 'src', 'lib', 'fonts', 'Inter-Variable.ttf'),
]
for (const fontPath of candidates) {
  if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'Inter')
    break
  }
}

/** Font family name to use in server-side Canvas 2D `ctx.font` strings. */
export const SERVER_FONT = 'Inter'

/** Create a server-side Canvas 2D surface backed by @napi-rs/canvas. */
export function createServerCanvas(width: number, height: number) {
  return createCanvas(width, height)
}

export { GlobalFonts }
