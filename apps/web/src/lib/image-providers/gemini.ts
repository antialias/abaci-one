import type { ImageProvider } from './types'

const MAX_RETRIES = 3
const RETRYABLE_STATUSES = new Set([500, 502, 503])

function parseGeminiError(status: number, body: string): string {
  try {
    const json = JSON.parse(body)
    const message = json?.error?.message
    if (typeof message === 'string') {
      const clean = message.split('\n')[0].trim()
      const retryInfo = json?.error?.details?.find(
        (d: Record<string, unknown>) => d?.retryDelay
      )
      const retrySuffix = retryInfo ? ` (retry after ${retryInfo.retryDelay})` : ''
      return `Gemini ${status}: ${clean}${retrySuffix}`
    }
  } catch {
    // Not JSON
  }

  const truncated = body.length > 200 ? body.slice(0, 200) + '...' : body
  return `Gemini API error ${status}: ${truncated}`
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const geminiProvider: ImageProvider = {
  meta: {
    id: 'gemini',
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro' },
      { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
    ],
  },

  isAvailable(): boolean {
    return !!process.env.GEMINI_API_KEY
  },

  async generate({ model, prompt }): Promise<{ imageBuffer: Buffer }> {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('No API key configured for Gemini. Set GEMINI_API_KEY in your environment.')
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const requestBody = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: {
          aspectRatio: '1:1',
          imageSize: '1K',
        },
      },
    })

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s, 8s + jitter
        const delay = (1 << attempt) * 1000 + Math.random() * 1000
        await sleep(delay)
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        lastError = new Error(parseGeminiError(response.status, body))

        if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
          continue
        }
        throw lastError
      }

      const data = await response.json()
      const candidates = data.candidates
      if (!candidates || candidates.length === 0) {
        throw new Error('Gemini returned no candidates')
      }

      for (const part of candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
          return { imageBuffer: Buffer.from(part.inlineData.data, 'base64') }
        }
      }

      throw new Error('Gemini response contained no image data')
    }

    throw lastError ?? new Error('Gemini generation failed after retries')
  },
}
