export type RawAlignment = Record<string, unknown>

export interface SongLyricsSection {
  name: string
  lines: string[]
  durationMs: number
  annotations?: string[]
}

export interface SyncedWord {
  text: string
  startMs: number
  endMs: number
}

export interface SyncedLine {
  words: SyncedWord[] | null
  rawText: string
  startMs: number | null
  endMs: number | null
}

export interface SyncedSection {
  name: string
  lines: SyncedLine[]
  startMs: number | null
  endMs: number | null
  fallbackDurationMs: number
  annotations?: string[]
}

export interface SyncedLyricsModel {
  sections: SyncedSection[]
  totalDurationMs: number
  hasAlignment: boolean
}

interface FlatAlignedWord {
  text: string
  startMs: number
  endMs: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function toMs(value: number, fieldName = ''): number {
  if (!Number.isFinite(value)) return 0
  const normalizedName = fieldName.toLowerCase()
  if (normalizedName.includes('ms')) return value
  if (normalizedName.includes('second')) return value * 1000
  return value < 1000 ? value * 1000 : value
}

function tokenizeLine(line: string): string[] {
  return line.split(/\s+/).filter(Boolean)
}

function tryParallelArrays(obj: Record<string, unknown>): FlatAlignedWord[] | null {
  const words = obj.words
  const startEntries: Array<[string, unknown]> = [
    ['word_start_times_seconds', obj.word_start_times_seconds],
    ['word_start_times', obj.word_start_times],
    ['starts', obj.starts],
    ['start_times', obj.start_times],
  ]
  const endEntries: Array<[string, unknown]> = [
    ['word_end_times_seconds', obj.word_end_times_seconds],
    ['word_end_times', obj.word_end_times],
    ['ends', obj.ends],
    ['end_times', obj.end_times],
  ]
  const startEntry = startEntries.find(([, value]) => Array.isArray(value))
  const endEntry = endEntries.find(([, value]) => Array.isArray(value))
  if (!Array.isArray(words) || !startEntry || !endEntry) return null

  const starts = startEntry[1] as unknown[]
  const ends = endEntry[1] as unknown[]
  const result: FlatAlignedWord[] = []
  const length = Math.min(words.length, starts.length, ends.length)
  for (let index = 0; index < length; index += 1) {
    const text = words[index]
    const start = starts[index]
    const end = ends[index]
    if (
      typeof text !== 'string' ||
      typeof start !== 'number' ||
      typeof end !== 'number'
    ) {
      continue
    }
    result.push({
      text,
      startMs: toMs(start, startEntry[0]),
      endMs: toMs(end, endEntry[0]),
    })
  }
  return result
}

function numericField(
  entry: Record<string, unknown>,
  names: string[]
): [string, number] | null {
  for (const name of names) {
    const value = entry[name]
    if (typeof value === 'number') return [name, value]
  }
  return null
}

function tryObjectArray(obj: Record<string, unknown>): FlatAlignedWord[] | null {
  for (const key of ['words_timestamps', 'words', 'word_timestamps', 'lyrics', 'tokens']) {
    const entries = obj[key]
    if (!Array.isArray(entries)) continue

    const result: FlatAlignedWord[] = []
    for (const value of entries) {
      const entry = asRecord(value)
      if (!entry) continue
      const text = [entry.text, entry.word, entry.token].find(
        (candidate): candidate is string => typeof candidate === 'string'
      )
      const start = numericField(entry, [
        'start',
        'start_time',
        'start_seconds',
        'startSeconds',
        'start_ms',
        'startMs',
      ])
      const end = numericField(entry, [
        'end',
        'end_time',
        'end_seconds',
        'endSeconds',
        'end_ms',
        'endMs',
      ])
      if (!text || !start || !end) continue
      result.push({
        text,
        startMs: toMs(start[1], start[0]),
        endMs: toMs(end[1], end[0]),
      })
    }
    if (result.length > 0) return result
  }
  return null
}

function extractFlatWords(raw: RawAlignment | null): FlatAlignedWord[] {
  if (!raw) return []
  const candidates = [raw]
  for (const key of ['alignment', 'song_metadata', 'songMetadata', 'metadata']) {
    const nested = asRecord(raw[key])
    if (nested) candidates.push(nested)
  }
  for (const candidate of candidates) {
    const words = tryParallelArrays(candidate) ?? tryObjectArray(candidate)
    if (words?.length) return words
  }
  return []
}

export function buildSyncedLyricsModel(
  sections: SongLyricsSection[],
  alignment: RawAlignment | null
): SyncedLyricsModel {
  const flatWords = extractFlatWords(alignment)
  const hasAlignment = flatWords.length > 0
  let alignedIndex = 0

  const syncedSections = sections.map((section): SyncedSection => {
    const lines = section.lines.map((rawText): SyncedLine => {
      const canonicalWords = tokenizeLine(rawText)
      if (!hasAlignment || canonicalWords.length === 0) {
        return { words: null, rawText, startMs: null, endMs: null }
      }

      const words = canonicalWords.map((text): SyncedWord => {
        const aligned = flatWords[alignedIndex]
        alignedIndex += 1
        return aligned
          ? { text, startMs: aligned.startMs, endMs: aligned.endMs }
          : { text, startMs: 0, endMs: 0 }
      })
      return {
        words,
        rawText,
        startMs: words[0]?.startMs ?? null,
        endMs: words.at(-1)?.endMs ?? null,
      }
    })

    return {
      name: section.name,
      lines,
      startMs: lines.find((line) => line.startMs !== null)?.startMs ?? null,
      endMs: [...lines].reverse().find((line) => line.endMs !== null)?.endMs ?? null,
      fallbackDurationMs: section.durationMs,
      annotations: section.annotations,
    }
  })

  const alignmentDuration = flatWords.reduce((max, word) => Math.max(max, word.endMs), 0)
  const planDuration = sections.reduce((sum, section) => sum + section.durationMs, 0)
  return {
    sections: syncedSections,
    totalDurationMs: alignmentDuration || planDuration,
    hasAlignment,
  }
}

export interface ActiveLyricLocation {
  sectionIndex: number
  lineIndex: number
  wordIndex: number
}

export function findActiveLocation(
  model: SyncedLyricsModel,
  currentMs: number
): ActiveLyricLocation | null {
  if (!model.hasAlignment) return null

  let active: ActiveLyricLocation | null = null
  for (let sectionIndex = 0; sectionIndex < model.sections.length; sectionIndex += 1) {
    const section = model.sections[sectionIndex]
    for (let lineIndex = 0; lineIndex < section.lines.length; lineIndex += 1) {
      const words = section.lines[lineIndex].words
      if (!words) continue
      for (let wordIndex = 0; wordIndex < words.length; wordIndex += 1) {
        if (currentMs < words[wordIndex].startMs) return active
        active = { sectionIndex, lineIndex, wordIndex }
      }
    }
  }
  return active
}
