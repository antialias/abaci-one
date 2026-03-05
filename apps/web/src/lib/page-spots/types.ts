/**
 * Page Content Spots — type definitions
 *
 * Each page can have multiple configurable "spots" that display either
 * an AI-generated image, a React component, or captured HTML.
 */

// ---------------------------------------------------------------------------
// Spot config types (persisted in content/page-spots/{pageId}.json)
// ---------------------------------------------------------------------------

export interface GeneratedSpotConfig {
  type: 'generated'
  prompt: string
  provider?: 'gemini' | 'openai'
  model?: string
  /** Focal-point crop — percentages from top-left (0–100) */
  focalPoint?: { x: number; y: number }
}

export interface ComponentSpotConfig {
  type: 'component'
  componentId: string
}

export interface HtmlSpotConfig {
  type: 'html'
  /** URL used to capture the HTML snapshot (for re-capture) */
  captureUrl?: string
  captureMethod?: 'GET' | 'POST'
  captureBody?: unknown
  captureExtractPath?: string
}

export type SpotConfig = GeneratedSpotConfig | ComponentSpotConfig | HtmlSpotConfig

/**
 * Map of spotId → SpotConfig for a single page.
 * Serialised as `content/page-spots/{pageId}.json`.
 */
export type PageSpotConfigMap = Record<string, SpotConfig>

// ---------------------------------------------------------------------------
// Resolved spot (ready to render)
// ---------------------------------------------------------------------------

export interface ResolvedGeneratedSpot {
  type: 'generated'
  config: GeneratedSpotConfig
  imageUrl: string | null
}

export interface ResolvedComponentSpot {
  type: 'component'
  config: ComponentSpotConfig
}

export interface ResolvedHtmlSpot {
  type: 'html'
  config: HtmlSpotConfig
  html: string | null
}

export type ResolvedSpot = ResolvedGeneratedSpot | ResolvedComponentSpot | ResolvedHtmlSpot
