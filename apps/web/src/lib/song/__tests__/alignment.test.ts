import { describe, expect, it } from 'vitest'
import { buildSyncedLyricsModel, type SongLyricsSection } from '../alignment'

const sampleSections: SongLyricsSection[] = [
  { name: 'Verse 1', lines: ['Detective Fern on the case'], durationMs: 5000 },
]

describe('buildSyncedLyricsModel', () => {
  it('parses the ElevenLabs /v1/music/detailed shape (words_timestamps array of objects with start_ms/end_ms)', () => {
    // Captured from a real prod sidecar for song hdb02euco44xtjbq629zy046 —
    // ElevenLabs uses the key `words_timestamps` (plural "words"), with
    // `{word, start_ms, end_ms}` entries.
    const raw = {
      composition_plan: {},
      song_metadata: { title: null },
      words_timestamps: [
        { word: 'Detective', start_ms: 4360, end_ms: 4899 },
        { word: 'Fern', start_ms: 4960, end_ms: 5319 },
        { word: 'on', start_ms: 5380, end_ms: 5559 },
        { word: 'the', start_ms: 5619, end_ms: 5899 },
        { word: 'case', start_ms: 5920, end_ms: 6500 },
      ],
    }

    const model = buildSyncedLyricsModel(sampleSections, raw)
    expect(model.hasAlignment).toBe(true)
    expect(model.sections[0].lines[0].words).not.toBeNull()
    const words = model.sections[0].lines[0].words!
    expect(words).toHaveLength(5)
    expect(words[0]).toMatchObject({ text: 'Detective', startMs: 4360, endMs: 4899 })
    expect(words[4]).toMatchObject({ text: 'case', startMs: 5920, endMs: 6500 })
  })

  it('still parses the parallel-arrays shape (TTS-style sidecar used for local mocks)', () => {
    const raw = {
      words: ['Detective', 'Fern', 'on', 'the', 'case'],
      word_start_times_seconds: [4.36, 4.96, 5.38, 5.619, 5.92],
      word_end_times_seconds: [4.899, 5.319, 5.559, 5.899, 6.5],
    }
    const model = buildSyncedLyricsModel(sampleSections, raw)
    expect(model.hasAlignment).toBe(true)
    const words = model.sections[0].lines[0].words!
    expect(words[0]).toMatchObject({ text: 'Detective', startMs: 4360, endMs: 4899 })
  })

  it('falls back to static lyrics with hasAlignment=false when alignment is missing', () => {
    const model = buildSyncedLyricsModel(sampleSections, null)
    expect(model.hasAlignment).toBe(false)
    expect(model.sections[0].lines[0].words).toBeNull()
    expect(model.sections[0].lines[0].rawText).toBe('Detective Fern on the case')
  })
})
