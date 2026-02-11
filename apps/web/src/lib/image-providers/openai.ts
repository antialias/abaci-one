import type { ImageProvider } from './types'

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

  async generate({ model, prompt }): Promise<{ imageBuffer: Buffer }> {
    const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        'No API key configured for OpenAI. Set LLM_OPENAI_API_KEY or OPENAI_API_KEY in your environment.'
      )
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
        size: '1024x1024',
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
