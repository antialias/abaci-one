import { describe, expect, it } from 'vitest'
import { AUDIO_MANIFEST, AUDIO_MANIFEST_MAP } from '../audioManifest'

describe('audioManifest', () => {
  it('has no duplicate IDs', () => {
    const ids = AUDIO_MANIFEST.map((e) => e.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('has no duplicate filenames', () => {
    const filenames = AUDIO_MANIFEST.map((e) => e.filename)
    const uniqueFilenames = new Set(filenames)
    expect(uniqueFilenames.size).toBe(filenames.length)
  })

  it('all filenames end with .mp3', () => {
    for (const entry of AUDIO_MANIFEST) {
      expect(entry.filename).toMatch(/\.mp3$/)
    }
  })

  it('map contains all entries', () => {
    expect(Object.keys(AUDIO_MANIFEST_MAP).length).toBe(AUDIO_MANIFEST.length)
  })

  it('has all required operator clips', () => {
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('operator-plus')
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('operator-minus')
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('operator-equals')
  })

  it('has all required feedback clips', () => {
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('feedback-correct')
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('feedback-great-job')
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('feedback-the-answer-is')
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('feedback-try-again')
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('feedback-nice-work')
    expect(AUDIO_MANIFEST_MAP).toHaveProperty('feedback-keep-going')
  })
})
