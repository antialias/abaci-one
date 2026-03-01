/**
 * Helper for the OpenAI Realtime Sessions API.
 *
 * Encapsulates the session creation call so both number-line and Euclid
 * API routes can share the same error classification and response parsing.
 */

import type { RealtimeTool } from './types'

export interface CreateRealtimeSessionOptions {
  apiKey: string
  /** OpenAI model ID (default: 'gpt-realtime-1.5') */
  model?: string
  voice: string
  instructions: string
  tools: RealtimeTool[]
  /** Turn detection config (sensible defaults applied) */
  turnDetection?: {
    type: 'server_vad'
    threshold?: number
    prefix_padding_ms?: number
    silence_duration_ms?: number
  }
}

export interface RealtimeSessionResult {
  clientSecret: string
  expiresAt: number
}

export interface RealtimeSessionError {
  message: string
  code: 'quota_exceeded' | 'rate_limited' | 'unavailable'
  status: number
}

/**
 * Create an ephemeral session token for the OpenAI Realtime API.
 * Returns the client secret + expiration, or throws a classified error.
 */
export async function createRealtimeSession(
  options: CreateRealtimeSessionOptions
): Promise<RealtimeSessionResult> {
  const {
    apiKey,
    model = 'gpt-realtime-1.5',
    voice,
    instructions,
    tools,
    turnDetection = {
      type: 'server_vad' as const,
      threshold: 0.8,
      prefix_padding_ms: 300,
      silence_duration_ms: 700,
    },
  } = options

  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      instructions,
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: turnDetection,
      tools,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[realtime/session] OpenAI error:', response.status, errText)

    let code: RealtimeSessionError['code'] = 'unavailable'
    let message = 'Phone calls are unavailable right now. Try again later!'

    try {
      const errBody = JSON.parse(errText)
      const errType = errBody?.error?.type || errBody?.error?.code || ''
      if (/insufficient_quota|quota_exceeded|billing/i.test(errType) || response.status === 429) {
        code = 'quota_exceeded'
        message = 'Phone calls are taking a break right now. Try again later!'
      } else if (/rate_limit/i.test(errType)) {
        code = 'rate_limited'
        message = 'Too many calls right now. Try again in a moment!'
      }
    } catch {
      if (response.status === 429) {
        code = 'quota_exceeded'
        message = 'Phone calls are taking a break right now. Try again later!'
      }
    }

    const err = new Error(message) as Error & { code: string; status: number }
    err.code = code
    err.status = response.status
    throw err
  }

  const data = await response.json()

  return {
    clientSecret: data.client_secret?.value ?? data.client_secret,
    expiresAt: data.client_secret?.expires_at ?? Date.now() / 1000 + 60,
  }
}
