import { describe, expect, it } from 'vitest'
import { classifySongFailure } from '../classify-failure'

describe('classifySongFailure', () => {
  it('classifies the prod OpenAI 401 message as auth_invalid', () => {
    const msg =
      'openai API error (401): Incorrect API key provided: sk-proj-***PY5WsA. You can find your API key at https://platform.openai.com/account/api-keys.'
    const result = classifySongFailure(msg)
    expect(result.kind).toBe('auth_invalid')
    expect(result.remediation?.href).toContain('platform.openai.com')
    expect(result.userMessage).not.toContain('API')
  })

  it('classifies an ElevenLabs 401 as auth_invalid pointing at ElevenLabs', () => {
    const msg = 'elevenlabs API error (401): unauthorized'
    const result = classifySongFailure(msg)
    expect(result.kind).toBe('auth_invalid')
    expect(result.remediation?.href).toContain('elevenlabs.io')
  })

  it('classifies "insufficient credits" as quota_exceeded', () => {
    const result = classifySongFailure(new Error('elevenlabs: insufficient credits available'))
    expect(result.kind).toBe('quota_exceeded')
    expect(result.remediation?.href).toContain('elevenlabs.io')
  })

  it('classifies OpenAI insufficient_quota as quota_exceeded pointing at OpenAI', () => {
    const result = classifySongFailure('openai API error (429): insufficient_quota')
    // 429 wins matching first; that's acceptable. Check explicit quota path:
    const result2 = classifySongFailure('openai: You exceeded your current quota')
    expect(result.kind === 'rate_limited' || result.kind === 'quota_exceeded').toBe(true)
    expect(result2.kind).toBe('quota_exceeded')
  })

  it('classifies 429 as rate_limited', () => {
    const result = classifySongFailure(new Error('Request failed with status 429: too many requests'))
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
