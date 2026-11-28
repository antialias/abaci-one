import { describe, expect, it } from 'vitest'
import { classifySongFailure } from '../classify-failure'

describe('classifySongFailure', () => {
  it('reads a 401 that names no service as the proxy refusing the app', () => {
    const result = classifySongFailure('Request failed (401): unauthorized')
    expect(result.kind).toBe('auth_invalid')
    expect(result.ownerMessage).toContain('LLM_CLAUDE_CODE_API_KEY')
    expect(result.ownerMessage).not.toContain('OpenAI')
    expect(result.userMessage).not.toContain('API')
  })

  it('classifies an ElevenLabs 401 as auth_invalid pointing at ElevenLabs', () => {
    const msg = 'elevenlabs API error (401): unauthorized'
    const result = classifySongFailure(msg)
    expect(result.kind).toBe('auth_invalid')
    expect(result.remediation?.href).toContain('elevenlabs.io')
  })

  it('classifies missing ElevenLabs music config as missing_config', () => {
    const result = classifySongFailure(
      new Error('ELEVENLABS_MUSIC_API_KEY environment variable is not set')
    )
    expect(result.kind).toBe('missing_config')
    expect(result.ownerMessage).toContain('ELEVENLABS_MUSIC_API_KEY')
    expect(result.remediation?.href).toContain('elevenlabs.io')
  })

  it('names Claude Code, not OpenAI, when the claude_code provider is not configured', () => {
    const result = classifySongFailure(
      "Provider 'claude_code' is not configured. Check your environment variables."
    )
    expect(result.kind).toBe('missing_config')
    expect(result.ownerMessage).toContain('LLM_CLAUDE_CODE_API_KEY')
    expect(result.ownerMessage).not.toContain('OpenAI')
  })

  it('reads a missing claude CLI as missing_config', () => {
    const result = classifySongFailure(
      "claude_code provider: Claude Code CLI not found at 'claude' (set LLM_CLAUDE_CODE_CLI_PATH)"
    )
    expect(result.kind).toBe('missing_config')
    expect(result.ownerMessage).toContain('claude CLI')
  })

  it('reads the proxy refusing the client secret as auth_invalid for the proxy', () => {
    const result = classifySongFailure('claude_code API error (401): authentication_failed')
    expect(result.kind).toBe('auth_invalid')
    expect(result.ownerMessage).toContain('switch proxy')
    expect(result.remediation).toBeNull()
  })

  it('reads a Claude usage limit through the proxy as rate_limited', () => {
    const result = classifySongFailure(
      'claude_code API error (429): Claude AI usage limit reached|1790000000'
    )
    expect(result.kind).toBe('rate_limited')
  })

  it('classifies "insufficient credits" as quota_exceeded', () => {
    const result = classifySongFailure(new Error('elevenlabs: insufficient credits available'))
    expect(result.kind).toBe('quota_exceeded')
    expect(result.remediation?.href).toContain('elevenlabs.io')
  })

  it('distinguishes the text model out of quota (429+insufficient_quota) from rate-limit (429 alone)', () => {
    const outOfFunds = classifySongFailure('claude_code API error (429): insufficient_quota')
    const rateLimited = classifySongFailure('claude_code API error (429): Rate limit reached')

    expect(outOfFunds.kind).toBe('quota_exceeded')
    expect(outOfFunds.ownerMessage).toContain('switch proxy')
    expect(outOfFunds.ownerMessage).not.toContain('OpenAI')
    expect(outOfFunds.remediation).toBeNull()

    expect(rateLimited.kind).toBe('rate_limited')
    expect(rateLimited.remediation).toBeNull()
  })

  it('classifies 429 as rate_limited', () => {
    const result = classifySongFailure(
      new Error('Request failed with status 429: too many requests')
    )
    expect(result.kind).toBe('rate_limited')
    expect(result.remediation).toBeNull()
  })

  it('classifies network error as transient', () => {
    const result = classifySongFailure(new Error('connect ETIMEDOUT 1.2.3.4:443'))
    expect(result.kind).toBe('transient')
  })

  it('returns kid-safe message for all sensitive kinds', () => {
    const cases = ['Incorrect API key', 'insufficient credits', 'random gibberish']
    for (const msg of cases) {
      const result = classifySongFailure(msg)
      expect(result.userMessage.toLowerCase()).not.toContain('api')
      expect(result.userMessage.toLowerCase()).not.toContain('key')
      expect(result.userMessage.toLowerCase()).not.toContain('credits')
    }
  })

  it('falls back to unknown for unrecognized errors', () => {
    const result = classifySongFailure(new Error('some weird thing happened'))
    expect(result.kind).toBe('unknown')
    expect(result.ownerMessage).toContain('some weird thing happened')
  })
})
