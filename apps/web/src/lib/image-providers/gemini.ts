import type { ImageProvider } from './types'

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

export const geminiProvider: ImageProvider = {
  meta: {
    id: 'gemini',
    name: 'Google Gemini',
    envKey: 'GEMINI_API_KEY',
    models: [
      { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro' },
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

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
            imageSize: '1K',
          },
        },
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(parseGeminiError(response.status, body))
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
  },
}
