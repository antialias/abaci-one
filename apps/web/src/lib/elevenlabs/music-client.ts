/**
 * ElevenLabs Music API client — generates songs from composition plans.
 *
 * Uses the ElevenLabs Music API v1 with composition plan mode for maximum
 * control over personalized lyrics and musical structure.
 */

// ============================================================================
// Types
// ============================================================================

export interface SongSection {
  section_name: string
  positive_local_styles: string[]
  negative_local_styles: string[]
  duration_ms: number
  lines: string[]
}

export interface CompositionPlan {
  positive_global_styles: string[]
  negative_global_styles: string[]
  sections: SongSection[]
}

export interface GenerateMusicRequest {
  compositionPlan: CompositionPlan
}

export interface GenerateMusicResult {
  audioBuffer: Buffer
}

// ============================================================================
// Configuration
// ============================================================================

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io'
const MUSIC_MODEL = 'music_v1'

function getApiKey(): string {
  const key = process.env.ELEVENLABS_MUSIC_API_KEY
  if (!key) {
    throw new Error('ELEVENLABS_MUSIC_API_KEY environment variable is not set')
  }
  return key
}

// ============================================================================
// API Function
// ============================================================================

/**
 * Generate music from a composition plan via ElevenLabs Music API.
 *
 * This is a synchronous API call that blocks for 30-120 seconds while
 * the music is generated. Returns raw MP3 bytes.
 */
export async function generateMusic(request: GenerateMusicRequest): Promise<GenerateMusicResult> {
  const apiKey = getApiKey()

  const body = {
    composition_plan: request.compositionPlan,
    model_id: MUSIC_MODEL,
  }

  const response = await fetch(`${ELEVENLABS_API_BASE}/v1/music`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown')
    const status = response.status

    if (status === 429) {
      throw new ElevenLabsRateLimitError(`ElevenLabs rate limited (${status}): ${text}`, status)
    }

    throw new ElevenLabsApiError(`ElevenLabs API error (${status}): ${text}`, status)
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer())

  return { audioBuffer }
}

// ============================================================================
// Errors
// ============================================================================

export class ElevenLabsApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'ElevenLabsApiError'
  }
}

export class ElevenLabsRateLimitError extends ElevenLabsApiError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode)
    this.name = 'ElevenLabsRateLimitError'
  }
}
