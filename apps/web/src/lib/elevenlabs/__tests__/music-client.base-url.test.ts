import { afterEach, describe, expect, it, vi } from 'vitest'
import { elevenLabsBaseUrl } from '../music-client'

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
