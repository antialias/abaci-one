import { describe, expect, it } from 'vitest'
import { isElevenLabsVoice } from '@/lib/audio/voices'
import { euclidAuthorConfig, euclidConfig, euclidHecklerConfig } from '../euclidConfig'
import { pappusConfig } from '../pappusConfig'

describe('character narration voices', () => {
  it.each([
    ['Euclid (teacher)', euclidConfig],
    ['Euclid (heckler)', euclidHecklerConfig],
    ['Euclid (author)', euclidAuthorConfig],
    ['Pappus', pappusConfig],
  ])('%s narrates in an ElevenLabs voice, so missing lines can be generated', (_, config) => {
    expect(isElevenLabsVoice(config.voice.ttsVoice ?? config.voice.id)).toBe(true)
  })

  it('every Euclid attitude shares one narration voice, distinct from Pappus', () => {
    const euclid = new Set(
      [euclidConfig, euclidHecklerConfig, euclidAuthorConfig].map((c) => c.voice.ttsVoice)
    )
    expect(euclid.size).toBe(1)
    expect(euclid.has(pappusConfig.voice.ttsVoice)).toBe(false)
  })

  it('realtime conversation keeps its OpenAI voice', () => {
    expect(euclidConfig.voice.id).toBe('ash')
    expect(pappusConfig.voice.id).toBe('echo')
  })
})
