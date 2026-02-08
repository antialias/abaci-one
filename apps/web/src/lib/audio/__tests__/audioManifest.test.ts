import { describe, expect, it } from 'vitest'
import { AUDIO_MANIFEST, AUDIO_MANIFEST_MAP } from '../audioManifest'
import { numberToClipIds } from '../numberToClips'

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

  describe('covers all clip IDs numberToClips can produce', () => {
    it('covers numbers 0-20 individually', () => {
      for (let n = 0; n <= 20; n++) {
        const clips = numberToClipIds(n)
        for (const clipId of clips) {
          expect(AUDIO_MANIFEST_MAP).toHaveProperty(clipId)
        }
      }
    })

    it('covers tens 30-90', () => {
      for (let n = 30; n <= 90; n += 10) {
        const clips = numberToClipIds(n)
        for (const clipId of clips) {
          expect(AUDIO_MANIFEST_MAP).toHaveProperty(clipId)
        }
      }
    })

    it('covers numbers with hundreds', () => {
      const testNumbers = [100, 157, 200, 305, 999]
      for (const n of testNumbers) {
        const clips = numberToClipIds(n)
        for (const clipId of clips) {
          expect(AUDIO_MANIFEST_MAP).toHaveProperty(clipId)
        }
      }
    })

    it('covers numbers with thousands', () => {
      const testNumbers = [1000, 1234, 2345, 5000, 9999]
      for (const n of testNumbers) {
        const clips = numberToClipIds(n)
        for (const clipId of clips) {
          expect(AUDIO_MANIFEST_MAP).toHaveProperty(clipId)
        }
      }
    })

    it('covers all possible clip IDs from 0-9999', () => {
      const allClipIds = new Set<string>()
      for (let n = 0; n <= 9999; n++) {
        for (const clipId of numberToClipIds(n)) {
          allClipIds.add(clipId)
        }
      }

      for (const clipId of allClipIds) {
        expect(AUDIO_MANIFEST_MAP, `Missing clip in manifest: ${clipId}`).toHaveProperty(clipId)
      }
    })
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
