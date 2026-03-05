import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { imageExists } from '../image-storage'
import type { PageSpotConfigMap, SpotConfig } from './types'

const CONTENT_DIR = join(process.cwd(), 'content', 'page-spots')
const PUBLIC_DIR = join(process.cwd(), 'public', 'page-spots')

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/** Load the config map for a page (returns {} if no file) */
export function loadPageSpotConfig(pageId: string): PageSpotConfigMap {
  const filePath = join(CONTENT_DIR, `${pageId}.json`)
  if (!existsSync(filePath)) return {}
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as PageSpotConfigMap
  } catch {
    return {}
  }
}

/** Load a single spot config */
export function loadSpotConfig(pageId: string, spotId: string): SpotConfig | undefined {
  return loadPageSpotConfig(pageId)[spotId]
}

/** Load HTML content for an html-type spot */
export function loadSpotHtml(pageId: string, spotId: string): string | null {
  const filePath = join(CONTENT_DIR, pageId, `${spotId}.html`)
  if (!existsSync(filePath)) return null
  return readFileSync(filePath, 'utf8')
}

/** Check if a generated image exists for a spot */
export function spotImageExists(pageId: string, spotId: string): boolean {
  return imageExists({ type: 'static', relativePath: `page-spots/${pageId}/${spotId}.png` })
}

/** Get the public URL for a spot image */
export function spotImageUrl(pageId: string, spotId: string): string {
  return `/page-spots/${pageId}/${spotId}.png`
}

// ---------------------------------------------------------------------------
// Write helpers (used by API routes)
// ---------------------------------------------------------------------------

/** Save the full config map for a page */
export function savePageSpotConfig(pageId: string, config: PageSpotConfigMap): void {
  if (!existsSync(CONTENT_DIR)) {
    mkdirSync(CONTENT_DIR, { recursive: true })
  }
  const filePath = join(CONTENT_DIR, `${pageId}.json`)
  writeFileSync(filePath, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

/** Save a single spot config (merges into existing page config) */
export function saveSpotConfig(pageId: string, spotId: string, spotConfig: SpotConfig): void {
  const config = loadPageSpotConfig(pageId)
  config[spotId] = spotConfig
  savePageSpotConfig(pageId, config)
}

/** Save HTML content for an html-type spot */
export function saveSpotHtml(pageId: string, spotId: string, html: string): void {
  const dir = join(CONTENT_DIR, pageId)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(join(dir, `${spotId}.html`), html, 'utf8')
}
