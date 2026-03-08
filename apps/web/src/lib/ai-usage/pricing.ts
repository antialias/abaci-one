/**
 * AI model pricing configuration.
 *
 * Prices are applied at query time for cost estimation — NOT stored in the DB.
 * Update this file when provider prices change.
 *
 * All prices in USD.
 */

interface TokenPricing {
  /** Price per 1M input tokens */
  inputPerMillion: number
  /** Price per 1M output tokens */
  outputPerMillion: number
  /** Price per 1M reasoning tokens (if applicable) */
  reasoningPerMillion?: number
}

interface ImagePricing {
  /** Price per image generated */
  perImage: number
}

interface AudioPricing {
  /** Price per minute of audio */
  perMinute: number
}

interface CharacterPricing {
  /** Price per 1M characters */
  perMillionCharacters: number
}

type PricingEntry =
  | { type: 'tokens'; pricing: TokenPricing }
  | { type: 'image'; pricing: ImagePricing }
  | { type: 'audio'; pricing: AudioPricing }
  | { type: 'characters'; pricing: CharacterPricing }

/**
 * Pricing table keyed by `${provider}/${model}` or `${provider}/${apiType}`.
 *
 * When looking up pricing, we try specific model first, then fall back to apiType.
 */
export const PRICING: Record<string, PricingEntry> = {
  // --- OpenAI LLM (Responses API / Chat Completions) ---
  'openai/gpt-5': {
    type: 'tokens',
    pricing: { inputPerMillion: 2, outputPerMillion: 8 },
  },
  'openai/gpt-5.2': {
    type: 'tokens',
    pricing: { inputPerMillion: 2, outputPerMillion: 8, reasoningPerMillion: 8 },
  },
  'openai/gpt-4o-mini': {
    type: 'tokens',
    pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  },

  // --- OpenAI Realtime ---
  'openai/gpt-realtime-1.5': {
    type: 'audio',
    pricing: { perMinute: 0.066 }, // audio input; output is ~$0.132/min
  },

  // --- OpenAI TTS ---
  'openai/gpt-4o-mini-tts': {
    type: 'characters',
    pricing: { perMillionCharacters: 12 },
  },

  // --- OpenAI Image ---
  'openai/gpt-image-1': {
    type: 'image',
    pricing: { perImage: 0.04 }, // varies by quality/size
  },

  // --- OpenAI Embeddings ---
  'openai/text-embedding-3-large': {
    type: 'tokens',
    pricing: { inputPerMillion: 0.13, outputPerMillion: 0 },
  },

  // --- Google Gemini ---
  'gemini/gemini-2.5-flash-image': {
    type: 'image',
    pricing: { perImage: 0.039 },
  },
  'gemini/gemini-3-pro-image-preview': {
    type: 'image',
    pricing: { perImage: 0.039 },
  },

  // --- ElevenLabs ---
  'elevenlabs/music_v1': {
    type: 'audio',
    pricing: { perMinute: 0.3 }, // estimate
  },
}

/**
 * Estimate the cost of a single usage record.
 *
 * Returns null if pricing is not configured for this provider/model.
 */
export function estimateCost(record: {
  provider: string
  model: string
  apiType: string
  inputTokens?: number | null
  outputTokens?: number | null
  reasoningTokens?: number | null
  imageCount?: number | null
  inputCharacters?: number | null
  audioDurationSeconds?: number | null
}): number | null {
  const key = `${record.provider}/${record.model}`
  const entry = PRICING[key]
  if (!entry) return null

  switch (entry.type) {
    case 'tokens': {
      const input = (record.inputTokens ?? 0) / 1_000_000
      const output = (record.outputTokens ?? 0) / 1_000_000
      const reasoning = (record.reasoningTokens ?? 0) / 1_000_000
      return (
        input * entry.pricing.inputPerMillion +
        output * entry.pricing.outputPerMillion +
        reasoning * (entry.pricing.reasoningPerMillion ?? entry.pricing.outputPerMillion)
      )
    }
    case 'image':
      return (record.imageCount ?? 0) * entry.pricing.perImage
    case 'audio':
      return ((record.audioDurationSeconds ?? 0) / 60) * entry.pricing.perMinute
    case 'characters':
      return ((record.inputCharacters ?? 0) / 1_000_000) * entry.pricing.perMillionCharacters
  }
}
