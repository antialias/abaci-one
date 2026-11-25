import { afterEach, describe, expect, it, vi } from 'vitest'
import { elevenLabsApiKey, elevenLabsBaseUrl } from '../config'

describe('elevenLabsBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('defaults to ElevenLabs itself', () => {
    vi.stubEnv('ELEVENLABS_API_BASE_URL', '')
    expect(elevenLabsBaseUrl()).toBe('https://api.elevenlabs.io')
  })

  it("follows ELEVENLABS_API_BASE_URL to the switch proxy's door, without a trailing slash", () => {
    vi.stubEnv('ELEVENLABS_API_BASE_URL', 'http://192.168.86.51:8788/elevenlabs/')
    expect(elevenLabsBaseUrl()).toBe('http://192.168.86.51:8788/elevenlabs')
  })
})

describe('elevenLabsApiKey', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads the proxy login from ELEVENLABS_MUSIC_API_KEY', () => {
    vi.stubEnv('ELEVENLABS_MUSIC_API_KEY', 'login-123')
    expect(elevenLabsApiKey()).toBe('login-123')
  })

  it('throws when the login is missing', () => {
    vi.stubEnv('ELEVENLABS_MUSIC_API_KEY', '')
    expect(() => elevenLabsApiKey()).toThrow(/ELEVENLABS_MUSIC_API_KEY/)
  })
})
