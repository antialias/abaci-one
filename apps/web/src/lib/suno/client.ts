/**
 * Suno API Client — wraps sunoapi.org for AI music generation.
 *
 * Uses the third-party proxy at sunoapi.org which provides a REST API
 * for Suno's music generation. Supports callback-based async generation
 * and fallback polling.
 */

// ============================================================================
// Types
// ============================================================================

export interface SunoGenerateRequest {
  lyrics: string
  style: string
  title: string
  callbackUrl?: string
}

export interface SunoGenerateResponse {
  taskId: string
}

export interface SunoTaskStatus {
  status: 'pending' | 'processing' | 'streaming' | 'complete' | 'failed'
  audioUrl?: string
  streamUrl?: string
  duration?: number
  errorMessage?: string
}

/** Shape of the sunoapi.org callback payload */
export interface SunoCallbackPayload {
  callbackType: 'text' | 'first' | 'complete'
  data: Array<{
    id: string
    status: string
    audio_url?: string
    stream_audio_url?: string
    duration?: number
    title?: string
    error_message?: string
  }>
}

// ============================================================================
// Configuration
// ============================================================================

const SUNO_API_BASE = 'https://apibox.erweima.ai'
const SUNO_MODEL = 'V4_5'

function getSunoApiKey(): string {
  const key = process.env.SUNO_API_KEY
  if (!key) {
    throw new Error('SUNO_API_KEY environment variable is not set')
  }
  return key
}

function getSunoWebhookBaseUrl(): string | undefined {
  return process.env.SUNO_WEBHOOK_BASE_URL
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Submit a song generation request to Suno via sunoapi.org.
 *
 * Returns the task ID for tracking. If a callbackUrl is provided (or
 * SUNO_WEBHOOK_BASE_URL is set), Suno will POST status updates to it.
 */
export async function submitSongGeneration(
  request: SunoGenerateRequest
): Promise<SunoGenerateResponse> {
  const apiKey = getSunoApiKey()

  const callbackUrl =
    request.callbackUrl ??
    (getSunoWebhookBaseUrl()
      ? undefined // will be set by the caller with the songId
      : undefined)

  const body = {
    prompt: request.lyrics,
    style: request.style,
    title: request.title,
    customMode: true,
    instrumental: false,
    model: SUNO_MODEL,
    ...(callbackUrl ? { callBackUrl: callbackUrl } : {}),
  }

  const response = await fetch(`${SUNO_API_BASE}/api/v1/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown')
    const status = response.status

    // Rate limit errors
    if (status === 405 || status === 429 || status === 430) {
      throw new SunoRateLimitError(`Suno rate limited (${status}): ${text}`, status)
    }

    throw new SunoApiError(`Suno API error (${status}): ${text}`, status)
  }

  const json = (await response.json()) as {
    code: number
    data: { taskId: string }
    msg?: string
  }

  if (json.code !== 200 || !json.data?.taskId) {
    throw new SunoApiError(`Suno generation failed: ${json.msg ?? 'unknown error'}`, json.code)
  }

  return { taskId: json.data.taskId }
}

/**
 * Poll Suno task status (fallback when webhook doesn't fire).
 */
export async function getSunoTaskStatus(taskId: string): Promise<SunoTaskStatus> {
  const apiKey = getSunoApiKey()

  const response = await fetch(
    `${SUNO_API_BASE}/api/v1/generate/record?taskId=${encodeURIComponent(taskId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  )

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown')
    throw new SunoApiError(
      `Suno status check failed (${response.status}): ${text}`,
      response.status
    )
  }

  const json = (await response.json()) as {
    code: number
    data: {
      status: string
      response?: {
        sunoData?: Array<{
          id: string
          status: string
          audio_url?: string
          stream_audio_url?: string
          duration?: number
          error_message?: string
        }>
      }
    }
  }

  // Map API response to our status type
  const sunoData = json.data?.response?.sunoData?.[0]
  if (!sunoData) {
    return { status: 'pending' }
  }

  switch (sunoData.status) {
    case 'complete':
      return {
        status: 'complete',
        audioUrl: sunoData.audio_url,
        duration: sunoData.duration,
      }
    case 'streaming':
      return {
        status: 'streaming',
        streamUrl: sunoData.stream_audio_url,
      }
    case 'error':
      return {
        status: 'failed',
        errorMessage: sunoData.error_message ?? 'Unknown Suno error',
      }
    default:
      return { status: 'processing' }
  }
}

// ============================================================================
// Errors
// ============================================================================

export class SunoApiError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message)
    this.name = 'SunoApiError'
  }
}

export class SunoRateLimitError extends SunoApiError {
  constructor(message: string, statusCode: number) {
    super(message, statusCode)
    this.name = 'SunoRateLimitError'
  }
}
