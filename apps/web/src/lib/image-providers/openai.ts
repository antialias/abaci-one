import type { ImageOptions, ImageProvider } from './types'

function parseOpenAIError(status: number, body: string): string {
  try {
    const json = JSON.parse(body)
    const message = json?.error?.message || json?.message || json?.error
    if (typeof message === 'string') {
      const clean = message.split('\n')[0].trim()
      return `OpenAI ${status}: ${clean}`
    }
  } catch {
    // Not JSON
  }

  const truncated = body.length > 200 ? body.slice(0, 200) + '...' : body
  return `OpenAI API error ${status}: ${truncated}`
}

type OpenAISizeString = '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024'

/** Pick the closest OpenAI-supported size string for a given pixel size. */
function mapSizeToOpenAI(size?: ImageOptions['size']): OpenAISizeString {
  if (!size) return '1024x1024'

  const presets: Array<{ label: OpenAISizeString; w: number; h: number }> = [
    { label: '256x256', w: 256, h: 256 },
    { label: '512x512', w: 512, h: 512 },
    { label: '1024x1024', w: 1024, h: 1024 },
    { label: '1024x1792', w: 1024, h: 1792 },
    { label: '1792x1024', w: 1792, h: 1024 },
  ]

  let closest = presets[0]
  let bestDist = Infinity
  for (const p of presets) {
    const dist = Math.abs(p.w - size.width) + Math.abs(p.h - size.height)
    if (dist < bestDist) {
      bestDist = dist
      closest = p
    }
  }
  return closest.label
}

export const openaiProvider: ImageProvider = {
  meta: {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'LLM_OPENAI_API_KEY',
    envKeyAlt: 'OPENAI_API_KEY',
    models: [
      { id: 'gpt-image-1', name: 'GPT Image 1' },
    ],
  },

  isAvailable(): boolean {
    return !!(process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY)
  },

  async generate({ model, prompt, options }): Promise<{ imageBuffer: Buffer }> {
    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'No API key configured for OpenAI. Set LLM_OPENAI_API_KEY or OPENAI_API_KEY in your environment.'
      )
    }

    const sizeStr = mapSizeToOpenAI(options?.size)

    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        size: sizeStr,
        n: 1,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(parseOpenAIError(response.status, body))
    }

    const data = await response.json()
    if (!data.data || data.data.length === 0) {
      throw new Error('OpenAI returned no image data')
    }

    return { imageBuffer: Buffer.from(data.data[0].b64_json, 'base64') }
  },
}
