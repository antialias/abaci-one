#!/usr/bin/env node
/**
 * Capture the /create hub's preview images from the REAL generators.
 *
 * Each image on the hub is an actual artifact — the same Typst/jsPDF/three.js
 * output a user gets when they run the tool — captured once and committed, so
 * the hub costs nothing at runtime. Hand-drawn approximations are not allowed:
 * if a tool's output changes, re-run this script rather than editing pixels.
 *
 *   node scripts/capture-create-previews.mjs            # all
 *   node scripts/capture-create-previews.mjs worksheets calendar
 *
 * Requires the dev server on :3000 (it hosts the real generator routes) plus
 * `typst` and `pdftoppm` on PATH, which those routes shell out to.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'
const OUT_DIR = 'public/images/create-previews'
/** Rendered at 2x the largest on-screen size so the images stay sharp on retina. */
const SCALE = 2

async function postJson(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`)
  return res
}

/**
 * Rasterize an SVG string through Chromium rather than a native converter:
 * Typst output embeds raster `<image>` payloads and relies on real font
 * metrics, both of which resvg/sharp get wrong.
 */
async function svgToPng(browser, svg, widthPx) {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  await page.setContent(
    `<!doctype html><style>
       html,body{margin:0;padding:0;background:#fff}
       svg{display:block;width:${widthPx}px;height:auto}
     </style>${svg}`,
    { waitUntil: 'networkidle' }
  )
  const el = await page.$('svg')
  const png = await el.screenshot({ type: 'png' })
  await page.close()
  return png
}

/** Rasterize page 1 of a PDF buffer. */
async function pdfToPng(pdf) {
  const dir = mkdtempSync(join(tmpdir(), 'create-preview-'))
  try {
    writeFileSync(join(dir, 'doc.pdf'), pdf)
    execFileSync('pdftoppm', [
      '-r',
      '150',
      '-png',
      '-f',
      '1',
      '-l',
      '1',
      join(dir, 'doc.pdf'),
      join(dir, 'page'),
    ])
    return readFileSync(join(dir, 'page-1.png'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Crop with a normalized {left,top,width,height} rect (0–1 of the source). */
async function crop(png, rect) {
  if (!rect) return png
  const img = sharp(png)
  const { width, height } = await img.metadata()
  return img
    .extract({
      left: Math.round(rect.left * width),
      top: Math.round(rect.top * height),
      width: Math.round(rect.width * width),
      height: Math.round(rect.height * height),
    })
    .png()
    .toBuffer()
}

async function writeWebp(name, png, targetWidth) {
  const out = join(OUT_DIR, `${name}.webp`)
  const info = await sharp(png)
    .resize({ width: targetWidth * SCALE, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(out)
  console.log(`  ${out}  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(1)} KB`)
}

const CAPTURES = {
  /** A real generated addition worksheet (Typst → SVG). */
  async worksheets(browser) {
    const res = await postJson('/api/create/worksheets/preview', {
      version: 4,
      mode: 'custom',
      problemsPerPage: 12,
      cols: 4,
      pages: 1,
      orientation: 'landscape',
      name: '',
      date: '',
      rows: 3,
      total: 12,
      digitRange: { min: 2, max: 2 },
      operator: 'addition',
      pAnyStart: 0.6,
      pAllStart: 0,
      interpolate: true,
      displayRules: {
        carryBoxes: 'whenRegrouping',
        answerBoxes: 'always',
        placeValueColors: 'always',
        tenFrames: 'whenRegrouping',
        problemNumbers: 'always',
        cellBorders: 'always',
        borrowNotation: 'whenRegrouping',
        borrowingHints: 'never',
      },
      difficultyProfile: 'earlyLearner',
      fontSize: 16,
      includeAnswerKey: false,
      includeQRCode: false,
      seed: 42,
      prngAlgorithm: 'mulberry32',
    })
    const { pages } = await res.json()
    return { png: await svgToPng(browser, pages[0], 1600), width: 800 }
  },

  /**
   * A real generated flashcard sheet (AbacusStatic → Typst → PDF).
   *
   * Deliberately the PDF route rather than /preview: the preview stamps a
   * "Preview (first 6 cards)" watermark across the sheet, and the hub should
   * show what you get, not what the in-app previewer shows. Two-digit values
   * so the cards exercise more than one rod.
   */
  async flashcards() {
    const res = await postJson('/api/generate', {
      range: '18-88',
      step: 14,
      cardsPerPage: 6,
      paperSize: 'us-letter',
      orientation: 'portrait',
      colorScheme: 'place-value',
      scaleFactor: 0.9,
    })
    return {
      png: await pdfToPng(Buffer.from(await res.arrayBuffer())),
      width: 700,
      // A full portrait sheet shrunk into a landscape card renders the beads
      // too small to read. Crop to the top two rows instead — still the real
      // sheet, just framed close enough to see what a card looks like.
      rect: { left: 0.06, top: 0.02, width: 0.88, height: 0.58 },
    }
  },

  /** A real generated abacus calendar month (Typst → SVG). */
  async calendar(browser) {
    const now = new Date()
    const res = await postJson('/api/create/calendar/preview', {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      format: 'monthly',
    })
    const { svg } = await res.json()
    return {
      png: await svgToPng(browser, svg, 1400),
      width: 700,
      // Month name + the first weeks: enough to read as a calendar of beads.
      rect: { left: 0.06, top: 0.07, width: 0.88, height: 0.52 },
    }
  },

  /**
   * A real generated music flashcard sheet (jsPDF → PDF → PNG).
   *
   * The generator emits notes in ascending order, so page 1 of a wide range is
   * six near-identical below-the-staff cards. The "beginner" preset (middle C
   * up to F, the app's own `NOTE_RANGES.beginner`) fills its first page with
   * notes that actually cross the staff — a truer picture of the deck for the
   * same unmodified generator.
   *
   * Cropped to the sheet's first two rows: a full portrait page next to the
   * landscape calendar made the two secondary cards wildly different heights,
   * leaving a void under the shorter one.
   */
  async musicFlashcards() {
    const res = await postJson('/api/create/music-flashcards', {
      clef: 'treble',
      lowNote: -2,
      highNote: 8,
      layout: '6-up',
      showNoteNames: true,
    })
    return {
      png: await pdfToPng(Buffer.from(await res.arrayBuffer())),
      width: 700,
      rect: { left: 0.05, top: 0.03, width: 0.9, height: 0.62 },
    }
  },

  /** The real 3D model the studio builds, screenshotted from the studio itself. */
  async abacus(browser) {
    const page = await browser.newPage({
      viewport: { width: 1400, height: 900 },
      deviceScaleFactor: 2,
    })
    // NOT `networkidle`: the dev server's HMR socket never lets the network go
    // quiet, so waiting on it burns the whole timeout before the page is ready.
    await page.goto(`${BASE}/create/abacus`, { waitUntil: 'domcontentloaded' })
    // The viewer builds its geometry through OpenSCAD-WASM, then three.js
    // paints it. Wait for a canvas with real backing-store dimensions.
    await page.waitForFunction(
      () => {
        const c = document.querySelector('canvas')
        return c instanceof HTMLCanvasElement && c.width > 100 && c.height > 100
      },
      { timeout: 180_000 }
    )
    // Let the model finish its entry framing before the shutter.
    await page.waitForTimeout(12_000)
    const png = await page.locator('canvas').first().screenshot({ type: 'png' })
    await page.close()
    // The canvas fills a portrait viewport column and carries the studio's own
    // HUD (a hint chip up top, a tris/clearance readout along the bottom).
    // Crop to a 16:10 window around the model, clear of both.
    return {
      png,
      width: 800,
      rect: { left: 0.068, top: 0.287, width: 0.829, height: 0.447 },
    }
  },
}

const only = process.argv.slice(2)
const names = only.length ? only : Object.keys(CAPTURES)

mkdirSync(OUT_DIR, { recursive: true })
const browser = await chromium.launch()
try {
  for (const name of names) {
    const capture = CAPTURES[name]
    if (!capture)
      throw new Error(`Unknown capture "${name}". Known: ${Object.keys(CAPTURES).join(', ')}`)
    console.log(`${name}…`)
    const { png, width, rect } = await capture(browser)
    await writeWebp(name, await crop(png, rect), width)
  }
} finally {
  await browser.close()
}
