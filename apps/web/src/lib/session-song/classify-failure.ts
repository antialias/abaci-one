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

type Remediation = ClassifiedSongFailure['remediation']

/** Who failed, for the owner's message: the music service or the text model (claude_code). */
type FailureSource = 'elevenlabs' | 'claude_code'

const SOURCE_MESSAGES: Record<
  FailureSource,
  { missing: string; auth: string; remediation: Remediation }
> = {
  elevenlabs: {
    missing:
      'Missing ElevenLabs Music API key. Set ELEVENLABS_MUSIC_API_KEY in the app-env Kubernetes secret.',
    auth: 'The ElevenLabs Music API key is invalid. Update ELEVENLABS_MUSIC_API_KEY in the app-env Kubernetes secret.',
    remediation: {
      label: 'ElevenLabs API keys',
      href: 'https://elevenlabs.io/app/settings/api-keys',
    },
  },
  claude_code: {
    missing:
      'Claude Code is not set up: set LLM_CLAUDE_CODE_API_KEY (the switch proxy client secret) and LLM_CLAUDE_CODE_BASE_URL, and check the claude CLI is in the image.',
    auth: "The switch proxy refused the app's client secret. Check LLM_CLAUDE_CODE_API_KEY against the proxy's client secret.",
    remediation: null,
  },
}

function failureSource(lower: string): FailureSource {
  if (
    lower.includes('elevenlabs') ||
    lower.includes('eleven_labs') ||
    lower.includes('music_api')
  ) {
    return 'elevenlabs'
  }
  // Everything else is the text model: every LLM call is claude_code.
  return 'claude_code'
}

export function classifySongFailure(rawError: unknown): ClassifiedSongFailure {
  const message =
    rawError instanceof Error
      ? rawError.message
      : typeof rawError === 'string'
        ? rawError
        : String(rawError ?? '')
  const lower = message.toLowerCase()

  // Missing server configuration — usually an env var omitted from app-env.
  if (
    lower.includes('environment variable is not set') ||
    lower.includes('missing env') ||
    lower.includes('missing environment variable') ||
    lower.includes('elevenlabs_music_api_key') ||
    lower.includes('is not configured') ||
    lower.includes('cli not found')
  ) {
    const source = SOURCE_MESSAGES[failureSource(lower)]
    return {
      kind: 'missing_config',
      userMessage: KID_SAFE_MESSAGE,
      ownerMessage: source.missing,
      remediation: source.remediation,
    }
  }

  // Auth failures — 401 with consistent strings (ElevenLabs, the proxy).
  if (
    lower.includes('401') ||
    lower.includes('incorrect api key') ||
    lower.includes('invalid api key') ||
    lower.includes('invalid_api_key') ||
    lower.includes('unauthorized') ||
    lower.includes('authentication failed') ||
    lower.includes('authentication_failed')
  ) {
    const source = SOURCE_MESSAGES[failureSource(lower)]
    return {
      kind: 'auth_invalid',
      userMessage: KID_SAFE_MESSAGE,
      ownerMessage: source.auth,
      remediation: source.remediation,
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
        : "The switch proxy reports the text model's quota is exhausted. Check the proxy's upstream accounts.",
      remediation: isElevenLabs
        ? { label: 'ElevenLabs billing', href: 'https://elevenlabs.io/app/subscription' }
        : null,
    }
  }

  // Rate limiting — 429 with retry-after.
  if (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
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
