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

/** GPT Image models use different sizes than DALL-E. */
type GptImageSizeString = '1024x1024' | '1024x1536' | '1536x1024' | 'auto'

/** Pick the closest GPT Image size string for a given pixel size. */
function mapSizeToGptImage(size?: ImageOptions['size']): GptImageSizeString {
  if (!size) return 'auto'

  const ratio = size.width / size.height
  if (ratio > 1.2) return '1536x1024' // landscape
  if (ratio < 0.8) return '1024x1536' // portrait
  return '1024x1024' // square-ish
}

export const openaiProvider: ImageProvider = {
  meta: {
    id: 'openai',
    name: 'OpenAI',
    envKey: 'LLM_OPENAI_API_KEY',
    envKeyAlt: 'OPENAI_API_KEY',
    models: [{ id: 'gpt-image-1', name: 'GPT Image 1' }],
  },

  isAvailable(): boolean {
    return !!(process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY)
  },

  async generate({ model, prompt, options, referenceImage }): Promise<{ imageBuffer: Buffer }> {
    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'No API key configured for OpenAI. Set LLM_OPENAI_API_KEY or OPENAI_API_KEY in your environment.'
      )
    }

    const sizeStr = mapSizeToGptImage(options?.size)

    if (referenceImage) {
      // Use the edits endpoint for image-to-image generation
      const formData = new FormData()
      formData.append('model', model)
      formData.append('prompt', prompt)
      formData.append('size', sizeStr)
      formData.append(
        'image',
        new Blob([new Uint8Array(referenceImage)], { type: 'image/png' }),
        'reference.png'
      )

      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
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
    }

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
