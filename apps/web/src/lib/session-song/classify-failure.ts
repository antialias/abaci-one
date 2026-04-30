import type { SessionSongFailureKind } from '@/db/schema/session-songs'

export interface ClassifiedSongFailure {
  kind: SessionSongFailureKind
  /** Kid-safe one-liner — shown to all viewers regardless of role. */
  userMessage: string
  /** Owner/admin-actionable description — shown only to account owners and admins. */
  ownerMessage: string
  /** Where the owner/admin should go to remediate, if applicable. */
  remediation: { label: string; href: string } | null
}

const KID_SAFE_MESSAGE = "Couldn't make a song this time. A grown-up will help."

export function classifySongFailure(rawError: unknown): ClassifiedSongFailure {
  const message =
    rawError instanceof Error
      ? rawError.message
      : typeof rawError === 'string'
        ? rawError
        : String(rawError ?? '')
  const lower = message.toLowerCase()

  // Auth failures — OpenAI / ElevenLabs return 401 with consistent strings.
  if (
    lower.includes('401') ||
    lower.includes('incorrect api key') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid_api_key') ||
    lower.includes('unauthorized') ||
    lower.includes('authentication failed')
  ) {
    const isElevenLabs = lower.includes('elevenlabs') || lower.includes('eleven_labs')
    return {
      kind: 'auth_invalid',
      userMessage: KID_SAFE_MESSAGE,
      ownerMessage: isElevenLabs
        ? 'The ElevenLabs API key is invalid. Update ELEVENLABS_API_KEY in the app-env Kubernetes secret.'
        : 'The OpenAI API key is invalid. Update LLM_OPENAI_API_KEY in the app-env Kubernetes secret.',
      remediation: isElevenLabs
        ? { label: 'ElevenLabs API keys', href: 'https://elevenlabs.io/app/settings/api-keys' }
        : { label: 'OpenAI API keys', href: 'https://platform.openai.com/account/api-keys' },
    }
  }

  // Quota / credits exhausted — 402 / explicit credit messages.
  if (
    lower.includes('402') ||
    lower.includes('insufficient_quota') ||
    lower.includes('insufficient credits') ||
    lower.includes('insufficient credit') ||
    lower.includes('quota exceeded') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('exceeded your quota') ||
    lower.includes('out of credits') ||
    lower.includes('character limit') ||
    lower.includes('not enough credits') ||
    lower.includes('payment required')
  ) {
    const isElevenLabs =
      lower.includes('elevenlabs') ||
      lower.includes('eleven_labs') ||
      lower.includes('character limit') ||
      lower.includes('credits')
    return {
      kind: 'quota_exceeded',
      userMessage: KID_SAFE_MESSAGE,
      ownerMessage: isElevenLabs
        ? 'ElevenLabs credits are exhausted. Top up your ElevenLabs account.'
        : 'OpenAI quota is exhausted. Top up your OpenAI account.',
      remediation: isElevenLabs
        ? { label: 'ElevenLabs billing', href: 'https://elevenlabs.io/app/subscription' }
        : { label: 'OpenAI billing', href: 'https://platform.openai.com/account/billing' },
    }
  }

  // Rate limiting — 429 with retry-after.
  if (lower.includes('429') || lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      kind: 'rate_limited',
      userMessage: "Couldn't make a song right now. Try again in a few minutes.",
      ownerMessage: 'Hit a provider rate limit. Should clear on its own; retry in a few minutes.',
      remediation: null,
    }
  }

  // Transient — network errors, 5xx, timeouts.
  if (
    lower.includes('etimedout') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('socket hang up') ||
    lower.includes('timeout') ||
    /\b5\d\d\b/.test(lower) // any 5xx status
  ) {
    return {
      kind: 'transient',
      userMessage: "Couldn't make a song this time. Try again later.",
      ownerMessage: 'Transient network or upstream error. Usually clears up on its own.',
      remediation: null,
    }
  }

  return {
    kind: 'unknown',
    userMessage: KID_SAFE_MESSAGE,
    ownerMessage: `Unclassified error: ${message.slice(0, 200)}`,
    remediation: null,
  }
}
