/**
 * Server-side canvas factory using @napi-rs/canvas.
 *
 * Registers the bundled Inter font at module load time so that
 * renderNumberLine() can produce identical output in Node.js.
 */

import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import path from 'node:path'
import fs from 'node:fs'

// Register Inter Variable font — try multiple paths for dev vs production.
// Also register under system font aliases so that renderNumberLine()'s
// hardcoded "-apple-system, BlinkMacSystemFont, ..." font stack resolves
// to Inter instead of producing garbled glyphs.
const candidates = [
  path.join(process.cwd(), 'src', 'lib', 'fonts', 'Inter-Variable.ttf'),
  path.join(process.cwd(), 'apps', 'web', 'src', 'lib', 'fonts', 'Inter-Variable.ttf'),
]
const FONT_ALIASES = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  'sans-serif',
]
for (const fontPath of candidates) {
  if (fs.existsSync(fontPath)) {
    for (const alias of FONT_ALIASES) {
      GlobalFonts.registerFromPath(fontPath, alias)
    }
    break
  }
}

// Register an emoji font so that emoji characters (🎯, 🌟, etc.) render
// instead of showing NOGLYPH boxes. Try platform-specific paths.
const emojiFontCandidates = [
  // macOS
  '/System/Library/Fonts/Apple Color Emoji.ttc',
  // Linux (common locations)
  '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
  '/usr/share/fonts/noto-emoji/NotoColorEmoji.ttf',
  // Bundled fallback
  path.join(process.cwd(), 'src', 'lib', 'fonts', 'NotoColorEmoji.ttf'),
  path.join(process.cwd(), 'apps', 'web', 'src', 'lib', 'fonts', 'NotoColorEmoji.ttf'),
]
for (const emojiPath of emojiFontCandidates) {
  if (fs.existsSync(emojiPath)) {
    GlobalFonts.registerFromPath(emojiPath, 'Emoji')
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
