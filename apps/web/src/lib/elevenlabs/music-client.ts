/**
 * ElevenLabs Music API client — generates songs from composition plans.
 *
 * Uses the ElevenLabs Music API v1 with composition plan mode for maximum
 * control over personalized lyrics and musical structure.
 *
 * Calls the `/v1/music/detailed` endpoint with `with_timestamps: true` so the
 * response includes word-level alignment for the generated vocals — used to
 * power karaoke-style lyric highlighting in the celebration UI.
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

/**
 * Raw alignment JSON returned by the detailed music endpoint.
 *
 * The exact field names aren't pinned down by the public docs at the time of
 * writing — we keep this as a permissive shape and log the first response so
 * we can lock the schema afterwards.
 */
export type MusicAlignmentJson = Record<string, unknown>

export interface GenerateMusicResult {
  audioBuffer: Buffer
  /** Parsed JSON portion of the multipart response, or null if missing/unparseable. */
  alignment: MusicAlignmentJson | null
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
// Multipart parsing
// ============================================================================

/**
 * Pull the multipart boundary out of a Content-Type header.
 * Returns null if the response isn't multipart.
 */
function parseBoundary(contentType: string | null): string | null {
  if (!contentType) return null
  const match = /boundary=("?)([^";]+)\1/i.exec(contentType)
  return match?.[2] ?? null
}

interface MultipartPart {
  headers: Record<string, string>
  body: Buffer
}

/**
 * Split a multipart/mixed body into its constituent parts.
 *
 * Intentionally lightweight — we only need to find the audio part and the
 * JSON metadata part. No support for nested multiparts or quoted boundaries.
 */
function splitMultipart(buffer: Buffer, boundary: string): MultipartPart[] {
  const delimiter = Buffer.from(`--${boundary}`)
  const parts: MultipartPart[] = []

  let cursor = buffer.indexOf(delimiter)
  if (cursor === -1) return parts

  while (cursor !== -1) {
    const partStart = cursor + delimiter.length
    // Closing boundary is `--<boundary>--` — stop there.
    if (buffer.slice(partStart, partStart + 2).toString() === '--') break

    const nextDelim = buffer.indexOf(delimiter, partStart)
    if (nextDelim === -1) break

    // Each part starts with a CRLF after the boundary, then headers, then
    // a blank line (CRLFCRLF), then the body, ending with CRLF before the
    // next boundary.
    const sectionStart = partStart + 2 // skip the CRLF after boundary
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), sectionStart)
    if (headerEnd === -1 || headerEnd > nextDelim) break

    const headerText = buffer.slice(sectionStart, headerEnd).toString('utf8')
    const headers: Record<string, string> = {}
    for (const line of headerText.split('\r\n')) {
      const idx = line.indexOf(':')
      if (idx > 0) {
        headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim()
      }
    }

    const bodyStart = headerEnd + 4
    const bodyEnd = nextDelim - 2 // strip trailing CRLF
    parts.push({ headers, body: buffer.slice(bodyStart, bodyEnd) })

    cursor = nextDelim
  }

  return parts
}

// ============================================================================
// API Function
// ============================================================================

/**
 * Generate music from a composition plan via ElevenLabs Music API.
 *
 * Calls the detailed endpoint with `with_timestamps: true` so the response
 * carries both the MP3 audio and a JSON metadata blob containing word-level
 * timing data for the sung vocals.
 *
 * Synchronous from the caller's perspective — blocks for 30-120 seconds
 * while the music is generated.
 */
export async function generateMusic(request: GenerateMusicRequest): Promise<GenerateMusicResult> {
  const apiKey = getApiKey()

  const body = {
    composition_plan: request.compositionPlan,
    model_id: MUSIC_MODEL,
    with_timestamps: true,
  }

  const response = await fetch(`${ELEVENLABS_API_BASE}/v1/music/detailed`, {
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

  const contentType = response.headers.get('content-type')
  const raw = Buffer.from(await response.arrayBuffer())
  const boundary = parseBoundary(contentType)

  // Fallback: if the response isn't multipart for some reason, treat the
  // whole body as audio with no alignment data.
  if (!boundary) {
    console.warn(
      '[elevenlabs-music] Detailed endpoint returned non-multipart response',
      { contentType }
    )
    return { audioBuffer: raw, alignment: null }
  }

  const parts = splitMultipart(raw, boundary)
  let audioBuffer: Buffer | null = null
  let alignment: MusicAlignmentJson | null = null

  for (const part of parts) {
    const partContentType = part.headers['content-type'] ?? ''
    if (partContentType.includes('json')) {
      try {
        alignment = JSON.parse(part.body.toString('utf8')) as MusicAlignmentJson
      } catch (err) {
        console.warn('[elevenlabs-music] Failed to parse JSON metadata part:', err)
      }
    } else if (partContentType.startsWith('audio/') || partContentType.includes('mpeg')) {
      audioBuffer = part.body
    }
  }

  if (!audioBuffer) {
    // Last-resort fallback — if we couldn't identify an audio part by header,
    // assume the largest part is the audio.
    const largest = parts.reduce<MultipartPart | null>(
      (acc, part) => (acc && acc.body.length >= part.body.length ? acc : part),
      null
    )
    audioBuffer = largest?.body ?? raw
  }

  // First-response diagnostic: log the top-level keys so we can lock the
  // schema once we know exactly what ElevenLabs sends. Cheap and runs once
  // per song; remove after we've persisted real responses.
  if (alignment && process.env.NODE_ENV !== 'production') {
    console.log(
      '[elevenlabs-music] Alignment JSON top-level keys:',
      Object.keys(alignment)
    )
  }

  return { audioBuffer, alignment }
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
